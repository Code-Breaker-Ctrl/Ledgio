# 💎 Ledgio — The Intelligent Private Financial Ledger

<div align="center">

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Supabase](https://img.shields.io/badge/Database-Supabase%20Postgres-emerald.svg)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)
![Currency](https://img.shields.io/badge/Currency-%E2%82%B9%20INR%20%2F%20Multi--Currency-purple.svg)

**An intelligent visual ledger engineered for precision, speed, and 100% private personal budgeting.**

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Database Schema](#-database-schema) • [Tech Stack](#-tech-stack)

</div>

---

## 🌟 Highlights & Features

### 🌌 3D Interactive UI & Ambient Lighting
- **Scroll-Driven Ambient Mesh**: Floating 3D background orbs dynamically morph colors across sections (Indigo → Emerald → Purple → Cosmic Sapphire).
- **Mouse-Tracking 3D Tilt**: Device mockup responds in real-time to cursor coordinates with 3D perspective transforms.
- **Glassmorphic Floating Chips**: Real-time pop-out transaction chips with subtle levitation physics and layered shadows.

### 🇮🇳 Indian Rupee (₹) & Multi-Currency Engine
- **Native ₹ INR Formatting**: Formatted with standard Indian number grouping (`en-IN` Lakhs/Crores e.g., `₹1,50,000.00`).
- **Quick Currency Switcher**: 1-click header switcher supporting `₹ INR`, `$ USD`, `€ EUR`, `£ GBP`, `د.إ AED`, `S$ SGD`, `CA$ CAD`, `A$ AUD`, `¥ JPY`, and more.

### 🛡️ Supabase PostgreSQL Cloud Sync & Authentication
- **Real Accounts**: Secure email & password signup/login with Bcrypt encryption.
- **Row Level Security (RLS)**: PostgreSQL policies guarantee complete data isolation between accounts.
- **Real-Time Cloud Persistence**: Instant synchronization for all income, expenses, and category budget caps.

### 📊 Comprehensive Financial Management
- **10 Smart Categories**: Food & Dining, Transport, Housing, Entertainment, Shopping, Health, Education, Bills & Utilities, Savings, Other.
- **Live Category Spending Caps**: Dynamic visual progress bars (<75% Green, 75-90% Yellow, >90% Red).
- **6-Month Trend Visuals**: Interactive Chart.js analytics for spending trajectory and category breakdowns.
- **Multi-Format Export**: Download transaction ledgers in CSV spreadsheets (`ledgio_export.csv`) or full JSON backups.
- **Cosmic Dark Mode**: OLED-optimized dark theme with instant toggle.

---

## 🏗️ Architecture & File Structure

```
ledgio/
├── index.html            # Next-Gen 3D SaaS Landing Page & Live Simulator
├── login.html            # Luxury Split-Screen Login Page
├── signup.html           # Luxury Split-Screen Signup with Strength Meter
├── dashboard.html        # Main Financial Management App (5 View Tabs)
├── app.js                # Core App State Engine & Supabase Cloud Sync
├── auth.js               # Supabase Auth Handlers & Guard System
├── supabase-config.js    # Cloud Database Client Configuration
├── styles.css            # 3D SaaS Design Tokens, Mesh Lighting & Auth CSS
├── dashboard.css         # Dashboard Components, Grids, Badges & Animations
├── manifest.json         # PWA Web App Manifest
└── README.md             # Project Documentation
```

---

## 🗄️ Database Schema

```sql
-- User Profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  currency text default 'INR',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expenses Ledger
create table public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  amount numeric not null,
  category text not null default 'other',
  date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Monthly Category Budgets
create table public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  monthly_limit numeric not null,
  unique(user_id, category)
);
```

---

## 🚀 Quick Start Guide

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Code-Breaker-Ctrl/Smart-Budget-Planner-Website.git
   cd Smart-Budget-Planner-Website
   ```

2. **Configure Supabase**:
   Open `supabase-config.js` and ensure your Supabase project URL and anon public key are set:
   ```javascript
   window.SUPABASE_CONFIG = {
     url: 'https://your-project.supabase.co',
     anonKey: 'your-anon-public-key'
   };
   ```

3. **Launch the App**:
   Simply open `index.html` in any web browser, or serve with VS Code Live Server!

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 Glassmorphism
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Auth)
- **Charts & Visuals**: [Chart.js](https://www.chartjs.org/)
- **Icons & Typography**: Font Awesome 6, Plus Jakarta Sans, Poppins
- **Design System**: Custom CSS Variables, Dynamic Mesh Lighting, 3D CSS Transforms

---

## 📄 License

This project is licensed under the MIT License — free for personal and commercial use.
