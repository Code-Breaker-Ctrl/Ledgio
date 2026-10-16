-- ==============================================================================
-- Ledgio — Phase 9b: Analytics User ID Validation (SEC-06)
-- ==============================================================================
-- Idempotent security migration:
-- Recreates public.app_analytics INSERT policy with:
-- 1. Length limits on text fields & event_type allowlist ('app_install', 'app_launch').
-- 2. User ID spoofing protection: enforces (user_id IS NULL OR user_id = auth.uid()).
--    Ensures anonymous events can log (user_id is NULL) while authenticated events
--    cannot spoof other users' IDs.
-- ==============================================================================

ALTER TABLE IF EXISTS public.app_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert into app_analytics" ON public.app_analytics;
DROP POLICY IF EXISTS "Allow insert into app_analytics" ON public.app_analytics;

CREATE POLICY "Allow insert into app_analytics" ON public.app_analytics
  FOR INSERT
  WITH CHECK (
    char_length(event_type) <= 64 AND
    char_length(platform) <= 256 AND
    char_length(display_mode) <= 256 AND
    (app_version IS NULL OR char_length(app_version) <= 256) AND
    (device_type IS NULL OR char_length(device_type) <= 256) AND
    (screen_res IS NULL OR char_length(screen_res) <= 256) AND
    event_type IN ('app_install', 'app_launch') AND
    (user_id IS NULL OR user_id = auth.uid())
  );
