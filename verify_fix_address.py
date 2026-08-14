import sys
ok = True
s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
for n in ["type: 'fix_address'", "modal.type === 'fix_address'", "update_billing_address", "Fix Address"]:
    if n not in s: ok = False; print('missing: ' + n)
if s.count("modal.type === 'fix_address'") < 2: ok = False; print('fix_address referenced fewer than 2x (need modal-body + submit)')
s2 = open('netlify/functions/invoices-api.js', encoding='utf-8', errors='surrogateescape').read()
if "'update_billing_address'" not in s2: ok = False; print('proxy allowlist missing action')
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
