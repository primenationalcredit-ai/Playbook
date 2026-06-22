// am-additional-rounds.js
// Counts PAID $299 additional rounds per Account Manager for a given month.
// Source of truth = consultant_payments rows with payment_type='additional_round'
// (these are real collected payments synced from Zoho). Attribution to an AM is
// resolved by deal_id via:
//   1. Pipedrive additional-rounds filter 134021 (deal -> person/AM, one bulk call)
//   2. the cached person_id -> AM map (am_person_to_am) written by am-pipeline-cache
//   3. a persistent deal_am_map table for any remaining misses (resolved once)
//
// Bonus tiers (standard 5/month): 6-10 = $25 each, 11-15 = $35 each, 16+ = $50 each.

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const ADDITIONAL_ROUNDS_FILTER = 134021;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`);
  return res.ok ? await res.json() : { data: null };
}

function amNameOf(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  return val.name || val.value || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Paid additional rounds this month
    const payRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${month}&payment_type=eq.additional_round&select=pipedrive_deal_id,amount,client_name,payment_date`, { headers: supa });
    const payments = payRes.ok ? await payRes.json() : [];
    const paid = payments.filter(p => p.pipedrive_deal_id);

    // 2. person_id -> AM map from cache
    let personToAM = {};
    try {
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_person_to_am&select=cache_value`, { headers: supa });
      if (cRes.ok) { const rows = await cRes.json(); if (rows[0]) personToAM = JSON.parse(rows[0].cache_value).personToAM || {}; }
    } catch (e) {}

    // 3. deal_id -> {person_id, am} from the additional-rounds filter (bulk)
    const dealMap = {};
    let start = 0, more = true, guard = 0;
    while (more && guard < 20) {
      const r = await pdGet(`/deals?filter_id=${ADDITIONAL_ROUNDS_FILTER}&start=${start}&limit=500`);
      const deals = r.data || [];
      for (const d of deals) {
        dealMap[d.id] = {
          person_id: d.person_id?.value || d.person_id || null,
          am: amNameOf(d[ACCOUNT_MANAGER_FIELD])
        };
      }
      more = r.additional_data?.pagination?.more_items_in_collection || false;
      start = r.additional_data?.pagination?.next_start || (start + 500);
      guard++;
      if (deals.length === 0) break;
    }

    // 4. persistent deal_am_map cache for misses
    let persistMap = {};
    try {
      const pmRes = await fetch(`${SUPABASE_URL}/rest/v1/deal_am_map?select=deal_id,am_name`, { headers: supa });
      if (pmRes.ok) { const rows = await pmRes.json(); rows.forEach(r => { persistMap[r.deal_id] = r.am_name; }); }
    } catch (e) {}

    const resolveAM = async (dealId) => {
      // a) from filter deal map (am field, or person->am)
      const dm = dealMap[dealId];
      if (dm) {
        if (dm.am) return dm.am;
        if (dm.person_id && personToAM[dm.person_id]) return personToAM[dm.person_id];
      }
      // b) persistent map
      if (persistMap[dealId]) return persistMap[dealId];
      // c) direct lookup (deal -> person -> AM), cache the result
      try {
        const dr = await pdGet(`/deals/${dealId}`);
        const deal = dr.data;
        let am = amNameOf(deal?.[ACCOUNT_MANAGER_FIELD]);
        let personId = deal?.person_id?.value || deal?.person_id || null;
        if (!am && personId && personToAM[personId]) am = personToAM[personId];
        if (!am && personId) {
          const pr = await pdGet(`/persons/${personId}`);
          am = amNameOf(pr.data?.[ACCOUNT_MANAGER_FIELD]);
        }
        if (am) {
          await fetch(`${SUPABASE_URL}/rest/v1/deal_am_map`, {
            method: 'POST',
            headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ deal_id: dealId, person_id: personId, am_name: am, resolved_at: new Date().toISOString() })
          });
        }
        return am || null;
      } catch (e) { return null; }
    };

    const byAM = {};
    let unattributed = 0;
    for (const p of paid) {
      const am = await resolveAM(Number(p.pipedrive_deal_id));
      if (!am) { unattributed++; continue; }
      if (!byAM[am]) byAM[am] = { count: 0, amount: 0, deals: [] };
      byAM[am].count++;
      byAM[am].amount += Number(p.amount || 0);
      byAM[am].deals.push({ deal_id: p.pipedrive_deal_id, client: p.client_name, amount: p.amount, date: p.payment_date });
    }

    // Additional-round invoices that are PAST DUE, reconciled against additional-round PAYMENTS so a
    // paid round (with a stale invoice balance) doesn't show as owed. AR identified by fee (249/299).
    const todayStr = now.toISOString().slice(0, 10);
    const arPaidByDeal = {};
    try {
      const arRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_type=eq.additional_round&select=pipedrive_deal_id,amount`, { headers: supa });
      const arPays = arRes.ok ? await arRes.json() : [];
      for (const p of arPays) { if (p.pipedrive_deal_id) { const k = String(p.pipedrive_deal_id); arPaidByDeal[k] = (arPaidByDeal[k] || 0) + (parseFloat(p.amount) || 0); } }
    } catch (e) {}
    const pastDueRounds = [];
    try {
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_invoices?select=customer_name,pipedrive_deal_id,balance,due_date,total`, { headers: supa });
      const invs = invRes.ok ? await invRes.json() : [];
      const byDeal = {};
      for (const inv of invs) {
        const total = Math.round(parseFloat(inv.total) || 0);
        if (!(total === 249 || total === 299) || !inv.pipedrive_deal_id) continue;
        const k = String(inv.pipedrive_deal_id);
        if (!byDeal[k]) byDeal[k] = [];
        byDeal[k].push(inv);
      }
      for (const [dealId, list] of Object.entries(byDeal)) {
        const seen = new Set();
        const sorted = list.filter(inv => { const key = `${String(inv.due_date || '').slice(0, 10)}|${Math.round(parseFloat(inv.total) || 0)}`; if (seen.has(key)) return false; seen.add(key); return true; })
          .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
        let paid = arPaidByDeal[dealId] || 0;
        let am = null, resolved = false;
        for (const inv of sorted) {
          const total = Math.round(parseFloat(inv.total) || 0);
          let remaining;
          if (paid >= total) { paid -= total; remaining = 0; } else { remaining = total - paid; paid = 0; }
          const due = inv.due_date ? String(inv.due_date).slice(0, 10) : null;
          if (remaining > 1 && due && due < todayStr) {
            if (!resolved) { am = await resolveAM(Number(dealId)); resolved = true; }
            pastDueRounds.push({ am: am || 'Unassigned', client: inv.customer_name, dealId, balance: Math.round(remaining), dueDate: inv.due_date, daysOverdue: Math.floor((now - new Date(due)) / 86400000) });
          }
        }
      }
      pastDueRounds.sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')));
    } catch (e) {}

    return { statusCode: 200, headers, body: JSON.stringify({ month, totalPaid: paid.length, unattributed, byAM, pastDueRounds, calculatedAt: new Date().toISOString() }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
