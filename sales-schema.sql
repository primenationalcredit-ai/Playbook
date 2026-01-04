-- Sales/Payments Table for ASAP Playbook
-- Run this in Supabase SQL Editor

-- Main sales table (mirrors your "Total Paid" sheet structure)
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant TEXT NOT NULL,
  date_paid DATE NOT NULL,
  client_name TEXT,
  fee_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  fee_type TEXT, -- 'Doc Fee', 'Partial Payment', 'Final Payment', etc.
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sales_consultant ON sales(consultant);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date_paid);
CREATE INDEX IF NOT EXISTS idx_sales_fee_type ON sales(fee_type);
CREATE INDEX IF NOT EXISTS idx_sales_month ON sales(date_trunc('month', date_paid));

-- Disable RLS for now
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;

-- Create a view for easy monthly stats
CREATE OR REPLACE VIEW sales_monthly_stats AS
SELECT 
  consultant,
  date_trunc('month', date_paid) as month,
  COUNT(*) as transaction_count,
  SUM(fee_paid) as total_sales,
  SUM(CASE WHEN LOWER(fee_type) LIKE '%doc%' THEN fee_paid ELSE 0 END) as doc_fees,
  COUNT(CASE WHEN LOWER(fee_type) LIKE '%doc%' THEN 1 END) as doc_count,
  SUM(CASE WHEN LOWER(fee_type) LIKE '%partial%' THEN fee_paid ELSE 0 END) as partial_fees,
  COUNT(CASE WHEN LOWER(fee_type) LIKE '%partial%' THEN 1 END) as partial_count,
  SUM(CASE WHEN LOWER(fee_type) LIKE '%final%' THEN fee_paid ELSE 0 END) as final_fees,
  COUNT(CASE WHEN LOWER(fee_type) LIKE '%final%' THEN 1 END) as final_count
FROM sales
GROUP BY consultant, date_trunc('month', date_paid);
