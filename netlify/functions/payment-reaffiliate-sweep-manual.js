// payment-reaffiliate-sweep.js (Joe 9/8, John Bennett/Ola Emerson/Asmita Karediya): Eric's
// referral organization got its "Consultant Referral" label added AFTER these payments were
// already enriched, and payment-enrich.js never revisits a row once consultant_name is set -
// a later label change on an org silently never reaches already-enriched payments, so the
// commission rate stays wrong (14% instead of 21%) forever until someone notices and files
// a ticket. This sweep re-checks the CURRENT org label/email state for recent non-affiliate
// payments and upgrades them if the org now qualifies. Only ever upgrades, never downgrades -
// removing someone's affiliate status automatically is a riskier direction to automate.
// Scoped to the last 90 days to stay fast; older non-affiliate payments are far less likely
// to reflect a since-changed org.
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_EMAIL_FIELD = 'ba6dfecbc8c99e28eefa892a929f317156c36474';
const H = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

const orgCache = {};
async function getOrgDetails(orgId) {
  if (!orgId) return null;
  const id = typeof orgId === 'object' ? (orgId.value || orgId) : orgId;
  if (orgCache[id]) return orgCache[id];
  try {
    const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${id}?api_token=${PIPEDRIVE_API_KEY}`);
    if (res.ok) { const data = await res.json(); orgCache[id] = data.data; return data.data; }
  } catch (e) {}
  return null;
}

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const scheduled = !event || !event.headers || !event.httpMethod;
  if (!scheduled) {
    const k = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || q.key || '';
    if (k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, body: '{"error":"unauthorized"}' };
  }
  // SINGLE-PAYMENT IMMEDIATE PATH (Joe 9/8): zoho-payment-sync calls this the instant a
  // payment inserts, so the commission rate is correct from second one - no schedule, no
  // sweep, no waiting. Skips the batch query entirely and checks just this one deal's org.
  if (q.deal_id) {
    try {
      const dRes1 = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${q.deal_id}?api_token=${PIPEDRIVE_API_KEY}`);
      const dJson1 = await dRes1.json().catch(() => null);
      const deal1 = dJson1 && dJson1.data;
      if (!deal1) return { statusCode: 200, body: JSON.stringify({ error: 'deal not found' }) };
      const orgId1 = deal1.org_id?.value || deal1.org_id;
      if (!orgId1) return { statusCode: 200, body: JSON.stringify({ noOrg: true }) };
      const org1 = await getOrgDetails(orgId1);
      if (!org1) return { statusCode: 200, body: JSON.stringify({ error: 'org lookup failed' }) };
      const isConsultantReferral1 = org1.label === 2993;
      let orgEmail1 = null;
      const emailRaw1 = org1[ORG_EMAIL_FIELD];
      if (emailRaw1) {
        if (typeof emailRaw1 === 'string') orgEmail1 = emailRaw1;
        else if (Array.isArray(emailRaw1) && emailRaw1.length > 0) orgEmail1 = emailRaw1[0].value || emailRaw1[0].primary || emailRaw1[0] || null;
        else if (typeof emailRaw1 === 'object' && emailRaw1.value) orgEmail1 = emailRaw1.value;
      }
      const orgHasEmail1 = !!(orgEmail1 && String(orgEmail1).includes('@'));
      const isAffiliate1 = isConsultantReferral1 || orgHasEmail1;
      await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?pipedrive_deal_id=eq.${q.deal_id}&is_affiliate_deal=eq.false`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ referrer_org: org1.name || null, is_affiliate_deal: isAffiliate1, org_email: orgEmail1, org_has_email: orgHasEmail1 })
      });
      return { statusCode: 200, body: JSON.stringify({ deal_id: q.deal_id, is_affiliate_deal: isAffiliate1, org_name: org1.name }) };
    } catch (e) { return { statusCode: 200, body: JSON.stringify({ error: String(e.message).slice(0, 150) }) }; }
  }
  const t0 = Date.now();
  const BUDGET = 20000;
  const since = q.since || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const out = { checked: 0, upgraded: 0, errors: 0, stoppedEarly: false };
  try {
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?is_affiliate_deal=eq.false&pipedrive_deal_id=not.is.null&payment_date=gte.${since}&consultant_name=not.in.(Unknown,pending_enrichment,needs_manual)&select=id,pipedrive_deal_id,consultant_name,referrer_org,client_name&limit=500`, { headers: H }).then(r => r.json()).catch(() => []);
    for (const p of (Array.isArray(rows) ? rows : [])) {
      out.checked++;
      if (Date.now() - t0 > BUDGET) { out.stoppedEarly = true; break; }
      try {
        const dRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${p.pipedrive_deal_id}?api_token=${PIPEDRIVE_API_KEY}`);
        const dJson = await dRes.json().catch(() => null);
        const deal = dJson && dJson.data;
        if (!deal) continue;
        const orgId = deal.org_id?.value || deal.org_id;
        if (!orgId) continue;
        const org = await getOrgDetails(orgId);
        if (!org) continue;
        const isConsultantReferral = org.label === 2993;
        let orgEmail = null;
        const emailRaw = org[ORG_EMAIL_FIELD];
        if (emailRaw) {
          if (typeof emailRaw === 'string') orgEmail = emailRaw;
          else if (Array.isArray(emailRaw) && emailRaw.length > 0) orgEmail = emailRaw[0].value || emailRaw[0].primary || emailRaw[0] || null;
          else if (typeof emailRaw === 'object' && emailRaw.value) orgEmail = emailRaw.value;
        }
        const orgHasEmail = !!(orgEmail && String(orgEmail).includes('@'));
        const nowAffiliate = isConsultantReferral || orgHasEmail;
        if (nowAffiliate) {
          await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${p.id}`, {
            method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
            body: JSON.stringify({ referrer_org: org.name || null, is_affiliate_deal: true, org_email: orgEmail, org_has_email: orgHasEmail })
          });
          out.upgraded++;
        }
      } catch (e) { out.errors++; }
    }
  } catch (e) { out.fatal = String(e.message).slice(0, 150); }
  out.done = out.stoppedEarly ? 0 : 1;
  return { statusCode: 200, body: JSON.stringify(out) };
};
