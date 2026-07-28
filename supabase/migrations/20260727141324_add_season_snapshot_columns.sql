-- Add snapshot columns so each season stores its own computed data
-- rather than sharing a global "last recommendation" object.

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS maturity_days int,
  ADD COLUMN IF NOT EXISTS growth_profile_id text,
  ADD COLUMN IF NOT EXISTS planting_window_start date,
  ADD COLUMN IF NOT EXISTS planting_window_end date,
  ADD COLUMN IF NOT EXISTS soil_data jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score int,
  ADD COLUMN IF NOT EXISTS confidence_breakdown jsonb;

-- Backfill existing rows with sensible defaults so they don't break the UI.
UPDATE seasons
SET maturity_days = COALESCE(maturity_days, 90),
    planting_window_start = COALESCE(planting_window_start, planting_date),
    planting_window_end = COALESCE(planting_window_end, planting_date + INTERVAL '14 days'),
    confidence_score = COALESCE(confidence_score, 50)
WHERE maturity_days IS NULL;
