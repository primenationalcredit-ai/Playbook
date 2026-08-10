import sys
f = 'netlify/functions/crm-sync.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """    const r = await fetch(`${SU}/rest/v1/${table}?on_conflict=${conflict}`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 200)) });"""
new = """    // \\u0000 (null bytes pasted into PD fields) are illegal in Postgres text - strip them
    const body = JSON.stringify(rows.slice(i, i + 200)).replace(/\\\\u0000/g, '');
    const r = await fetch(`${SU}/rest/v1/${table}?on_conflict=${conflict}`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body });"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("crm-sync: null-byte sanitizer in")
