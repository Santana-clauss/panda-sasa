// Kenya county boundary GeoJSON data
// Simplified approximate boundaries for the counties in our COUNTIES array.
// Each polygon is a ~50km bounding polygon around the county center point.
// For production, replace with official IEBC boundary data.

import { COUNTIES } from './data';

export type CountyFeature = GeoJSON.Feature<GeoJSON.Polygon, {
  name: string;
  region: string;
  agroEcologicalZone: string;
  rainfallZone: 'High' | 'Medium' | 'Low';
  annualRainfallMm: number;
}>;

export type CountyFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon, CountyFeature['properties']>;

// Generate an approximate rectangular boundary (~0.4° ≈ 45km each side)
// centered on the county's lat/lon. This gives a recognizable clickable area
// on the map for each county without needing the full IEBC boundary dataset.
function makeBoundaryPolygon(lat: number, lon: number, size = 0.35): GeoJSON.Polygon {
  const half = size / 2;
  // GeoJSON coordinates are [lng, lat] and the ring must close
  return {
    type: 'Polygon',
    coordinates: [[
      [lon - half, lat - half],
      [lon + half, lat - half],
      [lon + half, lat + half],
      [lon - half, lat + half],
      [lon - half, lat - half], // close ring
    ]],
  };
}

/**
 * Build a GeoJSON FeatureCollection from the static COUNTIES array.
 * Each county becomes a Polygon feature with metadata properties.
 */
export function buildCountyGeoJSON(): CountyFeatureCollection {
  const features: CountyFeature[] = COUNTIES.map((c) => ({
    type: 'Feature' as const,
    properties: {
      name: c.name,
      region: c.region,
      agroEcologicalZone: c.agroEcologicalZone,
      rainfallZone: c.rainfallZone,
      annualRainfallMm: c.annualRainfallMm,
    },
    geometry: makeBoundaryPolygon(c.latitude, c.longitude),
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Build a GeoJSON FeatureCollection of county center points (for labels).
 */
export function buildCountyPointsGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: COUNTIES.map((c) => ({
      type: 'Feature' as const,
      properties: {
        name: c.name,
        rainfallZone: c.rainfallZone,
        annualRainfallMm: c.annualRainfallMm,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [c.longitude, c.latitude],
      },
    })),
  };
}
