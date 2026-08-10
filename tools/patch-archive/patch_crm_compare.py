import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """[functions."crm-sync-tick"]
  schedule = "2,12,22,32,42,52 * * * *\""""
new = """[functions."crm-sync-tick"]
  schedule = "2,12,22,32,42,52 * * * *"

# Daily mirror proof: verifies every PD record changed in the last 24h exists
# fresh in crm_*. Verdict lands in crm_sync_state key last_compare. 7am CT.
[functions."crm-compare-tick"]
  schedule = "0 13 * * *\""""
if s.count(old) != 1: print(f"ABORTED: toml anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("toml: crm-compare-tick daily at 7am CT")
