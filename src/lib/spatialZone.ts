// Spatial agro-ecological zone detection
// Uses @turf/boolean-point-in-polygon to determine which county and AEZ
// a given lat/lon falls within, replacing the Haversine nearest-county approach.

import * as turf from '@turf/turf';
import { COUNTIES, type County } from './data';
import { buildCountyGeoJSON } from './kenyaCounties.geojson';

// Cache the GeoJSON so we don't rebuild it on every call
let _countyGeoJSON: ReturnType<typeof buildCountyGeoJSON> | null = null;

function getCountyGeoJSON() {
  if (!_countyGeoJSON) _countyGeoJSON = buildCountyGeoJSON();
  return _countyGeoJSON;
}

export type SpatialZoneResult = {
  county: County;
  agroEcologicalZone: string;
  rainfallZone: 'High' | 'Medium' | 'Low';
  method: 'spatial' | 'haversine';
};

/**
 * Detect the county that contains the given point using polygon intersection.
 * Falls back to nearest-county Haversine if the point falls outside all polygons.
 */
export function detectCountyFromPoint(lat: number, lon: number): SpatialZoneResult {
  const point = turf.point([lon, lat]);
  const geojson = getCountyGeoJSON();

  // Try spatial intersection first
  for (const feature of geojson.features) {
    if (turf.booleanPointInPolygon(point, feature)) {
      const name = feature.properties.name;
      const county = COUNTIES.find((c) => c.name === name);
      if (county) {
        return {
          county,
          agroEcologicalZone: county.agroEcologicalZone,
          rainfallZone: county.rainfallZone,
          method: 'spatial',
        };
      }
    }
  }

  // Fallback: Haversine nearest county
  let bestCounty = COUNTIES[0];
  let bestDist = Infinity;
  for (const c of COUNTIES) {
    const from = turf.point([lon, lat]);
    const to = turf.point([c.longitude, c.latitude]);
    const dist = turf.distance(from, to, { units: 'kilometers' });
    if (dist < bestDist) {
      bestDist = dist;
      bestCounty = c;
    }
  }

  return {
    county: bestCounty,
    agroEcologicalZone: bestCounty.agroEcologicalZone,
    rainfallZone: bestCounty.rainfallZone,
    method: 'haversine',
  };
}

/**
 * Detect the AEZ for a point. Returns the agro-ecological zone string
 * and the detection method used.
 */
export function detectAgroZone(lat: number, lon: number): {
  agroEcologicalZone: string;
  rainfallZone: 'High' | 'Medium' | 'Low';
  countyName: string;
  method: 'spatial' | 'haversine';
} {
  const result = detectCountyFromPoint(lat, lon);
  return {
    agroEcologicalZone: result.agroEcologicalZone,
    rainfallZone: result.rainfallZone,
    countyName: result.county.name,
    method: result.method,
  };
}
