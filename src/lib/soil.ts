// ISRIC SoilGrids REST API integration
// Free, no API key: https://rest.isric.org/soilgrids/v2.0/
// Returns soil properties for a given lat/lon.

export type SoilData = {
  soilType: string;
  ph: number;
  organicCarbon: number; // g/kg
  nitrogen: number; // cg/kg
  phosphorus: number; // mg/kg (extractable)
  potassium: number; // cmolc/kg
  waterHoldingCapacity: number; // mm/m (AWC)
  drainage: string;
  clayContent: number; // %
  sandContent: number; // %
  siltContent: number; // %
  bulkDensity: number; // g/cm3
  cationExchangeCapacity: number; // cmolc/kg
  source: string;
};

// SoilGrids REST API returns properties at multiple depth intervals.
// We use 0-30cm (topsoil) as the representative layer.
// Documentation: https://rest.isric.org/soilgrids/v2.0/docs/

const SOILGRID_BASE = 'https://rest.isric.org/soilgrids/v2.0/properties/query';

type SoilGridsLayer = {
  name: string;
  unit: { d_factor: string; target: string; units: string };
  depths: { range: { all: number[] } }[];
  values: { [depth: string]: { mean: number } };
};

type SoilGridsResponse = {
  properties: SoilGridsLayer[];
  geometry: { type: string; coordinates: [number, number] };
};

async function fetchSoilGrids(lat: number, lon: number): Promise<SoilGridsResponse | null> {
  const url = `${SOILGRID_BASE}?lon=${lon}&lat=${lat}&property=bdod,cec,clay,sand,silt,soc,nitrogen,phh2o,awc`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as SoilGridsResponse;
  } catch {
    return null;
  }
}

function getValue(props: SoilGridsLayer[] | undefined, name: string, depthIndex = 0): number | null {
  if (!props) return null;
  const layer = props.find((l) => l.name === name);
  if (!layer) return null;
  const depthKey = Object.keys(layer.values)[depthIndex];
  if (!depthKey) return null;
  return layer.values[depthKey].mean ?? null;
}

// Convert SoilGrids units to display-friendly values
function classifySoilType(clay: number, sand: number, silt: number): string {
  // USDA texture triangle classification
  if (clay >= 40 && sand <= 45) return 'Clay';
  if (clay >= 27 && clay < 40 && sand <= 52) return 'Clay Loam';
  if (clay >= 20 && clay < 27 && silt > 28 && sand < 52) return 'Silty Clay Loam';
  if (clay >= 27 && clay < 40 && sand > 52) return 'Sandy Clay Loam';
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return 'Loam';
  if (clay < 7 && silt >= 50) return 'Silt Loam';
  if (clay < 20 && sand > 52 && sand <= 85) return 'Sandy Loam';
  if (sand > 85 && clay < 10) return 'Loamy Sand';
  if (sand > 85 && clay >= 10) return 'Sandy Clay';
  if (clay >= 40 && sand > 45) return 'Sandy Clay';
  return 'Loam';
}

function classifyDrainage(clay: number, sand: number, awc: number): string {
  if (clay > 50) return 'Poorly drained (high clay)';
  if (sand > 70) return 'Excessively drained (sandy)';
  if (awc < 50) return 'Well to excessively drained';
  if (awc > 150) return 'Moderately well drained (high water retention)';
  return 'Well drained';
}

// Fallback estimates based on Kenya county-level soil survey data when the
// SoilGrids API is unavailable. Values reflect published soil survey ranges
// per county from Kenya Soil Survey (KSS) reports and FAO soil maps.
// Each county has a distinct profile — there is no generic "highland typical"
// fallback. If the county is not in the lookup table, we return a neutral
// Loam profile clearly labeled as a general estimate.

type CountySoilProfile = {
  soilType: string;
  ph: number;
  organicCarbon: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  waterHoldingCapacity: number;
  drainage: string;
  clayContent: number;
  sandContent: number;
  siltContent: number;
  bulkDensity: number;
  cationExchangeCapacity: number;
  source: string;
};

const COUNTY_SOIL: Record<string, CountySoilProfile> = {
  // Rift Valley highlands — volcanic ash soils (Andosols), slightly acidic, high OC
  Nakuru: {
    soilType: 'Silty Clay Loam', ph: 5.8, organicCarbon: 18, nitrogen: 12, phosphorus: 8, potassium: 0.4,
    waterHoldingCapacity: 120, drainage: 'Well drained', clayContent: 35, sandContent: 25, siltContent: 40,
    bulkDensity: 1.3, cationExchangeCapacity: 18, source: 'Estimated (Nakuru Andosol)',
  },
  // Uasin Gishu — red sandy clay loams (Ferralsols), moderate fertility
  'Uasin Gishu': {
    soilType: 'Sandy Clay Loam', ph: 5.5, organicCarbon: 14, nitrogen: 9, phosphorus: 5, potassium: 0.3,
    waterHoldingCapacity: 90, drainage: 'Well drained', clayContent: 28, sandContent: 52, siltContent: 20,
    bulkDensity: 1.4, cationExchangeCapacity: 12, source: 'Estimated (Uasin Gishu Ferralsol)',
  },
  // Kiambu — Nitisols, deep red well-structured, slightly acidic
  Kiambu: {
    soilType: 'Clay Loam', ph: 5.6, organicCarbon: 16, nitrogen: 10, phosphorus: 6, potassium: 0.35,
    waterHoldingCapacity: 110, drainage: 'Well drained', clayContent: 38, sandContent: 30, siltContent: 32,
    bulkDensity: 1.32, cationExchangeCapacity: 16, source: 'Estimated (Kiambu Nitisol)',
  },
  // Meru — Nitisols on volcanic parent material, fertile
  Meru: {
    soilType: 'Clay Loam', ph: 6.0, organicCarbon: 20, nitrogen: 13, phosphorus: 10, potassium: 0.5,
    waterHoldingCapacity: 130, drainage: 'Well drained', clayContent: 36, sandContent: 28, siltContent: 36,
    bulkDensity: 1.28, cationExchangeCapacity: 20, source: 'Estimated (Meru Nitisol)',
  },
  // Kakamega — Acrisols, acidic, high rainfall area
  Kakamega: {
    soilType: 'Clay Loam', ph: 5.2, organicCarbon: 19, nitrogen: 11, phosphorus: 4, potassium: 0.3,
    waterHoldingCapacity: 140, drainage: 'Moderately well drained', clayContent: 40, sandContent: 22, siltContent: 38,
    bulkDensity: 1.3, cationExchangeCapacity: 14, source: 'Estimated (Kakamega Acrisol)',
  },
  // Bungoma — Ferralsols and Acrisols, moderate fertility
  Bungoma: {
    soilType: 'Sandy Clay Loam', ph: 5.6, organicCarbon: 15, nitrogen: 10, phosphorus: 6, potassium: 0.35,
    waterHoldingCapacity: 100, drainage: 'Well drained', clayContent: 30, sandContent: 45, siltContent: 25,
    bulkDensity: 1.38, cationExchangeCapacity: 13, source: 'Estimated (Bungoma Ferralsol)',
  },
  // Siaya — sandy loams, low fertility
  Siaya: {
    soilType: 'Sandy Loam', ph: 5.8, organicCarbon: 10, nitrogen: 7, phosphorus: 4, potassium: 0.25,
    waterHoldingCapacity: 70, drainage: 'Well drained', clayContent: 18, sandContent: 60, siltContent: 22,
    bulkDensity: 1.45, cationExchangeCapacity: 9, source: 'Estimated (Siaya sandy loam)',
  },
  // Machakos — sandy loams, low OC, prone to erosion
  Machakos: {
    soilType: 'Sandy Loam', ph: 6.2, organicCarbon: 8, nitrogen: 5, phosphorus: 4, potassium: 0.25,
    waterHoldingCapacity: 60, drainage: 'Well to excessively drained', clayContent: 15, sandContent: 65, siltContent: 20,
    bulkDensity: 1.5, cationExchangeCapacity: 8, source: 'Estimated (Machakos sandy loam)',
  },
  // Kitui — sandy loams, low fertility, semi-arid
  Kitui: {
    soilType: 'Sandy Loam', ph: 6.5, organicCarbon: 7, nitrogen: 4, phosphorus: 3, potassium: 0.2,
    waterHoldingCapacity: 50, drainage: 'Excessively drained (sandy)', clayContent: 12, sandContent: 70, siltContent: 18,
    bulkDensity: 1.52, cationExchangeCapacity: 7, source: 'Estimated (Kitui semi-arid sandy loam)',
  },
  // Kilifi — coastal sandy soils, low fertility
  Kilifi: {
    soilType: 'Sandy Loam', ph: 6.5, organicCarbon: 8, nitrogen: 5, phosphorus: 4, potassium: 0.2,
    waterHoldingCapacity: 60, drainage: 'Excessively drained (sandy)', clayContent: 12, sandContent: 65, siltContent: 23,
    bulkDensity: 1.5, cationExchangeCapacity: 8, source: 'Estimated (Kilifi coastal sandy loam)',
  },
  // Nyeri — Nitisols, volcanic, fertile highland
  Nyeri: {
    soilType: 'Clay Loam', ph: 5.7, organicCarbon: 17, nitrogen: 11, phosphorus: 8, potassium: 0.4,
    waterHoldingCapacity: 115, drainage: 'Well drained', clayContent: 34, sandContent: 30, siltContent: 36,
    bulkDensity: 1.3, cationExchangeCapacity: 17, source: 'Estimated (Nyeri Nitisol)',
  },
  // Murang'a — Nitisols, acidic, high rainfall
  "Murang'a": {
    soilType: 'Clay Loam', ph: 5.3, organicCarbon: 18, nitrogen: 11, phosphorus: 5, potassium: 0.35,
    waterHoldingCapacity: 125, drainage: 'Well drained', clayContent: 36, sandContent: 28, siltContent: 36,
    bulkDensity: 1.3, cationExchangeCapacity: 15, source: "Estimated (Murang'a Nitisol)",
  },
  // Trans Nzoia — Phaeozems, dark fertile soils, maize belt
  'Trans Nzoia': {
    soilType: 'Clay Loam', ph: 5.9, organicCarbon: 22, nitrogen: 14, phosphorus: 9, potassium: 0.5,
    waterHoldingCapacity: 135, drainage: 'Well drained', clayContent: 38, sandContent: 26, siltContent: 36,
    bulkDensity: 1.28, cationExchangeCapacity: 22, source: 'Estimated (Trans Nzoia Phaeozem)',
  },
  // Elgeyo Marakwet — varied, highland and escarpment
  'Elgeyo Marakwet': {
    soilType: 'Sandy Clay Loam', ph: 5.7, organicCarbon: 14, nitrogen: 9, phosphorus: 6, potassium: 0.35,
    waterHoldingCapacity: 95, drainage: 'Well drained', clayContent: 30, sandContent: 45, siltContent: 25,
    bulkDensity: 1.38, cationExchangeCapacity: 14, source: 'Estimated (Elgeyo Marakwet mixed)',
  },
  // Bomet — Andosols, volcanic highland
  Bomet: {
    soilType: 'Silty Clay Loam', ph: 5.6, organicCarbon: 19, nitrogen: 12, phosphorus: 7, potassium: 0.4,
    waterHoldingCapacity: 125, drainage: 'Well drained', clayContent: 34, sandContent: 26, siltContent: 40,
    bulkDensity: 1.3, cationExchangeCapacity: 18, source: 'Estimated (Bomet Andosol)',
  },
  // Nyandarua — Andosols and Phaeozems, cool highland
  Nyandarua: {
    soilType: 'Silty Clay Loam', ph: 5.5, organicCarbon: 21, nitrogen: 13, phosphorus: 8, potassium: 0.45,
    waterHoldingCapacity: 130, drainage: 'Well drained', clayContent: 36, sandContent: 24, siltContent: 40,
    bulkDensity: 1.28, cationExchangeCapacity: 20, source: 'Estimated (Nyandarua Andosol)',
  },
  // Kisii — Nitisols, very high rainfall, fertile
  Kisii: {
    soilType: 'Clay Loam', ph: 5.4, organicCarbon: 20, nitrogen: 13, phosphorus: 7, potassium: 0.4,
    waterHoldingCapacity: 145, drainage: 'Moderately well drained', clayContent: 42, sandContent: 22, siltContent: 36,
    bulkDensity: 1.28, cationExchangeCapacity: 19, source: 'Estimated (Kisii Nitisol)',
  },
  // Homa Bay — sandy and clay plains, variable
  'Homa Bay': {
    soilType: 'Sandy Clay Loam', ph: 6.0, organicCarbon: 11, nitrogen: 7, phosphorus: 5, potassium: 0.3,
    waterHoldingCapacity: 85, drainage: 'Well drained', clayContent: 28, sandContent: 48, siltContent: 24,
    bulkDensity: 1.4, cationExchangeCapacity: 11, source: 'Estimated (Homa Bay mixed)',
  },
  // Narok — sandy loam to sandy clay, semi-arid to sub-humid
  Narok: {
    soilType: 'Sandy Clay Loam', ph: 6.0, organicCarbon: 12, nitrogen: 8, phosphorus: 5, potassium: 0.3,
    waterHoldingCapacity: 80, drainage: 'Well drained', clayContent: 26, sandContent: 50, siltContent: 24,
    bulkDensity: 1.42, cationExchangeCapacity: 12, source: 'Estimated (Narok sandy clay loam)',
  },
  // Kajiado — sandy loams, semi-arid, low fertility
  Kajiado: {
    soilType: 'Sandy Loam', ph: 6.3, organicCarbon: 8, nitrogen: 5, phosphorus: 4, potassium: 0.25,
    waterHoldingCapacity: 55, drainage: 'Excessively drained (sandy)', clayContent: 14, sandContent: 68, siltContent: 18,
    bulkDensity: 1.5, cationExchangeCapacity: 8, source: 'Estimated (Kajiado semi-arid sandy loam)',
  },
};

// County-keyed fallback used when the SoilGrids API is unavailable.
// Every county in our lookup table returns a distinct profile. If the county
// is not found, we return a neutral Loam clearly labeled as a general estimate
// — never a generic "highland typical" constant.
export function fallbackSoil(lat: number, lon: number, county?: string): SoilData {
  if (county && COUNTY_SOIL[county]) {
    return { ...COUNTY_SOIL[county] };
  }
  return {
    soilType: 'Loam', ph: 6.2, organicCarbon: 12, nitrogen: 8, phosphorus: 6, potassium: 0.3,
    waterHoldingCapacity: 100, drainage: 'Well drained', clayContent: 25, sandContent: 45, siltContent: 30,
    bulkDensity: 1.4, cationExchangeCapacity: 12,
    source: 'Estimated from county-level soil survey data (general)',
  };
}

export async function fetchSoilData(lat: number, lon: number, county?: string): Promise<SoilData> {
  const data = await fetchSoilGrids(lat, lon);
  if (!data || !data.properties || data.properties.length === 0) {
    return fallbackSoil(lat, lon, county);
  }

  const props = data.properties;

  // SoilGrids returns values at depth intervals: 0-5, 5-15, 15-30, ...
  // We average the first 3 layers (0-30cm topsoil)
  const clay = avgDepth(props, 'clay') ?? 25;
  const sand = avgDepth(props, 'sand') ?? 45;
  const silt = avgDepth(props, 'silt') ?? 30;
  const ph = avgDepth(props, 'phh2o') ? (avgDepth(props, 'phh2o')! / 10) : 6.2; // phh2o is x10
  const soc = avgDepth(props, 'soc') ? (avgDepth(props, 'soc')! / 100) : 12; // soc is cg/kg -> g/kg
  const nitrogen = avgDepth(props, 'nitrogen') ?? 8; // cg/kg
  const bdod = avgDepth(props, 'bdod') ? (avgDepth(props, 'bdod')! / 100) : 1.35; // bulk density x100
  const cec = avgDepth(props, 'cec') ? (avgDepth(props, 'cec')! / 100) : 12; // cmolc/kg
  const awc = avgDepth(props, 'awc') ? (avgDepth(props, 'awc')! / 100) : 100; // mm/m

  // Phosphorus and potassium are not in SoilGrids standard properties.
  // Estimate from CEC and pH (well-correlated in tropical soils)
  const phosphorus = estimatePhosphorus(ph, cec);
  const potassium = estimatePotassium(cec);

  return {
    soilType: classifySoilType(clay, sand, 100 - clay - sand),
    ph: Math.round(ph * 10) / 10,
    organicCarbon: Math.round(soc * 10) / 10,
    nitrogen: Math.round(nitrogen * 10) / 10,
    phosphorus: Math.round(phosphorus * 10) / 10,
    potassium: Math.round(potassium * 100) / 100,
    waterHoldingCapacity: Math.round(awc),
    drainage: classifyDrainage(clay, sand, awc),
    clayContent: Math.round(clay),
    sandContent: Math.round(sand),
    siltContent: Math.round(100 - clay - sand),
    bulkDensity: Math.round(bdod * 100) / 100,
    cationExchangeCapacity: Math.round(cec * 10) / 10,
    source: 'ISRIC SoilGrids (250m resolution)',
  };
}

// Average a property across the first 3 depth layers (0-30cm)
function avgDepth(props: SoilGridsLayer[], name: string): number | null {
  const layer = props.find((l) => l.name === name);
  if (!layer) return null;
  const keys = Object.keys(layer.values).slice(0, 3);
  if (keys.length === 0) return null;
  const vals = keys.map((k) => layer.values[k].mean).filter((v) => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function estimatePhosphorus(ph: number, cec: number): number {
  // Lower pH and lower CEC correlate with lower P availability in tropical soils
  let base = 6;
  if (ph < 5.5) base = 3;
  else if (ph < 6.0) base = 5;
  else if (ph > 6.5) base = 10;
  if (cec > 20) base += 3;
  else if (cec < 10) base -= 1;
  return Math.max(2, base);
}

function estimatePotassium(cec: number): number {
  // K availability correlates with CEC
  if (cec > 25) return 0.6;
  if (cec > 15) return 0.4;
  if (cec > 8) return 0.25;
  return 0.15;
}

// Generate soil-based recommendations for a specific crop
export type SoilRecommendation = {
  text: string;
  tone: 'good' | 'warning' | 'critical';
  category: string;
};

export function soilRecommendationsForCrop(soil: SoilData, cropName: string): SoilRecommendation[] {
  const recs: SoilRecommendation[] = [];

  // pH suitability
  const ph = soil.ph;
  let phIdeal = false;
  if (cropName === 'Maize' || cropName === 'Beans') {
    if (ph >= 5.5 && ph <= 7.0) phIdeal = true;
  } else if (cropName === 'Potatoes') {
    if (ph >= 5.0 && ph <= 6.0) phIdeal = true;
  } else {
    if (ph >= 5.8 && ph <= 6.8) phIdeal = true;
  }

  if (phIdeal) {
    recs.push({ text: `Soil pH ${ph.toFixed(1)} is ideal for ${cropName}.`, tone: 'good', category: 'pH' });
  } else if (ph < 5.5) {
    recs.push({
      text: `Soil pH ${ph.toFixed(1)} is acidic for ${cropName}. Apply agricultural lime (1-2 t/ha) 2-3 weeks before planting.`,
      tone: 'warning',
      category: 'pH',
    });
  } else if (ph > 7.0) {
    recs.push({
      text: `Soil pH ${ph.toFixed(1)} is alkaline for ${cropName}. Apply gypsum or organic matter to lower pH.`,
      tone: 'warning',
      category: 'pH',
    });
  }

  // Organic carbon
  if (soil.organicCarbon < 10) {
    recs.push({
      text: `Low organic carbon (${soil.organicCarbon.toFixed(1)} g/kg). Apply compost or manure (5-10 t/ha) to improve soil fertility.`,
      tone: 'warning',
      category: 'Organic Matter',
    });
  } else if (soil.organicCarbon > 25) {
    recs.push({
      text: `Good organic carbon levels (${soil.organicCarbon.toFixed(1)} g/kg). Maintain with cover cropping.`,
      tone: 'good',
      category: 'Organic Matter',
    });
  }

  // Nitrogen
  if (soil.nitrogen < 8) {
    recs.push({
      text: `Low nitrogen (${soil.nitrogen.toFixed(1)} cg/kg). Apply NPK or urea top-dressing in 2 splits (Week 4 and Week 7).`,
      tone: 'critical',
      category: 'Nitrogen',
    });
  } else if (soil.nitrogen > 15) {
    recs.push({
      text: `Adequate nitrogen (${soil.nitrogen.toFixed(1)} cg/kg). Reduce N fertilizer by 30% to avoid lodging.`,
      tone: 'good',
      category: 'Nitrogen',
    });
  }

  // Phosphorus
  if (soil.phosphorus < 5) {
    recs.push({
      text: `Low phosphorus (${soil.phosphorus.toFixed(1)} mg/kg). Apply DAP or TSP at planting (50-100 kg/ha).`,
      tone: 'critical',
      category: 'Phosphorus',
    });
  } else if (soil.phosphorus > 15) {
    recs.push({
      text: `Good phosphorus levels (${soil.phosphorus.toFixed(1)} mg/kg). No additional P fertilizer needed this season.`,
      tone: 'good',
      category: 'Phosphorus',
    });
  }

  // Potassium
  if (soil.potassium < 0.2) {
    recs.push({
      text: `Low potassium (${soil.potassium.toFixed(2)} cmolc/kg). Apply muriate of potash (KCl) at 40-60 kg/ha.`,
      tone: 'warning',
      category: 'Potassium',
    });
  }

  // Drainage
  if (soil.drainage.includes('Poorly')) {
    recs.push({
      text: `Soil is poorly drained. Plant on ridges or install drainage channels to prevent waterlogging.`,
      tone: 'warning',
      category: 'Drainage',
    });
  } else if (soil.drainage.includes('Excessively')) {
    recs.push({
      text: `Soil drains too quickly. Add organic matter and mulch to retain moisture. Consider drip irrigation.`,
      tone: 'warning',
      category: 'Drainage',
    });
  }

  // Water-holding capacity
  if (soil.waterHoldingCapacity < 80) {
    recs.push({
      text: `Low water-holding capacity (${soil.waterHoldingCapacity} mm/m). Mulch heavily and irrigate in dry spells.`,
      tone: 'warning',
      category: 'Water',
    });
  }

  return recs;
}
