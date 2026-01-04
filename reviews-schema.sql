-- Reviews Tracking Schema for ASAP Playbook
-- Run this in Supabase SQL Editor

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  platform TEXT NOT NULL DEFAULT 'google', -- google, yelp, facebook, etc.
  client_name TEXT,
  proof_url TEXT, -- URL to uploaded image
  notes TEXT,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_month ON reviews(date_trunc('month', review_date));

-- Disable RLS for now
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;

-- Create storage bucket for review proofs (run this separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('review-proofs', 'review-proofs', true);
