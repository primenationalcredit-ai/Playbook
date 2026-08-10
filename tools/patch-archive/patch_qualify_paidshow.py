# Jamie Lopez retask: the no-invoices fallback branch returned paid: 0 even
# when a doc fee (and any other payments) were on file - clients looked like
# they never paid. Credit what the payment rows show.
import re, sys
f = 'netlify/functions/consultant-bonus-metrics.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = "return { qualified: !!adv, month: fbMonth, reason: adv ? null : 'no partial or final payment on file', paid: 0, owed: 0 };"
new = """const paidAll = Math.round(docAmt + (client.payments || []).filter(p => p.payment_type !== 'doc_fee').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0));
        return { qualified: !!adv, month: fbMonth, reason: adv ? null : 'no partial or final payment on file', paid: paidAll, owed: 0 };"""
n = s.count(old)
if n != 1:
    print(f"ABORT: anchor x{n}. Lines with 'no partial or final':")
    for i, ln in enumerate(s.split('\n'), 1):
        if 'no partial or final' in ln: print(f"{i}: {ln.rstrip()[:170]}")
    sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("NO-INVOICE CLIENTS NOW SHOW WHAT THEY ACTUALLY PAID")
