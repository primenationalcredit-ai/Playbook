-- ============================================================
-- ASAP Playbook v286 — AM Bonus expansion
-- Run this in Supabase SQL editor BEFORE deploying v286.
-- Safe to re-run (idempotent).
-- ============================================================

-- 1. Proof image + Pipedrive note tracking on credit building submissions
ALTER TABLE credit_building_submissions ADD COLUMN IF NOT EXISTS proof_image_url TEXT;
ALTER TABLE credit_building_submissions ADD COLUMN IF NOT EXISTS pipedrive_note_posted BOOLEAN DEFAULT FALSE;
ALTER TABLE credit_building_submissions ADD COLUMN IF NOT EXISTS pipedrive_note_id TEXT;

-- 2. Public storage bucket for proof screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-proofs', 'credit-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies: the app authenticates with its own users table and talks to
-- Supabase as the anon role, so allow anon read + upload scoped to this bucket only.
DROP POLICY IF EXISTS "credit_proofs_read" ON storage.objects;
CREATE POLICY "credit_proofs_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'credit-proofs');

DROP POLICY IF EXISTS "credit_proofs_insert" ON storage.objects;
CREATE POLICY "credit_proofs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'credit-proofs');

DROP POLICY IF EXISTS "credit_proofs_update" ON storage.objects;
CREATE POLICY "credit_proofs_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'credit-proofs');

-- 3. Cached deal -> Account Manager map (powers Additional Rounds attribution)
CREATE TABLE IF NOT EXISTS deal_am_map (
  deal_id BIGINT PRIMARY KEY,
  person_id BIGINT,
  am_name TEXT,
  resolved_at TIMESTAMPTZ DEFAULT now()
);

-- 4. app_cache safety (already exists in prod, included for fresh environments)
CREATE TABLE IF NOT EXISTS app_cache (
  cache_key TEXT PRIMARY KEY,
  cache_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Done. After running, deploy v286.
