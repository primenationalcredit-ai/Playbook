import sys
f = 'netlify/functions/credit-team-bonus-metrics.js'
s = open(f, encoding='utf-8').read()
old = "resultsDetail = { gotResults: r3.num, completed: r3.den, clients: (r3.clients || []).slice(0, 300) }; }"
new = "resultsDetail = { gotResults: r3.num, completed: r3.den, clients: (r3.clients || []).slice(0, 300), debugRows: r3.debugRows }; }"
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("debugRows passed through to detail")
