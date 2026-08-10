import sys, re
f = 'netlify/functions/credit-team-bonus-metrics.js'
s = open(f, encoding='utf-8').read()
m = re.search(r"gotResults[^\n]{0,120}", s)
print("context:", m.group(0) if m else "NOT FOUND")
old_candidates = [x for x in s.split('\n') if 'gotResults' in x]
for c in old_candidates: print("line:", c.strip()[:160])
