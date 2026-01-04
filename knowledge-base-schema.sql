-- Knowledge Base Schema for ASAP AI Assistant

-- Main knowledge base table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[], -- Array of keywords for search
  priority INTEGER DEFAULT 0, -- Higher = more important
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Categories enum-like reference
-- objections, pricing, process, faq, scripts, compliance, success_stories, competitor

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_base USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON knowledge_base(is_active);

-- Full text search index
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS search_vector tsvector 
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED;
CREATE INDEX IF NOT EXISTS idx_knowledge_search ON knowledge_base USING GIN(search_vector);

-- Chat history for learning what questions are asked
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  helpful BOOLEAN, -- User feedback
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies - Disabled for now to allow all authenticated users
ALTER TABLE knowledge_base DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history DISABLE ROW LEVEL SECURITY;

-- Sample data for initial knowledge base
INSERT INTO knowledge_base (category, title, content, keywords, priority) VALUES
-- Objections
('objections', 'Too Expensive', 
'When a client says it''s too expensive, acknowledge their concern and reframe the value:

"I completely understand budget is a concern. Let me ask you this - what is bad credit costing you right now? Higher interest rates on your car loan? Denied for that home? When you add up the extra interest you''re paying, most clients find they''re losing thousands per year. Our service typically pays for itself within the first few months through the savings you''ll see."

Key points:
- Calculate their current cost of bad credit
- Show ROI - service pays for itself
- Monthly payment is less than daily coffee',
ARRAY['expensive', 'cost', 'price', 'money', 'afford', 'budget'], 10),

('objections', 'I Can Do It Myself',
'When a client says they can do it themselves:

"You absolutely can dispute items yourself - it''s your legal right. The question is, do you have 10-15 hours per month to research laws, write dispute letters, track responses, and follow up? Most of our clients tried DIY first and got frustrated. We have a 67,000+ client track record and know exactly which strategies work for each type of negative item. Think of it like taxes - you could do them yourself, but a professional gets better results faster."

Key points:
- Validate their capability
- Time investment reality (10-15 hrs/month)
- Professional expertise = better results
- Tax analogy works well',
ARRAY['myself', 'diy', 'own', 'self', 'alone', 'without help'], 10),

('objections', 'I Need to Think About It',
'When a client says they need to think about it:

"I completely respect that - this is an important decision. Help me understand what specifically you want to think about? Is it the investment, the process, or something else?"

Then address their specific concern. If they''re vague:

"Most people who say they need to think about it are really concerned about [cost/trust/time]. Which resonates most with you?"

Create urgency:
"Every month you wait, those negative items age and compound. The sooner we start, the sooner you see results. What would it take to get started today?"',
ARRAY['think', 'consider', 'decide', 'later', 'tomorrow', 'wait'], 10),

('objections', 'Does This Really Work?',
'When a client questions if credit repair works:

"Great question - I''d be skeptical too. Here''s the reality: We''ve helped over 67,000 clients since 2013. Credit repair works because we''re enforcing your legal rights under the Fair Credit Reporting Act. Creditors and bureaus are required by law to verify the accuracy of everything they report. When they can''t verify, they must remove it.

Our average client sees their first deletions within 45-60 days. We don''t guarantee specific results because every credit file is different, but we guarantee we''ll work the process correctly."

Key proof points:
- 67,000+ clients since 2013
- FCRA legal basis
- 45-60 day typical first results
- Process guarantee, not outcome guarantee',
ARRAY['work', 'works', 'legit', 'legitimate', 'scam', 'real', 'results', 'proof'], 10),

-- Process
('process', 'How Credit Repair Works',
'Our 3-round dispute process:

**Round 1 - Validation**
We send validation letters to creditors demanding they prove the debt is yours and accurate. Under FCRA, they must respond within 30 days or remove the item.

**Round 2 - Documentation Analysis** 
If they respond, we analyze their documentation for errors, inconsistencies, or FCRA violations. We build a case based on any discrepancies.

**Round 3 - Bureau Disputes**
We present our case to the credit bureaus with evidence. Bureaus must investigate within 30 days and remove unverifiable items.

Timeline: Most clients see first results in 45-60 days. Full process typically takes 4-8 months depending on complexity.',
ARRAY['process', 'how', 'work', 'steps', 'rounds', 'dispute', 'timeline'], 8),

('process', 'What Documents Do Clients Need?',
'Documents needed to get started:

**Required:**
- Government-issued ID (driver''s license or passport)
- Social Security card
- Proof of address (utility bill, bank statement dated within 60 days)
- Signed Limited Power of Attorney (we provide this)

**Helpful but not required:**
- Recent credit reports (we can pull these)
- Any correspondence from creditors
- Proof of payments made

We handle all the heavy lifting - clients just need to provide these basics to get started.',
ARRAY['documents', 'need', 'required', 'paperwork', 'start', 'provide', 'id', 'proof'], 7),

-- Pricing
('pricing', 'Service Packages Overview',
'Our pricing structure:

**First Work Fee (One-time):** Covers setup, credit analysis, strategy development, and first round of disputes.

**Monthly Service Fee:** Ongoing work including additional dispute rounds, monitoring, and creditor negotiations.

Value proposition:
- Most clients save $200-500/month in interest once credit improves
- Service typically pays for itself within 2-3 months
- Cancel anytime - no long-term contracts

When discussing price, always tie it back to what bad credit is costing them NOW.',
ARRAY['price', 'pricing', 'cost', 'fee', 'payment', 'package', 'monthly'], 9),

-- Compliance
('compliance', 'What We Cannot Promise',
'Legal compliance - what we CANNOT say:

❌ "We guarantee removal of [specific item]"
❌ "Your score will increase by X points"
❌ "This will be removed in X days"
❌ "We can remove accurate information"

What we CAN say:
✅ "We''ll dispute inaccurate, unverifiable, or incomplete information"
✅ "Most clients see results within 45-60 days"
✅ "We have a strong track record with similar cases"
✅ "We guarantee we''ll work the process correctly"

Remember: We dispute inaccurate/unverifiable items. We cannot and do not remove accurate negative information.',
ARRAY['guarantee', 'promise', 'legal', 'compliance', 'cannot', 'say', 'claim'], 10),

-- FAQ
('faq', 'How Long Does Credit Repair Take?',
'Timeline expectations:

**First Results:** 45-60 days typically
**Average Program Length:** 4-8 months
**Complex Cases:** Up to 12 months

Factors that affect timeline:
- Number of negative items
- Type of items (collections vs bankruptcies vs inquiries)
- How creditors/bureaus respond
- Client responsiveness with documents

Set realistic expectations upfront to avoid frustration. Under-promise, over-deliver.',
ARRAY['long', 'time', 'timeline', 'duration', 'months', 'days', 'how long', 'take'], 8),

('faq', 'Can Removed Items Come Back?',
'Yes, removed items can potentially return, but it''s rare when done correctly.

**Why items might return:**
- Creditor re-reports after investigation
- Bureau error in permanent deletion
- Creditor sells debt to new collector who reports

**How we prevent this:**
- Document every deletion
- Send cease and desist after removal
- Monitor credit for re-insertions
- Immediate re-dispute if item returns

If an item returns, client should notify us immediately. Re-inserted items without proper notification is an FCRA violation we can dispute.',
ARRAY['return', 'come back', 'removed', 'again', 'reappear', 'permanent'], 7)

ON CONFLICT DO NOTHING;
