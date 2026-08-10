import sys
f = 'netlify/functions/refund-requests.js'
s = open(f, encoding='utf-8').read()
old = """      const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=id,status`);
      const req = (rows.json || [])[0];
      if (!req) return respond(404, { error: 'Request not found' });
      const upd = await supa(`refund_requests?id=eq.${b.request_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'ready_to_pay', release_signed_at: new Date().toISOString(), release_agreement_id: b.release_id || null })
      });
      return respond(upd.ok ? 200 : 500, upd.ok ? { success: true } : { error: 'update failed' });"""
new = """      const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=id,status,amount,pipedrive_deal_id,client_name,client_email,consultant_name,reason,deduction_recorded`);
      const req = (rows.json || [])[0];
      if (!req) return respond(404, { error: 'Request not found' });
      const upd = await supa(`refund_requests?id=eq.${b.request_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'ready_to_pay', release_signed_at: new Date().toISOString(), release_agreement_id: b.release_id || null })
      });
      // Joe's ruling (8/4): the SIGNATURE is the commitment - the moment a
      // release is signed, the refund shows everywhere: payment rows marked,
      // ledger row written with the payroll deduction (10% VA / 14% regular),
      // tracker cache busted. Payment steps later find nothing left to do.
      if (upd.ok) {
        try {
          const target = Math.round((parseFloat(req.amount) || 0) * 100) / 100;
          let remaining2 = target;
          const pays = await supa(`consultant_payments?pipedrive_deal_id=eq.${encodeURIComponent(String(req.pipedrive_deal_id))}&refunded_at=is.null&select=id,amount,payment_date,is_va&order=payment_date.asc`);
          for (const p of (pays.json || [])) {
            const amt = Math.round((parseFloat(p.amount) || 0) * 100) / 100;
            if (amt <= 0 || amt > remaining2 + 0.009) continue;
            const m = await supa(`consultant_payments?id=eq.${p.id}`, {
              method: 'PATCH', headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ refunded_at: new Date().toISOString(), refund_reason: `Release signed (request ${req.id})` })
            });
            if (m.ok) remaining2 = Math.round((remaining2 - amt) * 100) / 100;
            if (remaining2 <= 0.009) break;
          }
          if (!req.deduction_recorded) {
            const isVa = !!(((pays.json || [])[0] || {}).is_va);
            const pct = isVa ? 10 : 14;
            const today3 = new Date().toISOString().slice(0, 10);
            const dIns2 = await supa('refunds', {
              method: 'POST', headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({
                client_name: req.client_name || null, client_email: req.client_email || null,
                pipedrive_deal_id: String(req.pipedrive_deal_id || ''), consultant_name: req.consultant_name || 'Unknown',
                refund_amount: target, refund_reason: req.reason || 'release signed', refund_date: today3,
                deduction_percentage: pct, deduction_amount: Math.round(target * pct) / 100,
                status: 'approved', payroll_period: today3.slice(0, 7),
                notes: `Auto-recorded on release signed (request ${req.id})${remaining2 > 0.009 ? ` - UNALLOCATED $${remaining2.toFixed(2)}, review` : ''}`,
                created_by: 'release-signed'
              })
            });
            if (dIns2.ok) await supa(`refund_requests?id=eq.${req.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deduction_recorded: true }) });
          }
          try { await fetch(`${process.env.URL || 'https://cute-cat-d9631c.netlify.app'}/.netlify/functions/consultant-bonus-metrics?month=${new Date().toISOString().slice(0, 7)}&refresh=1`); } catch (e2) {}
        } catch (e) { console.error('signature automation failed (release still recorded):', e.message); }
      }
      return respond(upd.ok ? 200 : 500, upd.ok ? { success: true } : { error: 'update failed' });"""
if s.count(old) != 1: print(f"ABORTED: release_signed anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("refunds fire at SIGNATURE: rows marked, ledger + deduction written, tracker busted")
