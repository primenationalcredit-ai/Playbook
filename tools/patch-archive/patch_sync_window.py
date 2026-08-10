import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8').read()
old = '[functions."zoho-payment-sync"]\n  schedule = "* 12-23 * * *"'
new = '[functions."zoho-payment-sync"]\n  schedule = "* 8-23 * * *"'
if s.count(old) != 1: print(f"ABORTED: sync anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = 'schedule = "*/5 13-23 * * 1-6"\n# Completeness safety net'
new = 'schedule = "*/5 8-23 * * 1-6"\n# Completeness safety net'
if s.count(old) != 1: print(f"ABORTED: enrich anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("SYNC WINDOW: payment sync + enrichment now start 2am MT, matching the new autobill schedule")
