// am-referrals.js
// Counts QUALIFIED referrals per Account Manager for a given month.
// A referral qualifies when a referred client signs up AND pays a doc fee.
//
// IMPORTANT: there is no "referred by / lead source = referral" field wired in
// the Playbook yet. This function reads that field by key from env vars so it
// can go live the moment the field is identified, without a code change:
//   PD_REFERRAL_FIELD  = Pipedrive person field key that marks a referral
//   PD_REFERRAL_VALUE  = the option value/id (or substring) that means "referral"
// Until both are set it returns { needsConfig: true } and the UI shows
// "Awaiting referral field" instead of a fabricated number.
//
// Bonus (standard 15/month): $20 per qualified referral, $30 each above 8
// qualified, +$100 to the monthly top producer.

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PD_REFERRAL_FIELD = process.env.PD_REFERRAL_FIELD || '';
const PD_REFERRAL_VALUE = process.env.PD_REFERRAL_VALUE || '';
const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';

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

function fieldMatchesReferral(raw) {
  if (raw === null || raw === undefined) return false;
  const v = typeof raw === 'object' ? (raw.value ?? raw.id ?? raw.name ?? '') : raw;
  const s = String(v).toLowerCase();
  const target = String(PD_REFERRAL_VALUE).toLowerCase();
  return s === target || s.includes(target);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!PD_REFERRAL_FIELD || !PD_REFERRAL_VALUE) {
      return { statusCode: 200, headers, body: JSON.stringify({ needsConfig: true, byAM: {}, month, message: 'Set PD_REFERRAL_FIELD and PD_REFERRAL_VALUE in Netlify env to enable referral tracking.' }) };
    }

    // Doc fee payments this month -> set of deal_ids that paid a doc fee
    const payRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${month}&payment_type=eq.doc_fee&select=pipedrive_deal_id,client_name,payment_date`, { headers: supa });
    const docPays = payRes.ok ? await payRes.json() : [];
    const docPaidDeals = new Set(docPays.filter(p => p.pipedrive_deal_id).map(p => Number(p.pipedrive_deal_id)));

    // person_id -> AM map (from scheduled cache)
    let personToAM = {};
    try {
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_person_to_am&select=cache_value`, { headers: supa });
      if (cRes.ok) { const rows = await cRes.json(); if (rows[0]) personToAM = JSON.parse(rows[0].cache_value).personToAM || {}; }
    } catch (e) {}

    // Scan persons flagged as referrals; for each, check if their deal paid a doc fee this month
    const byAM = {};
    let start = 0, more = true, guard = 0;
    while (more && guard < 30) {
      const r = await pdGet(`/persons?start=${start}&limit=500`);
      const persons = r.data || [];
      for (const p of persons) {
        if (!fieldMatchesReferral(p[PD_REFERRAL_FIELD])) continue;
        const am = amNameOf(p[ACCOUNT_MANAGER_FIELD]) || personToAM[p.id];
        if (!am) continue;
        // Qualified if any of this person's deals paid a doc fee this month.
        let qualified = false;
        try {
          const dr = await pdGet(`/persons/${p.id}/deals?status=all_not_deleted&limit=50`);
          const deals = dr.data || [];
          qualified = deals.some(d => docPaidDeals.has(d.id));
        } catch (e) {}
        if (!qualified) continue;
        if (!byAM[am]) byAM[am] = { count: 0, clients: [] };
        byAM[am].count++;
        byAM[am].clients.push({ name: p.name, person_id: p.id });
      }
      more = r.additional_data?.pagination?.more_items_in_collection || false;
      start = r.additional_data?.pagination?.next_start || (start + 500);
      guard++;
      if (persons.length === 0) break;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ needsConfig: false, month, byAM, calculatedAt: new Date().toISOString() }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
