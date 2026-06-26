// invoices-api.js (Playbook)
// Server-side proxy to the payment processor's consultant-dashboard-api.
// Forwards the Playbook user's identity via X-Acting-As so the payment
// processor records who performed each write action.

const PAYMENT_API_URL = process.env.PAYMENT_API_URL
  || 'https://asap-payment-processor.netlify.app/.netlify/functions/consultant-dashboard-api';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;

const PLAYBOOK_SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const PLAYBOOK_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const READ_ONLY = new Set(['get_deal', 'list_recent_invoices', 'list_pending_approvals', 'list_approval_messages']);
const WRITE_ACTIONS = new Set([
  // Approval workflow (used by AMs and Consultants, and by admins reviewing)
  'request_date_change', 'request_pause', 'post_approval_message', 'approve_request', 'reject_request',
  // Admin direct actions (the payment processor still gates these via isAdmin)
  'update_due_date', 'pause', 'resume', 'charge_now', 'refund_initial', 'refund_scheduled'
]);
const ALLOWED = new Set([...READ_ONLY, ...WRITE_ACTIONS]);

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
  if (!ALLOWED.has(action)) return { statusCode: 403, headers, body: JSON.stringify({ error: `action '${action}' not allowed from Playbook` }) };

  const playbookUser = await verifyPlaybookUser(event.headers.authorization || event.headers.Authorization);
  if (WRITE_ACTIONS.has(action) && !playbookUser) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Playbook sign-in required for this action' }) };
  }
  const actingAs = playbookUser?.email || null;

  try {
    const outHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': PAYMENT_API_KEY
    };
    if (actingAs) outHeaders['X-Acting-As'] = actingAs;

    const upstream = await fetch(PAYMENT_API_URL, {
      method: 'POST',
      headers: outHeaders,
      body: JSON.stringify(body)
    });
    const text = await upstream.text();
    return { statusCode: upstream.status, headers, body: text };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'upstream call failed', detail: String(err && err.message || err) }) };
  }
};
