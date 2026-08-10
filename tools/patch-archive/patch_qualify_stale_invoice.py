import sys
f = 'netlify/functions/consultant-bonus-metrics.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """      const paidTotals = nonDoc.filter(inv => (parseFloat(inv.balance) || 0) <= EPS).map(inv => parseFloat(inv.total) || 0).filter(t => t > 0);
      const qualified = paidTotals.length > 0 || owed <= EPS;
      // MONTH (Joe 7/23): the doc counts in the month that invoice FINISHED. Walk
      // the client's balance payments in date order until they cover the first
      // completed invoice; the payment that crosses the line names the month.
      let month = null;
      if (qualified) {
        const target = paidTotals.length ? Math.min(...paidTotals) : 0;"""
new = """      const paidTotals = nonDoc.filter(inv => (parseFloat(inv.balance) || 0) <= EPS).map(inv => parseFloat(inv.total) || 0).filter(t => t > 0);
      let qualified = paidTotals.length > 0 || owed <= EPS;
      // MONEY BEATS STALE PAPERWORK (Fernando Torres 266340, 8/10): the invoice
      // mirror can lag Zoho (his $275 partial paid 8/7 but INV-052095 still showed
      // balance 275 from 7/27). If the client's actual balance payments cover the
      // smallest balance invoice, they qualify off the payments - same doctrine as
      // the no-balance-invoice branch above.
      let payTarget = paidTotals.length ? Math.min(...paidTotals) : 0;
      if (!qualified) {
        const invTotals = nonDoc.map(inv => parseFloat(inv.total) || 0).filter(t => t > 0);
        const minInv = invTotals.length ? Math.min(...invTotals) : 0;
        const balancePaid = (client.payments || []).filter(p => p.payment_type !== 'doc_fee').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
        if (minInv > 0 && balancePaid >= minInv - EPS) { qualified = true; payTarget = minInv; }
      }
      // MONTH (Joe 7/23): the doc counts in the month that invoice FINISHED. Walk
      // the client's balance payments in date order until they cover the first
      // completed invoice; the payment that crosses the line names the month.
      let month = null;
      if (qualified) {
        const target = payTarget;"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("qualifyClient: money-beats-stale-paperwork rule in")
