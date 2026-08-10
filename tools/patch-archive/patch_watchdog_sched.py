import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8').read()
anchor = '[functions."consultant-bonus-sync"]'
if s.count(anchor) != 1: print(f"ABORTED: anchor x{s.count(anchor)}"); sys.exit(1)
s = s.replace(anchor, '# Qualified-doc watchdog: nightly self-heal at 3:30am MT (after 2am autobill+sync).\n# Verifies every recent final/PIF payment has its deal checkboxes + bonus events; fixes what is missing.\n[functions."qualified-doc-watchdog"]\n  schedule = "30 9 * * *"\n' + anchor, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("watchdog scheduled 09:30 UTC nightly")
