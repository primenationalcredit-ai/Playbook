// invoices-api.js (Playbook)
// Server-side proxy to the payment processor's consultant-dashboard-api.
// Forwards the Playbook user's identity via X-Acting-As so the payment
// processor records who performed each write action.

const PAYMENT_API_URL = process.env.PAYMENT_API_URL
  || 'https://asap-payment-processor.netlify.app/.netlify/functions/consultant-dashboard-api';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;

const PLAYBOOK_SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const PLAYBOOK_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const READ_ONLY = new Set(['get_deal', 'billing_overview', 'list_recent_invoices', 'list_pending_approvals', 'list_approval_messages']);
const WRITE_ACTIONS = new Set([
  // Approval workflow (used by AMs and Consultants, and by admins reviewing)
  'request_split', 'request_date_change', 'request_pause', 'post_approval_message', 'approve_request', 'reject_request', 'mark_approval_read',
  // Admin direct actions (the payment processor still gates these via isAdmin)
  'update_due_date', 'pause', 'resume', 'charge_now', 'refund_initial', 'refund_scheduled',
  // Card on file (save a card for a client, e.g. Zelle clients with no card yet)
  'update_card_on_file', 'collect_and_save_card',
  'send_payment_form',
  // Split a scheduled charge into partial + remainder
  'split_charge'
]);
const ALLOWED = new Set([...READ_ONLY, ...WRITE_ACTIONS]);

// ---- Zoho (split orchestration): edit the original invoice down, create the remainder.
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
const LINK_INVOICE_URL = (process.env.PAYMENT_API_URL || 'https://asap-payment-processor.netlify.app/.netlify/functions/consultant-dashboard-api').replace('consultant-dashboard-api', 'link-zoho-invoice');

async function zohoToken() {
  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token?refresh_token=${ZOHO_REFRESH_TOKEN}&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&grant_type=refresh_token`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  return data.access_token || null;
}

// Shrink the original invoice to the first piece; create+send+link the remainder invoice.
async function zohoSplit(d) {
  const out = { warnings: [], summary: [] };
  if (!d.zoho_invoice_id) { out.warnings.push('No Zoho invoice linked to the split charge - update Zoho manually.'); return out; }
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN || !ZOHO_ORG_ID) { out.warnings.push('Zoho credentials not configured - invoices not updated.'); return out; }
  const token = await zohoToken();
  if (!token) { out.warnings.push('Zoho auth failed - invoices not updated.'); return out; }
  const zh = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };
  try {
    const gRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${d.zoho_invoice_id}?organization_id=${ZOHO_ORG_ID}`, { headers: zh });
    const inv = (await gRes.json().catch(() => ({}))).invoice;
    if (!inv) { out.warnings.push('Original Zoho invoice not found - update Zoho manually.'); return out; }
    if (String(inv.status).toLowerCase() === 'paid') { out.warnings.push(`Original invoice ${inv.invoice_number} is PAID - Zoho untouched, review manually.`); return out; }
    // 1) shrink the original to the first piece
    const shrinkBody = {
      reason: 'Payment split at client request',
      due_date: d.partial_due_date || undefined,
      line_items: Array.isArray(inv.line_items) && inv.line_items.length
        ? inv.line_items.map((li, i) => (i === 0 ? { line_item_id: li.line_item_id, rate: d.partial_amount, quantity: li.quantity || 1 } : { line_item_id: li.line_item_id }))
        : undefined
    };
    const pRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${d.zoho_invoice_id}?organization_id=${ZOHO_ORG_ID}`, { method: 'PUT', headers: zh, body: JSON.stringify(shrinkBody) });
    const pData = await pRes.json().catch(() => ({}));
    if (pRes.ok && pData.code === 0) out.summary.push(`invoice ${inv.invoice_number} reduced to $${Number(d.partial_amount).toFixed(2)}`);
    else out.warnings.push(`Original invoice reduce failed: ${pData.message || pRes.status} - update Zoho manually.`);
    // 2) create the remainder invoice
    const cBody = {
      customer_id: inv.customer_id,
      due_date: d.remainder_due_date || undefined,
      line_items: [{ name: 'Remainder', description: `REMAINING BALANCE due on ${d.remainder_due_date || ''}`.trim(), rate: Number(d.remainder_amount) || 0, quantity: 1 }]
    };
    const cRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices?organization_id=${ZOHO_ORG_ID}`, { method: 'POST', headers: zh, body: JSON.stringify(cBody) });
    const cData = await cRes.json().catch(() => ({}));
    const created = cData.invoice;
    if (!cRes.ok || cData.code !== 0 || !created) { out.warnings.push(`Remainder invoice creation failed: ${cData.message || cRes.status} - create it manually.`); return out; }
    try { await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${created.invoice_id}/status/sent?organization_id=${ZOHO_ORG_ID}`, { method: 'POST', headers: zh }); } catch (e) {}
    out.summary.push(`remainder invoice ${created.invoice_number} created ($${Number(d.remainder_amount).toFixed(2)})`);
    // 3) link the remainder invoice to the remainder charge (highest sequence = 'final' targeting)
    try {
      const lRes = await fetch(LINK_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY },
        body: JSON.stringify({ deal_id: d.deal_id, zoho_invoice_id: created.invoice_id, invoice_type: 'final' })
      });
      if (!lRes.ok) out.warnings.push(`Remainder invoice created but linking returned ${lRes.status} - link it manually.`);
      else out.summary.push('linked to the remainder charge');
    } catch (e) { out.warnings.push('Remainder invoice created but linking failed: ' + e.message); }
  } catch (e) { out.warnings.push('Zoho split error: ' + e.message); }
  return out;
}

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
    // Split orchestration: carry the split into Zoho, then charge today's piece.
    if (action === 'split_charge' && upstream.ok) {
      let data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (data && data.success) {
        const z = await zohoSplit(data);
        data.warnings = [...(data.warnings || []), ...z.warnings];
        if (z.summary.length) data.message = (data.message || '') + ' Zoho: ' + z.summary.join('; ') + '.';
        if (data.charge_today && data.original_charge_id) {
          try {
            const cRes = await fetch(PAYMENT_API_URL, {
              method: 'POST', headers: outHeaders,
              body: JSON.stringify({ action: 'charge_now', charge_id: data.original_charge_id })
            });
            const cData = await cRes.json().catch(() => ({}));
            if (cRes.ok && cData.success !== false) data.message += ' First payment charged now.';
            else data.message += ' First payment is due today - it will be collected by today\'s autobill run (or an admin can Charge Now).';
          } catch (e) {
            data.message += ' First payment is due today - it will be collected by today\'s autobill run.';
          }
        }
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
    }
    return { statusCode: upstream.status, headers, body: text };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'upstream call failed', detail: String(err && err.message || err) }) };
  }
};
