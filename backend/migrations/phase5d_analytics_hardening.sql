-- ==============================================================================
-- Ledgio — Phase 5d: Analytics Table Hardening (SEC-05)
-- ==============================================================================
-- IMPORTANT NOTICE:
-- DO NOT RUN AGAINST PRODUCTION YET.
-- This migration hardens public.app_analytics with CHECK constraints:
-- 1. Length limits on all TEXT columns (event_type <= 64, others <= 256).
-- 2. Allowlist CHECK on event_type matching only the events active in the app:
--    ('app_install', 'app_launch').
--    (Note: Schema column is named 'event_type' in PostgreSQL DDL).
-- 3. All constraints are added as NOT VALID to prevent existing rows from
--    blocking deployment, with a separate commented VALIDATE step.
-- 4. INSERT policy remains open to public/anon for client telemetry.
-- 5. SELECT policy remains restricted strictly to Admin UUID (SEC-04).
-- ==============================================================================

-- 1. Ensure table exists and RLS is enabled
ALTER TABLE IF EXISTS public.app_analytics ENABLE ROW LEVEL SECURITY;

-- 2. Add Length Constraints (NOT VALID)
ALTER TABLE public.app_analytics
  ADD CONSTRAINT chk_app_analytics_event_type_len
  CHECK (char_length(event_type) <= 64) NOT VALID;

ALTER TABLE public.app_analytics
  ADD CONSTRAINT chk_app_analytics_platform_len
  CHECK (char_length(platform) <= 256) NOT VALID;

ALTER TABLE public.app_analytics
  ADD CONSTRAINT chk_app_analytics_display_mode_len
  CHECK (char_length(display_mode) <= 256) NOT VALID;

ALTER TABLE public.app_analytics
  ADD CONSTRAINT chk_app_analytics_app_version_len
  CHECK (app_version IS NULL OR char_length(app_version) <= 256) NOT VALID;

ALTER TABLE public.app_analytics
  ADD CONSTRAINT chk_app_analytics_device_type_len
  CHECK (device_type IS NULL OR char_length(device_type) <= 256) NOT VALID;

ALTER TABLE public.app_analytics
  ADD CONSTRAINT chk_app_analytics_screen_res_len
  CHECK (screen_res IS NULL OR char_length(screen_res) <= 256) NOT VALID;

-- 3. Add Event Type Allowlist Constraint (NOT VALID)
-- Allowed events sent by client today: 'app_install', 'app_launch'
ALTER TABLE public.app_analytics
  ADD CONSTRAINT chk_app_analytics_event_type_allowlist
  CHECK (event_type IN ('app_install', 'app_launch')) NOT VALID;

-- ==============================================================================
-- 4. VALIDATION STEP (Run manually after existing data review)
-- ==============================================================================
-- Once existing rows are reviewed and confirmed compliant, run the following:
--
-- ALTER TABLE public.app_analytics VALIDATE CONSTRAINT chk_app_analytics_event_type_len;
-- ALTER TABLE public.app_analytics VALIDATE CONSTRAINT chk_app_analytics_platform_len;
-- ALTER TABLE public.app_analytics VALIDATE CONSTRAINT chk_app_analytics_display_mode_len;
-- ALTER TABLE public.app_analytics VALIDATE CONSTRAINT chk_app_analytics_app_version_len;
-- ALTER TABLE public.app_analytics VALIDATE CONSTRAINT chk_app_analytics_device_type_len;
-- ALTER TABLE public.app_analytics VALIDATE CONSTRAINT chk_app_analytics_screen_res_len;
-- ALTER TABLE public.app_analytics VALIDATE CONSTRAINT chk_app_analytics_event_type_allowlist;

-- ==============================================================================
-- 5. RLS Policy Status Confirmation
-- ==============================================================================
-- The INSERT policy established in phase5c_analytics_rls.sql remains unchanged:
-- "Allow public insert into app_analytics" FOR INSERT WITH CHECK (true);
-- Permitting anon and authenticated clients to insert telemetry events.
-- The SELECT policy remains restricted strictly to Admin UUID.

-- ==============================================================================
-- 6. ROLLBACK BLOCK (In case of rollback)
-- ==============================================================================
/*
ALTER TABLE IF EXISTS public.app_analytics DROP CONSTRAINT IF EXISTS chk_app_analytics_event_type_allowlist;
ALTER TABLE IF EXISTS public.app_analytics DROP CONSTRAINT IF EXISTS chk_app_analytics_event_type_len;
ALTER TABLE IF EXISTS public.app_analytics DROP CONSTRAINT IF EXISTS chk_app_analytics_platform_len;
ALTER TABLE IF EXISTS public.app_analytics DROP CONSTRAINT IF EXISTS chk_app_analytics_display_mode_len;
ALTER TABLE IF EXISTS public.app_analytics DROP CONSTRAINT IF EXISTS chk_app_analytics_app_version_len;
ALTER TABLE IF EXISTS public.app_analytics DROP CONSTRAINT IF EXISTS chk_app_analytics_device_type_len;
ALTER TABLE IF EXISTS public.app_analytics DROP CONSTRAINT IF EXISTS chk_app_analytics_screen_res_len;
*/
