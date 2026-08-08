import os

NARRATIVE = """# ASAP Playbook - Developer Handover

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
"""

lines = [NARRATIVE]
fdir = 'netlify/functions'
for fn in sorted(os.listdir(fdir)):
    if not fn.endswith('.js'): continue
    desc = []
    with open(os.path.join(fdir, fn), encoding='utf-8', errors='surrogateescape') as f:
        for raw in f:
            t = raw.strip()
            if t.startswith('//'):
                desc.append(t.lstrip('/').strip())
                if len(desc) >= 3: break
            elif desc or (t and not t.startswith('//')):
                break
    lines.append(f"- **{fn}** - {' '.join(desc) if desc else '(no header comment)'}")

lines.append("\n## Pages inventory (src/pages)\n")
pdir = 'src/pages'
for fn in sorted(os.listdir(pdir)):
    if not fn.endswith('.jsx'): continue
    lines.append(f"- {fn}")
lines.append("\n_Generated from repo state. Credential values never live in this file._\n")
open('HANDOVER.md', 'w', encoding='utf-8', errors='surrogateescape', newline='').write('\n'.join(lines))
print(f"HANDOVER.md written")
