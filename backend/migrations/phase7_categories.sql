-- ==============================================================================
-- Ledgio — Phase 7: Category Cloud Backup & Sync Schema
-- ==============================================================================
-- ⚠️ DO NOT RUN UNTIL REVIEWED. Run ONCE in Supabase SQL Editor.
-- BEFORE RUNNING: export profiles from Table Editor (backup).
--
-- What this does:
-- 1. Creates public.user_categories table for custom category cloud persistence.
-- 2. Adds profiles.hidden_builtins text[] column to track removed built-in categories.
-- 3. Enables Row Level Security (RLS) on user_categories so users access only their own categories.
-- 4. Sets up automated handle_updated_at trigger for updated_at timestamps.
-- 5. Creates unique index on (user_id, LOWER(name)) to enforce case-insensitive uniqueness.
-- 6. Creates index on (user_id, updated_at DESC) for fast sync pulling.
-- ==============================================================================

BEGIN;

-- 0. Ensure updated_at trigger function exists (self-contained) ----------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create user_categories table ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  icon text,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. updated_at / LWW trigger -------------------------------------------------
DROP TRIGGER IF EXISTS set_user_categories_updated_at ON public.user_categories;
CREATE TRIGGER set_user_categories_updated_at
  BEFORE UPDATE ON public.user_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Indexes ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_categories_user_updated
  ON public.user_categories (user_id, updated_at DESC);

-- Unique category names per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_categories_user_name_lower
  ON public.user_categories (user_id, LOWER(name));

-- Partial index for built-in categories if any
CREATE INDEX IF NOT EXISTS idx_user_categories_user_builtin
  ON public.user_categories (user_id) WHERE is_builtin = true;

-- 4. Enable RLS on user_categories --------------------------------------------
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own categories" ON public.user_categories;
CREATE POLICY "Users manage own categories" ON public.user_categories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Add hidden_builtins column to profiles -----------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_builtins text[] DEFAULT '{}';

COMMIT;

-- ==============================================================================
-- Verification Query:
-- Run this in Supabase SQL Editor to verify the migration applied correctly:
-- ==============================================================================
-- SELECT 
--   table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'user_categories'
-- ORDER BY ordinal_position;
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'hidden_builtins';
--
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'user_categories';

-- ==============================================================================
-- Rollback Instructions (if needed):
-- ==============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.user_categories CASCADE;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS hidden_builtins;
-- COMMIT;
