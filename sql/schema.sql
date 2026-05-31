-- Run this in your Supabase project → SQL Editor

CREATE TABLE IF NOT EXISTS meals (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  user_id         UUID,
  total_calories  INTEGER,
  total_carbs_g   NUMERIC(6,1),
  total_protein_g NUMERIC(6,1),
  total_fat_g     NUMERIC(6,1),
  notes           TEXT,
  food_count      INTEGER
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

CREATE INDEX IF NOT EXISTS meal_foods_meal_id_idx ON meal_foods(meal_id);

-- ── RLS ──
ALTER TABLE meals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_foods ENABLE ROW LEVEL SECURITY;

-- Each user can only read/write their own meals
CREATE POLICY "users_select_own_meals" ON meals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_meals" ON meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- meal_foods inherit access through the parent meal's user_id
CREATE POLICY "users_select_own_foods" ON meal_foods
  FOR SELECT USING (
    meal_id IN (SELECT id FROM meals WHERE user_id = auth.uid())
  );

CREATE POLICY "users_insert_own_foods" ON meal_foods
  FOR INSERT WITH CHECK (
    meal_id IN (SELECT id FROM meals WHERE user_id = auth.uid())
  );
