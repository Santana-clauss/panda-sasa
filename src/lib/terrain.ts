// Terrain Analysis
// Uses Open-Meteo Elevation API to fetch elevation for a grid of points
// and estimates slope based on the elevation differences.

import { getSessionCache, setSessionCache } from './fetchUtils';

export type TerrainData = {
  elevation: number;
  slopePercent: number;
  slopeDegrees: number;
  terrainClass: 'Flat' | 'Gentle' | 'Moderate' | 'Steep' | 'Very Steep';
};

/**
 * Fetch elevation data for a single point.
 */
export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.elevation?.[0] ?? null;
  } catch (e) {
    console.error('Elevation API error:', e);
    return null;
  }
}

/**
 * Fetch terrain data (elevation and estimated slope) by sampling a 3x3 grid
 * around the target coordinate. Spacing is approx 90m (0.0008 degrees).
 */
export async function fetchTerrainData(lat: number, lon: number): Promise<TerrainData | null> {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLon = Math.round(lon * 1000) / 1000;
  const cacheKey = `terrain_${roundedLat}_${roundedLon}`;
  
  const cached = getSessionCache<TerrainData>(cacheKey);
  if (cached) return cached;

  try {
    // 0.0008 degrees is roughly ~90 meters at the equator
    const d = 0.0008;
    
    // Grid:
    // NW  N  NE
    // W   C  E
    // SW  S  SE
    const lats = [lat + d, lat, lat - d];
    const lons = [lon - d, lon, lon + d];
    
    // Flatten grid to a single list of coordinates
    const queryLats = [];
    const queryLons = [];
    for (const lat of lats) {
      for (const lon of lons) {
        queryLats.push(lat);
        queryLons.push(lon);
      }
    }

    const url = `https://api.open-meteo.com/v1/elevation?latitude=${queryLats.join(',')}&longitude=${queryLons.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    
    const elevs = data.elevation;
    if (!elevs || elevs.length < 9) return null;

    const centerElev = elevs[4]; // Center of the 3x3 grid

    // Calculate slope using maximum gradient method
    // Distance across a 90m grid is 90m cardinal, ~127m diagonal
    let maxSlopePercent = 0;
    
    const dCard = 90; // approx distance in meters
    const dDiag = 127; // approx distance in meters

    // N, S, E, W
    const cardinalIndices = [1, 3, 5, 7];
    for (const idx of cardinalIndices) {
      const drop = Math.abs(elevs[idx] - centerElev);
      const slope = (drop / dCard) * 100;
      if (slope > maxSlopePercent) maxSlopePercent = slope;
    }

    // NW, NE, SW, SE
    const diagonalIndices = [0, 2, 6, 8];
    for (const idx of diagonalIndices) {
      const drop = Math.abs(elevs[idx] - centerElev);
      const slope = (drop / dDiag) * 100;
      if (slope > maxSlopePercent) maxSlopePercent = slope;
    }

    const slopeDegrees = (Math.atan(maxSlopePercent / 100) * 180) / Math.PI;

    let terrainClass: TerrainData['terrainClass'] = 'Flat';
    if (maxSlopePercent < 3) terrainClass = 'Flat';
    else if (maxSlopePercent < 8) terrainClass = 'Gentle';
    else if (maxSlopePercent < 15) terrainClass = 'Moderate';
    else if (maxSlopePercent < 30) terrainClass = 'Steep';
    else terrainClass = 'Very Steep';

    const result: TerrainData = {
      elevation: Math.round(centerElev),
      slopePercent: Math.round(maxSlopePercent * 10) / 10,
      slopeDegrees: Math.round(slopeDegrees * 10) / 10,
      terrainClass,
    };

    setSessionCache(cacheKey, result);
    return result;

  } catch (e) {
    console.error('Terrain API error:', e);
    return null;
  }
}
