import sys
f = 'netlify/functions/crm-sync.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """async function userMap() {"""
new = """async function advanceCursor(k, v) {
  // Cursors only move FORWARD. The full backfill's final invocation (oldest pages)
  // once stomped the bookmark back to 2018, freezing incremental progress.
  const cur = await getState(k);
  if (!cur || v > cur) await setState(k, v);
}
async function userMap() {"""
if s.count(old) != 1: print(f"ABORTED: userMap anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
n = 0
for c in ['persons_cursor', 'deals_cursor', 'notes_cursor', 'activities_cursor']:
    a = f"await setState('{c}', maxSeen);"
    b = f"await advanceCursor('{c}', maxSeen);"
    if s.count(a) != 1: print(f"ABORTED: {c} anchor x{s.count(a)}"); sys.exit(1)
    s = s.replace(a, b, 1); n += 1
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print(f"crm-sync: advanceCursor in, {n} cursor writes converted")
