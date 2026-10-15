-- ==============================================================================
-- Ledgio — Phase 9: Security Hardening (Profiles & Analytics RLS)
-- ==============================================================================
-- Idempotent security migration:
-- 1. Hardens public.profiles UPDATE policy with WITH CHECK (auth.uid() = id).
-- 2. Hardens public.app_analytics INSERT policy: restricts event types and validates
--    char_length limits on all client-provided text fields, replacing WITH CHECK (true).
-- ==============================================================================

-- 1. Profiles Table RLS Hardening (D1)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Analytics Table RLS Hardening (D2)
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
    event_type IN ('app_install', 'app_launch')
  );
