import sys
f = 'netlify/functions/final-credit-hook.js'
s = open(f, encoding='utf-8').read()
old = "${SUPABASE_URL}/rest/v1/consultant_bonus_events"
new = "${SUPABASE_URL}/rest/v1/consultant_bonus_events?on_conflict=deal_id,event_type,event_month"
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("idempotency fixed: conflict target declared")
