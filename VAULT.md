# ASAP PLAYBOOK — MASTER VAULT (CENTRALIZED, SINGLE SOURCE OF TRUTH)
**Owner:** Joe Mahlow (CEO, ASAP Credit Repair / ASAP Credit & Financial Services)
**Last updated:** 2026-07-07
**Location:** Committed in the Playbook repo as `VAULT.md` (root). This is THE authoritative reference.

---

## 0. HOW TO USE + THE STANDING RULE
- This lives at the repo root as `VAULT.md`. It is version-controlled and travels with the code.
- **STANDING RULE — VAULT UPDATES ON EVERY PUSH.** Every time code is pushed to the Playbook repo,
  this vault MUST be updated in the same or an immediately following commit to reflect the change:
  what changed, why, which files/pages/functions, and any new issue found or fixed. No exceptions.
  A push without a vault update is an incomplete push.
- At the start of any new chat: open/paste this file and say "Continue from OPEN ISSUES; keep the vault
  updated on every push." Any Claude instance picks up here with full context.
- Deploy discipline (Section 4) is the #1 rule. Most reverts/pain trace to stale-clone or repo-vs-deploy drift.
- Treat credentials here as sensitive.

---

## 1. THE PLAYBOOK APP
| Item | Value |
|---|---|
| Live site | https://cute-cat-d9631c.netlify.app |
| GitHub | primenationalcredit-ai/Playbook |
| Stack | React + Vite (frontend), Netlify Functions (backend), Supabase (DB + storage), Tailwind |
| Supabase project ref | kkcbpqbcpzcarxhknzza |
| Supabase URL | https://kkcbpqbcpzcarxhknzza.supabase.co |
| Deploy | Netlify auto-builds on `git push origin main` (~2-3 min) |
| The ONE clone | C:\Users\18328\Downloads\playbook-fresh-win (Windows). Work only here. |

### Supabase anon key (READ + confirmed WRITE/PATCH/POST on cs_deals + stall_clients via REST)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0
```
- Service role key: Netlify env `SUPABASE_SERVICE_ROLE_KEY` (server-side only).
- **DDL (new tables/columns) requires Supabase dashboard SQL** — anon key cannot ALTER TABLE. Joe can run SQL in the dashboard (even on phone).

---

## 2. PIPEDRIVE
| Item | Value |
|---|---|
| Domain (API) | asapcreditrepairusa (base https://asapcreditrepairusa.pipedrive.com/api/v1) |
| Web deal-link subdomain (in code) | asapcreditrepair → DEAL_URL https://asapcreditrepair.pipedrive.com/deal/{id} |
| API token | 328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0 |
| API version | v1 |

### Custom field IDs
| Field | ID | Notes |
|---|---|---|
| Account Manager (PERSON) | 0a2bceaec010dd949056d374970917a6b573f1dc | {id,name,email,value}. AM lives on PERSON. |
| Monitoring Site (DEAL) | b8676d1cd8672d9a4214867037af2c94d8367c5e | Report-credit trigger. |
| Update Status (PERSON) | 6381d902f9c164217fbb0b5a6b98f10f1bce7fad | Stall/status logic. |
| CURRENT STATUS (PERSON) | 612856f2221d04679c1809eadb77b30300936445 | 708=2ND RD DONE, 715=Round 3. |
| Call Center Rep (PERSON) | fee42f0cb3d515239d602de62533887bfd58d384 | Report credit attribution. |
| RD1 date range (DEAL) | 6979c70df67f42c28dfcff39284ae17d564d600f | start at key, end at key+_until |
| RD2 date range (DEAL) | ff3697496664744d64d9f290766f919f40c23aa0 | |
| RD3 date range (DEAL) | 8d681007c089ee4c7390c02ee2f027ca60374708 | |

### Pipeline IDs
21 NEW LEADS · 37 Reports · 42 Quoted 2.0 · 7 SOLD · 45 C.R.S. · 65 ADDITIONAL C.R.S. · 63 Missed Opportunities · 71 Incomplete · 70 DONE/DND · 73 Affiliates · 78 Marketing · 79 Funnel · 3 INACTIVE · 62 Referrer Clients · 67 Done Clients · 41 Deleted
- Stall population pipelines: 45 (CRS) + 71 (Incomplete). Sold (7) excluded.
- CSR report credit early-pipeline gate: New Leads / Reports / Quoted 2.0.

### Monitoring Site option IDs (partial, key ones)
486 Identity IQ · 1715 Smart Credit · 1917 My Score IQ · 1744 Client sent credit reports to us · 3703 Identity Iq (Client Sent Reports) · 3704 Smart Credit (Client Sent Reports) · 1150 MyFico.com · 561 Experian.com
- Classify: contains identity/idiq → IDIQ; contains smart → SmartCredit; else → **Other**.

### Update Status values
- LOGINS NOT READY (INDIVIDUAL) = 934 (the ONLY status counting as report-stall)
- CHECK LOGINS = 937 · OWES MONEY *AUTO PILOT* = 1616 · ***MISSING DOCS***

---

## 3. TEAM ROSTER
### Account Managers (Supabase user IDs)
- Raquel Lanzas a59d7cfa-fa16-42b2-8d2d-4f85209f8928
- Zairen Verzales 6a56a4fb-d1b4-4ec5-8adc-eeff0daa471c (PD name "Zairen Stephanie Verzales")
- Dex-Ann Tillock a63b2cd8-a00d-43e9-993c-e93d17f0173a (PD "Dex-Ann")
- Rose

### Credit Consultants (dept credit_consultants)
- Carlos Salguera carlosasapcredit@gmail.com
- Cindy Broadstreet cindyasapcredit@gmail.com
- Eric De La Rosa edelarosaasapcredit@gmail.com
- Rose Benitez rosaliaasapcreditrepair@gmail.com

### CSR staff
Kenneth Larios, Vic Baltodano, Reni Reyes, Araceli Carrion, Jenifer Venegas, Cesar Cardona, Ethel Gatdula, CJ (person id 23611632, castilloasapcredit@gmail.com; PD rep name "CJ")

### Leadership
Joe Mahlow (CEO), Astrid Lemus (DOO), Kimberly Sanchez (kimberly@asapcreditrepairusa.com)

---

## 4. DEPLOY DISCIPLINE (#1 RULE — PREVENTS REVERTS)
- **ONE clone only**: playbook-fresh-win. Delete/ignore stale folders: asap-payment-processor-bad, asap-playbook-v52-payment-fix, asap-playbook-ready.
- **Always `git pull` before editing.** Prevents overwriting a newer change.
- **Three-way verify after every change**: (1) committed (`git log --oneline -2`), (2) pushed (origin/main == HEAD), (3) Netlify shows the commit "Published".
- Never force push. Netlify builds on push (~2-3 min); checking too early shows stale.
- Reconcile repo-vs-deploy drift before editing a deployed function. am-pipeline-cache.js / am-stall-rate.js are DRIFTED — do NOT edit/push those.
- **Windows file-transfer gotcha**: downloading files from chat sometimes writes 0-byte empty files. Reliable method = base64 in ~6000-char chunks pasted via Set-Content/Add-Content, then decode with `[IO.File]::WriteAllBytes("ABSOLUTE\path", [Convert]::FromBase64String($b64))` (MUST use absolute path). For small edits, use a PowerShell `.Replace()` patch instead. PowerShell mangles inline JSON in curl -d → write JSON to a file, use `--data "@file"`. Run PS commands ONE at a time.

---

## 5. APP STRUCTURE — ROUTES / PAGES (from App.jsx, confirmed 2026-07-07)
Public/survey routes:
- /survey/enrollment (EnrollmentSurvey) · /survey/completion (CompletionSurvey) · /survey/round2 (Round2Survey) · /login

Authenticated (under "/"):
- /dashboard (Dashboard) — default redirect
- /playbook (MyPlaybook) · /team (TeamView) · /updates (Updates)
- /training (Training) · /training/:courseId (TrainingCourse)
- /reviews (Reviews) · /incoming-reviews (IncomingReviews) · /claim-reviews (ClaimReviews) · /review-link (ReviewRandomizer)
- /payments (ConsultantPayments) · /invoices (Invoices) · /approvals (Approvals) · /approvals/:id
- /admin/all-payments (ConsultantPayments) · /secured-cards (SecuredCards) · /paysheet (Paysheet)
- /csr-dashboard (CSRDashboard) · /ask-ai (AskAI) · /calendar (Calendar) · /onboarding (Onboarding)
- /scorecards (Scorecards) · /bonus-tracker (BonusTracker) · /am-bonus-tracker (BonusTracker)
- /affiliates (Affiliates) · /settings (Settings) · /projects (LeadershipProjects) · /quick-links (QuickLinks)

Admin-only (ProtectedRoute adminOnly):
- /admin/tasks · /admin/users · /admin/updates · /admin/training · /admin/training/:courseId
- /admin/knowledge · /admin/knowledge/assistant · /admin/company-profile · /admin/ai-learning
- /admin/surveys · /admin/pto · /admin/onboarding · /admin/financials

Key page files (src/pages): Dashboard, MyPlaybook, ConsultantBonus, ConsultantPayments, Invoices,
CSRBonus, AMBonus, Approvals, BonusTracker, Paysheet, DOOPaysheet, FinancialDashboard, plus survey pages.

### Left-nav gating (src/components/Layout.jsx)
- Role flags: isConsultant (dept credit_consultants OR account_managers OR role account_manager/admin);
  isCreditConsultant (dept === credit_consultants); isAM (dept account_managers OR admin OR leadership);
  isCSR (dept customer_support OR admin); hideExtras (credit consultant / AM / CSR get lean nav).
- Nav arrays: coreNavItems, additionalNavItems, navItems, coreDepartmentItems, additionalDepartmentItems,
  departmentItems (= isJoe ? full : coreDepartmentItems). Sidebar maps navItems + departmentItems + adminItems.
- **Invoices tab**: shows for `(isAM || isConsultant)` — updated 2026-07-07 (was AM-only). Line ~223 coreDepartmentItems.

---

## 6. CSR REPORT CREDIT RULES (authoritative)
- A report is credited when the Monitoring Site is set. Credited by Call Center Rep; **if rep blank → credit deal Owner** (owner-based rows = tracking only, NO bonus).
- Site blank → classify as **Other**. Contains identity/idiq → IDIQ; contains smart → SmartCredit; else Other.
- Credit stamps `monitoring_site_set_at` (the date), gated to early pipeline (New Leads/Reports/Quoted 2.0) at set time. Current pipeline is irrelevant — what matters is where it was WHEN the site was set.
- CSR bonus table columns (CSRBonus.jsx): CSR | IDIQ | SmartCredit | **Other** | Total | Qualified | Report Bonus | Total Bonus. (Other restored 2026-07-07 — commit 73f2f09. It shows reports that were neither IDIQ nor Smart. Owner cell computes Other safely as total-idiq-smart.)
- Bonus: IDIQ pays per report past #35; needs 45 total reports/month to qualify. Other + SmartCredit count toward the 45.

---

## 7. STALL RATE SYSTEM (built + live 2026-07-06/07)
### Rules (per Astrid — do not change without her)
- Population: OPEN deal in CRS(45)/Incomplete(71), has an AM, latest round STARTED 45-90 days ago (inclusive). Sold excluded.
- Stalled: in population AND Update Status = LOGINS NOT READY (INDIVIDUAL)=934 AND latest round ENDED >= 14 days ago.
- 90-day ceiling INTENTIONAL (Kausara correctly ages out at 91 days). Newest round wins (RD1-3).
### Architecture (event-driven, stored, no scanning, no timeouts)
- Table `stall_clients` (deal_id PK, client_name, account_manager, update_status, pipeline, round_start/end, days_since_start/end, in_population, is_stalled, synced_at). RLS + anon full-access policy.
- `stall-webhook.js` — DEPLOYED. On updated.deal/updated.person, recomputes ONE client, upserts or deletes row. Registered in Pipedrive UI: updated.deal + updated.person → this function.
- `stall-daily-sweep.js` — WRITTEN, validated, in outputs. NOT YET DEPLOYED. Re-evaluates stored rows vs today's date for time-based transitions. Deploy + schedule in netlify.toml (e.g. `[functions."stall-daily-sweep"] schedule="0 13 * * *"`).
- `stall-sync.js` — DEPLOYED (manual/backup full-refresh; can time out on full scan; has ?dryRun=1).
### Verified numbers (2026-07-06): Dex-Ann 122/33/**27%** · Raquel 100/32/**32%** · Zairen 91/30/**33%**.
### Old broken path: am-pipeline-cache.js scanned 8,800 live, never completed → 0% for everyone. DRIFTED repo-vs-deploy. Do NOT edit.
### TODO: deploy stall-daily-sweep + schedule; point AMBonus.jsx to read rate from stall_clients.

---

## 8. cs_deals SYNC (root cause found + fixed 2026-07-07)
### What was wrong: cs_deals had NO working real-time add/update sync. Only webhook registered was `delete deal` → cs-deals-webhook. New deals only landed via manual initial-sync or a Zapier that stopped ~July 4. So EVERY deal after July 4 was silently missing (Michael Flores, etc.). Not random.
### Fix (DONE): Registered `added.deal` + `updated.deal` → cs-deals-webhook in Pipedrive. Ran full cs-deals-initial-sync backfill (paginated 40/page). July 5+ deals now populate.
### cs_deals functions: cs-deals-webhook.js (real-time upsert, on_conflict=deal_id, credit rule = site present + early pipeline + no existing set-date), cs-deals-initial-sync.js (manual paginated bulk, ?start=N), cs-deals-csv-import.js.
### KNOWN REMAINING BUG: cs-deals-initial-sync populates monitoring_site but does NOT stamp monitoring_site_set_at. Credit needs set_at. So backfilled deals (or deals whose site was set while webhook was down) have the site but don't count until stamped. TODO: fix initial-sync to also stamp set_at (using deal update_time + set_pipeline) so backfills self-credit. Until then, use the Ready-to-Quote CSV backfill method (Section 9).

---

## 9. SESSION LOG — ISSUES RAISED + FIXED (2026-07-06/07)
1. **Dex stall rate 0%** → built stall system, real 27% stored. FIXED.
2. **Kim's card "invalid authentication"** → wrong AUTH_NET_CLIENT_KEY in payment-processor. Sandbox public client key = 727jMf46uPcCgbL32yjCDm54Ax928zd6kKh3yaQE29QyX4emHV2vgP6mXS9C47PU. Joe to set env + redeploy. (Payment-processor, not Playbook.)
3. **Payment Received activity not populating (deal 267355)** → doc fee invoice never created on move-to-Quoted. Joe fixed himself.
4. **cs_deals sync broken** → registered add/update webhooks + backfilled. FIXED (Section 8).
5. **CJ missing conversions** (Isaias Ramos 267597 "Bring Own RPTS", Michael Flores 267678 IDIQ) → Michael inserted (Identity IQ, Reports); Isaias credited "Client sent reports"=Other. FIXED.
6. **Reni missing 4** (Betlhem Feleke 267486 IDIQ, Donald Lee 267706 MyScoreIQ, Amjad Masarwa 253436 Smart Credit, Noe Ramirez 267684 IDIQ) → all stamped/inserted with set_at + Reports gate. FIXED. Noe's issue was site present but set_at null (the initial-sync bug).
7. **Ready-to-Quote batch backfill** → 61 deals credited from CSV (deals-3184257-633.csv). Rules: blank site→Other; blank rep→deal Owner; preserve existing values (COALESCE, only fill blanks); stamp missing set_at with last-stage-change date; set_pipeline Reports. 15 credited to owner. SQL: outputs/backfill_ready_to_quote.sql. DONE.
8. **Invoices tab not showing for consultants** → was AM-only in Layout.jsx; changed to (isAM || isConsultant). Commit d9e295f. FIXED. (Needed hard refresh Ctrl+Shift+R.)
9. **"Other" column missing from CSR dashboard** → dropped during the owner-based-tracking rewrite (commit 1c6ca0b), data still present. Restored header + cells in CSRBonus.jsx. Commit 73f2f09. FIXED.

### Why things "revert": mostly (a) a later feature edit rewriting a component and dropping something (the Other column), or (b) stale-clone/drift. Defense: this vault (records known-good specs so drops get caught) + one clone + pull-before-edit + three-way verify.

---

## 10. RELATED APPS (quick pointers)
- **ASAP Payment Processor** (asap-payment-processor.netlify.app, repo primenationalcredit-ai/asap-payment-processor, Supabase rdsxfzdthcsndlcjgfcu). Authorize.net (primary + Amex-only merchant), Pipedrive, Zoho Books, MS Graph email, RingCentral SMS. get_config serves Accept.js keys. AUTH_NET_ENV switches sandbox/prod. Sandbox login 9fxe738GPVX, sandbox client key 727jMf46...(see #2 above), sandbox txn key 693WwJvw3E9X425u. Amex login 9NRft592.
- **MCL Client Manager** (stupendous-melomakarona-97abc8.netlify.app) — McCarthy Law FCRA referrals.
- **ASAP Funding Pipeline CRM** (tranquil-muffin-691d4e.netlify.app).
- **Organic Revenue OS** (internal SEO dashboard).
- **WealthPath** (wealthpath-weld.vercel.app), **FamilyFlow**, **Consultation Notes Producer** (asap-consultation-notes.netlify.app, Credit-Report-Reader repo, Supabase qhjveanfijxwydlfsjbk).

---

## 11. WRITING / STYLE PREFERENCES
- No em-dashes or hyphens as punctuation in drafted emails/outreach. Ranges written "60 to 90 days" not "60-90".
- In partner/affiliate outreach never say "credit repair" — lead with "approval ready" / "in a position to be approved".
- Email signature: "ASAP Credit & Financial Services".

---

## 12. OPEN / PENDING (next sessions)
- [ ] Deploy stall-daily-sweep.js + schedule in netlify.toml.
- [ ] Point AMBonus.jsx stall panel to read from stall_clients table.
- [ ] Fix cs-deals-initial-sync to stamp monitoring_site_set_at (kills the recurring "site present, not counting" bug).
- [ ] Kim's card: set AUTH_NET_CLIENT_KEY=727jMf46... in payment-processor Netlify + redeploy.
- [ ] Delete stale repo folders (asap-playbook-ready, asap-playbook-v52-payment-fix, asap-payment-processor-bad).
- [ ] Reconcile am-pipeline-cache / am-stall-rate repo-vs-deploy drift; delete deprecated am-stall-rate.js.
- [ ] Overdue Follow-ups pagination (gets 980 of 1207 activities).
- [ ] Standardize AM/rep names in Pipedrive (Zairen "Zairen Stephanie Verzales", Dex-Ann, etc.).

---
*END OF MASTER VAULT. Remember the standing rule: UPDATE THIS FILE ON EVERY PUSH.*
