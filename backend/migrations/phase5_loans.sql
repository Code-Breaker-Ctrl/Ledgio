-- ==============================================================================
-- Ledgio — Phase 5: Loans & Debts (People-Centric Settle-Up Ledger)
-- ==============================================================================
-- Architecture:
-- 1. loans: defines principal loans lent to or borrowed from people.
--    Outstanding balance is NEVER stored in the database — computed client-side as:
--    principal - SUM(loan_settlements.amount). Status = 'settled' when outstanding = 0.
-- 2. loan_settlements: first-class ledger records of partial payments, full settle-ups,
--    or write-offs. Cascade deletes with parent loan.
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

-- 1. Create loans table (Metadata & Principal Only)
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
  principal NUMERIC NOT NULL CHECK (principal > 0),
  loan_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_loans_updated_at ON public.loans;
CREATE TRIGGER set_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_loans_user_updated ON public.loans (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_person_name ON public.loans (user_id, person_name);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own loans" ON public.loans;
CREATE POLICY "Users can manage own loans" ON public.loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Create loan_settlements table (First-Class Ledger Records)
CREATE TABLE IF NOT EXISTS public.loan_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  settle_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.loan_settlements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_loan_settlements_updated_at ON public.loan_settlements;
CREATE TRIGGER set_loan_settlements_updated_at
  BEFORE UPDATE ON public.loan_settlements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_loan_settlements_loan_id ON public.loan_settlements (loan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_settlements_user_updated ON public.loan_settlements (user_id, updated_at DESC);

ALTER TABLE public.loan_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own loan settlements" ON public.loan_settlements;
CREATE POLICY "Users can manage own loan settlements" ON public.loan_settlements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
