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
