import sys
f = 'netlify/functions/invoices-api.js'
s = open(f, encoding='utf-8').read()
old = "  'update_due_date', 'pause', 'resume', 'charge_now', 'refund_initial', 'refund_scheduled',"
new = "  'update_due_date', 'pause', 'resume', 'charge_now', 'log_outreach', 'refund_initial', 'refund_scheduled',"
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("gateway allowlist: log_outreach added")
