// Payment Enrichment — Looks up Pipedrive deals for payments missing consultant names
// Processes 20 records at a time to stay under timeout
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NON_AFFILIATE = ['google', 'facebook', 'meta', 'bing', 'yahoo', 'direct', 'walk-in', 'walkin', 'other', 'n/a', 'none', 'craigslist', 'ask for referrers name', ''];
function isAffiliateOrg(orgName) {
  if (!orgName || orgName.trim().length === 0) return false;
  const lower = orgName.toLowerCase().trim();
  return !NON_AFFILIATE.some(na => lower === na || lower.includes(na));
}

// Org email field key in Pipedrive
const ORG_EMAIL_FIELD = 'ba6dfecbc8c99e28eefa892a929f317156c36474';
const orgCache = {};

// Account Manager (Pipedrive Person field). Additional rounds credit the AM, not the deal owner.
const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const personCache = {};
function amNameOf(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  return val.name || val.value || null;
}
async function getPerson(personId) {
  if (!personId) return null;
  const id = typeof personId === 'object' ? (personId.value || personId) : personId;
  if (personCache[id]) return personCache[id];
  try {
    const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${id}?api_token=${PIPEDRIVE_API_KEY}`);
    if (res.ok) { const data = await res.json(); personCache[id] = data.data; return data.data; }
  } catch (e) { console.log(`Person ${id} lookup failed`); }
  return null;
}

async function getOrgDetails(orgId) {
  if (!orgId) return null;
  const id = typeof orgId === 'object' ? (orgId.value || orgId) : orgId;
  if (orgCache[id]) return orgCache[id];
  try {
    const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${id}?api_token=${PIPEDRIVE_API_KEY}`);
    if (res.ok) {
      const data = await res.json();
      orgCache[id] = data.data;
      return data.data;
    }
  } catch (e) { console.log(`Org ${id} lookup failed`); }
  return null;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Fetch a single Pipedrive deal by id (cached).
async function getDeal(dealId, dealCache) {
  if (!dealId) return null;
  if (dealCache[dealId]) return dealCache[dealId];
  try {
    const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_KEY}`);
    if (r.ok) { const d = await r.json(); dealCache[dealId] = d.data; return d.data; }
  } catch (e) { console.log(`Deal ${dealId} lookup failed:`, e.message); }
  return null;
}

// Find a Pipedrive deal id for a payment that has no deal id, using email first
// then client name. Returns a deal id or null. Prefers an OPEN/most-recent deal.
async function searchDealId(payment) {
  // Email is the strongest signal: search the person by email, then read their deals.
  if (payment.client_email) {
    try {
      const pr = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/search?term=${encodeURIComponent(payment.client_email)}&fields=email&exact_match=true&limit=5&api_token=${PIPEDRIVE_API_KEY}`);
      if (pr.ok) {
        const pd = await pr.json();
        const personId = pd.data?.items?.[0]?.item?.id || null;
        if (personId) {
          const dr = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${personId}/deals?status=all_not_deleted&limit=20&api_token=${PIPEDRIVE_API_KEY}`);
          if (dr.ok) {
            const dd = await dr.json();
            const deals = dd.data || [];
            if (deals.length) {
              // Prefer an open deal; otherwise the most recent by id.
              const open = deals.filter(x => x.status === 'open').map(x => x.id);
              if (open.length) return open.sort((a, b) => b - a)[0];
              // NO-GUESS 8/29 (Juan Romero 149448/270149): zero open deals means the email
              // matched a STALE duplicate person - filing on their old/won deal is the
              // wrong-deal disease at its source. Park for a human instead.
              return null;
            }
          }
        }
      }
    } catch (e) { /* email-person lookup failed - no guessing below */ }
  }
  // NO-GUESS RULE (Joe's ticket 8/21, shipped 8/22 - Brandon Jackson class):
  // fuzzy term search and name search are GONE. A payment attaches to a deal
  // with hard proof (exact email -> person -> their deal) or it goes to
  // needs_manual for human review. Wrong-deal attribution beats a blank row
  // zero times out of ten.
  return null;
}

// Given a payment and a resolved deal, compute consultant + affiliate fields and
// write them. Returns true on success. Shared by the deal-id tier and search tier.
async function enrichFromDeal(payment, deal, personToAM) {
  if (!deal) return false;
  let consultantName = deal.owner_name || 'Unknown';
  if (payment.payment_type === 'additional_round') {
    let am = amNameOf(deal[ACCOUNT_MANAGER_FIELD]);
    const personId = deal.person_id?.value || deal.person_id || null;
    if (!am && personId && personToAM[personId]) am = personToAM[personId];
    if (!am && personId) { const p = await getPerson(personId); am = amNameOf(p?.[ACCOUNT_MANAGER_FIELD]); }
    if (am) consultantName = am;
  }
  const orgName = deal.org_name || null;
  let isConsultantReferral = false, orgHasEmail = false, orgEmail = null;
  const orgId = deal.org_id?.value || deal.org_id;
  if (orgId) {
    const org = await getOrgDetails(orgId);
    if (org) {
      isConsultantReferral = org.label === 2993;
      const emailRaw = org[ORG_EMAIL_FIELD];
      if (emailRaw) {
        if (typeof emailRaw === 'string') orgEmail = emailRaw;
        else if (Array.isArray(emailRaw) && emailRaw.length > 0) orgEmail = emailRaw[0].value || emailRaw[0].primary || emailRaw[0] || null;
        else if (typeof emailRaw === 'object' && emailRaw.value) orgEmail = emailRaw.value;
      }
      orgHasEmail = !!(orgEmail && String(orgEmail).includes('@'));
    }
  }
  const isAffiliate = isConsultantReferral || orgHasEmail;
  await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${payment.id}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      pipedrive_deal_id: deal.id || payment.pipedrive_deal_id || null,
      consultant_name: consultantName, referrer_org: orgName,
      is_affiliate_deal: isAffiliate, org_email: orgEmail, org_has_email: orgHasEmail
    })
  });
  return true;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // Pull a batch of pending payments. We no longer require a deal id here, so
    // rows that came in via the backfill (deal id null) are worked too, not just
    // counted. We grab the fields self-heal and search need.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/consultant_payments?consultant_name=in.(Unknown,pending_enrichment)&select=id,pipedrive_deal_id,client_name,client_email,payment_type,payment_date,source&order=payment_date.desc&limit=30`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const payments = res.ok ? await res.json() : [];

    if (payments.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Nothing to enrich', remaining: 0 }) };
    }

    let enriched = 0, healed = 0, searched = 0, unresolved = 0, failed = 0;
    const dealCache = {};

    // person_id -> AM name map (same cache the AM tools use), for additional-round credit
    let personToAM = {};
    try {
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_person_to_am&select=cache_value`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
      if (cRes.ok) { const rows = await cRes.json(); if (rows[0]) personToAM = JSON.parse(rows[0].cache_value).personToAM || {}; }
    } catch (e) {}

    for (const payment of payments) {
      // ---- Tier 0: self-heal from the client's own already-resolved payments ----
      // Most stuck rows are repeat clients. If another payment for the same person
      // already has a deal id and a real consultant, borrow it. The sibling CLOSEST
      // IN DATE to this payment wins, so a returning client's later round inherits
      // the right deal rather than an old one. Zero API calls.
      if (!payment.pipedrive_deal_id || !payment.consultant_name || payment.consultant_name === 'pending_enrichment' || payment.consultant_name === 'Unknown') {
        const nameKey = norm(payment.client_name);
        const emailKey = (payment.client_email || '').toLowerCase().trim();
        let sibQuery = null;
        if (emailKey) sibQuery = `client_email=eq.${encodeURIComponent(payment.client_email)}`;
        else if (nameKey) sibQuery = `client_name=eq.${encodeURIComponent(payment.client_name)}`;
        if (sibQuery) {
          const sRes = await fetch(
            `${SUPABASE_URL}/rest/v1/consultant_payments?${sibQuery}&pipedrive_deal_id=not.is.null&consultant_name=not.in.(Unknown,pending_enrichment)&select=pipedrive_deal_id,consultant_name,consultant_id,is_va,referrer_org,is_affiliate_deal,org_email,org_has_email,payment_date`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          );
          const sibs = sRes.ok ? await sRes.json() : [];
          if (sibs.length > 0) {
            // pick the sibling whose payment_date is closest to this payment's date
            const target = new Date(payment.payment_date).getTime();
            sibs.sort((a, b) => Math.abs(new Date(a.payment_date).getTime() - target) - Math.abs(new Date(b.payment_date).getTime() - target));
            const s = sibs[0];
            // VERIFIED BORROW (Mackenzie Haight 8/10: blind copy inherited a 2018
            // won deal + its 2018 consultant for a 2026 returning client). The
            // sibling only NOMINATES a deal - we fetch it, and if it isn't open we
            // walk forward to the person's newest OPEN deal (returning clients get
            // a fresh file; the old one must not claim their payments). Enrichment
            // then derives the consultant LIVE from the resolved deal's owner_name -
            // never copied from an old row.
            let borrowDeal = await getDeal(s.pipedrive_deal_id, dealCache);
            if (borrowDeal && borrowDeal.status !== 'open') {
              try {
                const pid = borrowDeal.person_id?.value || borrowDeal.person_id || null;
                if (pid) {
                  const odRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${pid}/deals?status=open&limit=50&api_token=${PIPEDRIVE_API_KEY}`);
                  if (odRes.ok) {
                    const od = (await odRes.json()).data || [];
                    if (od.length) {
                      od.sort((a, b) => b.id - a.id);
                      borrowDeal = await getDeal(od[0].id, dealCache) || borrowDeal;
                    }
                  }
                }
              } catch (e) { /* open-deal walk failed - keep the sibling's deal */ }
            }
            if (borrowDeal && await enrichFromDeal(payment, borrowDeal, personToAM)) {
              healed++; enriched++;
              continue;
            }
            // sibling nomination failed entirely - fall through to the search tiers
          }
        }
      }

      // ---- Tier 1: deal id present -> look up the deal and enrich ----
      if (payment.pipedrive_deal_id) {
        const deal = await getDeal(payment.pipedrive_deal_id, dealCache);
        if (deal && await enrichFromDeal(payment, deal, personToAM)) { enriched++; continue; }
      }

      // ---- Tier 2: no deal id -> search Pipedrive by email then name ----
      const foundId = await searchDealId(payment);
      if (foundId) {
        const deal = await getDeal(foundId, dealCache);
        if (deal && await enrichFromDeal(payment, deal, personToAM)) { enriched++; searched++; continue; }
      }

      // OWNER FALLBACK (Joe 8/27): a payment that HAS a deal id must never park as
      // needs_manual while that deal still resolves - one transient Pipedrive hiccup in
      // Tier 1 did exactly that to Michael Flores' $125 on Cindy's own deal. Last attempt:
      // fetch the deal directly; a live owner_name IS the consultant (marked owner_derived).
      if (payment.pipedrive_deal_id) {
        try {
          const pdTok2 = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
          const dr = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${payment.pipedrive_deal_id}?api_token=${pdTok2}`);
          const dj2 = await dr.json().catch(() => null);
          const own = dj2 && dj2.data && dj2.data.owner_name;
          if (own) {
            await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${payment.id}`, { method: 'PATCH', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify({ consultant_name: own, source: (payment.source ? payment.source + '|' : '') + 'owner_derived' }) });
            enriched++; continue;
          }
        } catch (e2) { /* fall through to needs_manual */ }
      }

      // ---- Tier 3: cannot resolve -> mark so it stops being retried/counted ----
      // The deal is deleted/merged and there's no sibling or search hit. Flag it
      // for manual fixing via the All Payments Edit button and drop it from the
      // workable queue. consultant_name moves off the pending sentinel so the
      // remaining-count query no longer counts it.
      await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${payment.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ consultant_name: 'needs_manual', source: (payment.source ? payment.source + '|' : '') + 'enrich_unresolved' })
      });
      unresolved++; failed++;
    }

    // Remaining = rows still on the pending sentinels. needs_manual and real names
    // are excluded, so this counts only what's still workable and now counts DOWN.
    const remainRes = await fetch(
      `${SUPABASE_URL}/rest/v1/consultant_payments?consultant_name=in.(Unknown,pending_enrichment)&select=id&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' } }
    );
    const remainCount = parseInt(remainRes.headers?.get('content-range')?.split('/')?.[1]) || 0;

    // Also report how many are parked for manual fixing, for the UI.
    const manualRes = await fetch(
      `${SUPABASE_URL}/rest/v1/consultant_payments?consultant_name=eq.needs_manual&select=id&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' } }
    );
    const needsManual = parseInt(manualRes.headers?.get('content-range')?.split('/')?.[1]) || 0;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        processed: payments.length, enriched, healed, searched, unresolved, failed,
        remaining: remainCount, needsManual,
        nextUrl: remainCount > 0 ? '/.netlify/functions/payment-enrich' : null,
        message: remainCount > 0 ? `${remainCount} more to enrich — call again` : `All resolved. ${needsManual} parked for manual fixing.`
      })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
