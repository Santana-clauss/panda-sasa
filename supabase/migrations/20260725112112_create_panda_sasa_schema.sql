
/*
# Panda Sasa - Full Schema

1. New Tables
  - `profiles` — farmer profiles tied to auth.users
    - id, user_id, name, phone, county, sub_county, preferred_language, avatar_url
  - `seasons` — active crop plantings per farmer
    - id, user_id, crop, variety, county, sub_county, planting_date, expected_harvest, notes
  - `activities` — weekly task checklist generated per season
    - id, season_id, user_id, week_number, title, description, category, due_date, completed
  - `storage_assessments` — storage risk evaluation records
    - id, user_id, crop, dryness_level, storage_method, moisture_condition, risk_score, advice, created_at

2. Security
  - RLS enabled on all tables
  - Authenticated users can only access their own rows
  - user_id defaults to auth.uid() for seamless inserts

3. Notes
  - Profiles are auto-created via trigger on auth.users insert
  - All owner columns default to auth.uid()
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  phone text,
  county text DEFAULT 'Nakuru',
  sub_county text DEFAULT 'Gilgil',
  preferred_language text DEFAULT 'en',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (new.id, new.raw_user_meta_data->>'name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- SEASONS
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  crop text NOT NULL,
  variety text,
  county text NOT NULL,
  sub_county text,
  planting_date date NOT NULL,
  expected_harvest date,
  notes text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_seasons" ON seasons;
CREATE POLICY "select_own_seasons" ON seasons FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_seasons" ON seasons;
CREATE POLICY "insert_own_seasons" ON seasons FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_seasons" ON seasons;
CREATE POLICY "update_own_seasons" ON seasons FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_seasons" ON seasons;
CREATE POLICY "delete_own_seasons" ON seasons FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ACTIVITIES
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  due_date date,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activities" ON activities;
CREATE POLICY "select_own_activities" ON activities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activities" ON activities;
CREATE POLICY "insert_own_activities" ON activities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_activities" ON activities;
CREATE POLICY "update_own_activities" ON activities FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activities" ON activities;
CREATE POLICY "delete_own_activities" ON activities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- STORAGE ASSESSMENTS
CREATE TABLE IF NOT EXISTS storage_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  crop text NOT NULL,
  dryness_level text NOT NULL,
  storage_method text NOT NULL,
  moisture_condition text NOT NULL,
  risk_score int NOT NULL,
  risk_level text NOT NULL,
  aflatoxin_risk text NOT NULL,
  spoilage_risk text NOT NULL,
  advice text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE storage_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_storage" ON storage_assessments;
CREATE POLICY "select_own_storage" ON storage_assessments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_storage" ON storage_assessments;
CREATE POLICY "insert_own_storage" ON storage_assessments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_storage" ON storage_assessments;
CREATE POLICY "update_own_storage" ON storage_assessments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_storage" ON storage_assessments;
CREATE POLICY "delete_own_storage" ON storage_assessments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
