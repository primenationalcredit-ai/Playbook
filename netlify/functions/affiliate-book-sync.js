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
const K_COMPANY = 'f411fe519779247e2ac388a6331669624be0e265';
const K_OCCUPATION = '939b17f8624908513f9a32d2b7601478686419f3';
const K_PORTAL_LINK = '15a30013a673b3412f9add0430cd3686f8228d8e';    // Portal Link (GENERIC url - filter field only)
const K_CLIENT_LINK = 'f5f38f128aadb798f04f3d9c6f9fffa53cf517a8';    // Client Referral Link (/self-signup/CODE - new Zapier-era signups)
const K_SEND_LINK = '15a8608561864a51c527a8ba78fa6c48b9081574';
const K_FU_NOTES = '17c6fcd0a8bcc21bbba680a8fe82697d9f996df9';   // Additional F/U Notes (two-way: engine appends, sync pulls)
const K_PAYOUT = 'fa804c13990a023d6b5c3f10a89969b1694c392f';     // Affiliate Pay out (monetary) - money talk allowed ONLY when filled      // Affiliate Send Client Link (client-signup.php?afcode= - the master field, 3,148 filled)
const K_SUPER_PORTAL = '04acdb1de8d9e3a6f04322339e3f95de19f1aa1e';  // Super Affiliate Portal
const K_SENIOR = 'a821f4a4053793acefdf300aa0a27ccc777afbfc';        // Senior Affiliate

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
          if (!soldByOrg[key]) soldByOrg[key] = { items: [] };
          const dt = String(p.payment_date || '').slice(0, 10);
          soldByOrg[key].items.push({ c: String(p.pipedrive_deal_id || p.client_name), d: dt || null });
        }
        if (rows.length < 1000) break;
        from += 1000;
        if (from > 100000) break; // hard stop
      }
    } catch (e) {}

    // ---- 2b. Derive the real super affiliates: orgs REFERENCED as a parent by the
    // Super Affiliate Portal field (that field points at the recruiting super's org,
    // so the supers are the referenced orgs, not the orgs carrying the field).
    // The Senior Affiliate enum names which super recruited the org (1730 = "NULL").
    // SUPER AFFILIATE ALLOWLIST (Joe, 7/10): the super OWNERS are managed relationships
    // and get NO cadences. Their recruits/downlines are normal affiliates and DO get
    // cadences. Edit this list by normalized org name to add/remove supers.
    const SUPER_ALLOWLIST = [
      'oguz konar',            // Oz Konar - BLB
      '7 figures funding',     // Leo Kanell
      'norisk digitals',       // house recruiting operation
      'kevin walters sr',      // Walters Insurance / TFA
    ];
    const seniorLabels = { 1731: 'Oguz', 2629: 'Olivia', 3603: 'Shawn', 3614: 'Leo 7Figures', 3604: 'Ramon', 3615: 'Marycruz', 3659: 'MO2V8', 3669: 'Walters Insurance Services & TFA', 3690: 'NRD', 3616: 'Dennis' };
    const superNameSet = new Set(SUPER_ALLOWLIST.map((n) => norm(n)));

    // ---- 3. Build rows + upsert (data fields only - cadence state untouched) ----
    const today = new Date();
    const daysSince = (d) => d ? Math.floor((today - new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z'))) / 86400000) : null;

    const rows = orgs.map((o) => {
      const email = (o[K_EMAIL] || '').trim() || null;
      const phone = ((o[K_CELL] || '').trim() || (o[K_WORK] || '').trim()) || null;
      const first = (o[K_FIRST] || '').trim();
      const last = (o[K_LAST] || '').trim();
      // Date guard: a payment can only be this affiliate's sale if it happened
      // after the affiliate existed. Kills retro-attribution from lead imports.
      const orgBorn = o.add_time ? String(o.add_time).slice(0, 10) : null;
      const soldAll = soldByOrg[norm(o.name)] || null;
      const soldItems = soldAll ? soldAll.items.filter((x) => !orgBorn || !x.d || x.d >= orgBorn) : [];
      const soldCount = new Set(soldItems.map((x) => x.c)).size;
      const lastRef = soldItems.reduce((m, x) => (x.d && (!m || x.d > m) ? x.d : m), null);
      const refDays = lastRef ? Math.floor((today - new Date(lastRef + 'T12:00:00Z')) / 86400000) : null;
      const ageDays = daysSince(o.add_time) ?? 99999;
      const referred = (o.open_deals_count || 0) + (o.closed_deals_count || 0);

      let segment;
      if (soldCount > 0 && refDays != null && refDays <= 30) segment = 'producing';
      else if (soldCount > 0 && refDays != null && refDays <= 90) segment = 'slowing';
      else if (soldCount > 0) segment = 'dormant';
      else if (referred > 0) segment = 'referred_pending'; // they sent people, nobody sold yet - help them convert
      else if (ageDays <= 60) segment = 'new_never';
      else segment = 'cold';

      return {
        pipedrive_org_id: o.id,
        org_name: o.name || `Org ${o.id}`,
        contact_name: (first || last) ? `${first} ${last}`.trim() : null,
        contact_email: email,
        contact_phone: phone,
        owner_name: o.owner_name || null,
        company: (o[K_COMPANY] == null ? '' : String(o[K_COMPANY])).trim() || null,
        occupation: (o[K_OCCUPATION] == null ? '' : String(o[K_OCCUPATION])).trim() || null,
        pipedrive_fu_notes: (o[K_FU_NOTES] == null ? '' : String(o[K_FU_NOTES])).trim() || null,
        payout_amount: (() => { const v = parseFloat(o[K_PAYOUT]); return isNaN(v) || v <= 0 ? null : v; })(),
        industry: (o.industry == null ? '' : String(o.industry)).trim() || null,
        ...(() => {
          // The unique give-this-to-your-client link, merged across eras:
          //   1. Affiliate Send Client Link (client-signup.php?afcode=) - normalized to https
          //   2. Client Referral Link when it's a real signup link (/self-signup/, /direct-signup/)
          //   3. neither -> generic portal + needs_unique_link flag for regeneration
          const clean = (v) => (v == null ? '' : String(v)).trim();
          let link = clean(o[K_SEND_LINK]);
          if (link && /clients\.php|affiliates-leads|affiliate-payments/i.test(link)) link = ''; // dashboard junk, not a client link
          if (link) {
            if (!/^https?:\/\//i.test(link)) link = 'https://' + link;
            link = link.replace(/^http:\/\//i, 'https://');
          }
          if (!link) {
            const cl = clean(o[K_CLIENT_LINK]);
            if (/self-signup|direct-signup/i.test(cl)) link = cl.replace(/^http:\/\//i, 'https://');
          }
          const needsLink = !link;
          if (!link) link = clean(o[K_PORTAL_LINK]) || null;
          return { portal_link: link, needs_unique_link: needsLink };
        })(),
        super_affiliate: superNameSet.has(norm(o.name)),
        recruited_by_super: (() => {
          const sp = o[K_SUPER_PORTAL];
          if (sp && typeof sp === 'object' && sp.name) return sp.name;
          const sen = o[K_SENIOR];
          if (sen && seniorLabels[Number(sen)]) return seniorLabels[Number(sen)];
          return null;
        })(),
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
      super_affiliates: rows.filter(r => r.super_affiliate).length,
      needs_unique_link: rows.filter(r => r.needs_unique_link).length,
      recruited_by_supers: rows.filter(r => r.recruited_by_super).length,
      note: params.debug ? rows.slice(0, 3) : undefined
    });
  } catch (e) {
    return respond(500, { error: String(e.message || e).slice(0, 300) });
  }
};
