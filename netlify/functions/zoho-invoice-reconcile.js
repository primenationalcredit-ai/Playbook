// zoho-invoice-reconcile.js  (Playbook)
// The invoice sync is upsert-only: invoices deleted in Zoho live forever in
// consultant_invoices with their last-known balance, and payments recorded in
// Zoho after the last sync leave stale balances. This function re-checks every
// locally-OPEN invoice against live Zoho:
//   - Zoho says the invoice no longer exists  -> delete the local row
//   - Zoho says it exists                     -> overwrite balance + status with truth
//
// Batched to fit Netlify's timeout: processes `limit` rows per call (default 40),
// returns hasMore so the caller can loop.
// GET params: ?limit=40&days=45   (days = how far back to look at due dates)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, status: r.status, json, text };
}

async function getZohoToken() {
  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token?refresh_token=${ZOHO_REFRESH_TOKEN}&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&grant_type=refresh_token`, { method: 'POST' });
  const data = await res.json();
  return data.access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit) || 60, 60);
  const days = parseInt(params.days) || 45;
  // Scheduled runs pass no cursor - resume from the stored one so the whole
  // set rotates through across runs (see treadmill note in header).
  let after = after || null;
  if (!after) {
    try {
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.zoho_reconcile_cursor&select=value`, { headers: SB });
      const cRows = cRes.ok ? await cRes.json() : [];
      if (cRows[0] && cRows[0].value) after = cRows[0].value;
    } catch (e) {}
  }

  try {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    // Locally-open invoices in the window (the ones that can wrongly flag past-due)
    const rows = await supa(
      `consultant_invoices?balance=gt.1&due_date=gte.${cutoff}&zoho_invoice_id=not.is.null` +
      `&select=id,zoho_invoice_id,customer_name,balance,due_date&order=id.asc&limit=${limit}` +
      (after ? `&id=gt.${after}` : '')
    );
    const invoices = rows.json || [];
    if (invoices.length === 0) return respond(200, { checked: 0, deleted: 0, updated: 0, hasMore: false, message: 'Nothing open in window' });

    const token = await getZohoToken();
    let deleted = 0, updated = 0, unchanged = 0, errors = 0;
    const changes = [];

    for (const inv of invoices) {
      try {
        const res = await fetch(`https://www.zohoapis.com/invoice/v3/invoices/${inv.zoho_invoice_id}?organization_id=${ZOHO_ORG_ID}`, {
          headers: { Authorization: `Zoho-oauthtoken ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        const zi = data.invoice;

        if (!zi && (res.status === 404 || /not exist|does not exist|invalid|not found/i.test(data.message || ''))) {
          // Deleted in Zoho -> tombstone, remove it
          const del = await supa(`consultant_invoices?id=eq.${inv.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
          if (del.ok) { deleted++; changes.push({ who: inv.customer_name, was: `$${inv.balance} due ${inv.due_date}`, action: 'DELETED (gone from Zoho)' }); }
          else errors++;
          continue;
        }
        if (!zi) { errors++; continue; }

        const trueBalance = parseFloat(zi.balance) || 0;
        const localBalance = parseFloat(inv.balance) || 0;
        if (Math.abs(trueBalance - localBalance) > 0.009 || zi.status) {
          const upd = await supa(`consultant_invoices?id=eq.${inv.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ balance: trueBalance, status: zi.status || null })
          });
          if (upd.ok) {
            if (Math.abs(trueBalance - localBalance) > 0.009) {
              updated++;
              changes.push({ who: inv.customer_name, was: `$${localBalance}`, action: `balance corrected to $${trueBalance} (${zi.status})` });
            } else unchanged++;
          } else errors++;
        } else unchanged++;
      } catch (e) { errors++; }
    }

    const lastId = invoices[invoices.length - 1].id;
    {
    // Persist rotation cursor: hasMore -> save next_after; done -> clear so the
    // next run starts from the top.
    try {
      const cursorVal = (typeof hasMore !== 'undefined' && hasMore && typeof nextAfter !== 'undefined' && nextAfter) ? String(nextAfter) : '';
      await fetch(`${SUPABASE_URL}/rest/v1/app_config?on_conflict=key`, {
        method: 'POST',
        headers: { ...SB, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: 'zoho_reconcile_cursor', value: cursorVal }])
      });
    } catch (e) {}
    return respond(200, {
      checked: invoices.length, deleted, updated, unchanged, errors,
      changes, hasMore: invoices.length === limit, next_after: lastId
    });
  }
  } catch (e) {
    return respond(500, { error: String(e.message || e).slice(0, 300) });
  }
};
