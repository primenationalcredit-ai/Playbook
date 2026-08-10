import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """[functions."crm-compare-tick"]
  schedule = "0 13 * * *\""""
new = """[functions."crm-compare-tick"]
  schedule = "0 13 * * *"

# Daily field-level spot audit: random recently-changed deals/persons pulled fresh
# from PD, compared field-by-field, mismatches self-heal (PD is master). 7:30am CT.
[functions."crm-deep-verify-tick"]
  schedule = "30 13 * * *\""""
if s.count(old) != 1: print(f"ABORTED: toml anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("toml: crm-deep-verify-tick daily 7:30am CT")
