// Open-Meteo Climate API integration
// Fetches historical climate statistics to replace hardcoded county climate data.
// Free, no API key: https://open-meteo.com/en/docs/climate-api
//
// We use the archive endpoint to pull 5 years of daily precipitation and
// temperature, then compute monthly averages and detect Kenya's bimodal
// rainy-season pattern (long rains Mar-Jun, short rains Oct-Dec).

import { type County, getCounty } from './data';

export type ClimateStats = {
  annualRainfallMm: number;
  rainfallZone: 'High' | 'Medium' | 'Low';
  monthlyRainfall: number[]; // 12 values, index 0 = Jan
  avgTempMin: number; // °C annual mean of daily min
  avgTempMax: number; // °C annual mean of daily max
  longRainsStart: string; // e.g. 'Mar'
  longRainsEnd: string;
  shortRainsStart: string; // e.g. 'Oct'
  shortRainsEnd: string;
  elevation: number | null;
  source: 'Open-Meteo Climate Archive' | 'Hardcoded Fallback';
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Cache ────────────────────────────────────────────────────────────────────
// Key: rounded lat/lon to 0.1° grid (reduces duplicate calls for nearby farms)
const cache = new Map<string, ClimateStats>();

function cacheKey(lat: number, lon: number): string {
  return `${Math.round(lat * 10) / 10},${Math.round(lon * 10) / 10}`;
}

// ── API call ────────────────────────────────────────────────────────────────
// The Open-Meteo archive API returns daily historical weather data.
// We request 5 years of daily precipitation_sum, temperature_2m_max, temperature_2m_min.

async function fetchClimateArchive(lat: number, lon: number): Promise<{
  daily: {
    time: string[];
    precipitation_sum: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
  elevation: number;
} | null> {
  const endYear = new Date().getFullYear() - 1; // last full year
  const startYear = endYear - 4; // 5 years of data
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min` +
    `&timezone=Africa%2FNairobi`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.daily?.time?.length) return null;
    return {
      daily: json.daily,
      elevation: json.elevation ?? null,
    };
  } catch {
    return null;
  }
}

// ── Analysis functions ──────────────────────────────────────────────────────

function computeMonthlyRainfall(times: string[], precip: number[]): number[] {
  // Accumulate per-month totals across all years, then average
  const monthTotals = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);

  for (let i = 0; i < times.length; i++) {
    const month = new Date(times[i]).getMonth(); // 0-indexed
    const val = precip[i] ?? 0;
    if (val >= 0) {
      monthTotals[month] += val;
      monthCounts[month]++;
    }
  }

  // Average daily rainfall per month, then scale to monthly total (~30 days)
  return monthTotals.map((total, m) => {
    const days = monthCounts[m];
    if (days === 0) return 0;
    const avgDaily = total / days;
    // Use actual average days per month
    const daysInMonth = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
    return Math.round(avgDaily * daysInMonth * 10) / 10;
  });
}

function classifyRainfallZone(annualMm: number): 'High' | 'Medium' | 'Low' {
  if (annualMm > 1200) return 'High';
  if (annualMm >= 700) return 'Medium';
  return 'Low';
}

/**
 * Detect Kenya's bimodal rainfall seasons from monthly averages.
 *
 * Kenya typically has:
 *   - Long rains: March–June (peak April/May)
 *   - Short rains: October–December (peak November)
 *
 * Algorithm:
 *   1. Find the month with peak rainfall in the Mar-Jun window → long rains peak
 *   2. Find the month with peak rainfall in the Sep-Dec window → short rains peak
 *   3. For each peak, expand outward to include months where rainfall > 40% of peak
 */
function detectRainSeasons(monthly: number[]): {
  longRainsStart: string;
  longRainsEnd: string;
  shortRainsStart: string;
  shortRainsEnd: string;
} {
  // Default Kenya pattern
  const defaults = {
    longRainsStart: 'Mar',
    longRainsEnd: 'May',
    shortRainsStart: 'Oct',
    shortRainsEnd: 'Dec',
  };

  if (monthly.length !== 12 || monthly.every((v) => v === 0)) {
    return defaults;
  }

  // Long rains window: search Feb(1) through Jul(6) for peak
  let lrPeak = 2; // March default
  let lrMax = 0;
  for (let m = 1; m <= 6; m++) {
    if (monthly[m] > lrMax) {
      lrMax = monthly[m];
      lrPeak = m;
    }
  }

  // Short rains window: search Aug(7) through Dec(11) for peak
  let srPeak = 10; // November default
  let srMax = 0;
  for (let m = 7; m <= 11; m++) {
    if (monthly[m] > srMax) {
      srMax = monthly[m];
      srPeak = m;
    }
  }

  // Expand around peaks: include months where rainfall > 40% of peak
  const lrThreshold = lrMax * 0.4;
  let lrStart = lrPeak;
  let lrEnd = lrPeak;
  // Expand backward (but not before Jan=0, stay within 0..6)
  while (lrStart > 0 && monthly[lrStart - 1] >= lrThreshold && lrStart - 1 >= 0) lrStart--;
  // Expand forward (but not past Jul=6)
  while (lrEnd < 6 && monthly[lrEnd + 1] >= lrThreshold) lrEnd++;

  const srThreshold = srMax * 0.4;
  let srStart = srPeak;
  let srEnd = srPeak;
  while (srStart > 7 && monthly[srStart - 1] >= srThreshold) srStart--;
  while (srEnd < 11 && monthly[srEnd + 1] >= srThreshold) srEnd++;

  return {
    longRainsStart: MONTH_NAMES[lrStart],
    longRainsEnd: MONTH_NAMES[lrEnd],
    shortRainsStart: MONTH_NAMES[srStart],
    shortRainsEnd: MONTH_NAMES[srEnd],
  };
}

function computeAvgTemps(times: string[], maxTemps: number[], minTemps: number[]): {
  avgTempMin: number;
  avgTempMax: number;
} {
  let sumMin = 0;
  let sumMax = 0;
  let count = 0;
  for (let i = 0; i < times.length; i++) {
    const tMin = minTemps[i];
    const tMax = maxTemps[i];
    if (tMin != null && tMax != null) {
      sumMin += tMin;
      sumMax += tMax;
      count++;
    }
  }
  if (count === 0) return { avgTempMin: 15, avgTempMax: 27 };
  return {
    avgTempMin: Math.round((sumMin / count) * 10) / 10,
    avgTempMax: Math.round((sumMax / count) * 10) / 10,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch climate statistics for a given location.
 * Results are cached in memory by rounded lat/lon.
 * Falls back to hardcoded county data if the API call fails.
 */
export async function fetchClimateStats(lat: number, lon: number, countyName?: string): Promise<ClimateStats> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached) return cached;

  const archive = await fetchClimateArchive(lat, lon);

  if (!archive) {
    // Fallback to hardcoded county data
    return getCountyFallbackClimate(countyName);
  }

  const { daily, elevation } = archive;
  const monthlyRainfall = computeMonthlyRainfall(daily.time, daily.precipitation_sum);
  const annualRainfallMm = Math.round(monthlyRainfall.reduce((a, b) => a + b, 0));
  const rainfallZone = classifyRainfallZone(annualRainfallMm);
  const seasons = detectRainSeasons(monthlyRainfall);
  const temps = computeAvgTemps(daily.time, daily.temperature_2m_max, daily.temperature_2m_min);

  const stats: ClimateStats = {
    annualRainfallMm,
    rainfallZone,
    monthlyRainfall,
    avgTempMin: temps.avgTempMin,
    avgTempMax: temps.avgTempMax,
    ...seasons,
    elevation,
    source: 'Open-Meteo Climate Archive',
  };

  cache.set(key, stats);
  return stats;
}

/**
 * Build a ClimateStats object from the hardcoded county data.
 * Used as a fallback when the Climate API is unavailable.
 */
export function getCountyFallbackClimate(countyName?: string): ClimateStats {
  const MONTH_TO_NUM: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const county: County | undefined = countyName ? getCounty(countyName) : undefined;
  if (!county) {
    return {
      annualRainfallMm: 900,
      rainfallZone: 'Medium',
      monthlyRainfall: [50, 60, 100, 150, 120, 50, 30, 30, 40, 80, 100, 90],
      avgTempMin: 14,
      avgTempMax: 26,
      longRainsStart: 'Mar',
      longRainsEnd: 'May',
      shortRainsStart: 'Oct',
      shortRainsEnd: 'Dec',
      elevation: null,
      source: 'Hardcoded Fallback',
    };
  }

  // Synthesize monthly rainfall from the county's annual total and known season windows
  // Distribute ~60% to long rains, ~30% to short rains, ~10% dry months
  const lrStart = MONTH_TO_NUM[county.longRainsStart] ?? 2;
  const lrEnd = MONTH_TO_NUM[county.longRainsEnd] ?? 4;
  const srStart = MONTH_TO_NUM[county.shortRainsStart] ?? 9;
  const srEnd = MONTH_TO_NUM[county.shortRainsEnd] ?? 11;

  const lrMonths = lrEnd - lrStart + 1;
  const srMonths = srEnd - srStart + 1;
  const dryMonths = 12 - lrMonths - srMonths;

  const lrShare = county.annualRainfallMm * 0.6;
  const srShare = county.annualRainfallMm * 0.3;
  const dryShare = county.annualRainfallMm * 0.1;

  const monthly = new Array(12).fill(0);
  for (let m = 0; m < 12; m++) {
    if (m >= lrStart && m <= lrEnd) {
      monthly[m] = Math.round(lrShare / lrMonths);
    } else if (m >= srStart && m <= srEnd) {
      monthly[m] = Math.round(srShare / srMonths);
    } else if (dryMonths > 0) {
      monthly[m] = Math.round(dryShare / dryMonths);
    }
  }

  return {
    annualRainfallMm: county.annualRainfallMm,
    rainfallZone: county.rainfallZone,
    monthlyRainfall: monthly,
    avgTempMin: 14,
    avgTempMax: 26,
    longRainsStart: county.longRainsStart,
    longRainsEnd: county.longRainsEnd,
    shortRainsStart: county.shortRainsStart,
    shortRainsEnd: county.shortRainsEnd,
    elevation: null,
    source: 'Hardcoded Fallback',
  };
}

/**
 * Compute the expected seasonal rainfall for a given season using monthly data.
 */
export function seasonalRainfall(climate: ClimateStats, season: 'LR' | 'SR'): number {
  const MONTH_TO_NUM: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const start = MONTH_TO_NUM[season === 'LR' ? climate.longRainsStart : climate.shortRainsStart] ?? 0;
  const end = MONTH_TO_NUM[season === 'LR' ? climate.longRainsEnd : climate.shortRainsEnd] ?? 0;

  let total = 0;
  for (let m = start; m <= end && m < 12; m++) {
    total += climate.monthlyRainfall[m] ?? 0;
  }
  return Math.round(total);
}

/**
 * Determine the current or next season based on month.
 */
export function currentSeason(month: number): 'LR' | 'SR' {
  if (month >= 2 && month <= 5) return 'LR';
  if (month >= 8 && month <= 11) return 'SR';
  return month >= 6 && month <= 7 ? 'SR' : 'LR';
}
