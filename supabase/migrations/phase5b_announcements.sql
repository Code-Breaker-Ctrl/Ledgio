-- ==============================================================================
-- Ledgio — Phase 5b: System Announcements & Admin Broadcasts
-- ==============================================================================
-- Architecture:
-- 1. announcements table: provides broadcast announcements from administrators
--    to all active users.
-- 2. RLS Security Model:
--    - SELECT: Allowed for all authenticated users.
--    - INSERT: Restricted strictly to the fixed Admin user UUID (583ea03b-2246-482f-8a92-670c5c0b7c4f).
--    - UPDATE / DELETE: Disallowed via client RLS policies.
-- ==============================================================================

-- 1. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for quick retrieval of latest announcements
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements (created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: All authenticated users can read announcements
DROP POLICY IF EXISTS "Allow authenticated users to read announcements" ON public.announcements;
CREATE POLICY "Allow authenticated users to read announcements" ON public.announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. RLS Policy: Only Admin can insert announcements
DROP POLICY IF EXISTS "Allow admin to insert announcements" ON public.announcements;
CREATE POLICY "Allow admin to insert announcements" ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = '583ea03b-2246-482f-8a92-670c5c0b7c4f'::uuid);
