# ASAP Playbook - Comprehensive Vault Documentation
## Last Updated: February 2, 2026

---

## TABLE OF CONTENTS
1. [Application Overview](#application-overview)
2. [Payment Dashboard System - CRITICAL](#payment-dashboard-system---critical)
3. [Data Architecture](#data-architecture)
4. [Deployment Guide](#deployment-guide)
5. [Known Issues & Solutions](#known-issues--solutions)
6. [DOO Compensation System](#doo-compensation-system)
7. [Version History](#version-history)

---

## APPLICATION OVERVIEW

### What is ASAP Playbook?
Internal operations management system for ASAP Credit Repair USA, a credit repair company established in 2013.

### Live URL
https://cute-cat-d9631c.netlify.app

### GitHub Repository
https://github.com/primenationalcredit-ai/Playbook

### Tech Stack
- **Frontend:** React + Vite
- **Backend:** Netlify Functions (serverless)
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Netlify
- **CRM Integration:** Pipedrive API
- **Payment Data:** Zoho Invoice → Zapier → Webhook (DIRECT TO DATABASE)

### Team Members (Consultants)
- Eric De La Rosa (Senior Consultant)
- Cindy (Consultant)
- Carlos Salguera (also known as "Carlos Danilo Salguera Balladares")
- Kimberly Sanchez
- Astrid Lemus (Director of Operations)
- Joe Mahlow (CEO/Founder)

---

## PAYMENT DASHBOARD SYSTEM - CRITICAL

### ⚠️ IMPORTANT: HOW PAYMENTS WORK (READ THIS FIRST)

**The payment system uses DIRECT WEBHOOK integration - NOT Google Sheets sync!**

The old Google Sheets sync approach caused 8+ days of issues with duplicates, wrong data, and timeouts. 
The solution is Zapier pushing directly to our webhook.

### Current Data Flow (WORKING - v197)

```
Zoho Invoice (Payment received)
       ↓
Zapier (Trigger: New Payment in Zoho)
       ↓
Zapier looks up Pipedrive Deal to get Owner Name (consultant)
       ↓
Zapier POST webhook to: https://cute-cat-d9631c.netlify.app/.netlify/functions/sales-webhook
       ↓
Webhook inserts directly into Supabase (sales table)
       ↓
Dashboard loads data on page load (click Refresh to reload)
```

### Zapier Webhook Configuration (ALREADY SET UP - Step 22 in Zap)

**URL:** `https://cute-cat-d9631c.netlify.app/.netlify/functions/sales-webhook`
**Method:** POST
**Data:**
```json
{
  "action": "edit",
  "row": {
    "client_name": "{{Zoho Contact Name}}",
    "date_paid": "{{Zoho Payment Date}}",
    "consultant": "{{Pipedrive Owner Name}}",
    "fee_paid": "{{Zoho Amount}}",
    "fee_type": "{{Calculated Fee Type: Document Fee, Partial, Final}}",
    "payment_method": "Credit Card"
  }
}
```

### Google Sheet (REFERENCE ONLY - NOT PRIMARY SOURCE)
- **Spreadsheet ID:** 1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y
- **Tab:** Data Export (GID: 24680817)
- **Columns:**
  - A: Consultant Name
  - B: Date Paid
  - C: Client 1 (Client Name)
  - D: Fee Paid
  - E: Payment Method
  - F: Fee Type
  - G: Client ID #
  - H: Deal ID
  - I: Code
  - J: Deal Title
  - K: Total Price
  - L: # of Negative Items
  - M: Doc Paid Date
  - N: Refund
  - O: Bonus Commission

**NOTE:** The Google Sheet is still populated by Zapier but is NOT the source of truth. 
The "Sync Sheet" button exists only for manual recovery if needed.

### Database Schema (sales table)
```sql
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  consultant TEXT NOT NULL,
  date_paid DATE NOT NULL,
  client_name TEXT,
  fee_paid NUMERIC(10,2) NOT NULL,
  fee_type TEXT,
  payment_method TEXT,
  deal_id TEXT,
  same_day_doc_date DATE,
  bonus NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Valid Consultant Names
The following are the ONLY valid consultant names in the database:
- `Eric De La Rosa`
- `Cindy`
- `Carlos Salguera`
- `Kimberly Sanchez`
- `Carlos Danilo Salguera Balladares` (normalizes to Carlos Salguera)

**Any other names are CLIENT NAMES and indicate a bug!**

### Sync Functions Status (v197)

| Function | Schedule | Status | Purpose |
|----------|----------|--------|---------|
| sales-webhook.js | On request | ✅ ACTIVE | Receives Zapier webhooks - PRIMARY |
| sales-api-sync.js | Manual only | ✅ ACTIVE | Manual sync from Google Sheet if needed |
| sales-sync-backup.js | -- | ❌ DISABLED | Was causing column mapping issues |
| sales-auto-sync.js | -- | ❌ DISABLED | Was causing duplicate issues |

### Dashboard Behavior (v197)
- **NO auto-refresh** - Data loads on page load only
- **"Refresh" button** - Reloads data from database
- **"Sync Sheet" button** - Manual sync from Google Sheet (emergency use only)
- **"Open Sheet" button** - Opens Google Sheet in new tab

### Manual Sync Commands (EMERGENCY USE ONLY)
```
# Full sync for specific month (delete + reimport from Google Sheet)
https://cute-cat-d9631c.netlify.app/.netlify/functions/sales-api-sync?mode=full&month=2026-02

# Diagnostic (shows differences between sheet and database)
https://cute-cat-d9631c.netlify.app/.netlify/functions/sales-api-sync?mode=diagnostic&month=2026-02
```

### Cleanup SQL Commands
```sql
-- Delete all garbage data (client names stored as consultants)
DELETE FROM sales WHERE consultant NOT IN (
  'Eric De La Rosa', 
  'Cindy', 
  'Carlos Salguera', 
  'Kimberly Sanchez', 
  'Carlos Danilo Salguera Balladares'
);

-- Check what consultants exist in database
SELECT consultant, COUNT(*), SUM(fee_paid) as total 
FROM sales 
WHERE date_paid >= '2026-01-01' 
GROUP BY consultant 
ORDER BY total DESC;
```

### Year-over-Year Comparisons
For YoY comparisons to work, previous year data must be synced:
```
https://cute-cat-d9631c.netlify.app/.netlify/functions/sales-api-sync?mode=full&month=2025-01
https://cute-cat-d9631c.netlify.app/.netlify/functions/sales-api-sync?mode=full&month=2025-02
```

---

## DATA ARCHITECTURE

### Key Tables

| Table | Purpose |
|-------|---------|
| sales | Payment data from consultants |
| users | Employee/consultant profiles |
| daily_tasks | Task completion tracking |
| schedules | Weekly work schedules |
| time_off_requests | PTO/time off requests |
| calendar_events | Calendar/schedule events |
| client_surveys | Client feedback surveys |
| deals | Pipedrive deal cache |

### Pipedrive Integration

**CRITICAL FILTER IDs (for Scorecards):**
| Filter | ID | URL | Purpose |
|--------|-----|-----|---------|
| Moved to Quoted This Month | 178770 | https://asapcreditrepair.pipedrive.com/deals/filter/178770 | Lead Conversion denominator |
| Moved to Sold This Month | 178773 | https://asapcreditrepair.pipedrive.com/deals/filter/178773 | Lead Conversion numerator |
| Deals Currently in SOLD | 181300 | https://asapcreditrepair.pipedrive.com/deals/filter/181300 | SOLD date lookup for onboarding |
| Moved into CRS This Month | 179572 | https://asapcreditrepair.pipedrive.com/deals/filter/179572 | Onboarding Speed tracking |
| Overdue Follow-ups | 134900 | - | Consultant overdue activities |

**Why use Pipedrive Filters instead of Supabase tracking columns:**
- Webhook tracking columns get corrupted when bulk updates/blasts are run
- Pipedrive filters track actual pipeline movement dates internally
- More reliable for accurate scorecard metrics

**Pagination Issue:** Only retrieves 980/1207 activities (known limitation)
**Deal Owner Mapping:** Used for scorecard metrics

### Scorecard Data Sources
| Metric | Source | Notes |
|--------|--------|-------|
| Lead Conversion Rate | Pipedrive Filter 178773 ÷ 178770 | Use API, NOT Supabase tracking columns |
| Overdue Follow-ups | Pipedrive Filter 134900 | Count by deal owner |
| Refund Rate | Supabase `refunds` table | |
| Client Retention | Supabase `deals` table | Based on RD1 start dates |

### User Roles
- `leadership` - Full access (Joe, Astrid)
- `consultant` - Limited access to own data
- `employee` - Basic access
- `va` - Virtual assistant access

---

## DEPLOYMENT GUIDE

### Windows PowerShell (One-liner)
```powershell
cd ~\Downloads; Remove-Item -Recurse -Force asap-playbook-ready -ErrorAction SilentlyContinue; Expand-Archive -Path "FILENAME.zip" -DestinationPath asap-playbook-ready -Force; cd asap-playbook-ready; git init; git add -A; git commit -m "VERSION MESSAGE"; git branch -M main; git remote add origin https://github.com/primenationalcredit-ai/Playbook.git; git push origin main --force
```

### Mac Terminal (One-liner)
```bash
cd ~/Downloads && rm -rf asap-playbook-ready && unzip -o ~/Downloads/FILENAME.zip -d asap-playbook-ready && cd asap-playbook-ready && git init && git add -A && git commit -m "VERSION MESSAGE" && git branch -M main && git remote add origin https://github.com/primenationalcredit-ai/Playbook.git && git push origin main --force
```

**GitHub Auth:** Username is primenationalcredit-ai. Token will be provided separately (cannot store in repo).

### Deployment Steps
1. Download the zip file from Claude
2. Run the one-liner command (replace FILENAME.zip with actual filename)
3. Enter GitHub credentials if prompted
4. Wait for Netlify to auto-deploy (1-2 minutes)
5. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

---

## KNOWN ISSUES & SOLUTIONS

### Issue: Client names appearing as consultants
**Cause:** Old sync functions had wrong column mapping (Column A vs Column C swapped)
**Solution:** 
1. All scheduled syncs disabled in v197
2. Run cleanup SQL to delete bad data
3. Zapier webhook now handles all new data correctly

### Issue: MTD showing wrong amount
**Cause:** Multiple sync functions fighting each other, deleting/reimporting data
**Solution:** 
1. Disabled all scheduled syncs
2. Zapier webhook is now the ONLY way data enters the system
3. Manual "Sync Sheet" button for emergencies

### Issue: Duplicates appearing
**Cause:** Multiple sync sources (Apps Script, scheduled functions, manual sync)
**Solution:** 
1. Removed Apps Script from Google Sheet
2. Disabled scheduled syncs
3. Single source: Zapier webhook

### Issue: February dates failing
**Cause:** Code hardcoded month end as day 31
**Solution:** Fixed in v194 - calculates actual last day of month

### Issue: Dashboard not updating after payment
**Cause:** Auto-refresh was removed in v197
**Solution:** Click "Refresh" button to reload data

### Issue: Last Year's Feb showing $0
**Cause:** 2025 data not synced
**Solution:** Run manual sync for 2025-02 and 2025-01

---

## DOO COMPENSATION SYSTEM

### Astrid Lemus - Director of Operations

**Base Salary:** $6,000/month (guaranteed regardless of profitability)

**CRITICAL RULE:** If Net Profit is $0 or negative, NO bonuses are paid. All bonuses require profitability.

**Bonus Components (only when Net Profit > $0):**

| Component | Calculation | Notes |
|-----------|-------------|-------|
| Profit Share | 3% × Net Profit | Paid monthly |
| Growth Bonus | $250-$750 | Based on YoY Core Revenue growth (30%+, 50%+, 75%+) |
| Profitability Milestone | $150-$1,000 | Based on profit tier ($1-$5K, $5K-$10K, $10K-$20K, $20K+) |
| Expense Reduction | 50% of annual savings | One-time, after 90 days sustained |

**25% Cap:** Total monthly bonuses (excluding Expense Reduction) cannot exceed 25% of Net Profit.

**Affiliate Revenue Exclusion:** IDIQ, SmartCredit, and other affiliate revenue is excluded from Core Service Revenue for bonus calculations.

**Dashboard Location:** DOO Paysheet page in app

**Data Source:** `monthly_pnl_snapshots` table in Supabase - enter P&L data from Financial Dashboard to calculate bonuses.

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| v198 | 2026-02-02 | Fixed DOO Paysheet - now reads from monthly_pnl_snapshots table, correctly shows $0 bonus when not profitable |
| v197 | 2026-02-02 | Removed auto-refresh, Zapier webhook is primary data source |
| v196 | 2026-02-02 | Disabled all scheduled syncs |
| v195 | 2026-02-02 | Fixed sales-sync-backup.js column mapping |
| v194 | 2026-02-01 | Fixed February date bug |
| v193 | 2026-02-01 | Separated DB refresh from Google Sheets sync |
| v192-v186 | 2026-02-01 | Failed auto-sync attempts |

---

## STARTING A NEW CONVERSATION CHECKLIST

When starting a new Claude conversation about this project:

1. **Reference this VAULT.md** - It contains everything
2. **Payment Dashboard uses ZAPIER WEBHOOK** - NOT Google Sheets sync!
3. **No auto-refresh** - User clicks Refresh button
4. **Valid consultants:** Eric De La Rosa, Cindy, Carlos Salguera, Kimberly Sanchez
5. **If you see client names as consultants** - Run the cleanup SQL
6. **Current version:** v197
7. **Transcript location:** /mnt/transcripts/journal.txt

---

## CONTACTS & RESOURCES

- **App URL:** https://cute-cat-d9631c.netlify.app
- **GitHub:** https://github.com/primenationalcredit-ai/Playbook
- **Google Sheet:** https://docs.google.com/spreadsheets/d/1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y
- **Webhook URL:** https://cute-cat-d9631c.netlify.app/.netlify/functions/sales-webhook
- **Supabase:** (credentials in Netlify environment variables)
- **Pipedrive:** (API key in Netlify environment variables)

---

## Company Profile Table (for AI memory)

```sql
CREATE TABLE company_profile (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT,
  tagline TEXT,
  founded_year TEXT,
  location TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  unique_value TEXT,
  process_summary TEXT,
  clients_helped TEXT,
  reviews_count TEXT,
  years_in_business TEXT,
  pricing_summary TEXT,
  team_summary TEXT,
  compliance_notes TEXT,
  additional_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now
CREATE POLICY "Allow all" ON company_profile FOR ALL USING (true);
```

## Environment Variables Needed

Add to Netlify:
- `OPENAI_API_KEY` - Your OpenAI API key (for Ask AI)
- `ANTHROPIC_API_KEY` - Keep this for Knowledge Assistant


---

## Multiple Links Support

Add this column to task_templates table:

```sql
ALTER TABLE task_templates ADD COLUMN links TEXT[];
```

And to personal_tasks table:

```sql
ALTER TABLE personal_tasks ADD COLUMN links TEXT[];
```


---

## AI Learning System Tables

Run these in Supabase:

```sql
-- Table for AI to ask questions and store company answers
CREATE TABLE ai_company_knowledge (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT,
  category TEXT,
  asked_by TEXT DEFAULT 'ai',
  answered_by UUID,
  answered_by_name TEXT,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

ALTER TABLE ai_company_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON ai_company_knowledge FOR ALL USING (true);

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
CREATE POLICY "Allow all" ON ai_flagged_responses FOR ALL USING (true);
```

