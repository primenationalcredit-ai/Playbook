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
  'update_due_date', 'pause', 'resume', 'charge_now', 'log_outreach', 'refund_initial', 'refund_scheduled',
  // External (Zelle) payment recording - Zoho payment + charge closed on the processor side
  'mark_paid_external',
  // Card on file (save a card for a client, e.g. Zelle clients with no card yet)
  'update_card_on_file', 'collect_and_save_card', 'update_billing_address',
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
  // ONE INVOICE, TWO PAYMENTS (Joe 7/15): Zoho is not restructured by a split.
  // The invoice keeps its full amount; both scheduled charges share the same
  // zoho_invoice_id and pay it down in two collections. Only touch: move the
  // invoice due date to payment 2's date so it doesn't show overdue in between.
  const out = { warnings: [], summary: [] };
  if (!d.zoho_invoice_id) { out.warnings.push('No Zoho invoice linked to the split charge - nothing to update.'); return out; }
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN || !ZOHO_ORG_ID) { out.warnings.push('Zoho credentials not configured - invoice due date not updated.'); return out; }
  const token = await zohoToken();
  if (!token) { out.warnings.push('Zoho auth failed - invoice due date not updated.'); return out; }
  const zh = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };
  try {
    const gRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${d.zoho_invoice_id}?organization_id=${ZOHO_ORG_ID}`, { headers: zh });
    const inv = (await gRes.json().catch(() => ({}))).invoice;
    if (!inv) { out.warnings.push('Zoho invoice not found - due date not updated.'); return out; }
    if (String(inv.status).toLowerCase() === 'paid') { out.warnings.push(`Invoice ${inv.invoice_number} is already PAID - review manually.`); return out; }
    if (d.remainder_due_date) {
      const pRes = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${d.zoho_invoice_id}?organization_id=${ZOHO_ORG_ID}`, { method: 'PUT', headers: zh, body: JSON.stringify({ due_date: d.remainder_due_date, reason: 'Payment split - balance collected in two payments' }) });
      const pData = await pRes.json().catch(() => ({}));
      if (pRes.ok && pData.code === 0) out.summary.push(`invoice ${inv.invoice_number} unchanged ($${inv.total}); due date moved to ${d.remainder_due_date}; both payments apply to it`);
      else out.warnings.push(`Invoice due date update failed: ${pData.message || pRes.status} (split still active - both payments apply to the invoice).`);
    } else {
      out.summary.push(`invoice ${inv.invoice_number} unchanged; both payments apply to it`);
    }
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

// Account managers only see THEIR clients on the invoices page. We match the
// signed-in user to cs_deals.account_manager_name (pipedrive_name overrides
// the display name when they differ). Admins, leadership, and consultants
// keep the full company view.
async function scopeInvoicesForAM(data, email) {
  const SU = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!SU || !SK) return data;
  const H = { apikey: SK, Authorization: `Bearer ${SK}` };
  try {
    const uRows = await fetch(`${SU}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=name,department,role,pipedrive_name`, { headers: H }).then(r => r.json());
    const u = Array.isArray(uRows) ? uRows[0] : null;
    if (!u) return data;
    const isAdminish = u.role === 'admin' || u.department === 'leadership';
    if (isAdminish || u.department !== 'account_managers') return data;
    const amName = String(u.pipedrive_name || u.name || '').trim();
    if (!amName) return data;
    const deals = await fetch(`${SU}/rest/v1/cs_deals?account_manager_name=ilike.${encodeURIComponent(amName)}&select=deal_id&limit=10000`, { headers: H }).then(r => r.json());
    const mine = new Set((Array.isArray(deals) ? deals : []).map(d => String(d.deal_id)));
    data.tokens = (data.tokens || []).filter(t => mine.has(String(t.pipedrive_deal_id)));
    data.charges = (data.charges || []).filter(c => mine.has(String(c.pipedrive_deal_id)));
    data.scoped_to = amName;
    data.scoped_deal_count = mine.size;
  } catch (e) { console.error('AM scope filter failed (returning unscoped):', e); }
  return data;
}
// Consultant column (Astrid 8/7): stamp each token/charge with the consultant
// who sold the deal. consultant_payments already maps deal -> consultant_name
// (Zoho-derived, same source the bonus math uses), so this is one bulk read -
// no Pipedrive calls. Fail-open: the list still returns without the names.
async function addConsultantNames(data) {
  const SU = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!SU || !SK) return data;
  const H = { apikey: SK, Authorization: `Bearer ${SK}` };
  try {
    const ids = [...new Set([...(data.tokens || []), ...(data.charges || [])].map(x => x.pipedrive_deal_id).filter(Boolean))];
    const map = {};
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const rows = await fetch(`${SU}/rest/v1/consultant_payments?pipedrive_deal_id=in.(${chunk.join(',')})&select=pipedrive_deal_id,consultant_name`, { headers: H }).then(r => r.json());
      for (const r of (Array.isArray(rows) ? rows : [])) { if (r.consultant_name && !map[r.pipedrive_deal_id]) map[r.pipedrive_deal_id] = r.consultant_name; }
    }
    for (const t of (data.tokens || [])) t.consultant_name = map[t.pipedrive_deal_id] || null;
    for (const c of (data.charges || [])) c.consultant_name = map[c.pipedrive_deal_id] || null;
  } catch (e) { console.error('consultant name enrich failed (list returns without it):', e); }
  return data;
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
    // AM scoping: filter the invoice browse list down to the signed-in AM's clients.
    if (action === 'list_recent_invoices' && upstream.ok) {
      let listData = null;
      try { listData = JSON.parse(text); } catch (e) {}
      if (listData && Array.isArray(listData.tokens)) {
        if (playbookUser && playbookUser.email) listData = await scopeInvoicesForAM(listData, playbookUser.email);
        listData = await addConsultantNames(listData);
        return { statusCode: 200, headers, body: JSON.stringify(listData) };
      }
    }
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
