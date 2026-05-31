-- Migration: add sugar_g column to meal_foods
-- Run this in Supabase → SQL Editor if the table already exists

ALTER TABLE meal_foods ADD COLUMN IF NOT EXISTS sugar_g NUMERIC(6,1);
