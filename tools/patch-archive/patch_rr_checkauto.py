import sys
f = 'netlify/functions/refund-requests.js'
s = open(f, encoding='utf-8').read()

old = "select=id,status,pipedrive_deal_id,client_name,client_email,check_amount,card_refunded_amount"
new = "select=id,status,pipedrive_deal_id,client_name,client_email,check_amount,card_refunded_amount,amount,consultant_name,reason,deduction_recorded"
if s.count(old) != 1: print(f"ABORTED: select anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "      return respond(upd.ok ? 200 : 500, upd.ok ? { success: true, email_sent } : { error: 'update failed' });"
new = """      // Bonus/paysheet automation (Joe 8/4): a mailed check IS the refund.
      // Mark the payment rows (oldest-first allocation), write the refunds
      // ledger, bust the tracker cache - no more hand-reconciled refunds.
      if (upd.ok) {
        try {
          const target = Math.round((parseFloat(req.check_amount) || 0) * 100) / 100;
          let remaining2 = target;
          const pays = await supa(`consultant_payments?pipedrive_deal_id=eq.${encodeURIComponent(String(req.pipedrive_deal_id))}&refunded_at=is.null&select=id,amount,payment_date&order=payment_date.asc`);
          const marked = [];
          for (const p of (pays.json || [])) {
            const amt = Math.round((parseFloat(p.amount) || 0) * 100) / 100;
            if (amt <= 0 || amt > remaining2 + 0.009) continue;
            const m = await supa(`consultant_payments?id=eq.${p.id}`, {
              method: 'PATCH', headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ refunded_at: new Date().toISOString(), refund_reason: `Check refund #${String(b.check_number)} (request ${req.id})` })
            });
            if (m.ok) { marked.push(p.id); remaining2 = Math.round((remaining2 - amt) * 100) / 100; }
            if (remaining2 <= 0.009) break;
          }
          if (!req.deduction_recorded) {
            const today3 = new Date().toISOString().slice(0, 10);
            const dIns2 = await supa('refunds', {
              method: 'POST', headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({
                client_name: req.client_name || null, client_email: req.client_email || null,
                pipedrive_deal_id: String(req.pipedrive_deal_id || ''), consultant_name: req.consultant_name || 'Unknown',
                refund_amount: target, refund_reason: req.reason || `check refund #${String(b.check_number)}`,
                refund_date: b.mailed_date || today3,
                deduction_percentage: 0, deduction_amount: 0, status: 'approved',
                payroll_period: (b.mailed_date || today3).slice(0, 7),
                notes: `Auto-recorded on check mailed (request ${req.id}); payments marked: ${marked.length}${remaining2 > 0.009 ? ` - UNALLOCATED $${remaining2.toFixed(2)}, review` : ''}`,
                created_by: b.requested_by || null
              })
            });
            if (dIns2.ok) {
              await supa(`refund_requests?id=eq.${req.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deduction_recorded: true }) });
            }
          }
          try { await fetch(`${process.env.URL || 'https://cute-cat-d9631c.netlify.app'}/.netlify/functions/consultant-bonus-metrics?month=${(b.mailed_date || new Date().toISOString().slice(0, 10)).slice(0, 7)}&refresh=1`); } catch (e2) {}
        } catch (e) { console.error('check refund automation failed (check still recorded):', e.message); }
      }
      return respond(upd.ok ? 200 : 500, upd.ok ? { success: true, email_sent } : { error: 'update failed' });"""
if s.count(old) != 1: print(f"ABORTED: return anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("check refunds fully automated: rows marked, ledger written, tracker busted - on the check-mailed click")
