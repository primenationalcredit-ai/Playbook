-- =====================================================
-- ASAP AI TRAINING SYSTEM - CLEAN INSTALL
-- Drops existing policies first to avoid conflicts
-- =====================================================

-- 1. Training Examples Table
CREATE TABLE IF NOT EXISTS ai_training_examples (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  source_document TEXT,
  created_by TEXT,
  status TEXT DEFAULT 'pending',
  training_job_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "Allow all ai_training_examples" ON ai_training_examples;
ALTER TABLE ai_training_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_training_examples" ON ai_training_examples FOR ALL USING (true);

-- 2. Training Documents Table
CREATE TABLE IF NOT EXISTS ai_training_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename TEXT NOT NULL,
  content_preview TEXT,
  examples_generated INTEGER DEFAULT 0,
  processed_by TEXT,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "Allow all ai_training_documents" ON ai_training_documents;
ALTER TABLE ai_training_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_training_documents" ON ai_training_documents FOR ALL USING (true);

-- 3. Fine-Tuning Jobs Table
CREATE TABLE IF NOT EXISTS ai_fine_tuning_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id TEXT NOT NULL,
  file_id TEXT,
  model_id TEXT,
  status TEXT DEFAULT 'running',
  examples_count INTEGER,
  error TEXT,
  started_by UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

DROP POLICY IF EXISTS "Allow all ai_fine_tuning_jobs" ON ai_fine_tuning_jobs;
ALTER TABLE ai_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_fine_tuning_jobs" ON ai_fine_tuning_jobs FOR ALL USING (true);

-- 4. Model Info Table
CREATE TABLE IF NOT EXISTS ai_model_info (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model_id TEXT NOT NULL,
  job_id TEXT,
  status TEXT DEFAULT 'active',
  examples_trained INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "Allow all ai_model_info" ON ai_model_info;
ALTER TABLE ai_model_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_model_info" ON ai_model_info FOR ALL USING (true);

-- 5. AI Training Instructions (already exists, just ensure policy)
DROP POLICY IF EXISTS "Allow all ai_training" ON ai_training;
ALTER TABLE ai_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_training" ON ai_training FOR ALL USING (true);

-- 6. Flagged Responses (already exists, just ensure policy)
DROP POLICY IF EXISTS "Allow all ai_flagged" ON ai_flagged_responses;
DROP POLICY IF EXISTS "Allow all ai_flagged_responses" ON ai_flagged_responses;
ALTER TABLE ai_flagged_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_flagged_responses" ON ai_flagged_responses FOR ALL USING (true);

-- Done!
SELECT 'AI Training tables ready!' as status;
