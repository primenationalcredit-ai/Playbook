-- PTO (Paid Time Off) Management Schema for ASAP Playbook

-- PTO Policies (company-wide rules)
CREATE TABLE IF NOT EXISTS pto_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "Standard PTO", "Executive PTO"
  description TEXT,
  -- Annual allocation
  annual_days DECIMAL(5,2) NOT NULL DEFAULT 10, -- Total days per year
  -- Accrual settings
  accrual_type TEXT DEFAULT 'annual', -- 'annual' (all at once), 'monthly', 'per_pay_period', 'hourly'
  accrual_rate DECIMAL(5,2), -- Days per period (if monthly/per_pay_period)
  -- Expiration settings
  expires BOOLEAN DEFAULT false,
  expiration_type TEXT DEFAULT 'calendar_year', -- 'calendar_year', 'anniversary', 'custom_date'
  expiration_date DATE, -- For custom expiration
  -- Rollover settings
  allow_rollover BOOLEAN DEFAULT false,
  max_rollover_days DECIMAL(5,2) DEFAULT 0, -- Max days that can roll over
  -- Caps
  max_balance DECIMAL(5,2), -- Maximum PTO balance allowed (null = unlimited)
  -- Waiting period
  waiting_period_days INTEGER DEFAULT 0, -- Days before new employees can use PTO
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User PTO Balances
CREATE TABLE IF NOT EXISTS pto_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES pto_policies(id),
  -- Current balances
  balance DECIMAL(5,2) NOT NULL DEFAULT 0, -- Current available days
  used DECIMAL(5,2) NOT NULL DEFAULT 0, -- Days used this period
  pending DECIMAL(5,2) NOT NULL DEFAULT 0, -- Days in pending requests
  accrued_ytd DECIMAL(5,2) NOT NULL DEFAULT 0, -- Total accrued this year
  -- Rollover
  rolled_over DECIMAL(5,2) DEFAULT 0, -- Days rolled over from last period
  -- Dates
  period_start DATE, -- Start of current accrual period
  period_end DATE, -- End of current accrual period (expiration)
  last_accrual_date DATE, -- Last time PTO was accrued
  hire_date DATE, -- For anniversary-based calculations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- PTO Transactions (audit trail)
CREATE TABLE IF NOT EXISTS pto_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'accrual', 'used', 'adjustment', 'rollover', 'expired', 'pending', 'pending_released'
  amount DECIMAL(5,2) NOT NULL, -- Positive for additions, negative for deductions
  balance_after DECIMAL(5,2) NOT NULL, -- Balance after this transaction
  description TEXT,
  time_off_request_id UUID REFERENCES time_off_requests(id), -- Link to request if applicable
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add policy_id to users table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pto_policy_id') THEN
    ALTER TABLE users ADD COLUMN pto_policy_id UUID REFERENCES pto_policies(id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pto_balances_user ON pto_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_pto_transactions_user ON pto_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pto_transactions_date ON pto_transactions(created_at);

-- Disable RLS
ALTER TABLE pto_policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE pto_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE pto_transactions DISABLE ROW LEVEL SECURITY;

-- Insert default policy
INSERT INTO pto_policies (name, description, annual_days, accrual_type, expires, expiration_type, allow_rollover, max_rollover_days)
VALUES 
  ('Standard PTO', 'Default PTO policy for all employees', 10, 'annual', true, 'calendar_year', true, 5),
  ('Senior Employee', 'Enhanced PTO for employees with 3+ years', 15, 'annual', true, 'calendar_year', true, 10),
  ('Unlimited PTO', 'Unlimited PTO policy (tracked but not capped)', 999, 'annual', false, 'calendar_year', false, 0)
ON CONFLICT DO NOTHING;

-- Function to calculate days between dates (for PTO deduction)
CREATE OR REPLACE FUNCTION calculate_business_days(start_date DATE, end_date DATE)
RETURNS INTEGER AS $$
DECLARE
  total_days INTEGER := 0;
  check_date DATE := start_date;
BEGIN
  WHILE check_date <= end_date LOOP
    -- Count only weekdays (Mon-Fri)
    IF EXTRACT(DOW FROM check_date) NOT IN (0, 6) THEN
      total_days := total_days + 1;
    END IF;
    check_date := check_date + 1;
  END LOOP;
  RETURN total_days;
END;
$$ LANGUAGE plpgsql;
