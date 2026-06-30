// netlify/functions/cs-deals-webhook.js
//
// ASAP Credit Repair - CS Deals Real-Time Webhook
// ------------------------------------------------
// Receives webhooks from Pipedrive when a deal is added or updated and keeps the
// cs_deals table current in real time, so the CSR report dashboard reflects pulls
// the moment they happen instead of waiting on a manual/initial sync.
//
// What it does on each deal add/update:
//   1. Resolves the deal's Call Center Rep, Account Manager, Monitoring Site,
//      pipeline name, and stage name (same field mapping as cs-deals-initial-sync.js).
//   2. Upserts the row into cs_deals (merge on deal_id).
//   3. Stamps monitoring_site_set_at = NOW the first time a monitoring site appears
//      on the deal (i.e. the moment a report is pulled). This is the date the CSR
//      report bonus uses to credit a report to a month, which nothing set before.
//   4. Also records monitoring_site_set_pipeline / monitoring_site_set_stage at that
//      moment, so the report is gated by where it was when pulled, not where it ends up.
//
// This is SEPARATE from pipedrive-webhook.js (which creates payment links). Register
// it as its own Pipedrive webhook so the two never interfere.
//
// Required env vars (reuses the same ones the other functions use):
//   PIPEDRIVE_API_KEY            - Pipedrive API token
//   PIPEDRIVE_DOMAIN             - api subdomain (default asapcreditrepairusa)
//   VITE_SUPABASE_URL / SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   CS_WEBHOOK_SECRET            - optional shared secret for Basic-auth on the webhook

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CS_WEBHOOK_SECRET = process.env.CS_WEBHOOK_SECRET;

// Same custom-field IDs the initial sync uses.
const CALL_CENTER_REP_FIELD = 'fee42f0cb3d515239d602de62533887bfd58d384';
const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const MONITORING_SITE_FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';

const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

const SUPABASE_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}
function respond(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

// Resolve option-id / stage-id / pipeline-id to readable names.
async function loadMaps() {
  const maps = { ms: {}, stage: {}, pipeline: {} };
  try {
    const r = await fetch(`${baseUrl}/dealFields?api_token=${PIPEDRIVE_API_KEY}&limit=500`);
    if (r.ok) {
      const f = await r.json();
      const field = (f.data || []).find(x => x.key === MONITORING_SITE_FIELD);
      for (const opt of (field && field.options ? field.options : [])) maps.ms[String(opt.id)] = opt.label;
    }
  } catch (e) {}
  try {
    const r = await fetch(`${baseUrl}/stages?api_token=${PIPEDRIVE_API_KEY}&limit=500`);
    if (r.ok) { const s = await r.json(); for (const st of (s.data || [])) maps.stage[String(st.id)] = st.name; }
  } catch (e) {}
  try {
    const r = await fetch(`${baseUrl}/pipelines?api_token=${PIPEDRIVE_API_KEY}`);
    if (r.ok) { const p = await r.json(); for (const pl of (p.data || [])) maps.pipeline[String(pl.id)] = pl.name; }
  } catch (e) {}
  return maps;
}

async function pipedriveGet(path) {
  const url = `${baseUrl}${path}?api_token=${PIPEDRIVE_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) { console.error(`Pipedrive GET ${path} failed:`, r.status); return null; }
  const j = await r.json();
  return j.success ? j.data : null;
}

// Read the existing cs_deals row (if any) so we know whether the monitoring site
// was already set previously (and keep the original set-date rather than overwriting it).
async function getExistingRow(dealId) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/cs_deals?deal_id=eq.${dealId}&select=deal_id,monitoring_site,monitoring_site_set_at,monitoring_site_set_pipeline,monitoring_site_set_stage&limit=1`,
      { headers: SUPABASE_HEADERS }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' };
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) return respond(500, { error: 'Supabase not configured' });

  // Optional Basic-auth check (username anything, password = CS_WEBHOOK_SECRET).
  if (CS_WEBHOOK_SECRET) {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Basic ')) return respond(401, { error: 'Missing webhook authentication' });
    const decoded = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [, password] = decoded.split(':');
    if (password !== CS_WEBHOOK_SECRET) return respond(401, { error: 'Invalid webhook credentials' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (err) { return respond(400, { error: 'Invalid JSON' }); }

  // Pipedrive sends: { event: "updated.deal" | "added.deal", current: {...}, previous: {...} }
  const current = payload.current || payload.data;
  const previous = payload.previous || null;
  if (!current || !current.id) return respond(200, { skipped: true, reason: 'No deal in payload' });

  const dealId = current.id;

  try {
    const maps = await loadMaps();

    // IMPORTANT: Pipedrive webhook payloads do not reliably include custom-field values (and when
    // they do, they can be keyed/typed differently than the API). So we fetch the deal fresh from the
    // API to get authoritative current values for the monitoring site, pipeline, and stage. We still
    // use the webhook's `previous` snapshot below only to detect that a change occurred.
    const freshDeal = await pipedriveGet(`/deals/${dealId}`);
    const dealData = freshDeal || current; // fall back to payload if the fetch fails

    // Resolve monitoring site from the freshly fetched deal (option id -> label).
    const msRaw = dealData[MONITORING_SITE_FIELD];
    const msId = msRaw && typeof msRaw === 'object' ? (msRaw.id || msRaw.value) : msRaw;
    const monitoringSite = (msId !== null && msId !== undefined && msId !== '')
      ? (maps.ms[String(msId)] || String(msId)) : null;

    // Resolve the rep + AM from the person record (custom fields live on the person).
    let callCenterRepId = null, callCenterRepName = null, accountManagerId = null, accountManagerName = null;
    const personId = dealData.person_id && typeof dealData.person_id === 'object'
      ? dealData.person_id.value : dealData.person_id;
    if (personId) {
      const person = await pipedriveGet(`/persons/${personId}`);
      if (person) {
        const repField = person[CALL_CENTER_REP_FIELD];
        if (repField) {
          callCenterRepId = typeof repField === 'object' ? (repField.id || repField.value) : repField;
          callCenterRepName = typeof repField === 'object' ? repField.name : repField;
        }
        const amField = person[ACCOUNT_MANAGER_FIELD];
        if (amField) {
          accountManagerId = typeof amField === 'object' ? (amField.id || amField.value) : amField;
          accountManagerName = typeof amField === 'object' ? amField.name : amField;
        }
      }
    }

    const pipelineName = maps.pipeline[String(dealData.pipeline_id)] || null;
    const stageName = maps.stage[String(dealData.stage_id)] || null;

    // ===== CREDIT RULE (per Joe) =====
    // A report is credited (monitoring_site_set_at stamped to NOW) ONLY when BOTH are true:
    //   1. The monitoring site genuinely CHANGED on this event (previous payload had no site, current
    //      does). A mere update to an already-set deal does NOT credit. This is what prevents an old
    //      March deal (Marcel) from being re-dated to today when its stage moves.
    //   2. The deal is currently in an early pipeline: New Leads, Reports, or Quoted (2.0). A site set
    //      on a deal already past those stages is not a fresh pull and is not credited here.
    // We never invent a "now" date for old/backfilled deals; if there is no real set-date, we leave it
    // null and the metrics fall back to deal_created_at for bucketing.
    const CREDIT_PIPELINES = ['new leads', 'reports', 'quoted 2.0', 'quoted'];
    const pipelineLower = (pipelineName || '').trim().toLowerCase();
    const inCreditPipeline = CREDIT_PIPELINES.some(p => pipelineLower === p || pipelineLower.includes(p));

    const existing = await getExistingRow(dealId);
    const previousMsRaw = previous ? previous[MONITORING_SITE_FIELD] : undefined;
    const prevHadSite = previousMsRaw !== undefined && previousMsRaw !== null && previousMsRaw !== '';
    // Site genuinely changed on THIS event: previous snapshot present and showed no site, current has one.
    const siteChanged = !!(monitoringSite && previous && !prevHadSite);
    // Credit only when the site just changed AND we are in an early pipeline.
    const shouldCredit = siteChanged && inCreditPipeline;

    let monitoringSiteSetAt = existing && existing.monitoring_site_set_at ? existing.monitoring_site_set_at : null;
    let monitoringSiteSetPipeline = existing && existing.monitoring_site_set_pipeline ? existing.monitoring_site_set_pipeline : null;
    let monitoringSiteSetStage = existing && existing.monitoring_site_set_stage ? existing.monitoring_site_set_stage : null;

    if (shouldCredit) {
      // Genuine fresh pull in an early pipeline: credit it now.
      monitoringSiteSetAt = new Date().toISOString();
      monitoringSiteSetPipeline = pipelineName;
      monitoringSiteSetStage = stageName;
    }
    // Any other case: do NOT touch monitoring_site_set_at. If it was already set (real prior credit),
    // it is preserved above. If it was null, it stays null and the metrics use deal_created_at. We never
    // stamp now or update_time on a deal whose site did not just change.

    const row = {
      deal_id: dealId,
      person_id: personId || null,
      deal_title: dealData.title || current.title || null,
      pipeline_id: dealData.pipeline_id || null,
      pipeline_name: pipelineName,
      stage_id: dealData.stage_id || null,
      stage_name: stageName,
      deal_status: dealData.status || 'open',
      deal_value: dealData.value || 0,
      call_center_rep_id: callCenterRepId,
      call_center_rep_name: callCenterRepName,
      account_manager_id: accountManagerId,
      account_manager_name: accountManagerName,
      monitoring_site: monitoringSite,
      monitoring_site_set_at: monitoringSiteSetAt,
      monitoring_site_set_pipeline: monitoringSiteSetPipeline,
      monitoring_site_set_stage: monitoringSiteSetStage,
      deal_created_at: dealData.add_time || current.add_time || (existing ? undefined : null),
      deal_updated_at: dealData.update_time || current.update_time || new Date().toISOString(),
      synced_at: new Date().toISOString()
    };
    // Don't overwrite deal_created_at with undefined.
    if (row.deal_created_at === undefined) delete row.deal_created_at;

    const upsert = await fetch(`${SUPABASE_URL}/rest/v1/cs_deals?on_conflict=deal_id`, {
      method: 'POST',
      headers: { ...SUPABASE_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row])
    });
    if (!upsert.ok) {
      const errText = await upsert.text();
      console.error('cs-deals-webhook upsert error:', errText);
      return respond(500, { error: 'Upsert failed', detail: errText });
    }

    return respond(200, {
      success: true,
      deal_id: dealId,
      monitoring_site: monitoringSite,
      site_just_set: !!siteJustSet,
      monitoring_site_set_at: monitoringSiteSetAt,
      rep: callCenterRepName
    });
  } catch (err) {
    console.error('cs-deals-webhook error:', err);
    return respond(500, { error: 'Webhook processing failed', message: err.message });
  }
};
