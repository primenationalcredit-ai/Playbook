import sys
ok = True
for fn in ['netlify/functions/invoice-mirror-invariant.js', 'netlify/functions/invoice-mirror-invariant-manual.js']:
    s = open(fn, encoding='utf-8').read()
    for n in ["invoice_mirror_skip", "repairable.slice(0, limit)", "invoices_under_other_deals", "skipped_known_unfixable", "repair_queue"]:
        if n not in s: ok = False; print(f"{fn} MISSING: {n}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
