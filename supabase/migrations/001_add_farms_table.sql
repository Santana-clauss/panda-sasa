-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add farms table with PostGIS spatial support
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PREREQUISITE: Enable the PostGIS extension in your Supabase Dashboard:
--   Database → Extensions → search "postgis" → Enable
--
-- Then run this migration in the SQL Editor.

-- 1. Enable PostGIS (no-op if already enabled via Dashboard)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create farms table
CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Farm',
  -- GeoJSON-compatible polygon in WGS84 (SRID 4326)
  boundary GEOMETRY(Polygon, 4326) NOT NULL,
  -- Computed fields (auto-populated by trigger)
  area_hectares NUMERIC(10,2),
  county TEXT,
  sub_county TEXT,
  elevation_m NUMERIC(6,1),
  slope_percent NUMERIC(5,2),
  soil_type TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Spatial index for fast intersection queries
CREATE INDEX IF NOT EXISTS farms_boundary_idx ON farms USING GIST(boundary);

-- 4. Regular index for user lookups
CREATE INDEX IF NOT EXISTS farms_user_id_idx ON farms(user_id);

-- 5. Auto-compute area in hectares on insert/update
CREATE OR REPLACE FUNCTION compute_farm_area()
RETURNS TRIGGER AS $$
BEGIN
  -- ST_Area on geography type returns square meters; divide by 10000 for hectares
  NEW.area_hectares := ROUND(
    ST_Area(NEW.boundary::geography) / 10000.0,
    2
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS farm_area_trigger ON farms;
CREATE TRIGGER farm_area_trigger
  BEFORE INSERT OR UPDATE OF boundary ON farms
  FOR EACH ROW
  EXECUTE FUNCTION compute_farm_area();

-- 6. Row Level Security
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;

-- Users can read their own farms
CREATE POLICY "Users can view own farms"
  ON farms FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own farms
CREATE POLICY "Users can insert own farms"
  ON farms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own farms
CREATE POLICY "Users can update own farms"
  ON farms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own farms
CREATE POLICY "Users can delete own farms"
  ON farms FOR DELETE
  USING (auth.uid() = user_id);
