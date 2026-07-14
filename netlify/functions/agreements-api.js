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

// ---- Zoho: edit EXISTING invoices in place (amounts + due dates). Never creates invoices.
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

async function zohoToken() {
  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token?refresh_token=${ZOHO_REFRESH_TOKEN}&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&grant_type=refresh_token`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  return data.access_token || null;
}

async function applyZohoEdits(targets) {
  const out = { updated: 0, warnings: [] };
  if (!Array.isArray(targets) || !targets.length) return out;
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN || !ZOHO_ORG_ID) {
    out.warnings.push('Zoho credentials not configured on this site - Zoho invoices were NOT updated.');
    return out;
  }
  const token = await zohoToken();
  if (!token) { out.warnings.push('Zoho auth failed - Zoho invoices were NOT updated.'); return out; }
  const zh = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };
  for (const t of targets) {
    if (!t || !t.invoice_id) continue;
    if (t.action === 'void') {
      try {
        const vRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${t.invoice_id}/status/void?organization_id=${ZOHO_ORG_ID}`, { method: 'POST', headers: zh, body: JSON.stringify({ reason: 'Agreement changed to a plan without this payment' }) });
        const vData = await vRes.json().catch(() => ({}));
        if (vRes.ok && vData.code === 0) out.updated++;
        else out.warnings.push(`Zoho ${t.role} invoice ${t.invoice_id} VOID failed: ${vData.message || vRes.status} - void it manually.`);
      } catch (e) { out.warnings.push(`Zoho ${t.role} invoice VOID error: ${e.message}`); }
      continue;
    }
    try {
      const gRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${t.invoice_id}?organization_id=${ZOHO_ORG_ID}`, { headers: zh });
      const gData = await gRes.json().catch(() => ({}));
      const inv = gData.invoice;
      if (!inv) { out.warnings.push(`Zoho ${t.role} invoice ${t.invoice_id} not found - not updated.`); continue; }
      if (String(inv.status).toLowerCase() === 'paid') {
        out.warnings.push(`Zoho ${t.role} invoice ${inv.invoice_number || t.invoice_id} is PAID - not changed, review manually.`);
        continue;
      }
      const body = { reason: 'Agreement terms updated in ASAP system' };
      if (t.due_date) body.due_date = t.due_date;
      const amt = parseFloat(t.amount);
      if (!isNaN(amt) && amt > 0 && Array.isArray(inv.line_items) && inv.line_items.length) {
        const items = inv.line_items.map((li, i) => (i === 0
          ? { line_item_id: li.line_item_id, rate: amt, quantity: li.quantity || 1 }
          : { line_item_id: li.line_item_id }));
        body.line_items = items;
      }
      if (!Object.keys(body).length) continue;
      const pRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${t.invoice_id}?organization_id=${ZOHO_ORG_ID}`, {
        method: 'PUT', headers: zh, body: JSON.stringify(body)
      });
      const pData = await pRes.json().catch(() => ({}));
      if (pRes.ok && pData.code === 0) out.updated++;
      else out.warnings.push(`Zoho ${t.role} invoice ${inv.invoice_number || t.invoice_id} update failed: ${pData.message || pRes.status}`);
    } catch (e) {
      out.warnings.push(`Zoho ${t.role} invoice update error: ${e.message}`);
    }
  }
  return out;
}

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
  if (action !== 'search' && action !== 'resend' && action !== 'edit_resend') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: `action '${action}' not allowed` }) };
  }

  // Auth: signed-in Playbook user, OR the internal API key (server-to-server / diagnostics).
  let actingAs = null;
  const inKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (inKey && inKey === PAYMENT_API_KEY) {
    actingAs = (event.headers['x-acting-as'] || event.headers['X-Acting-As'] || 'system@asapcreditrepairusa.com');
  } else {
    const playbookUser = await verifyPlaybookUser(event.headers.authorization || event.headers.Authorization);
    if (!playbookUser) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Playbook sign-in required' }) };
    }
    actingAs = playbookUser?.email || null;
  }

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

    // action === 'resend' -> reissue_agreement; 'edit_resend' -> edit_reissue_agreement
    const dealId = body.deal_id;
    if (!dealId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'deal_id required for resend' }) };
    const outHeaders = { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY };
    if (actingAs) outHeaders['X-Acting-As'] = actingAs;
    const upstreamBody = action === 'edit_resend'
      ? { action: 'edit_reissue_agreement', deal_id: dealId, edits: body.edits || {}, resend: !!body.resend }
      : { action: 'reissue_agreement', deal_id: dealId };
    const upstream = await fetch(DASHBOARD_URL, {
      method: 'POST',
      headers: outHeaders,
      body: JSON.stringify(upstreamBody)
    });
    const text = await upstream.text();
    // On a successful edit, carry the changes into the EXISTING Zoho invoices.
    if (action === 'edit_resend' && upstream.ok) {
      let data = null;
      try { data = JSON.parse(text); } catch (e) { /* raw below */ }
      if (data && data.success) {
        const targets = data.zoho_targets || [];
        const credsPresent = !!(ZOHO_CLIENT_ID && ZOHO_CLIENT_SECRET && ZOHO_REFRESH_TOKEN && ZOHO_ORG_ID);
        console.log('ZOHO LEG: targets=', JSON.stringify(targets), 'creds=', credsPresent);
        let z = { updated: 0, warnings: [] };
        try {
          z = await applyZohoEdits(targets);
        } catch (e) {
          z.warnings.push('Zoho edit crashed: ' + (e && e.message));
        }
        data.zoho_updated = z.updated;
        data.zoho_debug = { targets_received: targets.length, creds_present: credsPresent };
        data.warnings = [...(data.warnings || []), ...z.warnings];
        if (z.updated > 0) data.message = (data.message || '') + ` Zoho: ${z.updated} invoice(s) updated in place.`;
        else data.message = (data.message || '') + ` Zoho: 0 invoices updated (targets: ${targets.length}, creds: ${credsPresent ? 'yes' : 'NO'}).`;
        delete data.zoho_targets;
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
    }
    return { statusCode: upstream.status, headers, body: text };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'upstream call failed', detail: String(err && err.message || err) }) };
  }
};
