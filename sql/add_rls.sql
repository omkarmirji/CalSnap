-- Run this in Supabase → SQL Editor to secure existing tables

-- Add user_id column if tables already exist
ALTER TABLE meals ADD COLUMN IF NOT EXISTS user_id UUID;

-- Re-enable RLS (was disabled earlier)
ALTER TABLE meals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_foods ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies if any exist
DROP POLICY IF EXISTS "users_select_own_meals" ON meals;
DROP POLICY IF EXISTS "users_insert_own_meals" ON meals;
DROP POLICY IF EXISTS "users_select_own_foods" ON meal_foods;
DROP POLICY IF EXISTS "users_insert_own_foods" ON meal_foods;

-- Each user sees and writes only their own meals
CREATE POLICY "users_select_own_meals" ON meals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_meals" ON meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- meal_foods access is gated through the parent meal
CREATE POLICY "users_select_own_foods" ON meal_foods
  FOR SELECT USING (
    meal_id IN (SELECT id FROM meals WHERE user_id = auth.uid())
  );

CREATE POLICY "users_insert_own_foods" ON meal_foods
  FOR INSERT WITH CHECK (
    meal_id IN (SELECT id FROM meals WHERE user_id = auth.uid())
  );
