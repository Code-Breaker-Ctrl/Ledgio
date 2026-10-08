-- ==============================================================================
-- Ledgio — Phase 8: Loan Kinds Schema (Cash vs On-Behalf)
-- ==============================================================================
-- ⚠️ Run ONCE in Supabase SQL Editor.
--
-- What this does:
-- 1. Adds loans.kind text NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash', 'on_behalf')).
-- 2. Distinguishes direct cash loans from loans paid on user's behalf to merchants.
-- ==============================================================================

BEGIN;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash', 'on_behalf'));

COMMIT;

-- ==============================================================================
-- Verification Query:
-- Run this in Supabase SQL Editor to verify the migration applied correctly:
-- ==============================================================================
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'loans' AND column_name = 'kind';
