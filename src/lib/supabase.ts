import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  user_id: string;
  name: string | null;
  phone: string | null;
  county: string;
  sub_county: string;
  preferred_language: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Season = {
  id: string;
  user_id: string;
  crop: string;
  variety: string | null;
  county: string;
  sub_county: string | null;
  planting_date: string;
  expected_harvest: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  // Snapshot fields (populated at save time)
  maturity_days: number | null;
  growth_profile_id: string | null;
  planting_window_start: string | null;
  planting_window_end: string | null;
  soil_data: SoilDataSnapshot | null;
  confidence_score: number | null;
  confidence_breakdown: ConfidenceBreakdown | null;
};

export type SoilDataSnapshot = {
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

export type ConfidenceBreakdown = {
  rainfallFit: number;
  soilFit: number;
  timingFit: number;
  zoneFit: number;
  overall: number;
};

export type Activity = {
  id: string;
  season_id: string;
  user_id: string;
  week_number: number;
  title: string;
  description: string | null;
  category: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type StorageAssessment = {
  id: string;
  user_id: string;
  crop: string;
  dryness_level: string;
  storage_method: string;
  moisture_condition: string;
  risk_score: number;
  risk_level: string;
  aflatoxin_risk: string;
  spoilage_risk: string;
  advice: string;
  created_at: string;
};

export type FarmRow = {
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

