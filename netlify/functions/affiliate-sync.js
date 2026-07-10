// affiliate-sync.js  (Playbook)
// Syncs the affiliate book from Pipedrive filter 523931 (orgs with a Portal Link)
// into affiliate_orgs. New portal signups are Zapier-created with the field filled,
// so re-pulling the filter automatically captures every new affiliate.
//
// Per org: contacts from ORG-LEVEL fields (99.9% coverage - no person lookups),
// referred/won straight off the org record's deal counters, sold clients + last
// referral date matched from consultant_payments.referrer_org (normalized name),
// then a marketing segment. Cadence state columns are NEVER touched by this sync.
//
// Segments:
//   producing  - sold a client in the last 30 days
//   slowing    - sold in the last 31-90 days
//   dormant    - has sold before, quiet 90+ days
//   new_never  - added in the last 60 days, never sold (priority outreach)
//   cold       - older than 60 days, never sold

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const AFFILIATE_FILTER = 523931;

// Org-level contact field keys
const K_EMAIL = 'ba6dfecbc8c99e28eefa892a929f317156c36474';
const K_CELL = 'a35eb5e55e56656649f6badfed4388514deb04f4';
const K_WORK = 'cbdc53e78f78a27e0425c29150bf7d78c71d5066';
const K_FIRST = '094f2d3ede7277b5a9c2a697ee10f3ad28b6fa82';
const K_LAST = '2bae3cfd8aebc51a92d28a581b649305c1612524';

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

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

exports.handler = async (event) => {
  const params = (event && event.queryStringParameters) || {};
  try {
    // ---- 1. Pull the whole filter (paged) ----
    const orgs = [];
    let start = 0, more = true, pages = 0;
    while (more && pages < 40) {
      const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations?filter_id=${AFFILIATE_FILTER}&limit=500&start=${start}&api_token=${PIPEDRIVE_TOKEN}`);
      if (!r.ok) throw new Error(`Pipedrive ${r.status}`);
      const d = await r.json();
      orgs.push(...(d.data || []));
      more = d.additional_data && d.additional_data.pagination && d.additional_data.pagination.more_items_in_collection;
      start = (d.additional_data && d.additional_data.pagination && d.additional_data.pagination.next_start) || (start + 500);
      pages++;
    }

    // ---- 2. Sold clients + last referral per org name (from payment history) ----
    // referrer_org is free text; match on normalized name. Pull once, group in memory.
    const soldByOrg = {}; // norm(name) -> { clients: Set, lastDate: 'yyyy-mm-dd' }
    try {
      let from = 0;
      while (true) {
        const pr = await supa(`consultant_payments?referrer_org=not.is.null&select=referrer_org,pipedrive_deal_id,client_name,payment_date&order=id.asc&limit=1000&offset=${from}`);
        const rows = pr.json || [];
        for (const p of rows) {
          const key = norm(p.referrer_org);
          if (!key) continue;
          if (!soldByOrg[key]) soldByOrg[key] = { clients: new Set(), lastDate: null };
          soldByOrg[key].clients.add(String(p.pipedrive_deal_id || p.client_name));
          const dt = String(p.payment_date || '').slice(0, 10);
          if (dt && (!soldByOrg[key].lastDate || dt > soldByOrg[key].lastDate)) soldByOrg[key].lastDate = dt;
        }
        if (rows.length < 1000) break;
        from += 1000;
        if (from > 100000) break; // hard stop
      }
    } catch (e) {}

    // ---- 3. Build rows + upsert (data fields only - cadence state untouched) ----
    const today = new Date();
    const daysSince = (d) => d ? Math.floor((today - new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z'))) / 86400000) : null;

    const rows = orgs.map((o) => {
      const email = (o[K_EMAIL] || '').trim() || null;
      const phone = ((o[K_CELL] || '').trim() || (o[K_WORK] || '').trim()) || null;
      const first = (o[K_FIRST] || '').trim();
      const last = (o[K_LAST] || '').trim();
      const sold = soldByOrg[norm(o.name)] || null;
      const soldCount = sold ? sold.clients.size : 0;
      const lastRef = sold ? sold.lastDate : null;
      const refDays = lastRef ? Math.floor((today - new Date(lastRef + 'T12:00:00Z')) / 86400000) : null;
      const ageDays = daysSince(o.add_time) ?? 99999;
      const referred = (o.open_deals_count || 0) + (o.closed_deals_count || 0);

      let segment;
      if (soldCount > 0 && refDays != null && refDays <= 30) segment = 'producing';
      else if (soldCount > 0 && refDays != null && refDays <= 90) segment = 'slowing';
      else if (soldCount > 0) segment = 'dormant';
      else if (ageDays <= 60) segment = 'new_never';
      else segment = 'cold';

      return {
        pipedrive_org_id: o.id,
        org_name: o.name || `Org ${o.id}`,
        contact_name: (first || last) ? `${first} ${last}`.trim() : null,
        contact_email: email,
        contact_phone: phone,
        owner_name: o.owner_name || null,
        org_created_at: o.add_time ? new Date(String(o.add_time).replace(' ', 'T') + 'Z').toISOString() : null,
        pipedrive_add_time: o.add_time ? new Date(String(o.add_time).replace(' ', 'T') + 'Z').toISOString() : null,
        lifetime_referrals: soldCount,
        referred_deals: referred,
        won_deals: o.won_deals_count || 0,
        sold_clients: soldCount,
        conversion_pct: referred > 0 ? Math.min(100, Math.round((soldCount / referred) * 100)) : 0,
        last_referral_date: lastRef,
        segment,
        missing_contact: !email && !phone,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Upsert in chunks on pipedrive_org_id. Only the columns above are sent, so
    // cadence_step / next_touch_due / paused / opted_out are never overwritten.
    let upserted = 0, failedChunks = 0;
    for (let c = 0; c < rows.length; c += 200) {
      const chunk = rows.slice(c, c + 200);
      const up = await supa('affiliate_orgs?on_conflict=pipedrive_org_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk)
      });
      if (up.ok) upserted += chunk.length; else failedChunks++;
    }

    const bySegment = {};
    for (const r of rows) bySegment[r.segment] = (bySegment[r.segment] || 0) + 1;

    return respond(200, {
      success: true,
      orgs_in_filter: orgs.length,
      upserted, failedChunks,
      segments: bySegment,
      missing_contact: rows.filter(r => r.missing_contact).length,
      note: params.debug ? rows.slice(0, 3) : undefined
    });
  } catch (e) {
    return respond(500, { error: String(e.message || e).slice(0, 300) });
  }
};
