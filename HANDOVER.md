# ASAP Playbook - Developer Handover

> Auto-maintained. Regenerate with `py generate_handover.py` after adding functions/pages.
> Written for a developer inheriting this system cold. Companion doc: HANDOVER.md
> in the asap-payment-processor repo (the money engine this app fronts).

## What this is
The team's operating system (React + Vite SPA on Netlify, site cute-cat-d9631c).
Bonuses and leaderboards, payment dashboards, invoices browsing, affiliates CRM +
SMS cadences, training/LMS, tasks & projects, PTO/scheduling, scorecards,
financial dashboards (QuickBooks + Plaid), reviews, and the Automations control
panel (toggles + run feed + credentials vault) for the whole platform.
IN PROGRESS: becoming the full CRM replacing Pipedrive by end of year
(project notes: the CRM migration plan; phases Sept-Dec).

## Architecture in one breath
React pages (src/pages) call Netlify functions (netlify/functions) which read/write
THIS project's Supabase (kkcbpqbcpzcarxhknzza) and proxy to the payment processor
(asap-payment-processor.netlify.app) with X-API-Key for money operations. Heavy
metrics are computed on schedules into app_cache and served instantly (the page
always serves cache; freshness = the warm cadence).

## Supabase tables by domain (~120; RULE: new tables need
`alter table X disable row level security` or reads silently fail)
- IDENTITY/ORG: users (department drives role gates: credit_consultants,
  account_managers, leadership...), user_settings/notes/onboarding, financial_access
- PIPEDRIVE MIRRORS (Phase 1 of CRM migration promotes these to masters):
  cs_deals (deal snapshot + AM + monitoring site), consult_deals (closing rates),
  pipedrive_deals/deal_history/errors/escalations, deals, deal_am_map
- MONEY VIEWS: consultant_payments (Zoho-synced payment rows - the bonus/paysheet
  source of truth), consultant_invoices, refunds/refund_requests/refund_log,
  deleted_payment_tombstones, sales/sales_today
- BONUS ENGINE: consultant_bonus_events (the credit ledger; unique deal|type|month),
  consultant_bonus_monthly, bonus_awards, credit_team_bonus/status,
  csr_daily_checklist + role_daily_checklist (daily gates), scorecard_* tables
- AFFILIATES: affiliates, affiliate_orgs/referrals/touches/followups/templates/
  call_tasks (cadence engine gated by app_config.affiliate_engine_enabled)
- AUTOMATIONS PLATFORM: automation_registry (toggles), automation_runs (the feed),
  connection_secrets (the credentials vault), app_config, app_secrets
- TRAINING: training_* (courses/modules/lessons/quizzes/progress/assignments)
- WORK MGMT: tasks, task_*, project_cards/stages/members, personal_tasks,
  calendar_events, events, lunch_schedules, shift_templates, schedules,
  time_records, pto_*, time_off_requests, daily_checkouts/daily_out
- FINANCE: qb_* (QuickBooks), quickbooks_tokens, plaid_*, monthly_pnl_snapshots,
  transaction_reviews/rules, kpi_snapshots
- CONTENT/MISC: reviews/incoming_reviews/pending_reviews, client_surveys/survey_*,
  updates + update_acknowledgements, knowledge_base, quick_links/references,
  video_links/views, ai_* (assistant experiment), gmb_locations, stall_clients,
  credit_building_submissions, secured_cards, company_profile, app_cache

## Scheduled functions (see netlify.toml for the live map)
Highlights: consultant-bonus-warm (*/10 around the clock - the leaderboard's
freshness), consultant-bonus-sync, zoho-payment-sync + backfill + enrich(+tick),
zoho-invoice-sync + reconcile, am-pipeline-cache, sync-consult-deals,
qualified-doc-watchdog (nightly self-heal), pipedrive-daily-sync, affiliate-book-sync
+ cadence-runner, review-reconcile, round2-survey-trigger.
LANDMINE: scheduled functions reject direct HTTP (403). Anything a page must also
call needs a wrapper or a -manual twin with logic inlined (esbuild breaks
cross-function require).

## Auth model
Supabase Auth (email) -> users row -> department/role gates in App.jsx routes and
Layout.jsx nav. Admin/leadership pass through daily gates; consultants/AMs/CSRs
hit role checklists. Server functions verify the Supabase JWT (verifyPlaybookUser)
and forward identity to the processor via X-Acting-As.

## External systems
- Payment processor: invoices-api (proxy w/ AM scoping + consultant enrichment),
  authnet-proxy (reconciliation ticker), refund flows. X-API-Key both directions.
- Zoho Invoice: payment/invoice sync (the consultant_payments pipeline).
- Pipedrive: being replaced; today it is still master for clients/deals/stages/
  notes/activities + 6 person fields + round dateranges (see CRM migration notes).
- SendGrid (SENDGRID_API_KEY) for cadence/user mail; RingCentral SMS (STOP
  auto-opt-out live); QuickBooks + Plaid for financials; Google (Sheets scorecard,
  GMB reviews).

## Conventions & landmines
- Windows/PowerShell dev loop; python patch scripts with abort-checks; verify
  counts on FUNCTIONAL strings (comment collisions cause false failures).
- Builds take 4+ min and queue - check the Deploys tab, never assume.
- Chicago (America/Chicago) is the business day everywhere; sprint weeks are
  Mon-Sun with 1-2 day month-start stubs absorbed into week 1.
- Leaderboard/bonus changes: deploy -> purge consultant_bonus_{month} in app_cache
  -> recompute (?month=YYYY-MM&refresh=1) -> hard refresh. The recompute 502s at
  the HTTP gateway (~40s) but still completes and writes the cache.
- The paysheet mirror: consultant-bonus-metrics rewrites MTD/today sales from
  payments-live so the leaderboard always equals the Payment Dashboard.

## Where credentials live (names only)
Netlify env on THIS site: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY (+ SUPABASE_URL/SUPABASE_SERVICE_KEY aliases),
PAYMENT_API_KEY (processor door), PIPEDRIVE_API_KEY, SENDGRID_API_KEY,
ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN/ORG_ID, GOOGLE_* (service account),
QuickBooks/Plaid tokens live in their tables. Runtime vault: connection_secrets
(managed on the Automations page).

## Function inventory (auto-generated from file headers)

- **account-manager-metrics.js** - Account Manager Metrics Function Fetches Account Manager KPIs from Pipedrive and Supabase
- **admin-command-center.js** - netlify/functions/admin-command-center.js COMMAND CENTER P3 server: cohort funnel + JOURNEY (doc fee + dispute rounds) + range reviews + census. GET ?start&end (defaults current month CT).
- **affiliate-activity.js** - Affiliate outreach activity feed: recent affiliate_touches joined with org names, plus today / last-7-day counts by channel. Read-only, admin dashboard.
- **affiliate-book-sync.js** - affiliate-sync.js  (Playbook) Syncs the affiliate book from Pipedrive filter 523931 (orgs with a Portal Link) into affiliate_orgs. New portal signups are Zapier-created with the field filled,
- **affiliate-cadence-runner.js** - affiliate-cadence-runner.js  (Playbook) The affiliate outreach engine. Runs every 30 minutes during business hours. SHIPS DISABLED: app_config.affiliate_engine_enabled must be 'true' before anything sends.
- **affiliate-checkin-sms.js** - affiliate-checkin-sms.js  (Playbook) POST { id, consultant } -> sends the voicemail follow-up text to the affiliate, logs the touch, and appends the line to Pipedrive Additional F/U Notes.
- **affiliate-engine-status.js** - netlify/functions/affiliate-engine-status.js  One call answers: is the engine alive, what has it done today, and who is
- **affiliate-preview-message.js** - affiliate-preview-message.js  (Playbook) GET ?id={affiliate_orgs.id} Returns the affiliate's next message BOTH ways: the raw merged template and the
- **affiliate-referred-deals.js** - affiliate-referred-deals.js (Playbook) GET ?id=<affiliate_orgs.id>  ->  live referral history for one affiliate: every Pipedrive deal on their org (client name, stage, open/won/lost, dates, value)
- **affiliate-seed-templates.js** - affiliate-seed-templates.js  (Playbook) Seeds affiliate_templates with the message library. Idempotent: wipes and reloads. Run manually after deploy (and after any library revision):
- **affiliate-sms-inbound.js** - netlify/functions/affiliate-sms-inbound.js  Honors "Reply STOP to opt out" on affiliate texts.
- **affiliate-sync.js** - (no header comment)
- **affiliate-unsub.js** - affiliate-unsub.js  (Playbook) One-click unsubscribe from partner emails. Linked in every engine email footer. GET ?id={affiliate_orgs.id}&k={base64 of pipedrive_org_id} - the k check stops
- **affiliate-update-fu-notes.js** - affiliate-update-fu-notes.js  (Playbook) POST { id, notes } -> writes Additional F/U Notes BOTH ways: PUT to the Pipedrive organization field + PATCH to affiliate_orgs.pipedrive_fu_notes
- **agreements-api.js** - agreements-api.js (Playbook) Server-side proxy for the Agreements tab. Two actions: - search : forwards to the payment processor's agreements-search.js
- **all-payments.js** - All Payments: list + manual add for consultant_payments (service-role, bypasses RLS)
- **am-additional-rounds.js** - am-additional-rounds.js Counts PAID $299 additional rounds per Account Manager for a given month. Source of truth = consultant_payments rows with payment_type='additional_round'
- **am-agreement-dates.js** - am-agreement-dates.js  (VISIBILITY ONLY - never affects the bonus)  "% of clients who kept their agreement dates" per Account Manager.
- **am-csat.js** - am-csat.js — AM satisfaction score from the Round 2 survey. Each response carries an am_rating (1-10). An AM's monthly score is the average of their ratings that month. A minimum number of responses is required before
- **am-payments-summary.js** - am-payments-summary.js What Account Managers need from the payment sheet: how many payments were collected this month by type (doc fee / partial / final), with the consultant names, plus a best-effort "attributed to AM"
- **am-pipeline-cache.js** - am-pipeline-cache.js  (round-end based report stall; rate-safe, resumable)  Stall definition (per Joe and Astrid):
- **am-referrals.js** - am-referrals.js  (organization-based) Referrals are tracked by Pipedrive Organization: each AM has their own org, and referred clients are placed under it. Whoever owns the org gets the credit.
- **am-stall-rate.js** - AM Stall Rate Calculator with Supabase caching
- **approve-credit-submission.js** - approve-credit-submission.js Approves or rejects a credit-building submission. On approval, posts a Pipedrive note to the client's deal:
- **ar-tracker.js** - netlify/functions/ar-tracker.js  (PLAYBOOK side) Proxy to the payment processor's AR endpoints using AR_INTERNAL_API_KEY. GET                       -> offers list (ar-offers-list)
- **ar-tracking.js** - netlify/functions/ar-tracking.js ADDITIONAL ROUNDS TRACKING (Joe 7/24): every AR client in two buckets - inService:  open deals in ADDITIONAL C.R.S. (pipeline 65) - client, AM/owner, days in service
- **ask-ai.js** - Netlify Function for Ask AI Optimized for SPEED - fast responses for phone calls
- **ask-openai.js** - (no header comment)
- **authnet-proxy.js** - (no header comment)
- **backfill-resolve-deals.js** - backfill-resolve-deals.js The fast backfill inserted payments with the right dollars but no deal id / type, so the normal enrichment (which needs a deal id) can't touch them. This fills that in: for each backfilled row it
- **bonus-debug.js** - (no header comment)
- **check-fine-tuning.js** - (no header comment)
- **connections-proxy.js** - (no header comment)
- **consultant-bonus-metrics.js** - Consultant Bonus Metrics v4 — Derives ALL metrics from Zoho payments Qualified docs = unique clients with doc_fee AND (partial OR final) payments
- **consultant-bonus-sync.js** - Consultant Bonus Sync — Uses Pipedrive filters for fast scanning
- **consultant-bonus-warm.js** - Scheduled pre-warm for the consultant bonus dashboard. Calls the metrics function with ?refresh=1 so it recomputes and re-caches the result. Every normal page load then reads that fresh cache instantly instead of computing live.
- **consultant-metrics.js** - Consultant Metrics Function - Uses Pipedrive FILTERS for accurate data Lead Conversion now uses Pipedrive filters (not Supabase tracking columns which get corrupted by bulk updates) Filter 178770 = Moved to Quoted this month
- **credit-team-bonus-metrics.js** - Credit Team Bonus Metrics Computes the 5 operational metrics for the monthly $300 team bonus. Four run automatically off Pipedrive round date fields + the Reports Received filter;
- **credit-team-cache-background.js** - credit-team-cache-background.js Background function (15-min budget) that scans the CRS Round-1-started population once and caches each deal's round dates (app_cache['credit_team_round_dates']) so credit-team-bonus-metrics can
- **credit-team-metrics.js** - Credit Team Metrics Function Fetches Credit Team KPIs from Pipedrive and Google Sheets
- **cs-deals-csv-import.js** - CS Deals CSV Import Imports CS deals directly from uploaded CSV data Much faster than API calls - no rate limiting issues
- **cs-deals-initial-sync.js** - CS Deals Initial Sync (page-based) Loads CS deals from the Pipedrive filter into Supabase one page per call to stay under the function time limit. Call with no params to start, then follow the returned nextUrl until done.
- **cs-deals-webhook.js** - netlify/functions/cs-deals-webhook.js  ASAP Credit Repair - CS Deals Real-Time Webhook
- **csr-bonus-metrics.js** - CSR Bonus Metrics — computes the CSR Performance & Bonus Plan from cs_deals. Phase 1: Report Bonus (fully from cs_deals) + a debug block reporting the data shape (distinct monitoring sites + pipeline/stage names) so the gate can be locked precisely.
- **csr-set-allstar.js** - Sets or clears the All-Star CSR award (manual, +$100, one winner per month). POST { month: "YYYY-MM", csr: "Name", action: "set" | "clear" } Stored in bonus_awards as bonus_type = 'all_star_csr'.
- **customer-support-metrics.js** - Customer Support Metrics Function Reads metrics from cs_metrics_cache (populated by webhooks from cs_deals)
- **deals-csv-import.js** - Deals CSV Import Function Bulk import deals from Pipedrive CSV export to Supabase
- **deals-webhook.js** - Deals Webhook - Keeps Supabase deals table in sync with Pipedrive TRACKS CHANGES: Records timestamps when key fields change - Doc(1) changed to Yes → "Doc (1) Changed At"
- **final-credit-hook.js** - (no header comment)
- **generate-training-course.js** - (no header comment)
- **google-review-webhook.js** - Netlify function to receive Google reviews from Zapier Endpoint: /.netlify/functions/google-review-webhook
- **google-sheets-sync.js** - Google Sheets Sync Function Fetches credit repair results data from Google Sheets Uses GOOGLE_PRIVATE_KEY_B64 (base64 encoded) to avoid newline issues
- **invoices-api.js** - invoices-api.js (Playbook) Server-side proxy to the payment processor's consultant-dashboard-api. Forwards the Playbook user's identity via X-Acting-As so the payment
- **manage-user.js** - Netlify Function for creating users with Supabase Auth This keeps the service role key secure on the server side Includes email notification via SendGrid
- **migrate-daily-out.js** - Creates a simple 'daily_out' table for tracking who's out today Run once: /.netlify/functions/migrate-daily-out
- **migrate-links.js** - One-time migration: Add 'links' jsonb column to task_templates Hit this endpoint once after deploy: /.netlify/functions/migrate-links Can be deleted after running successfully
- **org-debug.js** - (no header comment)
- **parse-document.js** - Netlify Function to parse uploaded documents
- **pay-refund.js** - pay-refund.js  (Playbook) B3 proxy: leadership clicks Pay Refund on a ready-to-pay request. Verifies v3: records the consultant payroll deduction ONCE per request, split-aware:
- **payment-enrich-tick.js** - (no header comment)
- **payment-enrich.js** - Payment Enrichment — Looks up Pipedrive deals for payments missing consultant names Processes 20 records at a time to stay under timeout
- **payment-reconcile.js** - Reconciles the Google payment sheet against the Zoho consultant_payments table for a month. Shows, per consultant, sheet total vs Zoho total, how much Zoho money is unattributed (pending_enrichment), and which sheet payments don't match a Zoho row (and vice versa).
- **payment-webhook.js** - Payment Webhook — Receives payment events from Zapier or Zoho POST with JSON body: { client_name, amount, payment_type, consultant_name, ... }
- **payments-live.js** - netlify/functions/payments-live.js  Zoho-truth replacement for paysheet-live: serves consultant_payments rows in
- **paysheet-live.js** - PAYSHEET-LIVE: Reads payment data directly from Google Sheets NO Supabase sync - eliminates duplicate/stale data issues Accepts multiple months in one call for speed (current + last month)
- **person-webhook.js** - Person Webhook - Tracks updates to Person records from Pipedrive Updates deals table when Person fields change (Call Center Rep, Account Manager, etc.)
- **pipedrive-daily-sync.js** - Pipedrive Daily Sync Runs as scheduled function to ensure data consistency Also provides manual sync endpoint
- **pipedrive-sync.js** - Pipedrive API Integration for KPI Tracking Syncs escalations and errors from Pipedrive labels
- **pipedrive-webhook.js** - Pipedrive Webhook Receiver Receives real-time updates when deals/persons change in Pipedrive
- **pipeline-metrics.js** - Client Pipeline Metrics - Pulls live data from Pipedrive
- **process-training-doc.js** - (no header comment)
- **qualified-doc-watchdog.js** - (no header comment)
- **record-refund.js** - record-refund.js Manual-refund entrance to the ONE refund pipeline. The Refund Tracking tab submits here. Does everything in one place:
- **refund-requests.js** - refund-requests.js The refund REQUEST pipeline (B1). All refunds start here; nobody card-refunds directly from the Invoices page anymore.
- **refund-webhook.js** - refund-webhook.js Receives refund events from the payment processor's refund handlers. Rule (per Joe, conservative default): refunds only affect the CURRENT
- **register-cs-webhook.js** - Checks whether the Pipedrive webhook pointing at cs-deals-webhook exists, and creates it if not. Run once: /.netlify/functions/register-cs-webhook Returns the existing webhooks (so you can see what's there) and anything it created.
- **resend-survey.js** - resend-survey.js (Playbook) Resends the Round 2 survey to a client from an existing survey_sends row. POST { send_id }  ->  looks up the original send, re-sends via the payment-processor
- **review-post-note.js** - Posts a Pipedrive note on a deal that a review was left, and stores the deal id on the review. Called when a review is approved/assigned (the deal id is captured at claim or assign time).
- **review-reconcile.js** - review-reconcile.js Flags incoming_reviews that have dropped off Google ("delisted"). Google filters some reviews after they post (new accounts, similar wording, spam model), which
- **round2-survey-trigger.js** - round2-survey-trigger.js  (Playbook, scheduled daily) Finds clients whose CURRENT STATUS = 2ND RD DONE (option 708), and that haven't already been sent the Round 2 survey, then sends via the payment-processor sender
- **sales-api-sync.js** - Sales Sync using Google Sheets API (more reliable than CSV publish) URL: /.netlify/functions/sales-api-sync ?mode=diagnostic - Shows comparison (default)
- **sales-auto-sync.js** - Scheduled function to sync sales every 5 minutes This runs mode=full which deletes and reimports to prevent duplicates
- **sales-diagnostic.js** - Sales Diagnostic - Compare Google Sheet vs Supabase to find missing payments URL: /.netlify/functions/sales-diagnostic
- **sales-full-sync.js** - Sales Full Sync - One-time sync to catch ALL missing payments Reads entire Google Sheet and inserts any missing rows into Supabase URL: /.netlify/functions/sales-full-sync
- **sales-scheduled-sync.js** - Scheduled Sales Sync - Runs automatically via Netlify scheduled functions This syncs the current month's sales from Google Sheets to Supabase Schedule: Every 10 minutes during business hours
- **sales-sheet-test.js** - Test what's coming from Google Sheet URL: /.netlify/functions/sales-sheet-test
- **sales-sync-backup.js** - Sales Sync Backup - Runs hourly to catch any missed payments Reads from published Google Sheet and syncs to Supabase This is a BACKUP - primary sync should be via Zapier webhook
- **sales-webhook.js** - Sales Webhook - Receives payment data from Google Sheets and syncs to Supabase Sheet ID: 1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y GID: 1527489711 (Total Paid sheet)
- **scorecard-entry.js** - Netlify Function for receiving scorecard data from Zapier Endpoint: POST /.netlify/functions/scorecard-entry
- **send-release.js** - send-release.js  (Playbook) Proxy between the Refund Tracking queue and the processor's create-release. Exists so the browser NEVER holds the API key: this function verifies the
- **send-round2-survey.js** - send-round2-survey.js Sends the Round 2 survey link to a client by email (Outlook/Graph) and/or SMS (RingCentral). Uses the same env vars as the autobilling project:
- **send-survey-email.js** - SendGrid Email Function for Survey Delivery Sends enrollment and completion surveys to clients
- **sendgrid-events.js** - netlify/functions/sendgrid-events.js  Wave 2 of outreach visibility: receives SendGrid's Event Webhook and stamps
- **set-monitoring-site.js** - netlify/functions/set-monitoring-site.js  Writes a deal's Monitoring Site the RIGHT way: Pipedrive first (source of
- **setup-am-backups.js** - ONE-TIME SETUP: Assigns backup users for all Account Manager tasks Based on the "When an Account Manager is OUT for the day" document Run once after deploy: /.netlify/functions/setup-am-backups
- **stall-sync.js** - stall-sync.js  (Playbook, scheduled) ----------------------------------------------------------------------------- Computes the AM Reports Stall population from Pipedrive and stores it in the
- **stall-webhook.js** - netlify/functions/stall-webhook.js  ASAP Credit Repair - Stall Real-Time Webhook
- **start-fine-tuning.js** - (no header comment)
- **sync-consult-deals.js** - sync-consult-deals.js Pulls the "Ready to Quote this month" consult deals from Pipedrive (filter 523803) and stores them in our own consult_deals table. This is the ONLY place that touches the Pipedrive filter. The bonus
- **test-pipedrive-activities.js** - Test endpoint to verify Pipedrive activities API is working URL: /.netlify/functions/test-pipedrive-activities
- **watchdog-manual.js** - (no header comment)
- **zoho-invoice-reconcile.js** - zoho-invoice-reconcile.js  (Playbook) The invoice sync is upsert-only: invoices deleted in Zoho live forever in consultant_invoices with their last-known balance, and payments recorded in
- **zoho-invoice-sync.js** - (no header comment)
- **zoho-payment-backfill.js** - zoho-payment-backfill.js One-shot backfill that pulls EVERY customer payment for a year and inserts any that are missing from consultant_payments. Unlike the hourly sync, this paginates through all pages of every month, and it
- **zoho-payment-sync.js** - Zoho Payment Sync v2 — Faster: pulls payments + invoice list data only Enrichment (Pipedrive deal lookups) done separately to avoid timeouts

## Pages inventory (src/pages)

- AITrainingHub.jsx
- AMBonus.jsx
- AdditionalRounds.jsx
- AdminKnowledge.jsx
- AdminOnboarding.jsx
- AdminPTO.jsx
- AdminSurveys.jsx
- AdminTasks.jsx
- AdminTraining.jsx
- AdminTrainingCourse.jsx
- AdminUpdates.jsx
- AdminUsers.jsx
- AffiliateOutreach.jsx
- Affiliates.jsx
- Agreements.jsx
- AllPayments.jsx
- Approvals.jsx
- AskAI.jsx
- Automations.jsx
- BackupSettings.jsx
- BonusTracker.jsx
- CSRBonus.jsx
- CSRDashboard.jsx
- Calendar.jsx
- ClaimReviews.jsx
- ClientPipeline.jsx
- CommandCenter.jsx
- CompanyProfile.jsx
- CompletionSurvey.jsx
- ConsultantBonus.jsx
- ConsultantPayments.jsx
- CreditTeamBonus.jsx
- DOOPaysheet.jsx
- Dashboard.jsx
- EnrollmentSurvey.jsx
- FinancialDashboard.jsx
- IncomingReviews.jsx
- Invoices.jsx
- KnowledgeAssistant.jsx
- LeadershipProjects.jsx
- Login.jsx
- MyPlaybook.jsx
- Onboarding.jsx
- Paysheet.jsx
- QuickLinks.jsx
- RefundTracking.jsx
- ReviewRandomizer.jsx
- Reviews.jsx
- Round2Survey.jsx
- Scorecards.jsx
- SecuredCards.jsx
- Settings.jsx
- TeamView.jsx
- Training.jsx
- TrainingCourse.jsx
- Updates.jsx

_Generated from repo state. Credential values never live in this file._
