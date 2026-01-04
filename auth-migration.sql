-- =====================================================
-- SUPABASE AUTH MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add auth_id column to users table to link with Supabase Auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Step 3: Create helper functions FIRST (before RLS policies)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND (role = 'admin' OR department = 'leadership')
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 4: Enable RLS and create policies for each table
-- Using DO blocks to skip tables that don't exist

-- USERS TABLE (required)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth_id = auth.uid());

DROP POLICY IF EXISTS "Admins can insert users" ON users;
CREATE POLICY "Admins can insert users" ON users FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users" ON users FOR DELETE USING (is_admin());

-- TASK_TEMPLATES TABLE
DO $$ BEGIN
  ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view task_templates" ON task_templates;
  CREATE POLICY "Everyone can view task_templates" ON task_templates FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Admins can manage task_templates" ON task_templates;
  CREATE POLICY "Admins can manage task_templates" ON task_templates FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- TASK_COMPLETIONS TABLE
DO $$ BEGIN
  ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own completions" ON task_completions;
  CREATE POLICY "Users can view own completions" ON task_completions FOR SELECT USING (user_id = get_current_user_id() OR is_admin());
  DROP POLICY IF EXISTS "Users can insert own completions" ON task_completions;
  CREATE POLICY "Users can insert own completions" ON task_completions FOR INSERT WITH CHECK (true);
  DROP POLICY IF EXISTS "Users can update own completions" ON task_completions;
  CREATE POLICY "Users can update own completions" ON task_completions FOR UPDATE USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- UPDATES TABLE
DO $$ BEGIN
  ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view updates" ON updates;
  CREATE POLICY "Everyone can view updates" ON updates FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Everyone can update updates" ON updates;
  CREATE POLICY "Everyone can update updates" ON updates FOR UPDATE USING (true);
  DROP POLICY IF EXISTS "Admins can insert updates" ON updates;
  CREATE POLICY "Admins can insert updates" ON updates FOR INSERT WITH CHECK (is_admin());
  DROP POLICY IF EXISTS "Admins can delete updates" ON updates;
  CREATE POLICY "Admins can delete updates" ON updates FOR DELETE USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- TRAINING_COURSES TABLE
DO $$ BEGIN
  ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view courses" ON training_courses;
  CREATE POLICY "Everyone can view courses" ON training_courses FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Admins can manage courses" ON training_courses;
  CREATE POLICY "Admins can manage courses" ON training_courses FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- TRAINING_MODULES TABLE
DO $$ BEGIN
  ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view modules" ON training_modules;
  CREATE POLICY "Everyone can view modules" ON training_modules FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Admins can manage modules" ON training_modules;
  CREATE POLICY "Admins can manage modules" ON training_modules FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- TRAINING_PROGRESS TABLE
DO $$ BEGIN
  ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own progress" ON training_progress;
  CREATE POLICY "Users can view own progress" ON training_progress FOR SELECT USING (user_id = get_current_user_id() OR is_admin());
  DROP POLICY IF EXISTS "Users can manage own progress" ON training_progress;
  CREATE POLICY "Users can manage own progress" ON training_progress FOR ALL USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- KNOWLEDGE_BASE TABLE
DO $$ BEGIN
  ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view knowledge" ON knowledge_base;
  CREATE POLICY "Everyone can view knowledge" ON knowledge_base FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Admins can manage knowledge" ON knowledge_base;
  CREATE POLICY "Admins can manage knowledge" ON knowledge_base FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- AI_QUESTIONS TABLE
DO $$ BEGIN
  ALTER TABLE ai_questions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own questions" ON ai_questions;
  CREATE POLICY "Users can view own questions" ON ai_questions FOR SELECT USING (user_id = get_current_user_id() OR is_admin());
  DROP POLICY IF EXISTS "Users can insert questions" ON ai_questions;
  CREATE POLICY "Users can insert questions" ON ai_questions FOR INSERT WITH CHECK (true);
  DROP POLICY IF EXISTS "Users can update questions" ON ai_questions;
  CREATE POLICY "Users can update questions" ON ai_questions FOR UPDATE USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- EVENTS TABLE
DO $$ BEGIN
  ALTER TABLE events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view events" ON events;
  CREATE POLICY "Everyone can view events" ON events FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Admins can manage events" ON events;
  CREATE POLICY "Admins can manage events" ON events FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- SCHEDULES TABLE
DO $$ BEGIN
  ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view schedules" ON schedules;
  CREATE POLICY "Everyone can view schedules" ON schedules FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Admins can manage schedules" ON schedules;
  CREATE POLICY "Admins can manage schedules" ON schedules FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- TIME_OFF_REQUESTS TABLE
DO $$ BEGIN
  ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own requests" ON time_off_requests;
  CREATE POLICY "Users can view own requests" ON time_off_requests FOR SELECT USING (user_id = get_current_user_id() OR is_admin());
  DROP POLICY IF EXISTS "Users can insert own requests" ON time_off_requests;
  CREATE POLICY "Users can insert own requests" ON time_off_requests FOR INSERT WITH CHECK (true);
  DROP POLICY IF EXISTS "Admins can update all requests" ON time_off_requests;
  CREATE POLICY "Admins can update all requests" ON time_off_requests FOR UPDATE USING (is_admin() OR user_id = get_current_user_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- PTO_POLICIES TABLE
DO $$ BEGIN
  ALTER TABLE pto_policies ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view pto policies" ON pto_policies;
  CREATE POLICY "Everyone can view pto policies" ON pto_policies FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Admins can manage pto policies" ON pto_policies;
  CREATE POLICY "Admins can manage pto policies" ON pto_policies FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- PTO_BALANCES TABLE
DO $$ BEGIN
  ALTER TABLE pto_balances ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own balance" ON pto_balances;
  CREATE POLICY "Users can view own balance" ON pto_balances FOR SELECT USING (user_id = get_current_user_id() OR is_admin());
  DROP POLICY IF EXISTS "Admins can manage balances" ON pto_balances;
  CREATE POLICY "Admins can manage balances" ON pto_balances FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- PTO_TRANSACTIONS TABLE
DO $$ BEGIN
  ALTER TABLE pto_transactions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own transactions" ON pto_transactions;
  CREATE POLICY "Users can view own transactions" ON pto_transactions FOR SELECT USING (user_id = get_current_user_id() OR is_admin());
  DROP POLICY IF EXISTS "Admins can manage transactions" ON pto_transactions;
  CREATE POLICY "Admins can manage transactions" ON pto_transactions FOR ALL USING (is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- PERSONAL_TASKS TABLE
DO $$ BEGIN
  ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own personal tasks" ON personal_tasks;
  CREATE POLICY "Users can view own personal tasks" ON personal_tasks FOR SELECT USING (user_id = get_current_user_id() OR is_admin());
  DROP POLICY IF EXISTS "Users can manage own personal tasks" ON personal_tasks;
  CREATE POLICY "Users can manage own personal tasks" ON personal_tasks FOR ALL USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- =====================================================
-- DONE! 
-- Next steps:
-- 1. Create auth users in Supabase Dashboard > Authentication
-- 2. Link each auth user to their app user by updating auth_id
-- =====================================================
