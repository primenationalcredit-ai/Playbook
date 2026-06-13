# AI Training System - SQL Setup

Run these commands in Supabase SQL Editor:

```sql
-- Table for AI training instructions
-- These are rules/facts the AI must follow on EVERY request
CREATE TABLE ai_training (
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

-- Make sure flagged responses table exists
CREATE TABLE IF NOT EXISTS ai_flagged_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT,
  ai_response TEXT,
  correction TEXT,
  user_id UUID,
  user_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_flagged_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_flagged" ON ai_flagged_responses FOR ALL USING (true);

-- Optional: Company knowledge for structured Q&A
CREATE TABLE IF NOT EXISTS ai_company_knowledge (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  category TEXT,
  answered_by UUID,
  answered_by_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

ALTER TABLE ai_company_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ai_knowledge" ON ai_company_knowledge FOR ALL USING (true);
```

## How It Works

1. **ai_training** - Instructions the AI MUST follow on every request
   - "Never say we only have one location"
   - "Always mention our documentation-based approach"
   - "Our pricing is per-item, not monthly"

2. **ai_flagged_responses** - Feedback from users about wrong AI responses
   - Admin reviews and clicks "Add to AI Training" to approve
   - Gets converted to an instruction in ai_training

3. The `ask-openai` function pulls ALL active instructions and includes them in the system prompt

## Categories

- `must_say` - Things AI must include (priority 9)
- `never_say` - Things AI must avoid (priority 10)
- `pricing` - Pricing facts
- `process` - How things work
- `objections` - How to handle pushback
- `company` - General company facts
- `compliance` - Legal requirements
