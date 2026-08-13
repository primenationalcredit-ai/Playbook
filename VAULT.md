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

---

## 13. PLANNED FEATURE — "SEND TO CLIENT" BUTTON ON INVOICES TAB (spec'd 2026-07-07, NOT built yet)
**Goal:** In the Playbook Invoices tab, a "Send to Client" button next to each invoice that sends the
doc fee payment form to the client via SMS and/or Email (user chooses at send time).

**Key technical reality:** You cannot embed an interactive card form inside SMS/email. Standard approach
(what to build): send a LINK to the hosted doc fee payment page (pay.html on the payment processor).
Client taps link → form opens in browser → pays. Functionally "the form," reached via a link.

**All infrastructure already exists — this is wiring, not new capability:**
- Link/token generation: `create-payment-token.js` (payment processor) — produces the token pay.html uses
  (token carries client + zoho_doc_fee_invoice_id). pay.html is the doc fee form (the one Kim tested).
- SMS send: RingCentral code in `send-payment-reminders.js` (payment processor).
- Email send: Microsoft Graph code in `send-payment-reminders.js`.
- Playbook→payment-processor bridge: `invoices-api.js` (Playbook) proxies allow-listed actions to
  `consultant-dashboard-api.js` (payment processor), forwarding X-Acting-As = Playbook user email.

**Build steps (3 files, 2 repos):**
1. Playbook `netlify/functions/invoices-api.js`: add new action `send_payment_form` to the ALLOWED /
   WRITE_ACTIONS set (one line). It's a write action (requires Playbook sign-in).
2. Payment processor `netlify/functions/consultant-dashboard-api.js`: implement action `send_payment_form`:
   - input: invoice/deal id + channel ('sms'|'email'|'both')
   - generate (or fetch existing) doc fee payment token/link via create-payment-token logic
   - send via the RingCentral (SMS) and/or MS Graph (email) helpers lifted from send-payment-reminders.js
   - pull client phone/email from the deal/person or Zoho customer
   - return {ok, sentSms, sentEmail, link}
3. Playbook `src/pages/Invoices.jsx`: add "Send to Client" button per invoice row → opens a small dialog
   (choose SMS / Email / Both, show the message preview, Confirm) → calls invoices-api with
   action send_payment_form. Show success/failure inline.

**UX decision (confirmed by Joe):** small dialog on click (choose SMS/Email/Both, preview, send) — not
one-tap — so the user controls the channel. Message copy must follow writing rules (no em-dashes; friendly).

**Deploy:** both repos (Playbook + payment-processor). Verify: committed + pushed + Netlify published on BOTH.
Test end to end with a real deal (send to Joe's own phone/email first).

**Open questions to confirm at build time:**
- Does an invoice already carry a usable payment link/token, or must we always mint one via create-payment-token?
- Exact client phone/email source (person record vs Zoho customer).
- Message wording for SMS vs email.

---

## 13b. SEND-TO-CLIENT — CODE BUILT + VALIDATED (2026-07-07), READY TO DEPLOY
All code written and node --check passed. Files in outputs: handle_send_payment_form.js,
sms_helpers_for_cda.js, invoices_api_patch.txt, FRONTEND_PATCHES.txt. Wiring confirmed:
onAction flows parent→DealView→buttons (like charge_now/refund); response helper is respond();
consultant-dashboard-api.js ALREADY has sendEmail()+getGraphToken (line ~1439) so email is reuse;
only SMS helpers are new. create-payment-token returns {payment_link}; called via internal x-api-key
(same pattern as handleReissueAgreement). invoices-api.js is the Playbook→payment-processor proxy.

### DEPLOY ORDER (backend first, both repos):
PAYMENT PROCESSOR (payment-fresh-win):
1. Add SMS helpers (sms_helpers_for_cda.js) near line ~1418 (by the OUTLOOK block). Includes RC_* consts,
   SMS_ENABLED, getRingCentralAccessToken, sendSms, normalizePhoneSms.
2. Add handleSendPaymentForm (handle_send_payment_form.js) — uses existing sendEmail + new sendSms +
   create-payment-token. Note: create-payment-token REQUIRES a valid email; for SMS-only clients it
   passes placeholder noemail@asapcreditrepairusa.com (acceptable; 98% have email).
3. Add to the switch (~line 145, before default): case 'send_payment_form': return await handleSendPaymentForm(body, user);
4. node --check; commit; push; verify Netlify published.

PLAYBOOK (playbook-fresh-win):
5. invoices-api.js: add 'send_payment_form' to WRITE_ACTIONS set (invoices_api_patch.txt).
6. Invoices.jsx: 5 insertions (FRONTEND_PATCHES.txt):
   F1 submit-handler else-if for send_payment_form (after request_pause block ~947)
   F2 modalTitles: send_payment_form: 'Send Payment Form to Client'
   F3 channel-picker UI block in generic modal body (after refund block ~1110). SMS/Email/Both buttons;
      email disabled when !client_email; both disabled unless both phone+email present.
   F4 submit button label: modal.type === 'send_payment_form' ? 'Send to Client' :  (and ensure not
      disabled by missing reason/date; require modal.channel set)
   F5 "Send to Client" button in DealView near doc fee banner: onAction({type:'send_payment_form',
      deal_id, client_name, client_email, client_phone, amount: docfee balance or initial_amount}).
      Import Send icon from lucide-react.
7. npm build not required (Netlify builds); commit; push; verify published.

### TEST FIRST: send to Joe's OWN phone/email before any client. Verify link opens pay.html, SMS + email
both arrive, and a note posts on the deal. Only then announce to team.

### REMAINING CONFIRM AT DEPLOY: exact submit-button disabled logic in Invoices.jsx (~1125-1140) so the
send button isn't blocked by refund/date validators; grab the lucide-react import line to add Send.

---

## 13c. SEND-TO-CLIENT — DEPLOYED + TESTED WORKING (2026-07-07)
STATUS: LIVE. Tested end to end — payment form sent, SMS + email both received.
Commits:
- Payment processor: 860fa21 (send_payment_form action + SMS helpers), d27174e (auth gate: added
  send_payment_form to SYSTEM_WRITE_ACTIONS so acting-as Playbook users are allowed).
- Playbook: 3adb047 (invoices-api allowlist + Send to Client button/dialog in DealView),
  08af2c2 (Send button added to BrowseView "All Invoices" list rows too).
How it works: Playbook Invoices tab → "Send to Client" (green button, in single-deal DealView AND in
every row of the All Invoices list) → dialog picks SMS/Email/Both (email grays if no email on file) →
invoices-api proxies action send_payment_form to consultant-dashboard-api with X-Acting-As=user email →
handleSendPaymentForm mints a link via create-payment-token (internal x-api-key) → sends SMS
(RingCentral sendSms) and/or email (existing sendEmail/Graph) → posts a note on the deal.
Auth: send_payment_form is in BOTH invoices-api WRITE_ACTIONS (Playbook) AND consultant-dashboard-api
SYSTEM_WRITE_ACTIONS (payment processor). The latter was the missing piece that caused the initial
"System API key cannot perform this action" 403.
Notes: create-payment-token REQUIRES a valid email; SMS-only clients use placeholder
noemail@asapcreditrepairusa.com. List-view rows may lack client_phone (list query returns less than the
single-deal lookup) so SMS may gray out there; email works (98% have email). If phone needed in list,
add client_phone to list_recent_invoices query. Message copy follows writing rules (no em-dashes).

## 13d. SEND-TO-CLIENT — FINAL SCOPE (2026-07-07, commit 4c089cd)
DECISION: Send is DOC-FEE-ONLY. Not used for scheduled charges (would complicate auto-charge
reconciliation, and Amex cannot go through Zoho — so all sends use the create-payment-token → pay.html
form, which handles Amex via the Amex merchant routing).
- Send button HIDDEN when doc fee already paid (prevents duplicate payment).
  DealView (line ~444): gated `(isAdmin || canRequest) && !(doc_fee && doc_fee.paid)`.
  List/BrowseView (line ~662): gated `(isAdmin || canRequest) && isToken && !(i.status === 'used' && i.transaction_id)`
  — so it only shows on UNPAID doc-fee token rows, never on paid doc fees or scheduled-charge rows.
- FUTURE (deferred): to send links for scheduled charges after a decline, would need: an invoice picker
  in the dialog (list unpaid scheduled_charges), and a decision on whether paying via link marks the
  charge paid / stops auto-charge. Kept out for now to avoid reconciliation risk.
Full commit chain: 860fa21, 3adb047, d27174e, 08af2c2, 4c089cd.

---

## 14. PLANNED FEATURE — PARTIAL PAYMENT / SPLIT A SCHEDULED CHARGE (spec'd 2026-07-07, NOT built)
### Goal
Client can't cover a full scheduled charge on the due date but wants to pay a portion. STAFF (consultant)
splits it: reduce the charge to the partial amount (same due date), and add a new charge for the
remainder on a chosen date. Both apply to the SAME Zoho invoice.

### Confirmed rules (from Joe)
- STAFF-initiated, not client self-service. Client just requests it.
- Edit the scheduled_charge AMOUNT down (e.g. $300 -> $150). Due date does NOT change (partial still runs
  on the original due date). Changing the DATE is a separate existing admin-approval flow — not part of this.
- Create a NEW scheduled_charge for the remaining balance ($150) with a staff-chosen date.
- Keep the SAME Zoho invoice ($300). Collect it in two charges against that one invoice.

### THE HARD PROBLEM (why this needs careful build + testing, not a same-day patch)
Current code (consultant-dashboard-api.js ~line 414-416 in handleChargeNow, and ~657-660): when ANY
scheduled_charge clears, it calls markZohoInvoicePaidIdempotent which marks the ENTIRE Zoho invoice PAID.
So splitting $300 into two $150 charges on the same invoice would mark the whole $300 invoice paid the
moment the FIRST $150 clears — even though $150 is still owed. WRONG.
Fixes to choose from at build time:
  (A) Apply a PARTIAL payment to the Zoho invoice (Zoho "apply payment" API, partial amount) instead of
      mark-fully-paid. Requires a new Zoho call (current code only does mark-paid).
  (B) Only mark the Zoho invoice paid when the FINAL charge against it clears — track remaining balance
      on the invoice; each charge reduces it; last one closes it. Needs a per-invoice balance tracker.
Recommendation: (A) if Zoho's apply-partial-payment API is available; else (B).

### What exists already (reuse)
- handleUpdateDueDate (~712): edits a charge's DATE (pattern for a charge-edit action). No amount edit yet.
- handleChargeNow (~407): charges a scheduled_charge; marks Zoho invoice paid on success (the problem above).
- chargeCustomerProfile (~841): the card-charge primitive.
- scheduled_charges rows carry zoho_invoice_id (link to Zoho). link-zoho-invoice.js handles doc_fee/partial/final.

### What to build
1. New action edit_charge_amount (consultant-dashboard-api.js): change a scheduled_charge.amount
   (staff only, X-Acting-As). Add to SYSTEM_WRITE_ACTIONS + invoices-api WRITE_ACTIONS.
2. New action add_scheduled_charge (or split_charge doing both at once): insert a new scheduled_charge
   row (pipedrive_deal_id, amount, due_date chosen by staff, same customer profile/card, same
   zoho_invoice_id). Add to allowlists.
3. Zoho: implement partial-payment application (option A/B above) so the invoice isn't marked fully paid
   until the total is collected.
4. Frontend (Invoices.jsx): a "Split / Partial" action on a scheduled charge -> modal: enter partial
   amount (must be < full), show remainder auto-calculated, pick remainder date -> calls split_charge.
   Mirror the existing update_due_date modal pattern.

### TESTING REQUIRED BEFORE LIVE (money-handling)
Use a test deal: split a charge, verify (a) partial charges on original date, (b) Zoho shows partial paid
NOT paid-in-full, (c) remainder charges on chosen date, (d) Zoho invoice closes only after both clear,
(e) card is charged the right amounts and never double-charged. Only go live after all pass.

---

## 15. PLANNED FEATURE — PLAYBOOK AGREEMENTS TAB: search / edit / resend (spec'd 2026-07-07, NOT built)
### Goal
A new Agreements tab in the Playbook to (1) SEARCH agreements, (2) EDIT amounts/dates, (3) RESEND.
Editing must cascade to the document (client re-signs), the linked scheduled_charges, AND the Zoho
invoices. Editing ALWAYS requires the client to re-sign.

### What EXISTS today (reuse)
- Payment processor `agreements-search.js`: searches agreements table (query, status, type, from/to date).
  Auth via X-API-Key = INTERNAL_API_KEY or ADMIN_PASSCODE. Currently used by agreements-search.html.
- Payment processor `handleReissueAgreement` (consultant-dashboard-api.js line 252) + action
  `reissue_agreement`: voids existing agreement, calls create-agreement with force_recreate:true (same
  terms), sends new signing link (real email+SMS, not test mode). This IS the "resend" primitive.
- agreements table stores all terms: agreement_type, partial_amount, partial_date, final_amount,
  final_date, client info, status, token, etc.
- NO agreements UI in the Playbook yet (no jsx, no route). Tab is fully new.

### PHASES (build in this order; risk increases each phase)
PHASE 1 — SEARCH + RESEND (LOW RISK, mostly reuse):
- New Playbook page AgreementsSearch.jsx + route /agreements + nav item (gate to admin/leadership or
  whoever should manage agreements).
- New Playbook proxy action(s) in invoices-api.js (or a new agreements-api.js proxy) → forward to
  agreements-search (search) and reissue_agreement (resend). Add to WRITE_ACTIONS/SYSTEM_WRITE_ACTIONS.
- UI: search box + filters (status/type/date) → results table → per-row "Resend" (calls reissue_agreement).
- This phase is safe: resend already works, search already works. Just a Playbook UI + proxy.

PHASE 2 — EDIT amounts/dates (HIGH RISK, money + legal + Zoho; build + test carefully):
- Editing an agreement's partial/final amount or date must cascade:
  (a) DOCUMENT: create a new agreement version with the new terms → client must RE-SIGN (reuse
      create-agreement with force_recreate + new terms instead of copied terms).
  (b) SCHEDULED CHARGES: update the linked scheduled_charges to the new amounts/dates.
  (c) ZOHO INVOICES: update/reissue the linked Zoho invoices to match. SAME reconciliation danger as the
      split-charge feature (Section 14) — the "mark whole invoice paid on any charge" logic must not
      mis-fire. Editing amounts means the Zoho invoice total changes; must update Zoho invoice, not just
      the charge.
- Shares the "safely update a charge + its Zoho invoice" primitive with Section 14 (split-charge).
  DESIGN THESE TOGETHER.
- TESTING REQUIRED before live: edit an agreement on a TEST deal, verify new doc requires re-sign,
  scheduled_charges updated, Zoho invoice total corrected, no double-charge, old agreement voided.

### Recommendation
Phase 1 (search+resend) is a safe, useful win — can be built soon. Phase 2 (edit-cascade) is money+legal
sensitive and should be designed alongside Section 14 and tested thoroughly on test deals before launch to
real clients. Do NOT rush Phase 2 same-day.

---

## 16. SESSION LOG ADDENDUM — 2026-07-07 (afternoon/evening, the big root-cause day)

### *** THE BIG ROOT CAUSE *** cs-deals-webhook was CRASHING on every update (commit 525c6cb)
- cs-deals-webhook.js line 242 referenced `site_just_set: !!siteJustSet` but the variable is named
  `shouldCredit` (defined line 194). `siteJustSet` was never defined → the function threw
  "siteJustSet is not defined" and returned HTTP 500 on EVERY deal update.
- Effect: every time a rep set a monitoring site, the webhook died, so the cs_deals row stayed stale at
  its old "new lead, no site" state → deals never counted → the ENTIRE day's missing-conversion ticket
  stream (CJ, Reni x4, Earl, etc.) all traced to this ONE typo.
- Webhooks ARE registered + firing (Pipedrive webhooks 1336184 delete, 1365362 create, 1365364 change →
  cs-deals-webhook). The function just crashed when they fired.
- FIX: line 242 → `site_just_set: !!shouldCredit`. Verified: webhook now returns {"success":true} HTTP 200.
- AFTER FIX: ran full initial-sync backfill (paginated, done at start=40) + ran CSV backfill
  (backfill_this_month_reports.sql, 72 real deals, 8 tests skipped, 18 credited to owner). Deals now sync
  in real time. Ticket stream should STOP.

### cs-deals-initial-sync now stamps set_at (commit a8ee93b)
- Backfills now stamp monitoring_site_set_at (from deal update_time) for deals with a site in an early
  credit pipeline (NEW LEADS / Reports / Quoted 2.0) that don't already have a set_at. Preserves existing
  set_at (fetches page's existing values first). So future backfills self-credit — no more manual stamping.

### Individual conversion tickets fixed (Supabase PATCH, anon key)
- Earl Bell Jr (267782, Reni): cs_deals was stale (site null); Pipedrive had 486/IDIQ pipeline 42. PATCHED
  Identity IQ / Reni / set today / Reports. FIXED.
- Melany Mendoza (267541, Reni): site BLANK in Pipedrive but Reni pulled IDIQ reports. Joe: credit IDIQ.
  PATCHED monitoring_site → Identity IQ (kept set_at Jul 3). Joe also setting site in Pipedrive to persist.
- "There Hi" (267694): was showing in total reports while a new lead; backfill cleared stale data → now
  correctly does NOT count (site null, NEW LEADS). Resolved by backfill.

### Agreement POA blank-address fix (payment processor, commit 0399ea8)
- create-agreement.js line 157 read address from standard personData['address'] (empty for everyone).
  Address actually lives in PERSON custom field b42afe37cc9f83eff88d6b87a1be5a81cad64f31.
  FIX: `body.client_address || personData?.['b42afe37cc9f83eff88d6b87a1be5a81cad64f31'] || personData?.['address'] || ''`.
  Fixes NEW agreements (POA + standalone LPOA now show address; matters for dispute filing). Existing
  blank agreements won't retro-fix.

### Doc fee "linked" Pipedrive note disabled (payment processor, commit 3672b2e)
- link-zoho-invoice.js line 268: commented out postPipedriveNote for the "📄 DOC FEE INVOICE — Linked"
  note (unwanted clutter). Linking still happens; partial/final linked note left intact.

### Raquel AM-dashboard fixes
- WON DEAL showing in past-due (230988, pipeline 65 status won): am-additional-rounds.js pastDueRounds loop
  didn't check deal status. FIX (commit 8d787b4): fetch deal status per past-due deal, `continue` (skip) if
  status !== 'open' → excludes WON and LOST, only chases open deals.
- PAID REFERRAL not showing (267692 Lisa Casillas): DATA issue, not code. Raquel had TWO Pipedrive orgs
  both named "Raquel Lanzas": 100970 (7 deals, all 2025, stale — was stored in users table) and 199625
  (3 deals, all 2026, current — where Lisa lives). am-referrals queries /organizations/{stored}/deals so it
  missed 199625. FIX: PATCHED users table pipedrive_org_id 100970 → 199625. TELL RAQUEL: always use org
  199625 going forward. (Watch for same dup-org issue on other AMs.)

### Send to Client — see Sections 13b/13c/13d. Shipped, tested (SMS+email received), doc-fee-only,
  hidden when doc fee paid, button in both DealView and All Invoices list. Commits 860fa21, 3adb047,
  d27174e, 08af2c2, 4c089cd.

---

## 17. STALL-SYNC IS BROKEN (502 timeout) — POST-LAUNCH FIX (found 2026-07-07)
- stall-sync.js does a FULL scan of all open deals (line ~97-113) AND all persons (line ~122-152),
  paginated — thousands of records, many sequential Pipedrive calls, 30+ seconds. It is NOT a background
  function (filename is stall-sync.js, no -background suffix) → hits Netlify's 10s limit → HTTP 502.
  Confirmed: curl stall-sync?dryRun=1 returns 502.
- It is also NOT scheduled in netlify.toml (no [functions."stall-sync"] block).
- IMPACT: LOW right now. stall-webhook.js is live and keeps stall_clients current on every deal/person
  event (the main path). stall-sync is the daily full-recompute BACKUP that also catches purely
  time-based transitions (deals aging past 45/90 with no triggering event). That backup is currently
  not running.
- FIX (post-launch): rename stall-sync.js → stall-sync-background.js (background funcs get 15 min).
  NOTE: background functions respond 202 immediately and DON'T return a body to the caller — so the
  ?dryRun=1 return-counts behavior won't work the same; test by checking what it WRITES to stall_clients,
  not by reading the HTTP response. Then add schedule in netlify.toml, e.g.:
    [functions."stall-sync-background"]
    schedule = "0 13 * * *"   # ~7am CT daily, catches overnight time-based aging
  Update any code/docs that reference the old name. Test: run it, confirm stall_clients repopulates and
  the AM dashboard rate still matches (Dex 27% / Raquel 32% / Zairen 33% baseline).
- netlify.toml schedule format confirmed: [functions."NAME"] then schedule = "cron".

---

## 18. ZOHO PARTIAL-PAYMENT FOUNDATION — PROVEN WORKING (2026-07-07)
Shared foundation for BOTH Section 14 (split-charge) and Section 15 Phase 2 (edit-agreement).

### The key discovery
markZohoInvoicePaidIdempotent (duplicated in 4 files: autobill-run, consultant-dashboard-api,
link-zoho-invoice, process-initial-payment) does NOT hard-flip status to paid. It records a payment via
Zoho's customerpayments API applying amount_applied = FULL balance. Zoho then auto-sets status. So the
"marks whole invoice paid" behavior is just because it always applies the full balance.
=> To support PARTIAL payments, apply a SMALLER amount. Zoho natively sets status to "partially_paid"
   and keeps the remaining balance open. No manual status flipping needed.

### The helper (built, TESTED, works)
applyZohoPartialPayment({ invoiceId, amount, referenceNumber, description }):
  - looks up invoice (balance, customer_id)
  - caps amount at remaining balance (never over-applies)
  - POSTs to /customerpayments with amount_applied = that amount
  - re-reads invoice, returns { applied, remaining_balance, invoice_status }
Same Zoho auth/API as the working code (ZOHO_ACCOUNT_REGION, ZOHO_REFRESH_TOKEN/CLIENT_ID/CLIENT_SECRET,
customerpayments endpoint). It is a NEW helper — does NOT modify markZohoInvoicePaidIdempotent.

### TEST RESULTS (real Zoho, test deal 267781 "Test Astridone", INV-051489, $149)
- Applied $49 -> {applied:49, remaining_balance:100, status:"partially_paid"}  ✓
- Dry-run confirmed balance 100, partially_paid  ✓
- Applied remaining $100 -> {applied:100, remaining_balance:0, status:"paid"}  ✓
Proven: partials apply exactly, remainder stays open, multiple partials sum and close correctly.

### Tested via temp endpoint test-zoho-partial.js (committed ad08ee6, then DELETED after testing).
It had a dry_run mode (read-only) + apply mode, gated by INTERNAL_API_KEY.

### NEXT: add applyZohoPartialPayment as a real helper in consultant-dashboard-api.js, then build
split-charge (Section 14) and edit-agreement (Section 15 Phase 2) on top of it. Each still needs its own
test pass on a test deal before going live.

### SECURITY TODO: INTERNAL_API_KEY was exposed during testing — ROTATE it (new value in Netlify on the
payment processor, and update PAYMENT_API_KEY on the Playbook to match).

---

## 19. SPLIT-CHARGE — FULLY BUILT, GATED OFF, UNPROVEN (2026-07-07)

### STATUS: deployed but HIDDEN. `SPLIT_ENABLED = false` (Invoices.jsx line 8).
Flip to `true` ONLY after the full lifecycle test below passes.

### What it does
Staff-initiated. Reduce a scheduled_charge to a partial amount (SAME due date), create a NEW
scheduled_charge for the remainder on a staff-chosen date. Both share the SAME zoho_invoice_id.
When each auto-bills, applyZohoPartialPayment applies its amount as a partial, so the Zoho invoice
only closes once BOTH have cleared.

### Commits
- payment processor 9f36f9c — applyZohoPartialPayment added to autobill-run.js (line 570), unused
- payment processor 87271b6 — autobill call site (line 152) switched to applyZohoPartialPayment,
  param expectedAmount -> amount. SAFE: normal charge amount == full balance == fully pays as before.
  markZohoInvoicePaidIdempotent still in file (line 507) = instant revert (2-line change back).
- payment processor d601ea4 — handleSplitCharge (line 733), switch case (134), SYSTEM_WRITE_ACTIONS (84)
- Playbook 9de4322 — split_charge added to invoices-api WRITE_ACTIONS (line 23)
- Playbook 36e0a6b — UI: Split button, modal body, submit case, form init
- Playbook 46be872 — SPLIT_ENABLED flag gate (button hidden)

### handleSplitCharge safety design
- Validates: partial > 0, partial < original, remainder >= $0.01, date YYYY-MM-DD,
  status in (scheduled|failed|paused)
- Reduces original via PATCH (amount only; due_date untouched)
- Creates remainder by COPYING the whole original row, then deleting DB-generated/charge-result
  fields (id, created_at, updated_at, transaction_id, auth_code, paid_at, charged_at,
  next_retry_date, retry_count, last_decline_reason, claimed_at) and overriding
  amount / due_date / status='scheduled' / sequence_number(+100).
  => guarantees the remainder inherits customer_profile_id, payment_profile_id, zoho_invoice_id,
     pipedrive_deal_id, client_name (everything autobill needs). No hand-picked column list.
- ROLLBACK: if the remainder insert fails, the original amount is restored.
- Posts a Pipedrive note documenting the split.

### VALIDATION DONE
- node --check on all backend files: pass
- @babel/parser JSX parse of Invoices.jsx: OK
- `npx vite build`: builds clean (this is the real check; brace-counting alone let a mangled
  template-literal line through earlier — see gotcha below)

### *** REQUIRED BEFORE GOING LIVE ***
1. Confirm the AUTOBILL change is safe on NORMAL charges. autobill cron = `0 */8 * * *`
   (00:00 / 08:00 / 16:00 UTC = 6 PM / 2 AM / 10 AM Mountain). After a run:
     - Netlify > payment-processor > Functions > autobill-run > latest log: no Zoho errors
     - Pick a charged client's Zoho invoice: status `paid`, balance $0
     - Pipedrive AUTOBILL SUCCESS note looks normal
   If an invoice sits at `partially_paid` when it should be closed -> REVERT autobill line 152/154
   back to markZohoInvoicePaidIdempotent / expectedAmount.
2. Split lifecycle test on a TEST DEAL: split a charge -> verify rows (original reduced, remainder
   created, same zoho_invoice_id, note posted) -> let BOTH pieces auto-bill naturally -> verify Zoho
   closes only after the second clears, cards charged correctly, no double-charge, no orphan rows.
3. Only then set SPLIT_ENABLED = true.

### GOTCHA LEARNED (important for future PowerShell JSX edits)
Building a JS template literal inside a PowerShell double-quoted string mangles it. A line that
brace-counted as balanced was actually invalid JS:
  BAD  -> text: Split into +'$'+${partial.toFixed(2)} ...
  FIXED-> text: 'Split into $' + partial.toFixed(2) + ' and $' + (orig - partial).toFixed(2) + '.'
Use plain string concatenation, or splice JSX in from a downloaded file. And ALWAYS validate with
`npx vite build` or @babel/parser, never brace-count alone.

### NOTE: netlify.toml comment above the autobill cron is stale (says "daily", says 14:00 UTC).
Actual cron is `0 */8 * * *`. Cosmetic; fix when convenient.

---
---

# PART II — 2026-07-07 to 2026-08-13 (377 commits)

**Added:** 2026-08-13. Part I above is accurate as of 2026-07-07 and is kept as history.
Where Part I and Part II disagree, **Part II wins**.

## 20. HOW TO USE THIS PART + WHAT ELSE TO READ
- `HANDOVER.md` (repo root, 2026-08-08) documents architecture, ~120 tables by domain, the
  scheduled-function map, the auth model, and external systems. **Do not duplicate it here.**
  This part carries RULINGS, POLICY, and SYSTEM CHANGES - the things that live nowhere else.
- The standing rule from Part I still holds and was NOT followed 7/07 to 8/13. Follow it now:
  every push updates the vault in the same or next commit.
- Section 28 (Standing Rulings) is the highest-value section. Read it before changing any
  counting, crediting, or money logic. Most "why did this number change" questions end there.

## 21. THE CRM MIGRATION (8/08-8/10) — biggest new system, absent from Part I
Goal: replace Pipedrive as system of record with the Playbook. Pipedrive is STILL master;
the Playbook holds a live mirror and writes through to PD on every change.
- **Mirror:** `crm-sync` pulls persons + deals (all 18 custom fields, RD/ARD round dateranges),
  notes, and activities into `crm_clients` / `crm_deals` / `crm_notes` / `crm_activities` /
  `crm_field_options`. Cursor-based incremental; `crm-sync-tick` every 10 min.
- **Cursor hardening (learned the hard way):** cursors only advance FORWARD (`advanceCursor`) -
  the backfill's final oldest-page run was stomping bookmarks. Cursors are clamped to now - a
  future-dated 2036 activity in PD froze `activities_cursor` and silently stopped incremental sync.
- **Null bytes:** `crm-sync` strips `\u0000` from upsert payloads (a pasted null byte in one
  person record at page 10500 killed the whole person backfill).
- **Screens:** Client File (`/clients`, deal-centric search over 255k clients via
  `crm_deal_search` / `crm_client_search` RPC with trigram fuzzy), Pipeline Board, My Day,
  AM Book, SMS/Texts tab (two-way RingCentral threads incl. client replies).
- **Write-backs, all Pipedrive-first then mirror:** notes, activities (add task / mark done),
  deal stage moves, status changes (CURRENT STATUS / UPDATE STATUS / QUICK BUTTONS),
  person-merge (uses Pipedrive's NATIVE merge).
- **Verification:** `crm-compare` daily (every PD record changed in 24h exists in the mirror),
  `crm-deep-verify` daily field-level spot audit on a random sample changed in 48h.
- **Nav:** Clients / My Day / Pipelines / My Book are LEADERSHIP-ONLY (removed from
  `coreNavItems`) during rollout. Opening them to staff is a deliberate future step.

## 22. REFUNDS — full pipeline (7/09-7/16, rulings 8/04)
Flow: **request -> leadership approve -> release signed -> pay (card and/or check) -> ledger + payroll deduction.**
- Everyone files a request (`refund-requests`); no direct card refunds remain on Invoices.
- Card refunds route to the correct merchant (primary vs Amex) by `merchant_id` /
  `paid_via_merchant`. Remainder auto-routes to the check queue.
- `refund-webhook` writes the `refunds` ledger on every refund - the Bonus Tracker's standard
  source. Requires `refund_reason` AND `deduction_percentage` (both NOT NULL - two separate hotfixes).
- **Payroll deduction is automatic per house policy: 10% VA / 14% regular** of the refund
  amount, on both card and check paths. Check refunds are 0%.
- Bonus readers exclude refund-flagged payments (open-period rule).
- Refund requests stamp the consultant (Pipedrive deal owner) at submit time.

## 23. SPLIT CHARGES (7/14-7/16)
- **Design correction (Joe):** a split is ONE invoice with TWO payments. Zoho is not
  restructured, no remainder invoice is created; only the due date moves to payment 2.
- One door: everyone files a request; splits execute only via Approvals approve.
- Guardrails: P1 <= original due date, 14-day gap cap, 45-day resolution window,
  month-boundary acknowledgment. Admins split instantly (`split_charge`); team keeps the request path.

## 24. AFFILIATE CADENCE ENGINE (7/10-7/22)
- `affiliate-book-sync` hourly from PD filter 523931 into `affiliate_orgs`.
- **Super affiliates are excluded from all cadences** - flagged via Super Affiliate Portal /
  Senior Affiliate fields, plus an explicit allowlist (Oz Konar/BLB, 7 Figures Funding,
  NoRisk Digitals, Kevin Walters Sr).
- **Date guard:** payments cannot credit an affiliate that did not exist yet (kills
  retro-attribution - Paul Ashton went 8 referrals -> 1).
- Runner sends Mon-Fri only, from 8am Central, batch-dialled via `app_config.affiliate_per_run`.
  Atomic claim before send so overlapping runs can never double-send.
- **AI personalization at send time** rewrites each email around the affiliate's real history.
  Hard rule: the AI never mentions payouts, earnings, or dollar amounts to affiliates.
- SendGrid event webhook stamps opens/clicks/bounces onto touches. Sent bodies stored on the
  touch (JSON in `detail`, zero-DDL).
- RingCentral credentials live in Supabase `app_secrets` (4KB Lambda env cap workaround).
- SMS STOP replies auto-opt-out the affiliate.
- Call queue: **daily batch, 20 per consultant per weekday, done means done** (Joe's 8/10
  ruling replacing the rolling refill). Weekends promote nothing; unfinished carry into the
  next day's 20.
## 28. STANDING RULINGS (READ BEFORE CHANGING ANY COUNTING OR MONEY LOGIC)
These are Joe's decisions. They are not implementation details - changing code that violates
one of these is a policy change, not a bug fix.

**Qualified docs / consultant credit**
- A client qualifies when the first plan invoice COMPLETES; it counts in the month it finished (7/23).
- Cross-month is fine: a doc fee in one month and the balance payment in the next counts to the
  month of the first balance-side payment (7/10).
- One-shot payers with no balance invoice qualify off real payment rows (Sims).
- **Money beats stale paperwork:** if actual balance payments cover the smallest balance invoice,
  qualify off the payments even when the Zoho invoice mirror still shows a balance (Fernando 8/10).
- Orphan doc-fee payments only credit the consultant they NAME - repeat clients stop
  double-crediting old deal owners.
- Name-to-deal resolution prefers OPEN deals, then newest (the returning-client trap).
  Payment enrichment never blind-copies a sibling row's deal/consultant - it nominates, fetches,
  verifies open, then derives the consultant LIVE from `owner_name`.

**Refunds**
- A refund only counts against a month's sales when the ORIGINAL payment was made that month.
  Refunds of prior-month money do not reduce the current month (8/04).
- Refunds show the moment the release is SIGNED - rows marked, ledger written with payroll
  deduction at that point (8/04).

**CSR report credit**
- No monitoring site = no report. Blank-site deals stay in stage distribution and the
  operational funnel but never count toward reports.
- Credit triggers on the monitoring site being set, OR the deal landing in Ready to Quote this
  month (the legacy OR-branch). NOT deal creation date.
- Capture pipeline must be New Leads, Reports, or Quoted at capture time - but do NOT gate on
  CURRENT pipeline: an RTQ-this-month deal still counts after progressing to SOLD/CRS.
- Categories: contains "Identity IQ"/"IDIQ" = IDIQ; "Smart Credit" = Smart Credit; anything
  else filled = Other.
- Only deals created THIS MONTH get credited on first touch (stops legacy deals drip-crediting).

**Stall rate (Astrid/Kim's metric - do not change without them)**
- Rounds submitted to bureaus LEAVE the stall universe (waiting on bureaus, not the AM).
- Payment-blocked (OWES MONEY family), missing-docs, service-complete, and additional-round
  clients are all excluded from the stall population.

**Money / P&L**
- Meta/Facebook ad spend and attorney/legal fees on the card are OWNER COSTS - excluded from
  the P&L and from Astrid's DOO compensation basis entirely. VSL Queen ad-creative charges too.
- Consultant MTD/today = commissionable sales only (doc/partial/final). Additional rounds stay
  in company MTD but not consultant MTD.

**Reviews**
- Assigned/approved reviews keep their credit even if Google later delists them (Kim/Joe 7/20).
  Delisting only hides unassigned reviews.

**Team / process**
- Additional Rounds price is $299 (was $249 until 8/01). Already-sent $249 offers are HONORED
  via the `price_override` path - that is the standing honored-price route.
- Payment link first, always. Sideways money (Zoho-direct, Zelle) means capture the card the
  same day - a Zoho-direct payment breaks autopay, agreement send, AND the doc-fee guard at once.

## 29. GOTCHAS ADDED SINCE PART I
- `consultant-dashboard-api.js` contains a non-UTF8 byte (0x97). Read it with
  `errors='surrogateescape'` or patch byte-level (`open('rb')`) - naive readers crash.
- Scheduled Netlify functions reject direct HTTP (403). Every one needs an inlined `-manual`
  twin; `require`-ing a sibling function breaks under esbuild per-function bundling.
- Playbook deploys take 4+ minutes and QUEUE. Check the Netlify Deploys tab before concluding
  a change did not ship.
- JSX does not process unicode escapes in text nodes - write the character, not the escape.
- Supabase REST caps at 1000 rows; use `Prefer: count=exact` and paginate.
- `scheduled_charges` status constraint REJECTS 'cancelled'. Valid vocabulary includes
  scheduled/pending/paid/failed/paused/refunded/voided. Use 'paused'.
- PowerShell: `$pid` is a READ-ONLY builtin - never assign to it.
- Pipedrive moved the deal owner name to a flat `owner_name` field; `owner_id.name` is now
  EMPTY for every deal. Anything reading `owner_id.name` is silently broken.
- All timestamps that represent a PAYMENT DATE must stamp America/Chicago, not UTC. A payment
  after 7pm CT posts to TOMORROW in UTC and lands in the wrong commission month at month end.

## 30. OPEN AT 2026-08-13
- **Phase E of the AI Project Manager** (SOP library, Ask-the-Playbook, 90-day refreshers).
- **SOP phase gating:** the SOP generator writes an SOP of the PLAN when a card is early in its
  lifecycle. It should warn or refuse before the SOP phase and read completion state.
- Estrella qualified_doc revoke-or-stays after refund - asked 3x, still unruled.
- Refund deduction policy: the UI never sends a percentage, so deductions are 0 until Joe rules
  enforce-or-zero.
- Historical blind-borrow sweep beyond the walker's 120-day window.
- `pay.html` validates only primary Auth.net keys - missing Amex keys would silently kill all
  Amex tokenization. Loud-failure check is cheap and not yet done.
- Madison Diaz de Leon: a third sender (likely a GHL blast) has broken payment links; blocked
  on the forwarded email.
- Two clients carry duplicate open deals needing cleanup: Charles Watson (256037 + 269002),
  Melanie Quintanilla (259311 + 266053).
- Pipedrive API token rotation is still pending.

## 31. DEPLOY DISCIPLINE — ADDITIONS
Part I Section 4 still governs. Added since:
- **Every ticket ends in a permanent, structural fix. Nothing is re-tasked.** (Joe, 8/11)
- Patch scripts abort-check EVERY anchor (count != 1 -> exit before writing). An abort that
  writes nothing is a success, not a failure.
- Verify before push: a `verify_*.py` that greps for every expected string and prints
  ALL GOOD / DO NOT PUSH, with the push gated on `$LASTEXITCODE`.
- Before shipping anything that can lock users out or stop money, run a READ-ONLY precheck
  (Supabase REST GET from PowerShell) that names exactly who would be affected, and gate the
  push on it returning empty.
- When verifying a display complaint, verify THE SOURCE THE DISPLAY READS - not the system you
  assume feeds it. (Fernando 266340 cost three rounds to that lesson.)
- **SOP phase gating (8/13):** `ai-sop` refuses to start before the SOP phase unless the caller
  passes `confirm:true`, and the generator receives the phase, the done/total count, and a
  per-task [BUILT] / [NOT BUILT YET] marker with a ground rule to document only what is BUILT.
  Reason: the first real SOP documented an SOP library, quizzes and a Drive link that did not
  exist, because the card sat at BUILD and the plan field is a SPEC, not a description of reality.
- **PHASE E part 1 - SOP Library (8/13):** `/sops`, nav item for everyone (reading a process is
  never restricted). Reads every `project_cards.links` entry flagged `sop`, sorted newest first,
  full-text search across project title and SOP body with a match-centred snippet; clicking opens
  the `SopDocument` reader. This is the corpus Ask-the-Playbook answers from.