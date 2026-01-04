-- Optimized Views for Payment Dashboard
-- Run this in Supabase SQL Editor

-- Today's stats view
CREATE OR REPLACE VIEW sales_today AS
SELECT 
  COALESCE(SUM(fee_paid), 0) as total_sales,
  COUNT(*) as transaction_count,
  COUNT(CASE WHEN LOWER(fee_type) LIKE '%doc%' THEN 1 END) as docs,
  COALESCE(SUM(CASE WHEN LOWER(fee_type) LIKE '%doc%' THEN fee_paid END), 0) as docs_amount,
  COUNT(CASE WHEN LOWER(fee_type) LIKE '%partial%' THEN 1 END) as partials,
  COALESCE(SUM(CASE WHEN LOWER(fee_type) LIKE '%partial%' THEN fee_paid END), 0) as partials_amount,
  COUNT(CASE WHEN LOWER(fee_type) LIKE '%final%' THEN 1 END) as finals,
  COALESCE(SUM(CASE WHEN LOWER(fee_type) LIKE '%final%' THEN fee_paid END), 0) as finals_amount
FROM sales
WHERE date_paid = CURRENT_DATE;

-- Monthly stats by consultant (for any month)
CREATE OR REPLACE FUNCTION get_monthly_stats(target_year INT, target_month INT)
RETURNS TABLE (
  consultant TEXT,
  total_sales DECIMAL,
  transaction_count BIGINT,
  docs BIGINT,
  docs_amount DECIMAL,
  partials BIGINT,
  partials_amount DECIMAL,
  finals BIGINT,
  finals_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.consultant,
    COALESCE(SUM(s.fee_paid), 0)::DECIMAL as total_sales,
    COUNT(*)::BIGINT as transaction_count,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%doc%' THEN 1 END)::BIGINT as docs,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%doc%' THEN s.fee_paid END), 0)::DECIMAL as docs_amount,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%partial%' THEN 1 END)::BIGINT as partials,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%partial%' THEN s.fee_paid END), 0)::DECIMAL as partials_amount,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%final%' THEN 1 END)::BIGINT as finals,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%final%' THEN s.fee_paid END), 0)::DECIMAL as finals_amount
  FROM sales s
  WHERE EXTRACT(YEAR FROM s.date_paid) = target_year
    AND EXTRACT(MONTH FROM s.date_paid) = target_month
  GROUP BY s.consultant
  ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql;

-- Monthly totals (aggregated)
CREATE OR REPLACE FUNCTION get_month_totals(target_year INT, target_month INT)
RETURNS TABLE (
  total_sales DECIMAL,
  transaction_count BIGINT,
  docs BIGINT,
  docs_amount DECIMAL,
  partials BIGINT,
  partials_amount DECIMAL,
  finals BIGINT,
  finals_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.fee_paid), 0)::DECIMAL as total_sales,
    COUNT(*)::BIGINT as transaction_count,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%doc%' THEN 1 END)::BIGINT as docs,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%doc%' THEN s.fee_paid END), 0)::DECIMAL as docs_amount,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%partial%' THEN 1 END)::BIGINT as partials,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%partial%' THEN s.fee_paid END), 0)::DECIMAL as partials_amount,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%final%' THEN 1 END)::BIGINT as finals,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%final%' THEN s.fee_paid END), 0)::DECIMAL as finals_amount
  FROM sales s
  WHERE EXTRACT(YEAR FROM s.date_paid) = target_year
    AND EXTRACT(MONTH FROM s.date_paid) = target_month;
END;
$$ LANGUAGE plpgsql;

-- YTD totals
CREATE OR REPLACE FUNCTION get_ytd_totals(target_year INT)
RETURNS TABLE (
  total_sales DECIMAL,
  transaction_count BIGINT,
  docs BIGINT,
  partials BIGINT,
  finals BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.fee_paid), 0)::DECIMAL as total_sales,
    COUNT(*)::BIGINT as transaction_count,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%doc%' THEN 1 END)::BIGINT as docs,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%partial%' THEN 1 END)::BIGINT as partials,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%final%' THEN 1 END)::BIGINT as finals
  FROM sales s
  WHERE EXTRACT(YEAR FROM s.date_paid) = target_year;
END;
$$ LANGUAGE plpgsql;

-- YTD stats by consultant
CREATE OR REPLACE FUNCTION get_ytd_by_consultant(target_year INT)
RETURNS TABLE (
  consultant TEXT,
  total_sales DECIMAL,
  transaction_count BIGINT,
  docs BIGINT,
  docs_amount DECIMAL,
  partials BIGINT,
  partials_amount DECIMAL,
  finals BIGINT,
  finals_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.consultant,
    COALESCE(SUM(s.fee_paid), 0)::DECIMAL as total_sales,
    COUNT(*)::BIGINT as transaction_count,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%doc%' THEN 1 END)::BIGINT as docs,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%doc%' THEN s.fee_paid END), 0)::DECIMAL as docs_amount,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%partial%' THEN 1 END)::BIGINT as partials,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%partial%' THEN s.fee_paid END), 0)::DECIMAL as partials_amount,
    COUNT(CASE WHEN LOWER(s.fee_type) LIKE '%final%' THEN 1 END)::BIGINT as finals,
    COALESCE(SUM(CASE WHEN LOWER(s.fee_type) LIKE '%final%' THEN s.fee_paid END), 0)::DECIMAL as finals_amount
  FROM sales s
  WHERE EXTRACT(YEAR FROM s.date_paid) = target_year
  GROUP BY s.consultant
  ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql;

-- Add index for faster date queries
CREATE INDEX IF NOT EXISTS idx_sales_year_month ON sales(EXTRACT(YEAR FROM date_paid), EXTRACT(MONTH FROM date_paid));
