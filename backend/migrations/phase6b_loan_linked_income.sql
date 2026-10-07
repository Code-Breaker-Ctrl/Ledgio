-- Phase 6b: Add loan_id and settlement_id foreign key references to income_entries
-- Enables double-entry loan adjustment tracking without losing linkage in cloud sync

ALTER TABLE income_entries 
  ADD COLUMN IF NOT EXISTS loan_id uuid NULL REFERENCES loans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_id uuid NULL;

-- Index for fast lookup of loan adjustments
CREATE INDEX IF NOT EXISTS idx_income_entries_loan_id ON income_entries(loan_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_settlement_id ON income_entries(settlement_id);

-- Verification Query:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'income_entries' AND column_name IN ('loan_id', 'settlement_id');
