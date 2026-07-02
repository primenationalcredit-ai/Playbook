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

    // Real consultants only: the "By Consultant" breakdown must show people in the
    // credit_consultants department, NOT everyone who happens to have a payment row
    // (which would wrongly include AMs, CSRs, and system names like "Zapier").
    let consultantUsers = [];
    try {
      const cuRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.credit_consultants&select=name`, { headers: supa });
      if (cuRes.ok) consultantUsers = await cuRes.json();
    } catch (e) {}
    // Forgiving match: a payment counts for the consultant breakdown if its
    // consultant_name matches a real consultant by first name + last-name-contains
    // (handles extra middle names, e.g. "Zairen Stephanie Verzales" vs "Zairen Verzales").
    const consultantNameSet = consultantUsers.map(u => {
      const parts = (u.name || '').toLowerCase().trim().split(/\s+/);
      return { full: (u.name || '').toLowerCase().trim(), first: parts[0] || '', last: parts[parts.length - 1] || '' };
    });
    const isRealConsultant = (rawName) => {
      const n = (rawName || '').toLowerCase().trim();
      if (!n) return false;
      const nParts = n.split(/\s+/);
      const nFirst = nParts[0] || '';
      return consultantNameSet.some(c => {
        if (c.full === n) return true;
        // first name matches AND (last name appears in the payment name OR vice versa)
        if (c.first && c.first === nFirst && c.last && (n.includes(c.last) || c.full.includes(nParts[nParts.length - 1] || ''))) return true;
        return false;
      });
    };

    // Totals + by consultant
    const blank = () => ({ docs: 0, partials: 0, finals: 0, rounds: 0, other: 0, amount: 0 });
    const totals = blank();
    const byConsultant = {};
    for (const p of payments) {
      const k = typeKey(p.payment_type);
      const amt = parseFloat(p.amount) || 0;
      totals[k] += 1; totals.amount += amt;
      // By Consultant breakdown: only real consultants (credit_consultants dept).
      // Skip AMs, CSRs, and system names like "Zapier" so they don't appear here.
      if (!isRealConsultant(p.consultant_name)) continue;
      const name = p.consultant_name;
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
        // The Account Manager lives on the PERSON record (not the deal). If we still have no AM,
        // fetch the person and read the AM field straight off it. amNameOf handles the {id,name} shape.
        if (!am && personId) {
          const pr = await pdGet(`/persons/${personId}`);
          am = amNameOf(pr?.data?.[ACCOUNT_MANAGER_FIELD]);
        }
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

    // Canonicalize AM names to the account_managers user roster so middle-name variants
    // (e.g. "Zairen Stephanie Verzales") collapse to the user record ("Zairen Verzales").
    let amUsers = [];
    try {
      const auRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.account_managers&select=name`, { headers: supa });
      if (auRes.ok) amUsers = await auRes.json();
    } catch (e) {}
    const amRoster = amUsers.map(u => {
      const parts = (u.name || '').toLowerCase().trim().split(/\s+/);
      return { name: u.name, first: parts[0] || '', last: parts[parts.length - 1] || '' };
    });
    const canonicalAM = (raw) => {
      const n = (raw || '').toLowerCase().trim();
      if (!n) return raw;
      const parts = n.split(/\s+/);
      const first = parts[0] || '', last = parts[parts.length - 1] || '';
      const hit = amRoster.find(r => r.first === first && r.last === last);
      return hit ? hit.name : raw;
    };

    const byAM = {};
    let attributed = 0;
    const unattributedList = [];
    for (const p of payments) {
      const did = p.pipedrive_deal_id ? String(p.pipedrive_deal_id) : null;
      let am = (did && dealToAM[did]) ? dealToAM[did] : 'Unattributed';
      if (am !== 'Unattributed') { am = canonicalAM(am); attributed += 1; }
      else {
        unattributedList.push({
          client: p.client_name || '(no name)',
          dealId: did,
          amount: parseFloat(p.amount) || 0,
          type: p.payment_type || 'other'
        });
      }
      const k = typeKey(p.payment_type);
      if (!byAM[am]) byAM[am] = blank();
      byAM[am][k] += 1; byAM[am].amount += (parseFloat(p.amount) || 0);
    }
    unattributedList.sort((a, b) => b.amount - a.amount);

    const body = JSON.stringify({
      month,
      totals,
      byConsultant: Object.entries(byConsultant).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
      byAM: Object.entries(byAM).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
      attributionCoverage: payments.length ? Math.round((attributed / payments.length) * 100) : 0,
      totalPayments: payments.length,
      unattributedPayments: unattributedList,
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
