-- =====================================================
-- ASAP AI TRAINING SYSTEM - COMPLETE DATABASE SETUP
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- 1. Training Examples Table
-- Stores Q&A pairs used to train the AI
CREATE TABLE IF NOT EXISTS ai_training_examples (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_message TEXT NOT NULL,          -- The question/input
  assistant_message TEXT NOT NULL,      -- The ideal AI response
  source TEXT DEFAULT 'manual',         -- 'manual', 'document', 'correction'
  source_document TEXT,                 -- If from a document, which one
  created_by TEXT,                      -- Who added this
  status TEXT DEFAULT 'pending',        -- 'pending', 'training', 'trained'
  training_job_id TEXT,                 -- Which fine-tune job used this
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_training_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_training_examples" ON ai_training_examples FOR ALL USING (true);

-- 2. Training Documents Table
-- Tracks uploaded documents that were processed for training
CREATE TABLE IF NOT EXISTS ai_training_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename TEXT NOT NULL,
  content_preview TEXT,                 -- First 500 chars for reference
  examples_generated INTEGER DEFAULT 0, -- How many examples extracted
  processed_by TEXT,
  status TEXT DEFAULT 'processing',     -- 'processing', 'processed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_training_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_training_documents" ON ai_training_documents FOR ALL USING (true);

-- 3. Fine-Tuning Jobs Table
-- Tracks OpenAI fine-tuning jobs
CREATE TABLE IF NOT EXISTS ai_fine_tuning_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id TEXT NOT NULL,                 -- OpenAI job ID (ft-xxx)
  file_id TEXT,                         -- OpenAI file ID
  model_id TEXT,                        -- Resulting model ID (ft:gpt-xxx)
  status TEXT DEFAULT 'running',        -- 'running', 'completed', 'failed'
  examples_count INTEGER,               -- How many examples in this training
  error TEXT,                           -- Error message if failed
  started_by UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE ai_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_fine_tuning_jobs" ON ai_fine_tuning_jobs FOR ALL USING (true);

-- 4. Model Info Table
-- Tracks which fine-tuned model is active
CREATE TABLE IF NOT EXISTS ai_model_info (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model_id TEXT NOT NULL,               -- The fine-tuned model ID
  job_id TEXT,                          -- Which job created it
  status TEXT DEFAULT 'active',         -- 'active', 'deprecated'
  examples_trained INTEGER,             -- Total examples this model was trained on
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_model_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_model_info" ON ai_model_info FOR ALL USING (true);

-- 5. AI Training Instructions (for post-training additions)
-- Quick rules added between fine-tuning runs
CREATE TABLE IF NOT EXISTS ai_training (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instruction TEXT NOT NULL,
  category TEXT DEFAULT 'company',
  priority INTEGER DEFAULT 5,
  source_question TEXT,
  created_by UUID,
  created_by_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_training" ON ai_training FOR ALL USING (true);

-- 6. Flagged Responses (for corrections/feedback)
CREATE TABLE IF NOT EXISTS ai_flagged_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT,
  ai_response TEXT,
  correction TEXT,
  user_id UUID,
  user_name TEXT,
  status TEXT DEFAULT 'pending',        -- 'pending', 'approved', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_flagged_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_flagged_responses" ON ai_flagged_responses FOR ALL USING (true);

-- =====================================================
-- INDEXES for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_training_examples_status ON ai_training_examples(status);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_status ON ai_fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_model_info_status ON ai_model_info(status);
CREATE INDEX IF NOT EXISTS idx_ai_training_active ON ai_training(is_active);
CREATE INDEX IF NOT EXISTS idx_flagged_responses_status ON ai_flagged_responses(status);

-- =====================================================
-- Done! Your AI training system is ready.
-- =====================================================
