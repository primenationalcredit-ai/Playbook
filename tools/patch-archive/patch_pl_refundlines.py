import sys
f = 'netlify/functions/payments-live.js'
s = open(f, encoding='utf-8').read()
old = "consultant_payments?payment_month=eq.${ym}&excluded_from_bonus=eq.false&refunded_at=is.null&select="
new = "consultant_payments?payment_month=eq.${ym}&excluded_from_bonus=eq.false&select="
if s.count(old) != 1: print(f"ABORTED: filter anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = "      out[ym] = { rows };"
new = """      // Refund deductions (Joe 7/31): a refund shows as a NEGATIVE line in the
      // month it was refunded; the original stays counted where it was earned.
      // (Rows excluded_from_bonus stay hidden entirely - no double penalty.)
      try {
        const [ry, rm] = ym.split('-').map(Number);
        const nextYm = rm === 12 ? `${ry + 1}-01` : `${ry}-${String(rm + 1).padStart(2, '0')}`;
        const rres = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?refunded_at=gte.${ym}-01&refunded_at=lt.${nextYm}-01&excluded_from_bonus=eq.false&select=client_name,consultant_name,amount,refunded_at,pipedrive_deal_id`, { headers: SB });
        const refs = await rres.json();
        if (Array.isArray(refs)) for (const p of refs) {
          rows.push({
            date_paid: String(p.refunded_at).slice(0, 10),
            client: p.client_name || '', consultant: p.consultant_name || 'Unknown',
            fee_paid: -Math.abs(parseFloat(p.amount) || 0),
            fee_type: 'Refund', code: 'refund',
            deal_id: p.pipedrive_deal_id || '', referrer_org: '', is_affiliate: false,
            source: 'Refund', total_price: '', refund: '', negative_items: 0
          });
        }
      } catch (e) {}
      out[ym] = { rows };"""
if s.count(old) != 1: print(f"ABORTED: rows anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("paysheet: refunds are visible negative lines in the month refunded; originals stay where earned")
