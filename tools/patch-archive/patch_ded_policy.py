import sys
f = 'netlify/functions/refund-webhook.js'
s = open(f, encoding='utf-8').read()
old = "select=id,amount,payment_month,client_name,consultant_name&order=payment_date.desc"
new = "select=id,amount,payment_month,client_name,consultant_name,is_va&order=payment_date.desc"
if s.count(old) != 1: print(f"ABORTED: wh select x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = """    let cName = (matched && matched.consultant_name) || null;
    if (!cName) {
      const anyRow = await supa(`consultant_payments?pipedrive_deal_id=eq.${encodeURIComponent(String(b.pipedrive_deal_id))}&select=consultant_name&order=payment_date.desc&limit=1`);
      cName = (anyRow && anyRow[0] && anyRow[0].consultant_name) || 'Unknown';
    }"""
new = """    let cName = (matched && matched.consultant_name) || null;
    let cVa = matched ? !!matched.is_va : null;
    if (!cName || cVa === null) {
      const anyRow = await supa(`consultant_payments?pipedrive_deal_id=eq.${encodeURIComponent(String(b.pipedrive_deal_id))}&select=consultant_name,is_va&order=payment_date.desc&limit=1`);
      if (anyRow && anyRow[0]) { cName = cName || anyRow[0].consultant_name || null; if (cVa === null) cVa = !!anyRow[0].is_va; }
    }
    cName = cName || 'Unknown'; cVa = !!cVa;
    // House policy (Joe 8/4): payroll deduction = 10% VA / 14% regular of the refund
    const dedPct = cVa ? 10 : 14;
    const dedAmt = Math.round((parseFloat(b.amount) || 0) * dedPct) / 100;"""
if s.count(old) != 1: print(f"ABORTED: wh cname x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = """        deduction_amount: 0,
        deduction_percentage: 0,
        refund_reason: b.reason || 'refund'"""
new = """        deduction_amount: dedAmt,
        deduction_percentage: dedPct,
        refund_reason: b.reason || 'refund'"""
if s.count(old) != 1: print(f"ABORTED: wh ded x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("card path: deduction computed by house policy")

f = 'netlify/functions/refund-requests.js'
s = open(f, encoding='utf-8').read()
old = "&refunded_at=is.null&select=id,amount,payment_date&order=payment_date.asc"
new = "&refunded_at=is.null&select=id,amount,payment_date,is_va&order=payment_date.asc"
if s.count(old) != 1: print(f"ABORTED: rr select x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = """                deduction_percentage: 0, deduction_amount: 0, status: 'approved',"""
new = """                deduction_percentage: (!!((pays.json || [])[0] || {}).is_va ? 10 : 14),
                deduction_amount: Math.round(target * ((!!((pays.json || [])[0] || {}).is_va) ? 10 : 14)) / 100,
                status: 'approved',"""
if s.count(old) != 1: print(f"ABORTED: rr ded x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("check path: deduction computed by house policy")
