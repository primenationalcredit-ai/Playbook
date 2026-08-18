// Consultant Bonus Sync — Uses Pipedrive filters for fast scanning
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const BASE_URL = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FIELDS = {
  DOC_1: '314d267ebc05d3623ffd8aab701baae7bea29aa8',
  PARTIAL_1: '35c626c805984517bacdba0b20aa20ab7ee3c48a',
  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4',
  TODAYS_DATE: '7cd0b70520acc393591f6b4d569d7c4c80ae98cb'
};
const DOC1_YES = '1104';
const PARTIAL1_YES = '1106';
const FINAL1_YES = '1108';

// Pipedrive filter: Doc(1) = Yes
const DOC_FEE_FILTER = 523792;

const NON_AFFILIATE = ['google', 'facebook', 'meta', 'bing', 'yahoo', 'direct', 'walk-in', 'walkin', 'other', 'n/a', 'none', 'craigslist', 'ask for referrers name', ''];
function isAffiliateOrg(orgName) {
  if (!orgName || orgName.trim().length === 0) return false;
  const lower = orgName.toLowerCase().trim();
  return !NON_AFFILIATE.some(na => lower === na || lower.includes(na));
}

async function pdFetch(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE_URL}${endpoint}${sep}api_token=${PIPEDRIVE_API_KEY}`);
  if (!res.ok) throw new Error(`Pipedrive ${res.status}: ${endpoint}`);
  return await res.json();
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = params.month || currentMonth;
    const startOffset = parseInt(params.start) || 0;
    const batchSize = 400; // Larger batches since filter narrows results
    const mode = params.mode || 'filter'; // 'filter' (default) or 'recent'

    let deals = [];
    let hasMore = false;

    // PERMANENT FIX (Cindy qualified-doc ticket 7/28): the scheduler only ever ran
    // page 1 and nothing followed nextUrl, so deals past the first 400 were never
    // judged - qualified docs stayed stale until someone paged by hand. Each run
    // now walks ALL pages itself (capped; nextUrl remains for manual continuation).
    const maxPages = parseInt(params.pages) || 12;
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    let cursor = startOffset;
    for (let pg = 0; pg < maxPages; pg++) {
      let pageDeals = [];
      if (mode === 'recent') {
        const data = await pdFetch(`/deals?sort=update_time DESC&start=${cursor}&limit=${batchSize}`);
        pageDeals = data.data || [];
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
        const oldIdx = pageDeals.findIndex(d => d.update_time < cutoff);
        if (oldIdx >= 0) { pageDeals = pageDeals.slice(0, oldIdx); hasMore = false; }
      } else {
        const filterId = parseInt(params.filter) || DOC_FEE_FILTER;
        const data = await pdFetch(`/deals?filter_id=${filterId}&start=${cursor}&limit=${batchSize}`);
        pageDeals = data.data || [];
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
      }
      deals.push(...pageDeals);
      cursor += batchSize;
      if (!hasMore) break;
    }

    console.log(`Sync: mode=${mode} month=${targetMonth} start=${startOffset} deals=${deals.length}`);

    // Get existing events
    const existRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_bonus_events?event_month=eq.${targetMonth}&select=deal_id,event_type`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const existing = existRes.ok ? await existRes.json() : [];
    const existingSet = new Set(existing.map(e => `${e.deal_id}-${e.event_type}`));

    let newEvents = 0, skipped = 0;
    const batch = [];

    for (const deal of deals) {
      const doc1 = String(deal[FIELDS.DOC_1]) === DOC1_YES;
      const partial1 = String(deal[FIELDS.PARTIAL_1]) === PARTIAL1_YES;
      const final1 = String(deal[FIELDS.FINAL_1]) === FINAL1_YES;
      if (!doc1) continue;

      const isQualified = doc1 && (partial1 || final1);
      const orgName = deal.org_name || '';
      const isAffiliate = isAffiliateOrg(orgName);

      const base = {
        deal_id: deal.id,
        deal_title: deal.title || deal.person_name || 'Unknown',
        deal_value: deal.value || 0,
        owner_name: deal.owner_name || 'Unassigned',
        owner_id: deal.user_id?.id || deal.user_id || null,
        org_name: orgName || null,
        is_affiliate: isAffiliate,
        doc1, partial1, final1,
        deal_add_time: deal.add_time || null,
        deal_won_time: deal.won_time || null,
        pipeline_id: deal.pipeline_id || null,
        stage_id: deal.stage_id || null,
        event_month: targetMonth,
        event_date: now.toISOString().split('T')[0]
      };

      if (isQualified && !existingSet.has(`${deal.id}-qualified_doc`)) {
        batch.push({ ...base, event_type: 'qualified_doc' });
        existingSet.add(`${deal.id}-qualified_doc`);
        newEvents++;
      } else if (isQualified) { skipped++; }

      if (final1 && !existingSet.has(`${deal.id}-pif`)) {
        let isPifFast = false;
        const todaysDateVal = deal[FIELDS.TODAYS_DATE] || deal.add_time;
        if (todaysDateVal) {
          const addDate = new Date(todaysDateVal);
          let bizDays = 0, d = new Date(addDate);
          d.setDate(d.getDate() + 1); // day AFTER Todays Date (agreement sent) is business day 1
          while (d <= now && bizDays <= 8) {
            if (d.getDay() !== 0 && d.getDay() !== 6) bizDays++;
            d.setDate(d.getDate() + 1);
          }
          isPifFast = bizDays <= 7;
        }
        batch.push({ ...base, event_type: isPifFast ? 'pif_fast_start' : 'pif' });
        existingSet.add(`${deal.id}-pif`);
        newEvents++;
      } else if (final1) { skipped++; }

      if (doc1 && !isQualified && !existingSet.has(`${deal.id}-doc_fee_only`)) {
        batch.push({ ...base, event_type: 'doc_fee_only' });
        existingSet.add(`${deal.id}-doc_fee_only`);
        newEvents++;
      }
    }

    if (batch.length > 0) {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_bonus_events`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal,resolution=merge-duplicates'
        },
        body: JSON.stringify(batch)
      });
      if (!insertRes.ok) console.error('Insert error:', await insertRes.text());
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        mode, month: targetMonth,
        dealsScanned: deals.length, newEvents, skippedDuplicates: skipped,
        hasMore,
        nextUrl: hasMore ? `/.netlify/functions/consultant-bonus-sync?mode=${mode}&month=${targetMonth}&start=${cursor}` : null,
        syncedAt: now.toISOString()
      })
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
