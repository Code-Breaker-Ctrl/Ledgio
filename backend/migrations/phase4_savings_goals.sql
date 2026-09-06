-- ==============================================================================
-- Ledgio — Phase 4 (Milestone 4.1): Target Savings Goals & First-Class Deposits
-- ==============================================================================
-- Architecture:
-- 1. goals: defines target buckets (name, target_amount, target_date, etc.).
--    Current amount is NEVER stored in the database — computed client-side as SUM(deposits).
-- 2. goal_deposits: first-class ledger records of contributions and withdrawals
--    (positive = deposit, negative = withdrawal). Cascade deletes with parent goal.
-- 3. Both tables feature UUID PKs, updated_at triggers, user-scoped indexes, and RLS.
-- ==============================================================================

-- 0. Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create goals table (Metadata & Targets Only)
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  target_date DATE,
  category TEXT DEFAULT 'general',
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'fa-bullseye',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_goals_updated_at ON public.goals;
CREATE TRIGGER set_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_goals_user_updated ON public.goals (user_id, updated_at DESC);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goals" ON public.goals;
CREATE POLICY "Users can manage own goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Create goal_deposits table (First-Class Ledger Records)
CREATE TABLE IF NOT EXISTS public.goal_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount <> 0), -- positive = deposit, negative = withdrawal
  deposit_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goal_deposits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_goal_deposits_updated_at ON public.goal_deposits;
CREATE TRIGGER set_goal_deposits_updated_at
  BEFORE UPDATE ON public.goal_deposits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_goal_deposits_goal_id ON public.goal_deposits (goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_user_updated ON public.goal_deposits (user_id, updated_at DESC);

ALTER TABLE public.goal_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goal deposits" ON public.goal_deposits;
CREATE POLICY "Users can manage own goal deposits" ON public.goal_deposits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- Schema Verification Query (Run after execution to verify setup):
-- ==============================================================================
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('goals', 'goal_deposits')
-- ORDER BY table_name, ordinal_position;
