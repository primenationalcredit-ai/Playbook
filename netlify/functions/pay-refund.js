// pay-refund.js  (Playbook)
// B3 proxy: leadership clicks Pay Refund on a ready-to-pay request. Verifies
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
      body: JSON.stringify({ refund_request_id: req.id, deal_id: req.pipedrive_deal_id, target_amount: target })
    });
    const d = await r.json();
    if (!r.ok || d.error) return respond(502, { error: d.error || 'issue-refund failed' });

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

    return respond(200, {
      success: true,
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
