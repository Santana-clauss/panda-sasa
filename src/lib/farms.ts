// Farm CRUD operations — uses Supabase with PostGIS geometry storage
// Farms are stored as GeoJSON Polygon boundaries in the `farms` table.

import { supabase } from './supabase';
import * as turf from '@turf/turf';

// ── Types ───────────────────────────────────────────────────────────────────

export type Farm = {
  id: string;
  user_id: string;
  name: string;
  boundary: GeoJSON.Polygon;
  area_hectares: number | null;
  county: string | null;
  sub_county: string | null;
  elevation_m: number | null;
  slope_percent: number | null;
  soil_type: string | null;
  created_at: string;
  updated_at: string;
};

type FarmRow = {
  id: string;
  user_id: string;
  name: string;
  boundary: string; // GeoJSON string from PostGIS
  area_hectares: number | null;
  county: string | null;
  sub_county: string | null;
  elevation_m: number | null;
  slope_percent: number | null;
  soil_type: string | null;
  created_at: string;
  updated_at: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToFarm(row: FarmRow): Farm {
  let boundary: GeoJSON.Polygon;
  try {
    boundary = typeof row.boundary === 'string'
      ? JSON.parse(row.boundary)
      : row.boundary;
  } catch {
    boundary = { type: 'Polygon', coordinates: [] };
  }
  return {
    ...row,
    boundary,
  };
}

/**
 * Get the centroid of a farm polygon for API lookups (soil, climate, etc.)
 */
export function getFarmCentroid(farm: Farm): { lat: number; lon: number } {
  const centroid = turf.centroid(farm.boundary);
  const [lon, lat] = centroid.geometry.coordinates;
  return { lat, lon };
}

/**
 * Calculate area in hectares from a GeoJSON polygon (client-side preview).
 */
export function calcAreaHectares(polygon: GeoJSON.Polygon): number {
  const sqMeters = turf.area(polygon);
  return Math.round((sqMeters / 10000) * 100) / 100;
}

/**
 * Calculate area in acres from a GeoJSON polygon.
 */
export function calcAreaAcres(polygon: GeoJSON.Polygon): number {
  const sqMeters = turf.area(polygon);
  return Math.round((sqMeters / 4046.86) * 100) / 100;
}

// ── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Fetch all farms for the current user.
 */
export async function getUserFarms(): Promise<Farm[]> {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching farms:', error);
    throw new Error(error.message);
  }

  return (data as FarmRow[] ?? []).map(rowToFarm);
}

/**
 * Save a new farm with a polygon boundary.
 * The server-side trigger auto-computes area_hectares.
 */
export async function saveFarm(
  name: string,
  boundary: GeoJSON.Polygon,
  county?: string,
  subCounty?: string,
): Promise<Farm> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('farms')
    .insert({
      user_id: user.id,
      name,
      boundary: JSON.stringify(boundary),
      county: county ?? null,
      sub_county: subCounty ?? null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error saving farm:', error);
    throw new Error(error.message);
  }

  return rowToFarm(data as FarmRow);
}

/**
 * Update a farm's boundary polygon.
 */
export async function updateFarmBoundary(
  farmId: string,
  boundary: GeoJSON.Polygon,
): Promise<Farm> {
  const { data, error } = await supabase
    .from('farms')
    .update({
      boundary: JSON.stringify(boundary),
    })
    .eq('id', farmId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating farm:', error);
    throw new Error(error.message);
  }

  return rowToFarm(data as FarmRow);
}

/**
 * Update farm name.
 */
export async function updateFarmName(farmId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('farms')
    .update({ name })
    .eq('id', farmId);

  if (error) throw new Error(error.message);
}

/**
 * Delete a farm.
 */
export async function deleteFarm(farmId: string): Promise<void> {
  const { error } = await supabase
    .from('farms')
    .delete()
    .eq('id', farmId);

  if (error) throw new Error(error.message);
}
