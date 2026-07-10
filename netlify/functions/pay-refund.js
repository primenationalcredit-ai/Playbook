// pay-refund.js  (Playbook)
// B3 proxy: leadership clicks Pay Refund on a ready-to-pay request. Verifies
// v3: records the consultant payroll deduction ONCE per request, split-aware:
//   commission_paid_amount x deduction_rate -> deduction row in `refunds`;
//   the never-paid remainder is noted as removed-from-paysheet.
// the caller and the request state, calls the processor's issue-refund engine,
// then routes the request: fully covered -> card_refunded; remainder -> check_needed.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;
const PROCESSOR_URL = process.env.PROCESSOR_URL || 'https://asap-payment-processor.netlify.app';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, json, text };
}

async function recordDeduction(req, target, paidPortion, rate, byEmail) {
  const paid = Math.max(0, Math.min(parseFloat(paidPortion) || 0, target));
  const pct = Math.max(0, parseFloat(rate) || 0);
  const deduction = Math.round(paid * pct) / 100; // pct is whole-number percent
  const unpaid = Math.round((target - paid) * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);
  const ins = await supa('refunds', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      client_name: req.client_name || null,
      client_email: req.client_email || null,
      pipedrive_deal_id: req.pipedrive_deal_id || null,
      consultant_name: req.consultant_name || null,
      refund_amount: target,
      refund_reason: req.reason || null,
      refund_date: today,
      deduction_percentage: pct,
      deduction_amount: deduction,
      status: 'approved',
      payroll_period: today.slice(0, 7),
      notes: `From refund request #${req.id}. Commission already paid on $${paid.toFixed(2)} -> deduct $${deduction.toFixed(2)} (${pct}%).` +
        (unpaid > 0.009 ? ` Remaining $${unpaid.toFixed(2)} never paid out - remove from paysheet, no deduction.` : ''),
      created_by: byEmail || null
    })
  });
  if (ins.ok) {
    await supa(`refund_requests?id=eq.${req.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ commission_paid_amount: paid, deduction_rate: pct, deduction_recorded: true })
    });
  }
  return { ok: ins.ok, deduction, paid, unpaid };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  if (!b.request_id) return respond(400, { error: 'request_id required' });

  // Leadership check
  const lead = await supa(`users?email=eq.${encodeURIComponent(String(b.requested_by || '').trim().toLowerCase())}&department=eq.leadership&select=id`);
  if (!Array.isArray(lead.json) || lead.json.length === 0) {
    return respond(403, { error: 'Only leadership can issue refunds' });
  }

  const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=*`);
  const req = (rows.json || [])[0];
  if (!req) return respond(404, { error: 'Request not found' });
  if (req.status !== 'ready_to_pay' && req.status !== 'check_needed') {
    return respond(409, { error: `Request is ${req.status} - refunds are issued from ready-to-pay (or retried from check-needed)` });
  }

  const target = parseFloat(b.amount != null ? b.amount : req.amount);
  if (!target || target <= 0) return respond(400, { error: 'A positive amount is required' });

  try {
    const r = await fetch(`${PROCESSOR_URL}/.netlify/functions/issue-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY || '' },
      body: JSON.stringify({
        refund_request_id: req.id, deal_id: req.pipedrive_deal_id, target_amount: target,
        preview: !!b.preview, allocations: Array.isArray(b.allocations) ? b.allocations : undefined
      })
    });
    const d = await r.json();
    if (!r.ok || d.error) return respond(502, { error: d.error || 'issue-refund failed' });

    // Preview never changes the request - just relay the menu
    if (b.preview) return respond(200, d);

    const refunded = parseFloat(d.refunded_to_card || 0);
    const checkNeeded = parseFloat(d.check_needed || 0);
    const priorCard = parseFloat(req.card_refunded_amount || 0);
    const txns = (d.results || []).filter(x => x.ok).map(x => x.refund_txn).join(',');

    const patch = {
      card_refunded_amount: Math.round((priorCard + refunded) * 100) / 100,
      card_refund_txn: [req.card_refund_txn, txns].filter(Boolean).join(','),
      decided_at: req.decided_at || null
    };
    if (checkNeeded > 0.009) {
      patch.status = 'check_needed';
      patch.check_amount = checkNeeded;
    } else {
      patch.status = 'card_refunded';
      patch.check_amount = 0;
    }
    await supa(`refund_requests?id=eq.${req.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    });

    // Consultant payroll deduction - once per request, at the first pay action
    let deduction = null;
    if (!req.deduction_recorded && b.commission_paid_amount != null) {
      try { deduction = await recordDeduction(req, target, b.commission_paid_amount, b.deduction_rate != null ? b.deduction_rate : 14, b.requested_by); } catch (e) {}
    }

    // Tell the client their money moved (card-only, or card + check-coming)
    let email_sent = false;
    if (refunded > 0.009 && req.client_email) {
      try {
        const okTxn = (d.results || []).find(x => x.ok) || {};
        const last4 = String(okTxn.card || '').split('...')[1] || '';
        const n = await fetch(`${PROCESSOR_URL}/.netlify/functions/notify-refund-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY || '' },
          body: JSON.stringify({
            mode: 'card', to: req.client_email, client_name: req.client_name,
            card_amount: patch.card_refunded_amount, check_amount: checkNeeded, card_last4: last4
          })
        });
        email_sent = ((await n.json()) || {}).email_sent === true;
      } catch (e) {}
    }

    return respond(200, {
      success: true, email_sent,
      deduction: deduction ? { recorded: deduction.ok, amount: deduction.deduction, on_paid: deduction.paid, removed_from_sheet: deduction.unpaid } : null,
      refunded_to_card: refunded,
      check_needed: checkNeeded,
      new_status: patch.status,
      results: d.results,
      skipped: d.skipped,
      no_candidates: d.no_candidates
    });
  } catch (e) {
    return respond(500, { error: String(e.message || e).slice(0, 200) });
  }
};
