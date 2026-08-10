import sys
f = 'netlify/functions/refund-webhook.js'
s = open(f, encoding='utf-8').read()
old = "select=id,amount,payment_month,client_name&order=payment_date.desc"
new = "select=id,amount,payment_month,client_name,consultant_name&order=payment_date.desc"
if s.count(old) != 1: print(f"ABORTED: select anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = """  return respond(200, {
    success: true,
    matched_payment: matched ? matched.id : null,"""
new = """  // Refund ledger (Joe 8/4): the Bonus Tracker's refund standard reads the
  // refunds table - every refund writes a ledger row so no surface misses it.
  try {
    let cName = (matched && matched.consultant_name) || null;
    if (!cName) {
      const anyRow = await supa(`consultant_payments?pipedrive_deal_id=eq.${encodeURIComponent(String(b.pipedrive_deal_id))}&select=consultant_name&order=payment_date.desc&limit=1`);
      cName = (anyRow && anyRow[0] && anyRow[0].consultant_name) || 'Unknown';
    }
    await supa('refunds', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        consultant_name: cName,
        client_name: b.client_name || (matched && matched.client_name) || 'Unknown',
        refund_amount: parseFloat(b.amount) || 0,
        refund_date: new Date().toISOString().slice(0, 10),
        pipedrive_deal_id: String(b.pipedrive_deal_id),
        deduction_amount: 0
      })
    });
  } catch (e) { console.error('refund ledger write failed (non-fatal):', e.message); }
  return respond(200, {
    success: true,
    matched_payment: matched ? matched.id : null,"""
if s.count(old) != 1: print(f"ABORTED: ledger anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("refund-webhook: writes the refunds ledger on every refund")
