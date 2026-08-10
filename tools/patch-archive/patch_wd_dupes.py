import sys
f = 'netlify/functions/qualified-doc-watchdog.js'
s = open(f, encoding='utf-8').read()
old = "    // 6) Leave the morning report where humans and dashboards can read it"
new = """    // 5.7) DUPLICATE-PAYMENT SCAN (Erik class): same client + amount + type +
    // date recorded more than once. Flag with row ids - never auto-delete
    // (legit repeats and refund-rebills exist; a human confirms).
    try {
      const dRes = await sb(`consultant_payments?payment_date=gte.${since}&refunded_at=is.null&select=id,client_name,amount,payment_type,payment_date,consultant_name`);
      const dRows = dRes.ok ? await dRes.json() : [];
      const groups = new Map();
      for (const p of dRows) {
        const k = `${(p.client_name || '').trim().toLowerCase()}|${p.amount}|${p.payment_type}|${p.payment_date}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(p);
      }
      report.duplicate_payments = [];
      for (const arr of groups.values()) {
        if (arr.length > 1) report.duplicate_payments.push({
          client: arr[0].client_name, consultant: arr[0].consultant_name,
          amount: arr[0].amount, type: arr[0].payment_type, date: arr[0].payment_date,
          count: arr.length, ids: arr.map(x => x.id)
        });
      }
    } catch (e) { report.problems.push({ issue: 'dupe scan failed: ' + e.message }); }
    // 6) Leave the morning report where humans and dashboards can read it"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("DUPE SCAN: watchdog now flags duplicate payments nightly (ids included, flag-only)")
