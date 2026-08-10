# Sims-class fix: "doc fee only, no balance invoice yet" fired even when the
# client PAID their whole balance (no balance invoice was ever created for
# one-shot payers). Before declaring not-qualified, check the payment rows -
# real partial/final/paid_in_full money qualifies, invoice or not.
import sys
f = 'netlify/functions/consultant-bonus-metrics.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = "      if (nonDoc.length === 0) return { qualified: false, month: null, reason: 'doc fee only, no balance invoice yet', paid: 0, owed: 0 };"
new = """      if (nonDoc.length === 0) {
        // No balance invoice on file - but trust the money before the paperwork:
        // one-shot payers (whole balance in a single payment, no balance invoice
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
n = s.count(old)
if n != 1:
    print(f"ABORT: anchor x{n}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ONE-SHOT PAYERS QUALIFY OFF REAL PAYMENTS - Sims class fixed")
