-- Task Templates Enhancement Schema
-- Run this in Supabase SQL Editor to add new task features

-- Add new columns to task_templates
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'daily';
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS days_of_week INTEGER[];

-- Add constraint to validate frequency values
DO $$ BEGIN
  ALTER TABLE task_templates ADD CONSTRAINT check_frequency 
    CHECK (frequency IN ('daily', 'weekly', 'one_time'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add comment
COMMENT ON COLUMN task_templates.frequency IS 'daily = every day, weekly = specific days, one_time = disappears after completion';
COMMENT ON COLUMN task_templates.days_of_week IS 'Array of day numbers (0=Sun, 1=Mon, etc) for weekly tasks';
