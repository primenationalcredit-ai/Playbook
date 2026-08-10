import sys
f = 'netlify/functions/credit-team-bonus-metrics.js'
s = open(f, encoding='utf-8').read()

old = """  let den = 0, num = 0;
  const clients = [];"""
new = """  let den = 0, num = 0;
  const clients = [];
  const debugRows = [];"""
if s.count(old) != 1: print(f"ABORTED: init anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """    clients.push({ name: r[1] || 'Unknown', removed });
  }
  return { rate: den > 0 ? Math.round((num / den) * 100) : null, num, den, clients };"""
new = """    clients.push({ name: r[1] || 'Unknown', removed });
  }
  // Debug: dump raw rows for named clients across ALL months (row index, date, name, col C, col N)
  if (debugNames && debugNames.length) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const nm = String(r[1] || '').toLowerCase();
      if (debugNames.some((q) => nm.includes(q))) debugRows.push({ row: i + 1, date: r[0], name: r[1], roundCol: r[2], removedCol: r[13] });
    }
  }
  return { rate: den > 0 ? Math.round((num / den) * 100) : null, num, den, clients, debugRows: debugRows.length ? debugRows : undefined };"""
if s.count(old) != 1: print(f"ABORTED: return anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "async function fetchRound3ResultsRate(month) {"
new = "async function fetchRound3ResultsRate(month, debugNames) {"
if s.count(old) != 1: print(f"ABORTED: sig anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

import re
m = re.findall(r"fetchRound3ResultsRate\(month\)", s)
if len(m) != 1: print(f"ABORTED: call site x{len(m)}"); sys.exit(1)
s = s.replace("fetchRound3ResultsRate(month)", "fetchRound3ResultsRate(month, (event.queryStringParameters && event.queryStringParameters.debug_names ? String(event.queryStringParameters.debug_names).toLowerCase().split(',').map(x => decodeURIComponent(x).trim()).filter(Boolean) : null))", 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("DEBUG MODE IN: ?debug_names=a,b,c dumps raw sheet rows for those clients")
