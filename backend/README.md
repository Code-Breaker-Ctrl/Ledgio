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

1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor**.
3. Paste the contents of `supabase-schema.sql` and run the script.
4. RLS policies will automatically secure all tables so users can only read and write their own financial records.