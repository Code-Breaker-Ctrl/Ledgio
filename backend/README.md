# Ledgio — Backend & Database Layer

This directory contains the database schemas, Row Level Security (RLS) policies, and telemetry migrations for **Ledgio** powered by **Supabase PostgreSQL**.

---

## 🗄️ Architecture Overview

```
backend/
├── README.md               # Backend documentation & deployment guide
└── supabase-schema.sql     # Production SQL DDL (Tables, Indexes, RLS, Triggers)
```

---

## 📋 Database Schema Summary

### 1. `profiles`
Stores user settings, global preferences, and monthly total income.
* `id` (UUID, Primary Key, references `auth.users`)
* `full_name` (Text)
* `currency` (Text, default `'INR'`)
* `dark_mode` (Boolean, default `false`)
* `income` (Numeric, default `0`)
* `updated_at` (Timestamp)

### 2. `expenses`
Stores ledger transactions with high precision and categorization.
* `id` (UUID, Primary Key)
* `user_id` (UUID, references `auth.users`)
* `name` (Text)
* `amount` (Numeric)
* `category` (Text)
* `date` (Date)
* `created_at` (Timestamp)

### 3. `budgets`
Stores category spending limits.
* `id` (UUID, Primary Key)
* `user_id` (UUID, references `auth.users`)
* `category` (Text)
* `limit_amount` (Numeric)

### 4. `app_analytics`
Anonymous telemetry for app launches, standalone PWA ratio, and platform breakdown.
* `id` (UUID, Primary Key)
* `user_id` (UUID, optional)
* `event_name` (Text)
* `platform` (Text)
* `display_mode` (Text)
* `created_at` (Timestamp)

---

## 🚀 Setup & Execution

### Option A: Fresh Database Installation
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor**.
3. Paste the contents of `supabase-schema.sql` and run the script.
4. RLS policies will automatically secure all tables so users can only read and write their own financial records.

### Option B: Incremental Migration Sequence
For existing Ledgio installations, run the migration scripts in `backend/migrations/` in the following sequence:

1. `phase3_offline_sync.sql` — Offline sync queue support, timestamps, and profiles sync
2. `phase4_savings_goals.sql` — Savings goals and milestone deposits tables & RLS
3. `phase5_loans.sql` — Personal loans and settlement tracking
4. `phase5b_announcements.sql` — Admin announcements broadcasts
5. `phase5c_analytics_rls.sql` — Telemetry table RLS lockdown (admin-only SELECT)
6. `phase5d_analytics_hardening.sql` — Check constraints on telemetry string lengths and event allowlist
7. `phase6_income_entries.sql` — Discrete income entries ledger and opening balance locks
8. `phase6b_loan_linked_income.sql` — Double-entry references linking loans to income entries
9. `phase7_categories.sql` — Custom user expense and income categories
10. `phase7b_reset_epoch.sql` — Multi-device reset epoch coordination
11. `phase8_loan_kinds.sql` — Loan kind classification (`cash` vs `on_behalf`)
12. `phase9_hardening.sql` — Security hardening: profiles UPDATE `WITH CHECK (auth.uid() = id)` and telemetry INSERT policy constraints
13. `phase9b_analytics_userid.sql` — Telemetry user_id validation: enforces `(user_id IS NULL OR user_id = auth.uid())` against spoofing
14. `phase10_analytics_retention.sql` — Nightly pg_cron job deleting `app_launch` analytics older than 90 days (installs kept forever). Check with `SELECT jobname, schedule, active FROM cron.job;`

---

## 🔍 Verification Queries

To assert database health and policy validity after migrations:
* `backend/verify_schema_phase4.sql` — Verify goals schema and foreign keys
* `backend/verify_schema_phase5.sql` — Verify loans and settlements schema
* `backend/verify_schema_phase9.sql` — Run in Supabase SQL Editor to verify RLS activation on all tables, profiles `WITH CHECK` enforcement, and analytics anti-spoofing constraints (returns PASS/FAIL table)