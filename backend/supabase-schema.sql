-- ==============================================================================
-- Ledgio — Supabase Database Schema for App Analytics & Telemetry Tracking
-- ==============================================================================
-- Run this SQL in your Supabase Project -> SQL Editor to enable real-time 
-- tracking for app downloads (PWA installs) and active users.
-- ==============================================================================

-- 1. Create app_analytics Table
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