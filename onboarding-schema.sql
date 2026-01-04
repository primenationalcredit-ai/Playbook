-- =====================================================
-- ONBOARDING SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- Onboarding Templates (admin creates these per department/type)
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "Credit Consultant - In House"
  department TEXT NOT NULL, -- matches user department
  is_va BOOLEAN DEFAULT false, -- true for VA flows, false for in-house
  description TEXT,
  estimated_days INTEGER DEFAULT 14, -- estimated days to complete
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Task Types
-- video: Watch a video (YouTube, Loom, etc.)
-- document: Read and acknowledge a document/policy
-- quiz: Complete a quiz with questions
-- form: Fill out a form (collects data)
-- upload: Upload a document (ID, certification, etc.)
-- meeting: Schedule/attend a meeting
-- training: Complete a training course (links to training module)
-- checklist: Simple checkbox items
-- custom: Any other task

-- Onboarding Tasks (items within a template)
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'checklist', -- video, document, quiz, form, upload, meeting, training, checklist, custom
  content JSONB DEFAULT '{}', -- Flexible content based on task_type
  -- For video: { "url": "...", "duration_minutes": 10 }
  -- For document: { "content": "...", "require_signature": true }
  -- For quiz: { "questions": [...], "passing_score": 80 }
  -- For form: { "fields": [...] }
  -- For upload: { "accepted_types": ["pdf", "jpg"], "instructions": "..." }
  -- For meeting: { "with": "Manager", "duration_minutes": 30 }
  -- For training: { "course_id": "..." }
  order_index INTEGER DEFAULT 0,
  deadline_days INTEGER, -- Days from hire date (null = no deadline)
  requires_approval BOOLEAN DEFAULT false, -- Admin must approve completion
  is_required BOOLEAN DEFAULT true, -- Required for full playbook access
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Onboarding Assignment
CREATE TABLE IF NOT EXISTS user_onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES onboarding_templates(id),
  status TEXT DEFAULT 'in_progress', -- in_progress, pending_approval, completed
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(user_id) -- One active onboarding per user
);

-- User Onboarding Task Progress
CREATE TABLE IF NOT EXISTS user_onboarding_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, in_progress, submitted, approved, rejected
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  submission_data JSONB DEFAULT '{}', -- Form answers, upload URLs, quiz scores, etc.
  admin_notes TEXT, -- Notes from admin when approving/rejecting
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- Add onboarding fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'none'; 
-- none: no onboarding needed (current employee)
-- in_progress: going through onboarding
-- pending_approval: completed tasks, waiting for admin approval
-- completed: fully onboarded

ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_new_employee BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS playbook_access TEXT DEFAULT 'full';
-- full: full access to playbook
-- limited: can see playbook but limited features
-- onboarding_only: can only see onboarding tasks

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_dept ON onboarding_templates(department, is_va);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_template ON onboarding_tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_tasks_user ON user_onboarding_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_tasks_status ON user_onboarding_tasks(status);

-- Disable RLS for internal tool
ALTER TABLE onboarding_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding_tasks DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- SAMPLE ONBOARDING TEMPLATES
-- =====================================================

-- Credit Consultant - In House
INSERT INTO onboarding_templates (name, department, is_va, description, estimated_days)
VALUES 
  ('Credit Consultant - In House', 'credit_consultants', false, 'Onboarding flow for new in-house credit consultants', 14),
  ('Credit Consultant - VA', 'credit_consultants', true, 'Onboarding flow for new VA credit consultants', 14),
  ('Customer Support - In House', 'customer_support', false, 'Onboarding flow for new in-house CSR team members', 10),
  ('Customer Support - VA', 'customer_support', true, 'Onboarding flow for new VA CSR team members', 10),
  ('Account Manager - In House', 'account_managers', false, 'Onboarding flow for new in-house account managers', 14),
  ('Account Manager - VA', 'account_managers', true, 'Onboarding flow for new VA account managers', 14),
  ('Leadership', 'leadership', false, 'Onboarding flow for new leadership team members', 21)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DONE!
-- =====================================================
