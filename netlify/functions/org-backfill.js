// org-backfill.js (Joe 9/1, Eric's 21% ticket - John Bennet / Queenie Woody / Amy
// Schmidt): payments arrive with a consultant already set but no referring org, and
// payment-enrich only ever looks at rows still marked pending, so those rows keep a
// blank org forever and the client is paid at the organic rate instead of affiliate.
// This fills the org in from the deal, using the SAME affiliate test the enricher
// uses (org label 2993 = consultant referral, or the org has an email on file).
// ?dry=1 reports what would change without writing.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PDT = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
const PD = 'https://asapcreditrepairusa.pipedrive.com/api/v1';
const ORG_EMAIL_FIELD = 'ba6dfecbc8c99e28eefa892a929f317156c36474';
const H = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const scheduled = !event || !event.headers || !event.httpMethod;
  if (!scheduled) {
    const k = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || q.key || '';
    if (k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, body: '{"error":"unauthorized"}' };
  }
  const dry = q.dry === '1';
  const since = q.since || '2026-08-01';
  const out = { checked: 0, affiliate: [], organic: 0, noOrg: 0, errors: 0 };
  try {
    const rows = await fetch(SUPABASE_URL + '/rest/v1/consultant_payments?referrer_org=is.null&consultant_name=not.in.(Unknown,pending_enrichment,needs_manual)&pipedrive_deal_id=not.is.null&payment_date=gte.' + since + '&select=id,client_name,amount,payment_date,consultant_name,pipedrive_deal_id&order=payment_date.desc&limit=400', { headers: H }).then(r => r.json()).catch(() => []);
    if (!Array.isArray(rows)) return { statusCode: 200, body: JSON.stringify({ error: 'row fetch failed' }) };
    const orgCache = {};
    for (const row of rows) {
      out.checked++;
      try {
        const d = await fetch(PD + '/deals/' + row.pipedrive_deal_id + '?api_token=' + PDT).then(r => r.json()).then(j => j && j.data).catch(() => null);
        if (!d || !d.org_id || !d.org_id.name) { out.noOrg++; continue; }
        const orgName = d.org_id.name;
        const oid = d.org_id.value || d.org_id;
        if (!orgCache[oid]) {
          orgCache[oid] = await fetch(PD + '/organizations/' + oid + '?api_token=' + PDT).then(r => r.json()).then(j => j && j.data).catch(() => null);
        }
        const od = orgCache[oid];
        let orgEmail = od ? od[ORG_EMAIL_FIELD] : null;
        if (orgEmail && typeof orgEmail === 'object') orgEmail = orgEmail.value || (Array.isArray(orgEmail) ? (orgEmail[0] && (orgEmail[0].value || orgEmail[0])) : null);
        const hasEmail = !!(orgEmail && String(orgEmail).includes('@'));
        const isConsultantReferral = !!(od && od.label === 2993);
        const isAffiliate = isConsultantReferral || hasEmail;
        const patch = { referrer_org: orgName, is_affiliate_deal: isAffiliate, org_email: hasEmail ? String(orgEmail) : null, org_has_email: hasEmail };
        if (isAffiliate) { out.affiliate.push({ client: row.client_name, date: row.payment_date, consultant: row.consultant_name, amount: row.amount, org: orgName }); } else { out.organic++; }
        if (!dry) {
          await fetch(SUPABASE_URL + '/rest/v1/consultant_payments?id=eq.' + row.id, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        }
      } catch (e) { out.errors++; }
    }
  } catch (e) { out.fatal = String(e.message).slice(0, 150); }
  return { statusCode: 200, body: JSON.stringify({ dry, checked: out.checked, wouldFlagAffiliate: out.affiliate.length, organic: out.organic, noOrg: out.noOrg, errors: out.errors, affiliate: out.affiliate.slice(0, 40) }) };
};
