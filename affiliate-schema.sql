-- =====================================================
-- AFFILIATE TRACKING SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- Affiliates Table
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Info
  name TEXT NOT NULL,
  organization_name TEXT,
  type TEXT DEFAULT 'other', -- realtor, loan_officer, car_dealer, attorney, cpa, other
  classification TEXT DEFAULT 'referrer', -- affiliate (paid) or referrer (unpaid)
  
  -- Contact Info
  email TEXT,
  phone TEXT,
  
  -- Ownership
  consultant_id UUID REFERENCES users(id), -- Which consultant owns this affiliate
  
  -- Dates
  acquired_date DATE DEFAULT CURRENT_DATE,
  pipedrive_created_date DATE,
  
  -- Stats (updated by Zapier or calculated)
  leads_count INTEGER DEFAULT 0, -- # of active leads
  sold_count INTEGER DEFAULT 0, -- # of sold clients
  inactive_count INTEGER DEFAULT 0, -- # of inactive/lost
  total_revenue DECIMAL DEFAULT 0, -- Total revenue from their referrals
  
  -- Follow-up Tracking
  last_followup_date DATE,
  next_followup_date DATE,
  followup_stage TEXT DEFAULT 'day_1', -- day_1, day_7, day_30, monthly
  
  -- Status
  status TEXT DEFAULT 'active', -- active, inactive, churned
  notes TEXT,
  
  -- Pipedrive Integration
  pipedrive_id TEXT UNIQUE,
  pipedrive_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate Follow-up Log
CREATE TABLE IF NOT EXISTS affiliate_followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  consultant_id UUID REFERENCES users(id),
  followup_date DATE DEFAULT CURRENT_DATE,
  followup_type TEXT, -- call, email, meeting, text
  notes TEXT,
  outcome TEXT, -- connected, voicemail, no_answer, scheduled_meeting
  next_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate Referrals (tracks each lead/client from an affiliate)
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  
  -- Client Info
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  
  -- Status
  status TEXT DEFAULT 'lead', -- lead, consultation, sold, active, inactive, cancelled
  
  -- Dates
  referred_date DATE DEFAULT CURRENT_DATE,
  consultation_date DATE,
  sold_date DATE,
  
  -- Revenue
  deal_value DECIMAL,
  commission_paid DECIMAL DEFAULT 0,
  commission_status TEXT DEFAULT 'pending', -- pending, paid, waived
  
  -- Pipedrive
  pipedrive_deal_id TEXT,
  pipedrive_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_consultant ON affiliates(consultant_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_next_followup ON affiliates(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_affiliates_pipedrive ON affiliates(pipedrive_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_followups_affiliate ON affiliate_followups(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_status ON affiliate_referrals(status);

-- Disable RLS for internal tool
ALTER TABLE affiliates DISABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_followups DISABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FOLLOW-UP SCHEDULE FUNCTION
-- Calculates next follow-up date based on stage
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_next_followup(
  p_acquired_date DATE,
  p_last_followup DATE,
  p_current_stage TEXT
) RETURNS TABLE (next_date DATE, next_stage TEXT) AS $$
BEGIN
  -- Follow-up schedule: Day 1, Day 7, Day 30, then monthly
  IF p_current_stage = 'day_1' OR p_current_stage IS NULL THEN
    RETURN QUERY SELECT p_acquired_date, 'day_1'::TEXT;
  ELSIF p_current_stage = 'day_7' THEN
    RETURN QUERY SELECT p_acquired_date + INTERVAL '7 days', 'day_7'::TEXT;
  ELSIF p_current_stage = 'day_30' THEN
    RETURN QUERY SELECT p_acquired_date + INTERVAL '30 days', 'day_30'::TEXT;
  ELSE
    -- Monthly: next follow-up is 30 days from last
    RETURN QUERY SELECT COALESCE(p_last_followup, p_acquired_date) + INTERVAL '30 days', 'monthly'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-update affiliate stats
-- =====================================================

CREATE OR REPLACE FUNCTION update_affiliate_stats() RETURNS TRIGGER AS $$
BEGIN
  -- Update the affiliate's counts
  UPDATE affiliates SET
    leads_count = (
      SELECT COUNT(*) FROM affiliate_referrals 
      WHERE affiliate_id = COALESCE(NEW.affiliate_id, OLD.affiliate_id) 
      AND status = 'lead'
    ),
    sold_count = (
      SELECT COUNT(*) FROM affiliate_referrals 
      WHERE affiliate_id = COALESCE(NEW.affiliate_id, OLD.affiliate_id) 
      AND status IN ('sold', 'active')
    ),
    inactive_count = (
      SELECT COUNT(*) FROM affiliate_referrals 
      WHERE affiliate_id = COALESCE(NEW.affiliate_id, OLD.affiliate_id) 
      AND status IN ('inactive', 'cancelled')
    ),
    total_revenue = (
      SELECT COALESCE(SUM(deal_value), 0) FROM affiliate_referrals 
      WHERE affiliate_id = COALESCE(NEW.affiliate_id, OLD.affiliate_id) 
      AND status IN ('sold', 'active')
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.affiliate_id, OLD.affiliate_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_affiliate_stats ON affiliate_referrals;
CREATE TRIGGER trg_update_affiliate_stats
AFTER INSERT OR UPDATE OR DELETE ON affiliate_referrals
FOR EACH ROW EXECUTE FUNCTION update_affiliate_stats();

-- =====================================================
-- TRIGGER: Auto-advance follow-up stage
-- =====================================================

CREATE OR REPLACE FUNCTION advance_followup_stage() RETURNS TRIGGER AS $$
BEGIN
  -- When a follow-up is logged, advance to next stage
  UPDATE affiliates SET
    last_followup_date = NEW.followup_date,
    followup_stage = CASE 
      WHEN followup_stage = 'day_1' THEN 'day_7'
      WHEN followup_stage = 'day_7' THEN 'day_30'
      WHEN followup_stage = 'day_30' THEN 'monthly'
      ELSE 'monthly'
    END,
    next_followup_date = CASE 
      WHEN followup_stage = 'day_1' THEN acquired_date + INTERVAL '7 days'
      WHEN followup_stage = 'day_7' THEN acquired_date + INTERVAL '30 days'
      ELSE NEW.followup_date + INTERVAL '30 days'
    END,
    updated_at = NOW()
  WHERE id = NEW.affiliate_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_advance_followup ON affiliate_followups;
CREATE TRIGGER trg_advance_followup
AFTER INSERT ON affiliate_followups
FOR EACH ROW EXECUTE FUNCTION advance_followup_stage();

-- =====================================================
-- AFFILIATE TYPES
-- =====================================================

-- Common affiliate types for dropdown
COMMENT ON COLUMN affiliates.type IS 'realtor, loan_officer, car_dealer, attorney, cpa, insurance_agent, financial_advisor, other';

-- =====================================================
-- DONE!
-- =====================================================
