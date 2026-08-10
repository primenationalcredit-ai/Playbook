import sys
f = 'netlify/functions/crm-compare.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """  const out = { ran_at: new Date().toISOString(), window_start: cutoff };"""
new = """  const out = { ran_at: new Date().toISOString(), window_start: cutoff, grace_window_min: 15 };
  // Records PD touched in the last 15 min are in-flight (webhook/tick still landing) - not stale.
  const graceCut = norm(new Date(Date.now() - 15 * 60 * 1000).toISOString());
  const settled = (arr) => arr.filter(x => x.u <= graceCut);"""
if s.count(old) != 1: print(f"ABORTED: out anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
n = 0
for ep in ["recentPd('persons', cutoff, 4)", "recentPd('deals', cutoff, 4)", "recentPd('notes', cutoff, 3)", "recentPd('activities', cutoff, 4, 'user_id=0')"]:
    a = f"await {ep})"
    b = f"settled(await {ep}))"
    if s.count(a) != 1: print(f"ABORTED: '{ep[:30]}' x{s.count(a)}"); sys.exit(1)
    s = s.replace(a, b, 1); n += 1
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print(f"crm-compare: grace window in, {n} domains wrapped")
