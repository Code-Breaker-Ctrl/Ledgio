-- ==============================================================================
-- Ledgio — Supabase Full Production Database Schema
-- ==============================================================================
-- Includes profiles, expenses, budgets (with UUID PKs and updated_at triggers),
-- plus app_analytics telemetry tracking with full Row Level Security (RLS).
-- ==============================================================================

-- 0. Automated updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  currency TEXT DEFAULT 'INR',
  dark_mode BOOLEAN DEFAULT false,
  income NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_expenses_updated_at ON public.expenses;
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_expenses_user_updated ON public.expenses (user_id, updated_at DESC);

-- 3. budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_category UNIQUE (user_id, category)
);

ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_budgets_updated_at ON public.budgets;
CREATE TRIGGER set_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for expenses
DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;
CREATE POLICY "Users can manage own expenses" ON public.expenses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for budgets
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;
CREATE POLICY "Users can manage own budgets" ON public.budgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. goals & goal_deposits Tables (Phase 4: Savings Goals & Milestones)
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

-- goal_deposits table (First-class contributions & withdrawals ledger)
CREATE TABLE IF NOT EXISTS public.goal_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount <> 0),
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

-- 4. app_analytics Table (Telemetry)
CREATE TABLE IF NOT EXISTS public.app_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,          -- 'app_install', 'app_launch', 'active_session'
    platform TEXT NOT NULL,            -- 'Windows', 'Android', 'iOS', 'macOS', 'Linux', 'Other'
    display_mode TEXT NOT NULL,        -- 'standalone' (installed PWA) or 'browser' (web)
    app_version TEXT DEFAULT '1.0.4',
    device_type TEXT DEFAULT 'desktop',-- 'desktop', 'mobile', 'tablet'
    screen_res TEXT,                   -- '1920x1080', '390x844', etc.
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Index for Fast Aggregations
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.app_analytics (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.app_analytics (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_platform ON public.app_analytics (platform);
CREATE INDEX IF NOT EXISTS idx_analytics_display_mode ON public.app_analytics (display_mode);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.app_analytics ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
-- Allow anyone (anonymous or authenticated) to log install and launch events
DROP POLICY IF EXISTS "Allow public insert into app_analytics" ON public.app_analytics;
CREATE POLICY "Allow public insert into app_analytics"
  ON public.app_analytics
  FOR INSERT
  WITH CHECK (true);

-- Allow reading telemetry statistics for dashboard overview
DROP POLICY IF EXISTS "Allow read access to app_analytics" ON public.app_analytics;
CREATE POLICY "Allow read access to app_analytics"
  ON public.app_analytics
  FOR SELECT
  USING (true);