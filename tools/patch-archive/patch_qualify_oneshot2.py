# v2 (tolerant): one-shot payers qualify off real payment rows when no
# balance invoice exists. Regex-anchored on the nonDoc.length===0 return;
# prints candidates if it can't find it.
import re, sys
f = 'netlify/functions/consultant-bonus-metrics.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
pat = re.compile(r"if \(nonDoc\.length === 0\) return \{[^}]*\};")
m = pat.search(s)
if not m:
    print("ABORT: pattern not found. Lines containing nonDoc:")
    for i, ln in enumerate(s.split('\n'), 1):
        if 'nonDoc' in ln: print(f"{i}: {ln.rstrip()[:160]}")
    sys.exit(1)
new = """if (nonDoc.length === 0) {
        // No balance invoice on file - trust the money before the paperwork:
        // one-shot payers (whole balance in one payment, no balance invoice
        // ever created) still qualify off their actual payment rows.
        const pays0 = (client.payments || []).filter(p => p.payment_type !== 'doc_fee' && p.payment_date).sort((a, b) => String(a.payment_date).localeCompare(String(b.payment_date)));
        const adv0 = pays0.filter(p => ['partial', 'final', 'paid_in_full'].includes(String(p.payment_type)));
        if (adv0.length) {
          const fins0 = adv0.filter(p => p.payment_type === 'final' || p.payment_type === 'paid_in_full');
          const pick0 = fins0.length ? fins0[fins0.length - 1] : adv0[adv0.length - 1];
          const paid0 = pays0.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
          return { qualified: true, month: String(pick0.payment_date).slice(0, 7), reason: null, paid: Math.round(docAmt + paid0), owed: 0 };
        }
        return { qualified: false, month: null, reason: 'doc fee only, no balance invoice yet', paid: Math.round(docAmt), owed: 0 };
      }"""
s = s[:m.start()] + new + s[m.end():]
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("APPLIED at offset", m.start(), "- one-shot payers now qualify off payments")
