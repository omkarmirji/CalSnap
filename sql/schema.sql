-- Run this in your Supabase project → SQL Editor

CREATE TABLE IF NOT EXISTS meals (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  total_calories  INTEGER,
  total_carbs_g   NUMERIC(6,1),
  total_protein_g NUMERIC(6,1),
  total_fat_g     NUMERIC(6,1),
  notes       TEXT,
  food_count  INTEGER
);

CREATE TABLE IF NOT EXISTS meal_foods (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id             UUID    REFERENCES meals(id) ON DELETE CASCADE,
  name                TEXT    NOT NULL,
  emoji               TEXT,
  portion             TEXT,
  quantity_reasoning  TEXT,
  calories            INTEGER,
  carbs_g             NUMERIC(6,1),
  protein_g           NUMERIC(6,1),
  fat_g               NUMERIC(6,1),
  glycemic_index      INTEGER,
  confidence          NUMERIC(4,2)
);

-- index for fast lookup of foods by meal
CREATE INDEX IF NOT EXISTS meal_foods_meal_id_idx ON meal_foods(meal_id);
