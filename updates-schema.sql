-- Updates Schema for ASAP Playbook
-- Run this in Supabase SQL Editor

-- Updates table
CREATE TABLE IF NOT EXISTS updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  assigned_to TEXT[] DEFAULT ARRAY['everyone'],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update acknowledgements table
CREATE TABLE IF NOT EXISTS update_acknowledgements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  update_id UUID REFERENCES updates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(update_id, user_id)
);

-- Enable RLS
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE update_acknowledgements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for updates
CREATE POLICY "Anyone can view updates" ON updates FOR SELECT USING (true);
CREATE POLICY "Admins can insert updates" ON updates FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update updates" ON updates FOR UPDATE USING (true);
CREATE POLICY "Admins can delete updates" ON updates FOR DELETE USING (true);

-- RLS Policies for acknowledgements
CREATE POLICY "Anyone can view acknowledgements" ON update_acknowledgements FOR SELECT USING (true);
CREATE POLICY "Users can acknowledge" ON update_acknowledgements FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update acknowledgements" ON update_acknowledgements FOR UPDATE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_updates_created_at ON updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acknowledgements_update ON update_acknowledgements(update_id);
CREATE INDEX IF NOT EXISTS idx_acknowledgements_user ON update_acknowledgements(user_id);
