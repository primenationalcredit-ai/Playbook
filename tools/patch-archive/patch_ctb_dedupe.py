import sys
f = 'netlify/functions/credit-team-bonus-metrics.js'
s = open(f, encoding='utf-8').read()

old = """  let den = 0, num = 0;
  const clients = [];
  const debugRows = [];"""
new = """  let den = 0, num = 0;
  const clients = [];
  const debugRows = [];
  const byClient = new Map(); // one verdict per client per month (sheet rows get double-entered)"""
if s.count(old) != 1: print(f"ABORTED: init x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """    den++;
    const removed = Number(r[13]) > 0;
    if (removed) num++;
    clients.push({ name: r[1] || 'Unknown', removed });
  }"""
new = """    const nmKey = String(r[1] || 'Unknown').trim().toLowerCase();
    const removedN = Number(String(r[13] == null ? '' : r[13]).replace(/[^0-9.\\-]/g, ''));
    const removed = Number.isFinite(removedN) && removedN > 0;
    const prev = byClient.get(nmKey);
    if (prev) { prev.entries++; if (removed) prev.removed = true; }
    else byClient.set(nmKey, { name: r[1] || 'Unknown', removed, entries: 1 });
  }
  for (const c of byClient.values()) {
    den++;
    if (c.removed) num++;
    clients.push({ name: c.name, removed: c.removed, entries: c.entries > 1 ? c.entries : undefined });
  }"""
if s.count(old) != 1: print(f"ABORTED: loop x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("R3 RESULTS: deduped per client per month; removed = any row > 0; dupes flagged with entry count")
