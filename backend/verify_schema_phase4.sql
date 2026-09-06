-- ==============================================================================
-- Ledgio — Schema Verification Query for Phase 4 (Milestone 4.1)
-- Run this in Supabase SQL Editor after running phase4_savings_goals.sql
-- ==============================================================================

SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public' 
  AND c.table_name IN ('goals', 'goal_deposits')
ORDER BY c.table_name, c.ordinal_position;

-- Verify Foreign Key and Cascade rules
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('goals', 'goal_deposits');
