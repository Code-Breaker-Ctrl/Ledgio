-- ==============================================================================
-- Ledgio — Phase 5c: Analytics RLS Lockdown (SEC-04)
-- ==============================================================================
-- IMPORTANT INSTRUCTION FOR ADMINISTRATOR:
-- Run this migration in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to secure the app_analytics telemetry table against public inspection.
--
-- What this does:
-- 1. Drops the unrestricted public SELECT policy that allowed anyone with
--    the anonKey to harvest registered user IDs and device telemetry.
-- 2. Restricts SELECT strictly to the authenticated Admin user UUID:
--    ('583ea03b-2246-482f-8a92-670c5c0b7c4f').
-- 3. Retains permissive client INSERT for telemetry logging (app installs,
--    launches, and platform metrics), noting potential flood risk.
-- ==============================================================================

-- 1. Ensure Row Level Security is active
ALTER TABLE IF EXISTS public.app_analytics ENABLE ROW LEVEL SECURITY;

-- 2. Drop the open public SELECT policy
DROP POLICY IF EXISTS "Allow read access to app_analytics" ON public.app_analytics;
DROP POLICY IF EXISTS "Allow admin read access to app_analytics" ON public.app_analytics;

-- 3. Restrict SELECT to authenticated Admin user only
CREATE POLICY "Allow admin read access to app_analytics" ON public.app_analytics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = '583ea03b-2246-482f-8a92-670c5c0b7c4f'::uuid);

-- 4. Maintain client INSERT permissions for telemetry logging
-- NOTE: Telemetry events (app_install, app_launch) are logged by clients before or during auth.
-- WITH CHECK (true) is accepted here for telemetry logging; throttling is handled client-side.
DROP POLICY IF EXISTS "Allow public insert into app_analytics" ON public.app_analytics;
CREATE POLICY "Allow public insert into app_analytics" ON public.app_analytics
  FOR INSERT
  WITH CHECK (true);
