-- Calendar Events Recurrence Schema
-- Run this in Supabase SQL Editor to enable recurring events

-- Add recurrence columns to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'none';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_end DATE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[];

-- Add check constraint for valid recurrence values
DO $$ BEGIN
  ALTER TABLE calendar_events ADD CONSTRAINT check_recurrence 
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'biweekly', 'monthly'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add comment
COMMENT ON COLUMN calendar_events.recurrence IS 'none = one-time, daily, weekly, biweekly, monthly';
COMMENT ON COLUMN calendar_events.recurrence_end IS 'Optional end date for recurring events';
COMMENT ON COLUMN calendar_events.recurrence_days IS 'Array of day numbers (0=Sun, 1=Mon, etc) for weekly events';
