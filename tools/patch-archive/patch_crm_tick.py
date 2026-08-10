import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """[functions."payment-enrich-tick"]
  schedule = "0 * * * *\""""
new = """[functions."payment-enrich-tick"]
  schedule = "0 * * * *"

# CRM mirror heartbeat: incremental Pipedrive -> crm_* sync every 10 min,
# offset to :02 so it never collides with the bonus warm on :00.
[functions."crm-sync-tick"]
  schedule = "2,12,22,32,42,52 * * * *\""""
if s.count(old) != 1: print(f"ABORTED: toml anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("toml: crm-sync-tick scheduled every 10 min")
