// agreements-api.js (Playbook)
// Server-side proxy for the Agreements tab. Two actions:
//   - search : forwards to the payment processor's agreements-search.js
//   - resend : forwards to consultant-dashboard-api.js (reissue_agreement)
// Auth mirrors invoices-api.js: verifies the Playbook user via Supabase, then
// forwards to the payment processor with the internal X-API-Key. 'resend' also
// sends X-Acting-As so the payment processor records who reissued.
//
// This file does NOT modify any existing function. It only ADDS a proxy.

const PAYMENT_BASE = process.env.PAYMENT_API_BASE
  || 'https://asap-payment-processor.netlify.app/.netlify/functions';
const SEARCH_URL = `${PAYMENT_BASE}/agreements-search`;
const DASHBOARD_URL = `${PAYMENT_BASE}/consultant-dashboard-api`;
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;

const PLAYBOOK_SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const PLAYBOOK_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

async function verifyPlaybookUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  if (!PLAYBOOK_SUPABASE_ANON_KEY) { console.error('PLAYBOOK_SUPABASE_ANON_KEY not set'); return null; }
  try {
    const r = await fetch(`${PLAYBOOK_SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: PLAYBOOK_SUPABASE_ANON_KEY }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) { console.error('playbook auth verify error:', err); return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  if (!PAYMENT_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'PAYMENT_API_KEY env var is not set on this site.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON body' }) }; }

  const action = body.action;
  if (!action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'action required' }) };
  if (action !== 'search' && action !== 'resend') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: `action '${action}' not allowed` }) };
  }

  // Both actions require a signed-in Playbook user.
  const playbookUser = await verifyPlaybookUser(event.headers.authorization || event.headers.Authorization);
  if (!playbookUser) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Playbook sign-in required' }) };
  }
  const actingAs = playbookUser?.email || null;

  try {
    if (action === 'search') {
      // Forward search params to agreements-search.js (X-API-Key auth).
      const { query = '', status = '', type = '', from_date = '', to_date = '', limit = 500 } = body;
      const upstream = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY },
        body: JSON.stringify({ query, status, type, from_date, to_date, limit })
      });
      const text = await upstream.text();
      return { statusCode: upstream.status, headers, body: text };
    }

    // action === 'resend' -> reissue_agreement on consultant-dashboard-api
    const dealId = body.deal_id;
    if (!dealId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'deal_id required for resend' }) };
    const outHeaders = { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY };
    if (actingAs) outHeaders['X-Acting-As'] = actingAs;
    const upstream = await fetch(DASHBOARD_URL, {
      method: 'POST',
      headers: outHeaders,
      body: JSON.stringify({ action: 'reissue_agreement', deal_id: dealId })
    });
    const text = await upstream.text();
    return { statusCode: upstream.status, headers, body: text };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'upstream call failed', detail: String(err && err.message || err) }) };
  }
};
