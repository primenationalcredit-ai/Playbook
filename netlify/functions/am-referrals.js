// am-referrals.js  (organization-based)
// Referrals are tracked by Pipedrive Organization: each AM has their own org, and
// referred clients are placed under it. Whoever owns the org gets the credit.
//
// Each AM's org id is stored on their users-table row as pipedrive_org_id (set in
// Admin > Users, or by the AM in their profile).
//
// Per month, per AM:
//   referrals = deals under their org that were created (signed up) this month
//   paid      = deals under their org whose doc fee was paid this month
// Payout (pays regardless of the 15 minimum):
//   $20 per paid referral; once paid >= 8, ALL paid that month count at $30.
// Top producer: +$100 to the AM with the most paid referrals this month, but only
//   if that AM also has >= 15 referrals (paid or not) this month.

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REFERRAL_MIN = 15;       // monthly referral standard (gates top-producer bonus)
const TOP_PRODUCER_BONUS = 100;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function pdGet(path, retry = 1) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`);
  if (res.ok) return await res.json();
  if ((res.status === 429 || res.status >= 500) && retry > 0) { await new Promise(r => setTimeout(r, 1500)); return pdGet(path, retry - 1); }
  return { data: null, _failed: true };
}

function monthBounds(month) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { start, end } = monthBounds(month);

    // AMs and their org ids
    const amRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.account_managers&select=name,pipedrive_org_id`, { headers: supa });
    const amUsers = amRes.ok ? await amRes.json() : [];
    const ams = amUsers.filter(u => u.pipedrive_org_id);
    if (ams.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ needsConfig: true, byAM: {}, month, message: 'No AM has a Pipedrive Org ID set yet (Admin > Users).' }) };
    }

    // Doc fee payments this month -> set of deal_ids that paid a doc fee
    const payRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${month}&payment_type=eq.doc_fee&select=pipedrive_deal_id`, { headers: supa });
    const docPays = payRes.ok ? await payRes.json() : [];
    const docPaidDeals = new Set(docPays.filter(p => p.pipedrive_deal_id).map(p => Number(p.pipedrive_deal_id)));

    const byAM = {};
    for (const am of ams) {
      const orgId = String(am.pipedrive_org_id).trim();
      let referrals = 0, paid = 0;
      const dealList = [];
      let cursor = 0, more = true, guard = 0;
      while (more && guard < 20) {
        const r = await pdGet(`/organizations/${orgId}/deals?start=${cursor}&limit=500`);
        if (r._failed) break;
        const deals = r.data || [];
        for (const d of deals) {
          const added = d.add_time ? new Date(d.add_time.replace(' ', 'T') + 'Z') : null;
          const isThisMonth = added && added >= start && added < end;
          const isPaid = docPaidDeals.has(d.id);
          if (isThisMonth) referrals++;
          if (isPaid) paid++;  // paid a doc fee this month
          if (isThisMonth || isPaid) {
            dealList.push({ id: d.id, title: d.title || d.person_name || `Deal ${d.id}`, added: d.add_time ? String(d.add_time).slice(0, 10) : null, paid: isPaid });
          }
        }
        more = r.additional_data?.pagination?.more_items_in_collection || false;
        cursor = r.additional_data?.pagination?.next_start || (cursor + 500);
        guard++;
        if (deals.length === 0) break;
      }
      const rate = paid >= 8 ? 30 : 20;
      dealList.sort((a, b) => (Number(b.paid) - Number(a.paid)) || String(b.added || '').localeCompare(String(a.added || '')));
      byAM[am.name] = { referrals, paid, perPaidRate: rate, payout: paid * rate, isTopProducer: false, orgId, deals: dealList };
    }

    // Top producer: most paid, must have >= 15 referrals
    let topName = null, topPaid = 0;
    for (const [name, d] of Object.entries(byAM)) {
      if (d.referrals >= REFERRAL_MIN && d.paid > topPaid) { topPaid = d.paid; topName = name; }
    }
    if (topName && topPaid > 0) {
      byAM[topName].isTopProducer = true;
      byAM[topName].topProducerBonus = TOP_PRODUCER_BONUS;
    }
    for (const d of Object.values(byAM)) {
      d.bonus = d.payout + (d.isTopProducer ? TOP_PRODUCER_BONUS : 0);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ needsConfig: false, month, referralMin: REFERRAL_MIN, byAM, calculatedAt: new Date().toISOString() }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
