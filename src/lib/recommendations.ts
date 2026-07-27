// Decision engine: planting advisor, crop ranking, variety selection, harvest, storage risk
import { COUNTIES, CROPS, MONTH_TO_NUM, getCounty, getCrop, type County, type CropInfo } from './data';
import type { DailyForecast } from './weather';
import type { SoilData } from './soil';
import { getCurrentStage, getGrowthProfile, type CurrentStageResult } from './growthProfiles';

export type PlantingDecision = {
  verdict: 'Plant Now' | 'Wait' | 'Not Recommended';
  plantingWindow: { start: string; end: string; label: string };
  bestWindow: { start: string; end: string; label: string };
  recommendedVariety: string;
  estimatedHarvestDate: string;
  daysToHarvest: number;
  maturityDays: number;
  growthProfileId: string;
  confidence: number;
  confidenceBreakdown: {
    rainfallFit: number;
    soilFit: number;
    timingFit: number;
    zoneFit: number;
    overall: number;
  };
  explanation: string[];
};

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

// Determine current season based on planting month
function currentSeason(plantingMonth: number): 'LR' | 'SR' {
  // Long rains: Mar-Jun, Short rains: Oct-Dec
  if (plantingMonth >= 2 && plantingMonth <= 5) return 'LR';
  if (plantingMonth >= 8 && plantingMonth <= 11) return 'SR';
  // Off-season: pick nearest
  return plantingMonth >= 6 && plantingMonth <= 7 ? 'SR' : 'LR';
}

// Recommend the best planting window for a county based on the KALRO crop
// calendar and the current date. Returns a ~2-week window (start + end dates).
export function recommendPlantingDate(countyName: string): {
  startDate: string;
  endDate: string;
  season: 'LR' | 'SR';
  reason: string;
} {
  const county = getCounty(countyName);
  const today = new Date();
  const todayStr = fmt(today);
  if (!county) {
    return { startDate: todayStr, endDate: fmt(addDays(today, 14)), season: 'LR', reason: 'County unknown — showing a 2-week window from today.' };
  }
  const month = today.getMonth();
  const lrStart = MONTH_TO_NUM[county.longRainsStart];
  const lrEnd = MONTH_TO_NUM[county.longRainsEnd];
  const srStart = MONTH_TO_NUM[county.shortRainsStart];
  const srEnd = MONTH_TO_NUM[county.shortRainsEnd];

  // Are we currently inside a rains window?
  const inLR = month >= lrStart && month <= lrEnd;
  const inSR = month >= srStart && month <= srEnd;

  if (inLR) {
    return {
      startDate: todayStr,
      endDate: fmt(addDays(today, 14)),
      season: 'LR',
      reason: `You are within the long rains window (${county.longRainsStart}–${county.longRainsEnd}). The next 2 weeks are ideal for planting.`,
    };
  }
  if (inSR) {
    return {
      startDate: todayStr,
      endDate: fmt(addDays(today, 14)),
      season: 'SR',
      reason: `You are within the short rains window (${county.shortRainsStart}–${county.shortRainsEnd}). The next 2 weeks are ideal for planting.`,
    };
  }

  // Not in a window — recommend the first 2 weeks of the next upcoming rains.
  const nextLR = new Date(today.getFullYear(), lrStart, 1);
  if (nextLR < today) nextLR.setFullYear(today.getFullYear() + 1);
  const nextSR = new Date(today.getFullYear(), srStart, 1);
  if (nextSR < today) nextSR.setFullYear(today.getFullYear() + 1);

  const nextIsLR = nextLR <= nextSR;
  const target = nextIsLR ? nextLR : nextSR;
  const season = nextIsLR ? 'LR' : 'SR';
  const windowStart = nextIsLR ? county.longRainsStart : county.shortRainsStart;
  const windowEnd = nextIsLR ? county.longRainsEnd : county.shortRainsEnd;

  return {
    startDate: fmt(target),
    endDate: fmt(addDays(target, 14)),
    season,
    reason: `Outside the rains window. The next ${season === 'LR' ? 'long' : 'short'} rains begin in ${windowStart} (window ${windowStart}–${windowEnd}). We recommend planting in the first 2 weeks.`,
  };
}

export function analyzePlanting(input: {
  county: string;
  subCounty?: string;
  crop: string;
  plantingDate?: string; // optional — defaults to recommended date
  variety?: string;
  rainfallForecast?: number; // mm expected next 14 days
  soil?: SoilData; // optional soil data from ISRIC SoilGrids
}): PlantingDecision {
  const county = getCounty(input.county);
  const crop = getCrop(input.crop);
  const explanations: string[] = [];

  if (!county || !crop) {
    return {
      verdict: 'Not Recommended',
      plantingWindow: { start: '', end: '', label: 'Unknown' },
      bestWindow: { start: '', end: '', label: 'Unknown' },
      recommendedVariety: input.variety ?? '',
      estimatedHarvestDate: '',
      daysToHarvest: 0,
      maturityDays: 0,
      growthProfileId: '',
      confidence: 0,
      confidenceBreakdown: { rainfallFit: 0, soilFit: 0, timingFit: 0, zoneFit: 0, overall: 0 },
      explanation: ['County or crop not found in our dataset.'],
    };
  }

  const recommended = recommendPlantingDate(input.county);
  const plantingDateStr = input.plantingDate ?? recommended.startDate;
  if (input.plantingDate == null) {
    explanations.push(recommended.reason);
  }

  const planting = new Date(plantingDateStr);
  const month = planting.getMonth();
  const season = currentSeason(month);

  // 1. Check rainfall zone suitability
  const countyRainfall = county.annualRainfallMm;
  const cropMinRain = crop.minRainfall;
  const cropMaxRain = crop.maxRainfall;
  const seasonRainfall = season === 'LR' ? countyRainfall * 0.6 : countyRainfall * 0.4;

  if (seasonRainfall < cropMinRain) {
    explanations.push(
      `${county.name} receives ~${countyRainfall}mm annually; the ${season === 'LR' ? 'long' : 'short'} rains contribute ~${seasonRainfall.toFixed(0)}mm, below ${crop.name}'s minimum of ${cropMinRain}mm.`
    );
  } else {
    explanations.push(
      `${county.name} (${county.rainfallZone} rainfall zone, ~${countyRainfall}mm/yr) provides sufficient moisture for ${crop.name} (needs ${cropMinRain}-${cropMaxRain}mm).`
    );
  }

  // 2. Check agro-ecological zone
  const zoneMatch = crop.zones.some((z) => county.agroEcologicalZone.includes(z));
  if (zoneMatch) {
    explanations.push(`${county.agroEcologicalZone} is suitable for ${crop.name} (suitable zones: ${crop.zones.join(', ')}).`);
  } else {
    explanations.push(`${county.agroEcologicalZone} is marginal for ${crop.name}. Yield may be lower than optimal.`);
  }

  // 3. Check KALRO crop calendar timing
  const seasonStart = season === 'LR' ? county.longRainsStart : county.shortRainsStart;
  const seasonEnd = season === 'LR' ? county.longRainsEnd : county.shortRainsEnd;
  const startMonth = MONTH_TO_NUM[seasonStart];
  const endMonth = MONTH_TO_NUM[seasonEnd];

  const inWindow = month >= startMonth && month <= endMonth;
  const daysIntoSeason = (month - startMonth) * 30 + planting.getDate();

  if (inWindow) {
    explanations.push(
      `Planting in ${monthName(month)} falls within the ${season === 'LR' ? 'long' : 'short'} rains window (${seasonStart}-${seasonEnd}) per the KALRO crop calendar for ${county.name}.`
    );
  } else if (daysIntoSeason > 0 && daysIntoSeason < 45) {
    explanations.push(
      `Planting in ${monthName(month)} is slightly late for the ${season === 'LR' ? 'long' : 'short'} rains (window ${seasonStart}-${seasonEnd}). A short-maturity variety is recommended.`
    );
  } else if (month < startMonth) {
    explanations.push(
      `Planting in ${monthName(month)} is early. The ${season === 'LR' ? 'long' : 'short'} rains typically begin in ${seasonStart}. Consider waiting.`
    );
  } else {
    explanations.push(
      `Planting in ${monthName(month)} is outside the ${season === 'LR' ? 'long' : 'short'} rains window (${seasonStart}-${seasonEnd}). Not recommended without irrigation.`
    );
  }

  // 4. Rainfall forecast check
  if (input.rainfallForecast != null) {
    if (input.rainfallForecast < 10) {
      explanations.push(`Only ${input.rainfallForecast.toFixed(0)}mm rainfall forecast in the next 14 days — soil may be too dry for germination.`);
    } else if (input.rainfallForecast > 80) {
      explanations.push(`${input.rainfallForecast.toFixed(0)}mm rainfall forecast in the next 14 days — good moisture for establishment.`);
    } else {
      explanations.push(`${input.rainfallForecast.toFixed(0)}mm rainfall forecast in the next 14 days — adequate for planting.`);
    }
  }

  // 5. Variety selection — switch to short maturity if late
  const isLate = !inWindow && daysIntoSeason > 0 && daysIntoSeason < 60;
  const shortVarieties = crop.varieties.filter((v) => v.type === 'short');
  const mediumVarieties = crop.varieties.filter((v) => v.type === 'medium');
  let recommendedVariety = input.variety ?? '';

  if (!recommendedVariety || isLate) {
    if (isLate && shortVarieties.length > 0) {
      const pick = shortVarieties[0];
      recommendedVariety = pick.name;
      explanations.push(
        `Because planting is late, we recommend the short-maturity variety "${pick.name}" (${pick.maturityDays} days) instead of longer varieties. ${pick.notes}.`
      );
    } else if (!recommendedVariety) {
      const pick = (mediumVarieties[0] ?? crop.varieties[0]);
      recommendedVariety = pick.name;
      explanations.push(`Recommended variety: "${pick.name}" (${pick.maturityDays} days to maturity). ${pick.notes}.`);
    }
  } else {
    const v = crop.varieties.find((x) => x.name.toLowerCase() === recommendedVariety.toLowerCase());
    if (v) explanations.push(`Selected variety "${v.name}" matures in ${v.maturityDays} days. ${v.notes}.`);
  }

  // 6. Harvest date
  const chosenVariety = crop.varieties.find((v) => v.name.toLowerCase() === recommendedVariety.toLowerCase());
  const maturityDays = chosenVariety?.maturityDays ?? crop.maturityDays;
  const harvestDate = addDays(planting, maturityDays);
  const daysToHarvest = Math.ceil((harvestDate.getTime() - Date.now()) / 86400000);

  // 7. Verdict and confidence breakdown (computed from sub-scores)
  let verdict: PlantingDecision['verdict'] = 'Plant Now';

  // --- Confidence sub-scores (0-100 each) ---
  // Rainfall fit: how well does the seasonal rainfall match the crop's needs?
  let rainfallFit = 70;
  if (seasonRainfall >= cropMinRain && seasonRainfall <= cropMaxRain) rainfallFit = 95;
  else if (seasonRainfall >= cropMinRain * 0.8) rainfallFit = 75;
  else if (seasonRainfall < cropMinRain) rainfallFit = 35;

  // Soil fit: based on pH and nutrient levels (if soil data available)
  let soilFit = 70;
  if (input.soil) {
    soilFit = 80;
    if (input.soil.ph < 5.5 || input.soil.ph > 7.5) soilFit -= 20;
    if (input.soil.nitrogen < 8) soilFit -= 10;
    if (input.soil.phosphorus < 5) soilFit -= 10;
    if (input.soil.organicCarbon < 10) soilFit -= 10;
    soilFit = Math.max(20, soilFit);
  }

  // Timing fit: how well does the planting date match the crop calendar window?
  let timingFit = 70;
  if (inWindow) timingFit = 95;
  else if (isLate) timingFit = 60;
  else if (month < startMonth) timingFit = 40;
  else timingFit = 30;

  // Zone fit: does the county's agro-ecological zone match the crop?
  const zoneFit = zoneMatch ? 95 : 50;

  // Overall: weighted average
  const overall = Math.round(
    rainfallFit * 0.35 + soilFit * 0.25 + timingFit * 0.25 + zoneFit * 0.15,
  );
  let confidence = overall;

  if (!zoneMatch && seasonRainfall < cropMinRain) {
    verdict = 'Not Recommended';
    confidence = Math.min(confidence, 30);
  } else if (!inWindow && (month < startMonth || daysIntoSeason >= 60)) {
    verdict = 'Wait';
    confidence = Math.min(confidence, 50);
  } else if (isLate) {
    verdict = 'Plant Now';
    confidence = Math.min(confidence, 70);
    explanations.push('Despite late planting, short-maturity varieties can still produce a viable crop.');
  } else if (inWindow && zoneMatch) {
    confidence = Math.max(confidence, 92);
  } else if (inWindow) {
    confidence = Math.max(confidence, 78);
  }

  if (input.rainfallForecast != null && input.rainfallForecast < 10 && verdict === 'Plant Now') {
    verdict = 'Wait';
    confidence = Math.min(confidence, 55);
    explanations.push('With dry conditions forecast, waiting 3-5 days for rainfall will improve germination.');
  }

  const confidenceBreakdown = { rainfallFit, soilFit, timingFit, zoneFit, overall: confidence };

  // Growth profile id for this crop/variety
  const growthProfile = getGrowthProfile(input.crop, recommendedVariety || undefined);
  const growthProfileId = growthProfile ? `${growthProfile.crop}${growthProfile.variety ? ':' + growthProfile.variety : ''}` : input.crop;

  // Soil-based recommendations (from ISRIC SoilGrids)
  if (input.soil) {
    const soil = input.soil;
    explanations.push(`Soil: ${soil.soilType} (pH ${soil.ph.toFixed(1)}, ${soil.organicCarbon.toFixed(1)} g/kg organic carbon, ${soil.nitrogen.toFixed(1)} cg/kg N). Source: ${soil.source}.`);

    if (soil.ph < 5.5) {
      explanations.push(`Soil pH is acidic (${soil.ph.toFixed(1)}). Apply agricultural lime (1-2 t/ha) 2-3 weeks before planting to raise pH for ${crop.name}.`);
      confidence = Math.max(0, confidence - 5);
    } else if (soil.ph > 7.5) {
      explanations.push(`Soil pH is alkaline (${soil.ph.toFixed(1)}). Apply gypsum or organic matter to lower pH for optimal ${crop.name} growth.`);
      confidence = Math.max(0, confidence - 5);
    } else {
      explanations.push(`Soil pH (${soil.ph.toFixed(1)}) is in the suitable range for ${crop.name}.`);
    }

    if (soil.nitrogen < 8) {
      explanations.push(`Low nitrogen in soil — plan 2 splits of urea top-dressing (Week 4 and Week 7).`);
    } else if (soil.nitrogen > 20) {
      explanations.push(`Good nitrogen levels — reduce N fertilizer by 20-30% to avoid lodging and save costs.`);
    }

    if (soil.phosphorus < 5) {
      explanations.push(`Low phosphorus — apply DAP or TSP at planting (50-100 kg/ha) for strong root development.`);
    }

    if (soil.potassium < 0.2) {
      explanations.push(`Low potassium — apply muriate of potash (KCl) at 40-60 kg/ha, especially for root crops.`);
    }

    if (soil.organicCarbon < 10) {
      explanations.push(`Low organic matter — incorporate compost or manure (5-10 t/ha) to improve soil structure and water retention.`);
    }

    if (soil.waterHoldingCapacity < 80) {
      explanations.push(`Low water-holding capacity (${soil.waterHoldingCapacity} mm/m). Mulch heavily and plan for supplemental irrigation during dry spells.`);
    }

    if (soil.drainage.includes('Poorly')) {
      explanations.push(`Soil is poorly drained — plant on ridges or raised beds to prevent waterlogging of ${crop.name}.`);
    } else if (soil.drainage.includes('Excessively')) {
      explanations.push(`Soil drains rapidly — add organic matter and mulch to retain moisture for ${crop.name}.`);
    }
  }

  // Best window
  const windowStart = new Date(planting.getFullYear(), startMonth, 1);
  const windowEnd = new Date(planting.getFullYear(), endMonth, 28);
  const bestWindow = {
    start: fmt(windowStart),
    end: fmt(windowEnd),
    label: `${seasonStart}–${seasonEnd} (${season === 'LR' ? 'Long' : 'Short'} Rains)`,
  };

  return {
    verdict,
    plantingWindow: {
      start: recommended.startDate,
      end: recommended.endDate,
      label: `${fmtDate(recommended.startDate)} – ${fmtDate(recommended.endDate)}`,
    },
    bestWindow,
    recommendedVariety,
    estimatedHarvestDate: fmt(harvestDate),
    daysToHarvest,
    maturityDays,
    growthProfileId,
    confidence,
    confidenceBreakdown,
    explanation: explanations,
  };
}

export type CropRanking = {
  crop: CropInfo;
  score: number;
  reasons: string[];
};

export function recommendCrops(countyName: string, season?: 'LR' | 'SR'): CropRanking[] {
  const county = getCounty(countyName);
  if (!county) return [];

  const now = new Date();
  const s = season ?? currentSeason(now.getMonth());

  const rankings: CropRanking[] = CROPS.map((crop) => {
    const reasons: string[] = [];
    let score = 50;

    // Rainfall match
    const seasonRainfall = s === 'LR' ? county.annualRainfallMm * 0.6 : county.annualRainfallMm * 0.4;
    if (seasonRainfall >= crop.minRainfall && seasonRainfall <= crop.maxRainfall) {
      score += 25;
      reasons.push(`Rainfall match (${seasonRainfall.toFixed(0)}mm in season vs ${crop.minRainfall}-${crop.maxRainfall}mm needed)`);
    } else if (seasonRainfall >= crop.minRainfall * 0.7) {
      score += 10;
      reasons.push(`Marginal rainfall (${seasonRainfall.toFixed(0)}mm available)`);
    } else {
      score -= 15;
      reasons.push(`Insufficient rainfall (${seasonRainfall.toFixed(0)}mm vs ${crop.minRainfall}mm minimum)`);
    }

    // Zone match
    if (crop.zones.some((z) => county.agroEcologicalZone.includes(z))) {
      score += 20;
      reasons.push(`${county.agroEcologicalZone} is suitable`);
    } else {
      score -= 10;
      reasons.push(`Zone mismatch (${county.agroEcologicalZone})`);
    }

    // Season suitability
    if (crop.seasons.includes(s)) {
      score += 5;
      reasons.push(`${s === 'LR' ? 'Long' : 'Short'} rains suitable`);
    }

    // Short-maturity bonus for short rains
    if (s === 'SR' && crop.maturityDays <= 90) {
      score += 8;
      reasons.push(`Short maturity (${crop.maturityDays}d) fits short rains`);
    }

    // Drought tolerance for low rainfall zones
    if (county.rainfallZone === 'Low' && crop.minRainfall <= 300) {
      score += 10;
      reasons.push('Drought tolerant');
    }

    score = Math.max(20, Math.min(99, score));
    return { crop, score, reasons };
  });

  rankings.sort((a, b) => b.score - a.score);
  return rankings;
}

export function recommendVariety(cropName: string, isLate: boolean): {
  variety: string;
  maturityDays: number;
  reason: string;
} {
  const crop = getCrop(cropName);
  if (!crop) return { variety: '', maturityDays: 0, reason: 'Crop not found' };

  if (isLate) {
    const short = crop.varieties.filter((v) => v.type === 'short');
    if (short.length) {
      const v = short[0];
      return {
        variety: v.name,
        maturityDays: v.maturityDays,
        reason: `Planting is late, so we recommend the short-maturity variety "${v.name}" (${v.maturityDays} days). This reduces the risk of the crop running out of rainfall before maturity. ${v.notes}.`,
      };
    }
  }
  const med = crop.varieties.find((v) => v.type === 'medium') ?? crop.varieties[0];
  return {
    variety: med.name,
    maturityDays: med.maturityDays,
    reason: `Recommended variety: "${med.name}" (${med.maturityDays} days). ${med.notes}.`,
  };
}

// Growth stage calculation — delegates to the single source of truth in growthProfiles.ts
export type GrowthStatus = {
  daysAfterPlanting: number;
  currentStage: string | null;
  stageDescription: string | null;
  stageIndex: number;
  remainingDays: number;
  progressPercent: number;
  harvestDate: string;
  isMature: boolean;
  isBeforePlanting: boolean;
  isPastHarvest: boolean;
  maturityDays: number;
};

export function calcGrowthStatus(plantingDate: string, cropName: string, varietyName?: string): GrowthStatus | null {
  const result = getCurrentStage(plantingDate, cropName, varietyName, new Date());
  if (!result) return null;

  return {
    daysAfterPlanting: result.dayInSeason,
    currentStage: result.stageName,
    stageDescription: result.stageDescription,
    stageIndex: result.stageIndex,
    remainingDays: Math.max(0, result.maturityDays - result.dayInSeason),
    progressPercent: result.progressPercent,
    harvestDate: result.harvestDate,
    isMature: result.isPastHarvest,
    isBeforePlanting: result.isBeforePlanting,
    isPastHarvest: result.isPastHarvest,
    maturityDays: result.maturityDays,
  };
}

// Weekly activity generation
export type GeneratedActivity = {
  week: number;
  title: string;
  description: string;
  category: string;
  dueDate: string;
};

export function generateActivities(plantingDate: string, cropName: string): GeneratedActivity[] {
  const crop = getCrop(cropName);
  if (!crop) return [];
  const planting = new Date(plantingDate);
  return crop.weeklyActivities.map((a) => ({
    week: a.week,
    title: a.title,
    description: a.description,
    category: a.category,
    dueDate: fmt(addDays(planting, a.week * 7)),
  }));
}

// Storage risk calculator
export type StorageRiskInput = {
  crop: string;
  drynessLevel: 'fully-dry' | 'mostly-dry' | 'slightly-damp' | 'wet';
  storageMethod: 'hermetic-bag' | 'woven-sack' | 'granary' | 'floor' | 'plastic-bag';
  moistureCondition: 'low' | 'moderate' | 'high';
};

export type StorageRiskResult = {
  riskScore: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  aflatoxinRisk: string;
  spoilageRisk: string;
  advice: string;
};

export function calculateStorageRisk(input: StorageRiskInput): StorageRiskResult {
  let score = 0;
  const advice: string[] = [];

  // Dryness
  const drynessScores: Record<string, number> = {
    'fully-dry': 0,
    'mostly-dry': 15,
    'slightly-damp': 35,
    wet: 60,
  };
  score += drynessScores[input.drynessLevel];
  if (input.drynessLevel === 'wet') advice.push('Dry your crop to 12-13% moisture before storage. Use a moisture meter if available.');
  if (input.drynessLevel === 'slightly-damp') advice.push('Continue drying on tarpaulins in full sun for 2-3 more days before storing.');

  // Storage method
  const methodScores: Record<string, number> = {
    'hermetic-bag': 0,
    'woven-sack': 20,
    granary: 25,
    floor: 40,
    'plastic-bag': 30,
  };
  score += methodScores[input.storageMethod];
  if (input.storageMethod === 'floor') advice.push('Storing on the floor exposes grain to moisture and pests. Use raised pallets and hermetic bags.');
  if (input.storageMethod === 'woven-sack') advice.push('Woven sacks allow pest entry. Consider hermetic (PICS) bags for long-term storage.');
  if (input.storageMethod === 'hermetic-bag') advice.push('Hermetic bags are excellent — they block oxygen and preserve grain quality.');

  // Moisture condition of storage environment
  const moistureScores: Record<string, number> = { low: 0, moderate: 15, high: 35 };
  score += moistureScores[input.moistureCondition];
  if (input.moistureCondition === 'high') advice.push('Storage area is humid. Improve ventilation and use desiccants or raised platforms.');

  // Aflatoxin risk (maize and groundnuts are high-risk)
  const aflatoxinCrops = ['Maize', 'Groundnuts', 'Sorghum', 'Millets'];
  let aflatoxinRisk = 'Low';
  if (aflatoxinCrops.includes(input.crop)) {
    if (score >= 60) aflatoxinRisk = 'High';
    else if (score >= 35) aflatoxinRisk = 'Moderate';
    if (aflatoxinRisk !== 'Low') {
      advice.push(`${input.crop} is prone to aflatoxin. Ensure thorough drying and use hermetic storage to prevent mould growth.`);
    }
  } else {
    if (score >= 70) aflatoxinRisk = 'Moderate';
  }

  // Spoilage risk
  let spoilageRisk = 'Low';
  if (score >= 70) spoilageRisk = 'High';
  else if (score >= 40) spoilageRisk = 'Moderate';
  if (spoilageRisk !== 'Low') {
    advice.push('Spoilage risk is elevated. Inspect stored grain weekly for mould, insects, and odd smells.');
  }

  score = Math.min(100, score);
  let riskLevel: StorageRiskResult['riskLevel'] = 'Low';
  if (score >= 75) riskLevel = 'Severe';
  else if (score >= 50) riskLevel = 'High';
  else if (score >= 25) riskLevel = 'Moderate';

  if (advice.length === 0) advice.push('Your storage conditions look good. Keep the area clean, dry, and pest-free.');

  return {
    riskScore: score,
    riskLevel,
    aflatoxinRisk,
    spoilageRisk,
    advice: advice.join(' '),
  };
}

// Notifications
export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: 'planting' | 'fertilizer' | 'weeding' | 'pest' | 'harvest' | 'storage' | 'weather';
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
};

export function generateNotifications(opts: {
  seasons: { id: string; crop: string; variety: string | null; planting_date: string }[];
  weatherRecs?: { text: string; tone: string }[];
}): NotificationItem[] {
  const notifs: NotificationItem[] = [];

  opts.seasons.forEach((s) => {
    const status = calcGrowthStatus(s.planting_date, s.crop, s.variety ?? undefined);
    if (!status) return;
    const activities = generateActivities(s.planting_date, s.crop);
    const now = new Date();
    const dap = status.daysAfterPlanting;

    activities.forEach((a) => {
      const due = new Date(a.dueDate);
      const daysUntil = Math.ceil((due.getTime() - now.getTime()) / 86400000);
      if (daysUntil >= -3 && daysUntil <= 7) {
        const priority: NotificationItem['priority'] = daysUntil < 0 ? 'high' : daysUntil <= 2 ? 'medium' : 'low';
        notifs.push({
          id: `${s.id}-${a.week}`,
          title: a.title,
          body: `${s.crop} (Week ${a.week}): ${a.description}`,
          type: a.category as NotificationItem['type'],
          dueDate: a.dueDate,
          priority,
        });
      }
    });

    if (status.isMature) {
      notifs.push({
        id: `${s.id}-harvest`,
        title: 'Harvest Ready',
        body: `Your ${s.crop} is ready to harvest. Expected harvest date: ${status.harvestDate}.`,
        type: 'harvest',
        dueDate: status.harvestDate,
        priority: 'high',
      });
    } else if (status.remainingDays <= 14 && status.remainingDays > 0) {
      notifs.push({
        id: `${s.id}-harvest-soon`,
        title: 'Harvest Approaching',
        body: `Your ${s.crop} will be ready in ${status.remainingDays} days. Prepare drying and storage facilities.`,
        type: 'harvest',
        dueDate: status.harvestDate,
        priority: 'high',
      });
    }
  });

  if (opts.weatherRecs) {
    opts.weatherRecs.forEach((r, i) => {
      if (r.tone !== 'good') {
        notifs.push({
          id: `weather-${i}`,
          title: 'Weather Alert',
          body: r.text,
          type: 'weather',
          dueDate: fmt(new Date()),
          priority: r.tone === 'critical' ? 'high' : 'medium',
        });
      }
    });
  }

  notifs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return notifs;
}

// County info for map
export function countyInfo(name: string) {
  const county = getCounty(name);
  if (!county) return null;
  const crops = recommendCrops(name);
  return {
    county,
    topCrops: crops.slice(0, 5),
    allCrops: crops,
  };
}
