-- ==============================================================================
-- Ledgio — Schema & RLS Policy Verification Query (Phase 9 & 9b Hardening)
-- ==============================================================================
-- Run this query in Supabase SQL Editor (https://supabase.com/dashboard)
-- to assert all security and RLS hardening policies are correctly applied.
-- Returns one row per assertion with PASS/FAIL status.
-- ==============================================================================

WITH checks AS (
  -- 1. Check profiles update policy has both USING and WITH CHECK
  SELECT 
    '1. Profiles UPDATE policy enforces both USING and WITH CHECK' AS assertion,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'profiles' 
          AND cmd = 'UPDATE' 
          AND qual IS NOT NULL 
          AND with_check IS NOT NULL
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS result,
    COALESCE(
      (SELECT format('policy: %s, using: %s, with_check: %s', policyname, qual, with_check)
       FROM pg_policies 
       WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'UPDATE' LIMIT 1),
      'No UPDATE policy found on public.profiles'
    ) AS details

  UNION ALL

  -- 2. Check app_analytics insert policy exists with char_length, event_type, and user_id checks
  SELECT 
    '2. Analytics INSERT policy constrains event_type, char_length, and user_id' AS assertion,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'app_analytics' 
          AND cmd = 'INSERT' 
          AND with_check ILIKE '%char_length%'
          AND with_check ILIKE '%event_type%'
          AND with_check ILIKE '%auth.uid()%'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS result,
    COALESCE(
      (SELECT format('policy: %s, with_check: %s', policyname, with_check)
       FROM pg_policies 
       WHERE schemaname = 'public' AND tablename = 'app_analytics' AND cmd = 'INSERT' LIMIT 1),
      'No constrained INSERT policy found on public.app_analytics'
    ) AS details

  UNION ALL

  -- 3. Check no policy on app_analytics has permissive WITH CHECK (true)
  SELECT 
    '3. No policy on app_analytics permits unrestricted WITH CHECK (true)' AS assertion,
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'app_analytics' 
          AND (TRIM(with_check) = 'true' OR with_check = 'true'::text)
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS result,
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'app_analytics' 
          AND (TRIM(with_check) = 'true' OR with_check = 'true'::text)
      ) THEN 'Confirmed: 0 permissive with_check (true) policies exist on app_analytics'
      ELSE 'Warning: Permissive with_check = true policy still active on app_analytics'
    END AS details

  UNION ALL

  -- 4. Check RLS is enabled on all active application tables
  SELECT 
    '4. Row Level Security (RLS) is active on all Ledgio application tables' AS assertion,
    CASE 
      WHEN (
        SELECT COUNT(*) 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relname IN (
            'profiles', 'expenses', 'budgets', 'goals', 'goal_deposits', 
            'loans', 'loan_settlements', 'income_entries', 'user_categories', 
            'app_analytics', 'announcements'
          )
          AND c.relrowsecurity = false
      ) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END AS result,
    (
      SELECT format('Tables checked: %s; Unsecured: %s', 
        (SELECT string_agg(c.relname, ', ') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('profiles', 'expenses', 'budgets', 'goals', 'goal_deposits', 'loans', 'loan_settlements', 'income_entries', 'user_categories', 'app_analytics', 'announcements')),
        COALESCE((SELECT string_agg(c.relname, ', ') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('profiles', 'expenses', 'budgets', 'goals', 'goal_deposits', 'loans', 'loan_settlements', 'income_entries', 'user_categories', 'app_analytics', 'announcements') AND c.relrowsecurity = false), 'None')
      )
    ) AS details
)
SELECT assertion, result, details FROM checks;
