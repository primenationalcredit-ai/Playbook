import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """[functions."consultant-bonus-warm"]
  schedule = "*/10 12-23 * * 1-6\""""
new = """# Around the clock (Joe 8/8, stale-rankings ticket): the old 7AM-6PM CT Mon-Sat
# window left evenings, early mornings, and all of Sunday serving a stale cache -
# the page always serves cache by design, so freshness IS the warm cadence.
[functions."consultant-bonus-warm"]
  schedule = "*/10 * * * *\""""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("consultant-bonus-warm: every 10 minutes, 24/7")
