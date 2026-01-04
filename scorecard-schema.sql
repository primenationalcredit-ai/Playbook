-- =====================================================
-- SCORE CARDS SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- Scorecard Metrics Definition (admin creates these)
CREATE TABLE IF NOT EXISTS scorecard_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "Sold Clients"
  key TEXT NOT NULL UNIQUE, -- e.g., "sold_clients" (used by Zapier)
  description TEXT,
  department TEXT NOT NULL, -- which department this applies to
  metric_type TEXT DEFAULT 'number', -- number, percentage, currency
  direction TEXT DEFAULT 'higher_better', -- higher_better, lower_better
  unit TEXT, -- e.g., "$", "%", "clients"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scorecard Thresholds (green/yellow/red targets)
CREATE TABLE IF NOT EXISTS scorecard_thresholds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_id UUID REFERENCES scorecard_metrics(id) ON DELETE CASCADE,
  period_type TEXT DEFAULT 'monthly', -- daily, weekly, monthly
  green_min DECIMAL, -- >= this is green (for higher_better)
  yellow_min DECIMAL, -- >= this is yellow
  red_max DECIMAL, -- below this is red
  -- For lower_better metrics, logic is reversed
  applies_to TEXT DEFAULT 'all', -- 'all' or specific user_id
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Scorecard Entries (data from Zapier or manual)
CREATE TABLE IF NOT EXISTS scorecard_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metric_id UUID REFERENCES scorecard_metrics(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  value DECIMAL NOT NULL,
  notes TEXT,
  source TEXT DEFAULT 'zapier', -- zapier, manual, calculated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metric_id, entry_date)
);

-- Scorecard Focus (which metrics are currently in focus)
CREATE TABLE IF NOT EXISTS scorecard_focus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_id UUID REFERENCES scorecard_metrics(id) ON DELETE CASCADE,
  department TEXT, -- null = company-wide focus
  user_id UUID REFERENCES users(id), -- null = whole department
  is_focused BOOLEAN DEFAULT true,
  quarter TEXT, -- e.g., "2025-Q1"
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scorecard_entries_user_date ON scorecard_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_scorecard_entries_metric_date ON scorecard_entries(metric_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_scorecard_metrics_dept ON scorecard_metrics(department);
CREATE INDEX IF NOT EXISTS idx_scorecard_thresholds_metric ON scorecard_thresholds(metric_id);

-- Disable RLS for internal tool
ALTER TABLE scorecard_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_thresholds DISABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_focus DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- DEFAULT METRICS
-- =====================================================

-- Credit Consultants Metrics
INSERT INTO scorecard_metrics (name, key, description, department, metric_type, direction, unit) VALUES
  ('Consultations', 'consultations', 'Number of consultations conducted', 'credit_consultants', 'number', 'higher_better', 'consultations'),
  ('Sold Clients', 'sold_clients', 'Number of new clients signed', 'credit_consultants', 'number', 'higher_better', 'clients'),
  ('New Affiliates', 'new_affiliates', 'Number of new affiliate partners acquired', 'credit_consultants', 'number', 'higher_better', 'affiliates'),
  ('Affiliate Leads', 'affiliate_leads', 'Number of leads referred by affiliates', 'credit_consultants', 'number', 'higher_better', 'leads'),
  ('Affiliate Sales', 'affiliate_sales', 'Number of affiliate-referred leads that sold', 'credit_consultants', 'number', 'higher_better', 'sales'),
  ('Client Reviews', 'client_reviews', 'Number of client reviews collected', 'credit_consultants', 'number', 'higher_better', 'reviews'),
  ('Client Referrals', 'client_referrals', 'Number of referrals from existing clients', 'credit_consultants', 'number', 'higher_better', 'referrals')
ON CONFLICT (key) DO NOTHING;

-- Account Managers Metrics
INSERT INTO scorecard_metrics (name, key, description, department, metric_type, direction, unit) VALUES
  ('Total Clients', 'am_total_clients', 'Total number of active clients managed', 'account_managers', 'number', 'higher_better', 'clients'),
  ('Stalled - Past Due', 'am_stalled_pastdue', 'Clients stalled due to past due payments', 'account_managers', 'number', 'lower_better', 'clients'),
  ('Stalled - No Reports', 'am_stalled_noreports', 'Clients stalled due to missing updated reports', 'account_managers', 'number', 'lower_better', 'clients'),
  ('Satisfied Clients', 'am_satisfied', 'Number of satisfied clients', 'account_managers', 'number', 'higher_better', 'clients'),
  ('Unsatisfied Clients', 'am_unsatisfied', 'Number of unsatisfied clients', 'account_managers', 'number', 'lower_better', 'clients'),
  ('Secured Card Enrollments', 'am_secured_cards', 'Number of secured credit card enrollments', 'account_managers', 'number', 'higher_better', 'enrollments')
ON CONFLICT (key) DO NOTHING;

-- Leadership Metrics (placeholders)
INSERT INTO scorecard_metrics (name, key, description, department, metric_type, direction, unit) VALUES
  ('Team Revenue', 'leadership_revenue', 'Total team revenue', 'leadership', 'currency', 'higher_better', '$'),
  ('Client Retention', 'leadership_retention', 'Client retention rate', 'leadership', 'percentage', 'higher_better', '%'),
  ('Expense Ratio', 'leadership_expense_ratio', 'Operating expense ratio', 'leadership', 'percentage', 'lower_better', '%')
ON CONFLICT (key) DO NOTHING;

-- Credit Team Metrics (placeholders)
INSERT INTO scorecard_metrics (name, key, description, department, metric_type, direction, unit) VALUES
  ('Disputes Filed', 'ct_disputes_filed', 'Number of disputes filed', 'credit_team', 'number', 'higher_better', 'disputes'),
  ('Items Removed', 'ct_items_removed', 'Number of negative items removed', 'credit_team', 'number', 'higher_better', 'items')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- DEFAULT THRESHOLDS (examples - adjust as needed)
-- =====================================================

-- Get metric IDs and insert thresholds
DO $$
DECLARE
  sold_clients_id UUID;
  consultations_id UUID;
  reviews_id UUID;
BEGIN
  SELECT id INTO sold_clients_id FROM scorecard_metrics WHERE key = 'sold_clients';
  SELECT id INTO consultations_id FROM scorecard_metrics WHERE key = 'consultations';
  SELECT id INTO reviews_id FROM scorecard_metrics WHERE key = 'client_reviews';
  
  -- Sold Clients: Green >= 8, Yellow >= 4, Red < 4
  IF sold_clients_id IS NOT NULL THEN
    INSERT INTO scorecard_thresholds (metric_id, period_type, green_min, yellow_min, red_max)
    VALUES (sold_clients_id, 'monthly', 8, 4, 4)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Consultations: Green >= 40, Yellow >= 20, Red < 20
  IF consultations_id IS NOT NULL THEN
    INSERT INTO scorecard_thresholds (metric_id, period_type, green_min, yellow_min, red_max)
    VALUES (consultations_id, 'monthly', 40, 20, 20)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Reviews: Green >= 10, Yellow >= 5, Red < 5
  IF reviews_id IS NOT NULL THEN
    INSERT INTO scorecard_thresholds (metric_id, period_type, green_min, yellow_min, red_max)
    VALUES (reviews_id, 'monthly', 10, 5, 5)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- ZAPIER WEBHOOK FUNCTION (Optional - for direct inserts)
-- =====================================================

-- Function to upsert scorecard entry (for Zapier)
CREATE OR REPLACE FUNCTION upsert_scorecard_entry(
  p_user_email TEXT,
  p_metric_key TEXT,
  p_value DECIMAL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_metric_id UUID;
  v_result JSON;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id FROM users WHERE email = p_user_email;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Get metric ID from key
  SELECT id INTO v_metric_id FROM scorecard_metrics WHERE key = p_metric_key;
  IF v_metric_id IS NULL THEN
    RETURN json_build_object('error', 'Metric not found');
  END IF;
  
  -- Upsert the entry
  INSERT INTO scorecard_entries (user_id, metric_id, entry_date, value, notes, source)
  VALUES (v_user_id, v_metric_id, p_date, p_value, p_notes, 'zapier')
  ON CONFLICT (user_id, metric_id, entry_date) 
  DO UPDATE SET value = EXCLUDED.value, notes = EXCLUDED.notes, updated_at = NOW();
  
  RETURN json_build_object('success', true, 'user_id', v_user_id, 'metric_id', v_metric_id);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DONE!
-- =====================================================
