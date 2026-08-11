import sys, re
ok = True
for fn in ['netlify/functions/invoice-mirror-invariant.js', 'netlify/functions/invoice-mirror-invariant-manual.js']:
    s = open(fn, encoding='utf-8').read()
    for n in ["collectOrphans", "missing_invoice", "stale_balance", "zoho-invoice-sync-manual?search=", "invoice_mirror_invariant_last"]:
        if n not in s: ok = False; print(f"{fn} MISSING: {n}")
t = open('netlify.toml', encoding='utf-8', errors='surrogateescape').read()
if not re.search(r'\[functions\."invoice-mirror-invariant"\]', t): ok = False; print("toml schedule missing")
if 'invoice-mirror-invariant-manual' in t: ok = False; print("manual door wrongly scheduled")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
