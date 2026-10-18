-- ==============================================================================
-- Ledgio — Phase 10: Analytics Retention (keeps app_analytics small)
-- ==============================================================================
-- app_analytics gets one row per app launch, so it is the only table that grows
-- on its own (about 330 bytes per launch). This schedules a nightly job that
-- deletes app_launch events older than 90 days. app_install events are kept
-- forever, so the admin install count stays all-time; launch stats become
-- "last 90 days".
--
-- Idempotent: safe to run more than once (the job is replaced, not duplicated).
-- Requires the pg_cron extension (available on Supabase, including the free plan).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove an existing job with the same name so re-running doesn't duplicate it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-app-launch-analytics') THEN
    PERFORM cron.unschedule('prune-app-launch-analytics');
  END IF;
END
$$;

-- Every night at 03:00 UTC
SELECT cron.schedule(
  'prune-app-launch-analytics',
  '0 3 * * *',
  $job$
    DELETE FROM public.app_analytics
    WHERE event_type = 'app_launch'
      AND created_at < now() - interval '90 days'
  $job$
);

-- Check: should list the job as active
-- SELECT jobid, jobname, schedule, active FROM cron.job;
