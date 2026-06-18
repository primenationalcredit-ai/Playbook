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

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // Get payments that need enrichment (have deal_id but consultant is unknown/pending)
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/consultant_payments?consultant_name=in.(Unknown,pending_enrichment)&pipedrive_deal_id=not.is.null&select=id,pipedrive_deal_id,client_name,payment_type&limit=20`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const payments = res.ok ? await res.json() : [];

    if (payments.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Nothing to enrich', remaining: 0 }) };
    }

    let enriched = 0, failed = 0;
    const dealCache = {};

    // person_id -> AM name map (same cache the AM tools use), for additional-round credit
    let personToAM = {};
    try {
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_person_to_am&select=cache_value`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
      if (cRes.ok) { const rows = await cRes.json(); if (rows[0]) personToAM = JSON.parse(rows[0].cache_value).personToAM || {}; }
    } catch (e) {}

    for (const payment of payments) {
      const dealId = payment.pipedrive_deal_id;
      let deal = dealCache[dealId];
      
      if (!deal) {
        try {
          const dealRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_KEY}`);
          if (dealRes.ok) {
            const dealData = await dealRes.json();
            deal = dealData.data;
            dealCache[dealId] = deal;
          }
        } catch (e) {
          console.log(`Deal ${dealId} lookup failed:`, e.message);
        }
      }

      if (deal) {
        let consultantName = deal.owner_name || 'Unknown';
        // Additional rounds credit the Account Manager on the deal, not the deal owner
        if (payment.payment_type === 'additional_round') {
          let am = amNameOf(deal[ACCOUNT_MANAGER_FIELD]);
          const personId = deal.person_id?.value || deal.person_id || null;
          if (!am && personId && personToAM[personId]) am = personToAM[personId];
          if (!am && personId) {
            const p = await getPerson(personId);
            am = amNameOf(p?.[ACCOUNT_MANAGER_FIELD]);
          }
          if (am) consultantName = am;
        }
        const orgName = deal.org_name || null;
        let isConsultantReferral = false;
        let orgHasEmail = false;
        let orgEmail = null;
        
        // Fetch org details for label and email
        const orgId = deal.org_id?.value || deal.org_id;
        if (orgId) {
          const org = await getOrgDetails(orgId);
          if (org) {
            // Check for "Consultant Referral" label (ID 2993)
            isConsultantReferral = org.label === 2993;
            // Check for email in custom field — handle various formats
            const emailRaw = org[ORG_EMAIL_FIELD];
            if (emailRaw) {
              if (typeof emailRaw === 'string') {
                orgEmail = emailRaw;
              } else if (Array.isArray(emailRaw) && emailRaw.length > 0) {
                orgEmail = emailRaw[0].value || emailRaw[0].primary || emailRaw[0] || null;
              } else if (typeof emailRaw === 'object' && emailRaw.value) {
                orgEmail = emailRaw.value;
              }
            }
            orgHasEmail = !!(orgEmail && String(orgEmail).includes('@'));
            console.log(`Org ${org.name}: label=${org.label}, email=${orgEmail}, hasEmail=${orgHasEmail}`);
          }
        }
        
        const isAffiliate = isConsultantReferral || orgHasEmail;

        await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${payment.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', 'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ 
            consultant_name: consultantName, 
            referrer_org: orgName, 
            is_affiliate_deal: isConsultantReferral,
            org_email: orgEmail,
            org_has_email: orgHasEmail
          })
        });
        enriched++;
      } else {
        failed++;
      }
    }

    // Check how many still need enrichment
    const remainRes = await fetch(
      `${SUPABASE_URL}/rest/v1/consultant_payments?consultant_name=in.(Unknown,pending_enrichment)&select=id&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' } }
    );
    const remainCount = parseInt(remainRes.headers?.get('content-range')?.split('/')?.[1]) || 0;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        processed: payments.length, enriched, failed,
        remaining: remainCount,
        nextUrl: remainCount > 0 ? '/.netlify/functions/payment-enrich' : null,
        message: remainCount > 0 ? `${remainCount} more to enrich — call again` : 'All payments enriched!'
      })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
