-- ==============================================================================
-- Ledgio — Phase 7b: Multi-Device Reset Epoch Schema
-- ==============================================================================
-- ⚠️ Run ONCE in Supabase SQL Editor.
--
-- What this does:
-- 1. Adds profiles.reset_epoch integer NOT NULL DEFAULT 0.
-- 2. Tracks the authoritative cloud reset epoch counter per user.
-- 3. Enables deterministic reset victory across multi-device and cross-tab setups.
-- ==============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reset_epoch integer NOT NULL DEFAULT 0;

COMMIT;

-- ==============================================================================
-- Verification Query:
-- Run this in Supabase SQL Editor to verify the migration applied correctly:
-- ==============================================================================
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'reset_epoch';

-- ==============================================================================
-- Rollback Instructions (if needed):
-- ==============================================================================
-- BEGIN;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS reset_epoch;
-- COMMIT;
