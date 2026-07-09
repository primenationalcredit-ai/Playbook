// refund-webhook.js
// Receives refund events from the payment processor's refund handlers.
// Rule (per Joe, conservative default): refunds only affect the CURRENT
// bonus period. A matched payment in the current month is flagged
// excluded_from_bonus; matched payments from already-paid past months are
// marked refunded for the record but stay counted (no retroactive clawback).
//
// Auth: X-API-Key must equal PAYMENT_API_KEY (the same shared secret the
// invoices-api already validates - key rotation stays three places).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-API-Key', 'Content-Type': 'application/json' };
const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (opts.method === 'PATCH' || opts.method === 'POST') {
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { ok: r.ok, status: r.status, json };
  }
  return r.ok ? r.json() : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  const key = (event.headers['x-api-key'] || event.headers['X-API-Key'] || '').trim();
  if (!PAYMENT_API_KEY || key !== PAYMENT_API_KEY) return respond(401, { error: 'Unauthorized' });

  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  if (!b.pipedrive_deal_id || !b.amount) return respond(400, { error: 'pipedrive_deal_id and amount are required' });

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Try to match the refund to a synced payment row: same deal, same amount, not already refunded.
  let matched = null;
  try {
    const candidates = await supa(`consultant_payments?pipedrive_deal_id=eq.${encodeURIComponent(String(b.pipedrive_deal_id))}&refunded_at=is.null&select=id,amount,payment_month,client_name&order=payment_date.desc`);
    matched = (candidates || []).find(r => Math.abs((parseFloat(r.amount) || 0) - (parseFloat(b.amount) || 0)) < 0.01) || null;
  } catch (e) {}

  let excluded = false;
  if (matched) {
    excluded = String(matched.payment_month || '') === currentMonth; // open-period rule
    await supa(`consultant_payments?id=eq.${matched.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        refunded_at: new Date().toISOString(),
        refund_reason: b.reason || null,
        excluded_from_bonus: excluded
      })
    });
  }

  const logRes = await supa('refund_log', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      source: b.source || null,
      pipedrive_deal_id: String(b.pipedrive_deal_id),
      client_name: b.client_name || null,
      amount: parseFloat(b.amount) || null,
      refund_transaction_id: b.refund_transaction_id || null,
      original_transaction_id: b.original_transaction_id || null,
      reason: b.reason || null,
      refunded_by: b.refunded_by || null,
      matched_payment_id: matched ? matched.id : null,
      excluded_from_bonus: excluded
    })
  });

  return respond(200, {
    success: true,
    matched_payment: matched ? matched.id : null,
    excluded_from_bonus: excluded,
    note: matched
      ? (excluded ? 'Payment flagged and excluded from current-period bonus' : 'Payment marked refunded; past period already paid out - not clawed back (open-period rule)')
      : 'No matching synced payment found yet (Zoho sync lag is normal) - refund logged for the record',
    logged: logRes.ok
  });
};
