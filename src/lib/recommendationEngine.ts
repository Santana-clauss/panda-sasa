// Enhanced Recommendation Engine
// Uses live data from Open-Meteo Climate, ISRIC SoilGrids, Open-Meteo Weather,
// and FAO Crop Calendar to produce case-by-case crop recommendations.
//
// This module replaces the hardcoded scoring in recommendations.ts with a
// multi-factor algorithm that uses real climate, soil, and weather data.

import { CROPS, MONTH_TO_NUM, getCounty, getCrop, type CropInfo } from './data';
import { fetchClimateStats, seasonalRainfall, currentSeason, getCountyFallbackClimate, type ClimateStats } from './climate';
import { fetchSoilData, type SoilData } from './soil';
import { fetchWeather, type DailyForecast, type WeatherData } from './weather';
import { fetchCropCalendar, type CropCalendarEntry } from './cropCalendar';
import { getGrowthProfile } from './growthProfiles';

// ── Types ───────────────────────────────────────────────────────────────────

export type DataSources = {
  climate: 'live' | 'fallback';
  soil: 'live' | 'fallback';
  weather: 'live' | 'unavailable';
  faoCalendar: 'live' | 'unavailable';
};

export type ScoreBreakdown = {
  rainfallScore: number;   // 0-100
  soilScore: number;       // 0-100
  temperatureScore: number;// 0-100
  timingScore: number;     // 0-100
  zoneScore: number;       // 0-100
  forecastBonus: number;   // -20 to +20
  overall: number;         // 0-100 final score
};

export type CropRecommendation = {
  crop: CropInfo;
  score: number;
  breakdown: ScoreBreakdown;
  verdict: 'Highly Recommended' | 'Recommended' | 'Marginal' | 'Not Recommended';
  recommendedVariety: string;
  varietyMaturityDays: number;
  plantingWindow: { start: string; end: string; label: string };
  estimatedHarvestDate: string;
  explanations: string[];
};

export type RecommendationInput = {
  lat: number;
  lon: number;
  countyName?: string;
  plantingDate?: string;    // ISO date; defaults to next optimal window
  selectedCrop?: string;    // optional filter to single crop
};

export type RecommendationResult = {
  recommendations: CropRecommendation[];
  climate: ClimateStats;
  soil: SoilData;
  weather: WeatherData | null;
  sources: DataSources;
  season: 'LR' | 'SR';
  plantingWindow: { start: string; end: string };
};

// ── Helper functions ────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function monthName(monthNum: number): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthNum];
}

// ── Scoring Functions ───────────────────────────────────────────────────────

/**
 * Score how well the seasonal rainfall matches a crop's needs.
 * Uses real seasonal rainfall from the climate data.
 */
function scoreRainfall(seasonRain: number, crop: CropInfo, climate: ClimateStats): {
  score: number;
  explanation: string;
} {
  const { minRainfall, maxRainfall } = crop;

  // Perfect fit: seasonal rain is within the crop's range
  if (seasonRain >= minRainfall && seasonRain <= maxRainfall) {
    // Score higher when closer to the midpoint of the ideal range
    const mid = (minRainfall + maxRainfall) / 2;
    const deviation = Math.abs(seasonRain - mid) / (maxRainfall - minRainfall);
    const score = Math.round(95 - deviation * 15); // 80-95 range
    return {
      score,
      explanation: `Seasonal rainfall (~${seasonRain}mm) is ideal for ${crop.name} (needs ${minRainfall}-${maxRainfall}mm). Source: ${climate.source}.`,
    };
  }

  // Marginal: below minimum but within 80%
  if (seasonRain >= minRainfall * 0.8 && seasonRain < minRainfall) {
    const score = Math.round(55 + (seasonRain / minRainfall) * 20);
    return {
      score,
      explanation: `Seasonal rainfall (~${seasonRain}mm) is slightly below ${crop.name}'s minimum of ${minRainfall}mm. Drought-tolerant varieties recommended.`,
    };
  }

  // Above maximum
  if (seasonRain > maxRainfall) {
    const excess = (seasonRain - maxRainfall) / maxRainfall;
    const score = Math.max(30, Math.round(75 - excess * 50));
    return {
      score,
      explanation: `Seasonal rainfall (~${seasonRain}mm) exceeds ${crop.name}'s maximum of ${maxRainfall}mm. Risk of waterlogging and disease.`,
    };
  }

  // Insufficient
  const ratio = seasonRain / minRainfall;
  const score = Math.max(10, Math.round(ratio * 50));
  return {
    score,
    explanation: `Seasonal rainfall (~${seasonRain}mm) is insufficient for ${crop.name} (needs at least ${minRainfall}mm). Irrigation required or choose a drought-tolerant crop.`,
  };
}

/**
 * Score soil suitability for a crop using ISRIC SoilGrids data.
 * Considers pH, nutrients, drainage, and organic carbon.
 */
function scoreSoil(soil: SoilData, crop: CropInfo): {
  score: number;
  explanations: string[];
} {
  const explanations: string[] = [];
  let score = 75; // base score

  // pH match
  const { ph } = soil;
  const { optimalPhMin, optimalPhMax } = crop;
  if (ph >= optimalPhMin && ph <= optimalPhMax) {
    score += 10;
    explanations.push(`Soil pH ${ph.toFixed(1)} is in the optimal range (${optimalPhMin}-${optimalPhMax}) for ${crop.name}.`);
  } else if (ph < optimalPhMin - 0.5) {
    score -= 15;
    explanations.push(`Soil pH ${ph.toFixed(1)} is acidic for ${crop.name} (optimal ${optimalPhMin}-${optimalPhMax}). Apply agricultural lime 2-3 weeks before planting.`);
  } else if (ph > optimalPhMax + 0.5) {
    score -= 15;
    explanations.push(`Soil pH ${ph.toFixed(1)} is alkaline for ${crop.name} (optimal ${optimalPhMin}-${optimalPhMax}). Apply gypsum or organic matter.`);
  } else {
    score += 3;
    explanations.push(`Soil pH ${ph.toFixed(1)} is acceptable for ${crop.name} but outside the optimal range.`);
  }

  // Nitrogen
  if (soil.nitrogen < 8) {
    score -= 10;
    explanations.push(`Low nitrogen (${soil.nitrogen.toFixed(1)} cg/kg). Plan split urea top-dressing (Week 4 and Week 7).`);
  } else if (soil.nitrogen > 15) {
    score += 5;
    explanations.push(`Good nitrogen (${soil.nitrogen.toFixed(1)} cg/kg). Reduce N fertilizer by 20-30% to save costs.`);
  }

  // Phosphorus
  if (soil.phosphorus < 5) {
    score -= 8;
    explanations.push(`Low phosphorus (${soil.phosphorus.toFixed(1)} mg/kg). Apply DAP or TSP at planting (50-100 kg/ha).`);
  } else if (soil.phosphorus > 15) {
    score += 3;
  }

  // Organic carbon
  if (soil.organicCarbon < 10) {
    score -= 8;
    explanations.push(`Low organic carbon (${soil.organicCarbon.toFixed(1)} g/kg). Apply compost or manure (5-10 t/ha).`);
  } else if (soil.organicCarbon > 20) {
    score += 5;
    explanations.push(`Excellent organic carbon (${soil.organicCarbon.toFixed(1)} g/kg) — good soil health.`);
  }

  // Drainage
  if (soil.drainage.includes('Poorly')) {
    score -= 10;
    explanations.push(`Poorly drained soil — plant on ridges or raised beds.`);
  } else if (soil.drainage.includes('Excessively')) {
    // Some crops tolerate this better than others
    const penalty = crop.droughtTolerance > 60 ? 3 : 10;
    score -= penalty;
    explanations.push(`Excessively drained soil — mulch heavily to retain moisture.`);
  }

  // Water-holding capacity
  if (soil.waterHoldingCapacity < 80) {
    const penalty = crop.droughtTolerance > 60 ? 3 : 8;
    score -= penalty;
    explanations.push(`Low water-holding capacity (${soil.waterHoldingCapacity} mm/m). Consider supplemental irrigation during dry spells.`);
  }

  explanations.push(`Soil: ${soil.soilType} (source: ${soil.source}).`);

  return {
    score: Math.max(10, Math.min(100, score)),
    explanations,
  };
}

/**
 * Score temperature suitability using climate average temperatures.
 */
function scoreTemperature(climate: ClimateStats, crop: CropInfo): {
  score: number;
  explanation: string;
} {
  const avgTemp = (climate.avgTempMin + climate.avgTempMax) / 2;
  const { optimalTempMin, optimalTempMax } = crop;

  if (avgTemp >= optimalTempMin && avgTemp <= optimalTempMax) {
    return {
      score: 95,
      explanation: `Average temperature (${climate.avgTempMin.toFixed(0)}-${climate.avgTempMax.toFixed(0)}°C) is ideal for ${crop.name} (optimal ${optimalTempMin}-${optimalTempMax}°C).`,
    };
  }

  if (avgTemp < optimalTempMin) {
    const diff = optimalTempMin - avgTemp;
    const score = Math.max(20, Math.round(90 - diff * 10));
    return {
      score,
      explanation: `Average temperature (${climate.avgTempMin.toFixed(0)}-${climate.avgTempMax.toFixed(0)}°C) is below ${crop.name}'s optimal range. Growth may be slower.`,
    };
  }

  // avgTemp > optimalTempMax
  const diff = avgTemp - optimalTempMax;
  const score = Math.max(20, Math.round(90 - diff * 10));
  return {
    score,
    explanation: `Average temperature (${climate.avgTempMin.toFixed(0)}-${climate.avgTempMax.toFixed(0)}°C) is above ${crop.name}'s optimal range. Heat stress possible.`,
  };
}

/**
 * Score planting timing — how well does the planting date fit the rain season window?
 */
function scoreTiming(climate: ClimateStats, plantingMonth: number, season: 'LR' | 'SR'): {
  score: number;
  explanation: string;
} {
  const seasonStart = MONTH_TO_NUM[season === 'LR' ? climate.longRainsStart : climate.shortRainsStart] ?? 2;
  const seasonEnd = MONTH_TO_NUM[season === 'LR' ? climate.longRainsEnd : climate.shortRainsEnd] ?? 5;
  const seasonLabel = season === 'LR' ? 'long rains' : 'short rains';
  const startName = season === 'LR' ? climate.longRainsStart : climate.shortRainsStart;
  const endName = season === 'LR' ? climate.longRainsEnd : climate.shortRainsEnd;

  const inWindow = plantingMonth >= seasonStart && plantingMonth <= seasonEnd;

  if (inWindow) {
    // Best if at the start of the window
    const posInWindow = plantingMonth - seasonStart;
    const windowLength = seasonEnd - seasonStart + 1;
    const earlyBonus = Math.round(10 - (posInWindow / windowLength) * 15);
    return {
      score: Math.min(100, 90 + earlyBonus),
      explanation: `Planting in ${monthName(plantingMonth)} falls within the ${seasonLabel} window (${startName}–${endName}). Good timing.`,
    };
  }

  // Before the window
  if (plantingMonth < seasonStart) {
    const monthsEarly = seasonStart - plantingMonth;
    if (monthsEarly <= 1) {
      return {
        score: 70,
        explanation: `Planting in ${monthName(plantingMonth)} is slightly early. The ${seasonLabel} start in ${startName}.`,
      };
    }
    return {
      score: Math.max(15, 55 - monthsEarly * 10),
      explanation: `Planting in ${monthName(plantingMonth)} is ${monthsEarly} months before the ${seasonLabel} (${startName}–${endName}). Consider waiting.`,
    };
  }

  // After the window
  const monthsLate = plantingMonth - seasonEnd;
  if (monthsLate <= 1) {
    return {
      score: 55,
      explanation: `Planting in ${monthName(plantingMonth)} is slightly late for the ${seasonLabel}. Choose a short-maturity variety.`,
    };
  }
  return {
    score: Math.max(10, 40 - monthsLate * 12),
    explanation: `Planting in ${monthName(plantingMonth)} is outside the ${seasonLabel} window (${startName}–${endName}). Not recommended without irrigation.`,
  };
}

/**
 * Score agro-ecological zone compatibility.
 * Uses elevation from climate/weather data when available.
 */
function scoreZone(crop: CropInfo, county: ReturnType<typeof getCounty>, elevation: number | null): {
  score: number;
  explanation: string;
} {
  // Check if the county's AEZ matches the crop's preferred zones
  const zoneMatch = county
    ? crop.zones.some((z) => county.agroEcologicalZone.includes(z))
    : false;

  // Check altitude fit if elevation data is available
  let altitudeMatch = true;
  let altitudeExplanation = '';
  if (elevation != null) {
    if (elevation < crop.altitudeMin || elevation > crop.altitudeMax) {
      altitudeMatch = false;
      altitudeExplanation = ` Elevation (${Math.round(elevation)}m) is outside ${crop.name}'s range (${crop.altitudeMin}-${crop.altitudeMax}m).`;
    }
  }

  if (zoneMatch && altitudeMatch) {
    return {
      score: 95,
      explanation: `${county?.agroEcologicalZone ?? 'Zone'} is well-suited for ${crop.name}.${elevation != null ? ` Elevation: ${Math.round(elevation)}m.` : ''}`,
    };
  }
  if (zoneMatch && !altitudeMatch) {
    return {
      score: 60,
      explanation: `${county?.agroEcologicalZone ?? 'Zone'} is suitable but${altitudeExplanation}`,
    };
  }
  if (!zoneMatch && altitudeMatch) {
    return {
      score: 50,
      explanation: `${county?.agroEcologicalZone ?? 'Zone'} is not an ideal zone for ${crop.name} (best in: ${crop.zones.join(', ')}). Yields may be lower.`,
    };
  }
  return {
    score: 30,
    explanation: `${county?.agroEcologicalZone ?? 'Zone'} is a poor match for ${crop.name}.${altitudeExplanation}`,
  };
}

/**
 * Calculate a short-term weather forecast bonus.
 * Positive if conditions favor immediate planting, negative if not.
 */
function forecastBonus(daily: DailyForecast[] | null): {
  bonus: number;
  explanation: string | null;
} {
  if (!daily || daily.length === 0) {
    return { bonus: 0, explanation: null };
  }

  const next3 = daily.slice(0, 3);
  const next7 = daily.slice(0, 7);
  const rain3 = next3.reduce((s, d) => s + d.precipitation, 0);
  const rain7 = next7.reduce((s, d) => s + d.precipitation, 0);

  if (rain3 < 5) {
    return {
      bonus: -15,
      explanation: `Dry conditions forecast (${rain3.toFixed(0)}mm in 3 days). Wait for rainfall before planting for better germination.`,
    };
  }
  if (rain3 >= 15 && rain3 <= 60) {
    return {
      bonus: 10,
      explanation: `Good rainfall forecast (${rain3.toFixed(0)}mm in 3 days). Favorable conditions for planting.`,
    };
  }
  if (rain3 > 60) {
    return {
      bonus: -5,
      explanation: `Heavy rainfall forecast (${rain3.toFixed(0)}mm in 3 days). Risk of seed wash-out. Wait for lighter rains.`,
    };
  }
  if (rain7 > 80) {
    return {
      bonus: 5,
      explanation: `Good weekly rainfall (${rain7.toFixed(0)}mm in 7 days). Adequate moisture for establishment.`,
    };
  }

  return {
    bonus: 0,
    explanation: `Moderate rainfall forecast (${rain3.toFixed(0)}mm in 3 days). Conditions are acceptable for planting.`,
  };
}

/**
 * Select the best variety based on timing and conditions.
 */
function selectVariety(crop: CropInfo, isLate: boolean, lowRainfall: boolean): {
  variety: string;
  maturityDays: number;
  explanation: string;
} {
  const shortVarieties = crop.varieties.filter((v) => v.type === 'short');
  const mediumVarieties = crop.varieties.filter((v) => v.type === 'medium');

  if ((isLate || lowRainfall) && shortVarieties.length > 0) {
    const pick = shortVarieties[0];
    const reason = isLate ? 'late planting' : 'low rainfall';
    return {
      variety: pick.name,
      maturityDays: pick.maturityDays,
      explanation: `Recommended short-maturity variety "${pick.name}" (${pick.maturityDays} days) due to ${reason}. ${pick.notes}.`,
    };
  }

  const pick = mediumVarieties[0] ?? crop.varieties[0];
  if (!pick) {
    return { variety: '', maturityDays: crop.maturityDays, explanation: '' };
  }
  return {
    variety: pick.name,
    maturityDays: pick.maturityDays,
    explanation: `Recommended variety: "${pick.name}" (${pick.maturityDays} days). ${pick.notes}.`,
  };
}

/**
 * Determine the optimal planting window from climate data.
 */
function findOptimalPlantingWindow(climate: ClimateStats, season: 'LR' | 'SR'): {
  start: string;
  end: string;
  label: string;
} {
  const today = new Date();
  const startMonth = MONTH_TO_NUM[season === 'LR' ? climate.longRainsStart : climate.shortRainsStart] ?? 2;
  const endMonth = MONTH_TO_NUM[season === 'LR' ? climate.longRainsEnd : climate.shortRainsEnd] ?? 5;
  const seasonLabel = season === 'LR' ? 'Long Rains' : 'Short Rains';

  // Target: first 2 weeks of the rains window
  let windowStart = new Date(today.getFullYear(), startMonth, 1);
  if (windowStart < today) {
    // If we're past the start of this season, check if we're still in window
    if (today.getMonth() <= endMonth) {
      windowStart = today;
    } else {
      // Move to next year
      windowStart = new Date(today.getFullYear() + 1, startMonth, 1);
    }
  }

  const windowEnd = addDays(windowStart, 14);
  const startName = season === 'LR' ? climate.longRainsStart : climate.shortRainsStart;
  const endName = season === 'LR' ? climate.longRainsEnd : climate.shortRainsEnd;

  return {
    start: fmt(windowStart),
    end: fmt(windowEnd),
    label: `${fmtDate(fmt(windowStart))} – ${fmtDate(fmt(windowEnd))} (${seasonLabel}: ${startName}–${endName})`,
  };
}

// ── Main Engine ─────────────────────────────────────────────────────────────

/**
 * Generate crop recommendations using live data from multiple APIs.
 *
 * Pipeline:
 *   1. Fetch live data in parallel (climate, soil, weather, FAO calendar)
 *   2. Determine season and planting window
 *   3. Score each crop on multiple factors
 *   4. Rank and return with explanations
 */
export async function generateRecommendations(input: RecommendationInput): Promise<RecommendationResult> {
  const { lat, lon, countyName, plantingDate, selectedCrop } = input;
  const county = countyName ? getCounty(countyName) : undefined;

  // Step 1: Fetch live data in parallel
  const [climate, soil, weather] = await Promise.all([
    fetchClimateStats(lat, lon, countyName).catch(() => getCountyFallbackClimate(countyName)),
    fetchSoilData(lat, lon, countyName),
    fetchWeather(lat, lon).catch(() => null),
  ]);

  // Track data sources
  const sources: DataSources = {
    climate: climate.source === 'Open-Meteo Climate Archive' ? 'live' : 'fallback',
    soil: soil.source.includes('ISRIC') ? 'live' : 'fallback',
    weather: weather != null ? 'live' : 'unavailable',
    faoCalendar: 'unavailable', // will update below
  };

  // Step 2: Determine season and planting window
  const today = new Date();
  const plantDate = plantingDate ? new Date(plantingDate) : today;
  const plantMonth = plantDate.getMonth();
  const season = currentSeason(plantMonth);
  const seasonRain = seasonalRainfall(climate, season);
  const plantingWindow = findOptimalPlantingWindow(climate, season);

  // Step 3: Determine planting timing context
  const seasonStartMonth = MONTH_TO_NUM[season === 'LR' ? climate.longRainsStart : climate.shortRainsStart] ?? 2;
  const seasonEndMonth = MONTH_TO_NUM[season === 'LR' ? climate.longRainsEnd : climate.shortRainsEnd] ?? 5;
  const inWindow = plantMonth >= seasonStartMonth && plantMonth <= seasonEndMonth;
  const isLate = !inWindow && plantMonth > seasonEndMonth && (plantMonth - seasonEndMonth) <= 2;
  const lowRainfall = seasonRain < 400;

  // Elevation from climate data or weather
  const elevation = climate.elevation ?? weather?.elevation ?? null;

  // Step 4: Score each crop
  const cropsToScore = selectedCrop
    ? CROPS.filter((c) => c.name.toLowerCase() === selectedCrop.toLowerCase())
    : CROPS;

  const recommendations: CropRecommendation[] = [];

  for (const crop of cropsToScore) {
    const explanations: string[] = [];

    // Fetch FAO calendar data for this crop (best-effort)
    let faoEntry: CropCalendarEntry | null = null;
    try {
      faoEntry = await fetchCropCalendar(crop.name, countyName);
      if (faoEntry) sources.faoCalendar = 'live';
    } catch {
      // FAO calendar unavailable — continue without it
    }

    // Score each factor
    const rainfall = scoreRainfall(seasonRain, crop, climate);
    const soilResult = scoreSoil(soil, crop);
    const temperature = scoreTemperature(climate, crop);
    const timing = scoreTiming(climate, plantMonth, season);
    const zone = scoreZone(crop, county ?? undefined, elevation);
    const forecast = forecastBonus(weather?.daily ?? null);

    explanations.push(rainfall.explanation);
    explanations.push(...soilResult.explanations);
    explanations.push(temperature.explanation);
    explanations.push(timing.explanation);
    explanations.push(zone.explanation);
    if (forecast.explanation) explanations.push(forecast.explanation);

    // FAO calendar cross-check
    if (faoEntry) {
      explanations.push(`FAO Crop Calendar confirms ${crop.name} is grown in Kenya (planting: ${faoEntry.plantingStart ?? 'N/A'} to ${faoEntry.plantingEnd ?? 'N/A'}).`);
    }

    // Compute overall score with weighted blend + harmonic mean
    const rainfallScore = rainfall.score;
    const soilScore = soilResult.score;
    const temperatureScore = temperature.score;
    const timingScore = timing.score;
    const zoneScore = zone.score;
    const fBonus = forecast.bonus;

    // Weighted average
    const weightedAvg = rainfallScore * 0.35 + soilScore * 0.25 + temperatureScore * 0.15 + timingScore * 0.15 + zoneScore * 0.10;

    // Harmonic mean — penalizes any single weak factor
    const harmonicMean = 5 / (
      1 / Math.max(1, rainfallScore) +
      1 / Math.max(1, soilScore) +
      1 / Math.max(1, temperatureScore) +
      1 / Math.max(1, timingScore) +
      1 / Math.max(1, zoneScore)
    );

    // Blend and apply forecast bonus
    let overall = Math.round(0.55 * weightedAvg + 0.45 * harmonicMean + fBonus);
    overall = Math.max(5, Math.min(99, overall));

    // Drought tolerance bonus for low-rainfall areas
    if (lowRainfall && crop.droughtTolerance > 60) {
      overall = Math.min(99, overall + Math.round((crop.droughtTolerance - 60) / 5));
      explanations.push(`${crop.name} has good drought tolerance (${crop.droughtTolerance}/100), which is valuable in this low-rainfall area.`);
    }

    // Determine verdict
    let verdict: CropRecommendation['verdict'];
    if (overall >= 80) verdict = 'Highly Recommended';
    else if (overall >= 60) verdict = 'Recommended';
    else if (overall >= 40) verdict = 'Marginal';
    else verdict = 'Not Recommended';

    // Select variety
    const varietyResult = selectVariety(crop, isLate, lowRainfall);
    if (varietyResult.explanation) explanations.push(varietyResult.explanation);

    // Calculate harvest date
    const harvestDate = addDays(plantDate, varietyResult.maturityDays);

    const breakdown: ScoreBreakdown = {
      rainfallScore,
      soilScore,
      temperatureScore,
      timingScore,
      zoneScore,
      forecastBonus: fBonus,
      overall,
    };

    recommendations.push({
      crop,
      score: overall,
      breakdown,
      verdict,
      recommendedVariety: varietyResult.variety,
      varietyMaturityDays: varietyResult.maturityDays,
      plantingWindow,
      estimatedHarvestDate: fmt(harvestDate),
      explanations,
    });
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  return {
    recommendations,
    climate,
    soil,
    weather,
    sources,
    season,
    plantingWindow: { start: plantingWindow.start, end: plantingWindow.end },
  };
}

/**
 * Detailed analysis for a single crop — same as generateRecommendations but
 * returns a single result with richer data. Convenience wrapper.
 */
export async function analyzeSpecificCrop(input: RecommendationInput & { crop: string }): Promise<{
  recommendation: CropRecommendation | null;
  climate: ClimateStats;
  soil: SoilData;
  weather: WeatherData | null;
  sources: DataSources;
  season: 'LR' | 'SR';
}> {
  const result = await generateRecommendations({
    ...input,
    selectedCrop: input.crop,
  });

  return {
    recommendation: result.recommendations[0] ?? null,
    climate: result.climate,
    soil: result.soil,
    weather: result.weather,
    sources: result.sources,
    season: result.season,
  };
}
