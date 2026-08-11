// MANUAL DOOR for invoice-mirror-invariant (scheduled functions 403 direct HTTP).
﻿// invoice-mirror-invariant.js - THE FIX for the mirror-miss ticket class
// (Fernando 266340, Vic 268118, Elizabeth 268497, Raven 268053 - four tickets).
// INVARIANT: every payment in consultant_payments must be covered by mirrored
// invoices on its deal, and a deal whose payments cover its billing must not
// show open balances. Violations = orphans -> auto-repaired via the proven
// zoho-invoice-sync-manual?search= (Zoho date filters proven unreliable 8/11;
// name search is the tool that actually finds invoices). Nightly + manual door.
// Params: ?days=120&limit=8&dry=1
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const EPS = 1.5;

const supaGet = async (path) => {
  const r = await fetch(`${SU}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`supa ${r.status}: ${(await r.text()).slice(0, 150)}`);
  return r.json();
};

const collectOrphans = async (days) => {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  // Page payments (supabase caps at 1000/req)
  let payments = [], last = null;
  for (let i = 0; i < 12; i++) {
    const batch = await supaGet(`consultant_payments?payment_date=gte.${cutoff}&excluded_from_bonus=not.is.true&pipedrive_deal_id=not.is.null&select=id,pipedrive_deal_id,client_name,amount,payment_type&order=id.asc&limit=1000${last ? `&id=gt.${last}` : ''}`);
    payments = payments.concat(batch);
    if (batch.length < 1000) break;
    last = batch[batch.length - 1].id;
  }
  const byDeal = {};
  for (const p of payments) {
    const d = String(p.pipedrive_deal_id);
    byDeal[d] = byDeal[d] || { dealId: d, client: p.client_name, paid: 0, n: 0 };
    byDeal[d].paid += parseFloat(p.amount) || 0;
    byDeal[d].n++;
  }
  const dealIds = Object.keys(byDeal);
  // Invoices for those deals, chunked
  for (let i = 0; i < dealIds.length; i += 100) {
    const chunk = dealIds.slice(i, i + 100);
    const invs = await supaGet(`consultant_invoices?pipedrive_deal_id=in.(${chunk.map(x => `"${x}"`).join(',')})&select=pipedrive_deal_id,total,balance`);
    for (const inv of invs) {
      const d = byDeal[String(inv.pipedrive_deal_id)];
      if (!d) continue;
      d.invoiced = (d.invoiced || 0) + (parseFloat(inv.total) || 0);
      d.openBal = (d.openBal || 0) + (parseFloat(inv.balance) || 0);
      d.invCount = (d.invCount || 0) + 1;
    }
  }
  const orphans = [];
  for (const d of Object.values(byDeal)) {
    const invoiced = d.invoiced || 0, openBal = d.openBal || 0;
    const missingInvoice = d.paid > invoiced + EPS;                    // paid money with no mirrored invoice to carry it
    const staleBalance = !missingInvoice && openBal > EPS && d.paid >= invoiced - EPS; // fully covered but mirror still shows owed
    if (missingInvoice || staleBalance) orphans.push({ dealId: d.dealId, client: d.client, paid: Math.round(d.paid), invoiced: Math.round(invoiced), openBal: Math.round(openBal), invCount: d.invCount || 0, kind: missingInvoice ? 'missing_invoice' : 'stale_balance' });
  }
  orphans.sort((a, b) => (b.paid - b.invoiced) - (a.paid - a.invoiced));
  return orphans;
};

exports.handler = async (event) => {
  try {
    const params = (event && event.queryStringParameters) || {};
    const days = parseInt(params.days) || 120;
    const limit = Math.min(parseInt(params.limit) || 8, 25);
    const dry = params.dry === '1';
    const orphans = await collectOrphans(days);
    let repaired = [], failed = [];
    if (!dry && orphans.length) {
      for (const o of orphans.slice(0, limit)) {
        try {
          const r = await fetch(`${SITE}/.netlify/functions/zoho-invoice-sync-manual?search=${encodeURIComponent(o.client || '')}`);
          const j = await r.json().catch(() => ({}));
          repaired.push({ ...o, upserted: j.upserted ?? null });
        } catch (e) { failed.push({ ...o, error: e.message }); }
      }
    }
    // Re-verify the ones we touched
    let verified = null;
    if (repaired.length) {
      const after = await collectOrphans(days);
      const stillBad = new Set(after.map(o => o.dealId));
      verified = repaired.map(r => ({ dealId: r.dealId, client: r.client, fixed: !stillBad.has(r.dealId) }));
    }
    const summary = { ran_at: new Date().toISOString(), days, dry, orphans_found: orphans.length, orphans: orphans.slice(0, 40), repaired_this_run: repaired.length, verified, failed, remaining_estimate: Math.max(0, orphans.length - repaired.length) };
    await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ cache_key: 'invoice_mirror_invariant_last', cache_value: JSON.stringify(summary), updated_at: new Date().toISOString() }) }).catch(() => {});
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(summary) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
