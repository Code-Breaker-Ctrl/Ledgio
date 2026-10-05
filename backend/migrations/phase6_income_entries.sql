-- ==============================================================================
-- Ledgio — Phase 6: Income Entries Ledger (Stage A — SQL MIGRATION)
-- ==============================================================================
-- ⚠️ DO NOT RUN UNTIL REVIEWED. Run ONCE in Supabase SQL Editor.
-- BEFORE RUNNING: export profiles + expenses from Table Editor (backup).
--
-- What this does:
-- 1. Creates public.income_entries — a dated ledger of income events
--    (type: 'add' | 'opening' | 'adjustment').
-- 2. RLS: users touch only their own entries.
-- 3. updated_at/LWW trigger (same handle_updated_at pattern as
--    phase3_offline_sync.sql / phase4_savings_goals.sql).
-- 4. SERVER-SIDE BACKFILL: one 'opening' entry per profile with income > 0,
--    deterministic id = md5('ledgio-income-opening:' || user_id)::uuid —
--    re-runs and multi-device races collapse via ON CONFLICT DO NOTHING.
-- 5. profiles.income is NOT modified and NOT dropped — rollback is trivial,
--    old cached app versions keep working.
--
-- SEMANTICS (for Stage B/C):
-- - type='add'        → counts toward "Income — This Month" and % spent
-- - type='opening'    → counts toward total balance only, NEVER monthly
-- - type='adjustment' → counts toward total balance only (Set Balance
--                       corrections are logged, history is never wiped)
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

-- 1. Table --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  entry_date date NOT NULL DEFAULT current_date,
  type text NOT NULL CHECK (type IN ('add','opening','adjustment')),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT income_entries_add_positive CHECK (type <> 'add' OR amount > 0)
);

-- 2. updated_at / LWW trigger -------------------------------------------------
DROP TRIGGER IF EXISTS set_income_entries_updated_at ON public.income_entries;
CREATE TRIGGER set_income_entries_updated_at
  BEFORE UPDATE ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Indexes ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_income_entries_user_date
  ON public.income_entries (user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_income_entries_user_updated
  ON public.income_entries (user_id, updated_at DESC);

-- 4. One opening entry per user, ever ------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_entries_one_opening
  ON public.income_entries (user_id) WHERE type = 'opening';

-- 5. RLS -----------------------------------------------------------------------
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own income entries" ON public.income_entries;
CREATE POLICY "Users manage own income entries" ON public.income_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. SERVER-SIDE BACKFILL (idempotent — safe to re-run) ------------------------
-- One 'opening' entry per profile with income > 0. Deterministic id derived
-- from the user's UUID: same user can never produce a second opening entry,
-- across re-runs OR across devices (Stage B clients reuse the same id and
-- upsert, so duplicates collapse instead of doubling the balance).
INSERT INTO public.income_entries (id, user_id, amount, entry_date, type, note)
SELECT
  md5('ledgio-income-opening:' || p.id::text)::uuid,
  p.id,
  p.income,
  current_date,
  'opening',
  'Opening balance'
FROM public.profiles p
WHERE COALESCE(p.income, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.income_entries ie
    WHERE ie.user_id = p.id AND ie.type = 'opening'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ==============================================================================
-- VERIFICATION — run in a NEW query tab after the migration:
--
-- a) Every profile with income > 0 has an opening entry (expect 0 rows):
--    SELECT p.id FROM public.profiles p
--    WHERE COALESCE(p.income,0) > 0
--    AND NOT EXISTS (SELECT 1 FROM public.income_entries ie
--                    WHERE ie.user_id = p.id AND ie.type = 'opening');
--
-- b) Backfill totals match profiles.income (expect 0 rows):
--    SELECT p.id FROM public.profiles p
--    JOIN (SELECT user_id, SUM(amount) AS total
--          FROM public.income_entries GROUP BY user_id) t ON t.user_id = p.id
--    WHERE t.total <> p.income;
--
-- c) Table structure:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'income_entries' ORDER BY ordinal_position;
--
-- NOTE: check (b) is valid immediately after migration. Once Stage B ships
-- and the app writes new entries, totals intentionally drift from
-- profiles.income (which becomes a frozen legacy column).
-- ==============================================================================
-- ROLLBACK (if ever needed — profiles.income untouched, so nothing is lost):
-- DROP TABLE IF EXISTS public.income_entries;
-- ==============================================================================
