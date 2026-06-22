// am-payments-summary.js
// What Account Managers need from the payment sheet: how many payments were collected this month by
// type (doc fee / partial / final), with the consultant names, plus a best-effort "attributed to AM"
// breakdown (which AM the paying client's deal belongs to) since AMs work the collections.
//
// Attribution reuses the same cached deal->AM sources as the additional-rounds tracker:
//   1. cached person_id -> AM map (am_person_to_am, written by am-pipeline-cache)
//   2. persistent deal_am_map table
//   3. a bounded number of fresh Pipedrive lookups per run, cached back to deal_am_map (so coverage
//      grows over time without ever timing the function out)
// Result is cached per month so the dashboard loads instantly.

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const RESOLVE_CAP = 30; // fresh deal->AM lookups per run

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`);
  return res.ok ? await res.json() : { data: null };
}
function amNameOf(val) { if (!val) return null; if (typeof val === 'string') return val; return val.name || val.value || null; }
function typeKey(t) {
  if (t === 'doc_fee') return 'docs';
  if (t === 'partial') return 'partials';
  if (t === 'final' || t === 'paid_in_full') return 'finals';
  if (t === 'additional_round') return 'rounds';
  return 'other';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const CACHE_KEY = `am_payments_${month}`;
    const refresh = params.refresh === '1' || params.refresh === 'true';

    if (!refresh) {
      try {
        const c = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.${CACHE_KEY}&select=cache_value`, { headers: supa });
        if (c.ok) { const rows = await c.json(); if (rows[0]?.cache_value) return { statusCode: 200, headers, body: rows[0].cache_value }; }
      } catch (e) {}
    }

    // Payments this month
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${month}&select=payment_type,amount,consultant_name,pipedrive_deal_id,client_name&limit=10000`, { headers: supa });
    const payments = pRes.ok ? await pRes.json() : [];

    // Totals + by consultant
    const blank = () => ({ docs: 0, partials: 0, finals: 0, rounds: 0, other: 0, amount: 0 });
    const totals = blank();
    const byConsultant = {};
    for (const p of payments) {
      const k = typeKey(p.payment_type);
      const amt = parseFloat(p.amount) || 0;
      totals[k] += 1; totals.amount += amt;
      const name = (p.consultant_name && p.consultant_name !== 'pending_enrichment') ? p.consultant_name : 'Unassigned';
      if (!byConsultant[name]) byConsultant[name] = blank();
      byConsultant[name][k] += 1; byConsultant[name].amount += amt;
    }

    // AM attribution sources
    let personToAM = {};
    try {
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_person_to_am&select=cache_value`, { headers: supa });
      if (cRes.ok) { const rows = await cRes.json(); if (rows[0]) personToAM = JSON.parse(rows[0].cache_value).personToAM || {}; }
    } catch (e) {}
    const dealToAM = {};
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/deal_am_map?select=deal_id,am_name&limit=100000`, { headers: supa });
      if (r.ok) { (await r.json()).forEach(row => { dealToAM[String(row.deal_id)] = row.am_name; }); }
    } catch (e) {}

    const uniqueDeals = [...new Set(payments.filter(p => p.pipedrive_deal_id).map(p => String(p.pipedrive_deal_id)))];
    let resolved = 0;
    for (const dealId of uniqueDeals) {
      if (dealToAM[dealId]) continue;
      if (resolved >= RESOLVE_CAP) break;     // defer the rest to later runs
      resolved++;
      try {
        const dr = await pdGet(`/deals/${dealId}`);
        const deal = dr.data;
        let am = amNameOf(deal?.[ACCOUNT_MANAGER_FIELD]);
        const personId = deal?.person_id?.value || deal?.person_id || null;
        if (!am && personId && personToAM[personId]) am = personToAM[personId];
        if (am) {
          dealToAM[dealId] = am;
          await fetch(`${SUPABASE_URL}/rest/v1/deal_am_map`, {
            method: 'POST',
            headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ deal_id: dealId, person_id: personId, am_name: am, resolved_at: new Date().toISOString() })
          });
        }
      } catch (e) {}
    }

    const byAM = {};
    let attributed = 0;
    for (const p of payments) {
      const did = p.pipedrive_deal_id ? String(p.pipedrive_deal_id) : null;
      const am = (did && dealToAM[did]) ? dealToAM[did] : 'Unattributed';
      if (am !== 'Unattributed') attributed += 1;
      const k = typeKey(p.payment_type);
      if (!byAM[am]) byAM[am] = blank();
      byAM[am][k] += 1; byAM[am].amount += (parseFloat(p.amount) || 0);
    }

    const body = JSON.stringify({
      month,
      totals,
      byConsultant: Object.entries(byConsultant).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
      byAM: Object.entries(byAM).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
      attributionCoverage: payments.length ? Math.round((attributed / payments.length) * 100) : 0,
      totalPayments: payments.length,
      calculatedAt: new Date().toISOString(),
    });

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
        method: 'POST',
        headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ cache_key: CACHE_KEY, cache_value: body, updated_at: new Date().toISOString() })
      });
    } catch (e) {}

    return { statusCode: 200, headers, body };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
