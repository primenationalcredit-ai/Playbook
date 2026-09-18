// monitoring-site-reverse-sweep.js (Joe 9/18, after Araceli's Eyoel Gebrekidan 269142)
// The two existing drift jobs both query cs_deals?monitoring_site=not.is.null - they
// only ever look at deals the Playbook ALREADY knows have a site, and their job is to
// restore Pipedrive when it goes blank. Nothing does the reverse: Pipedrive holds a
// monitoring site, the Playbook's mirror is blank, and the report is invisible to the
// rep's numbers forever. The only route from Pipedrive into the mirror is the live
// webhook, so one missed update means the deal is never examined again. Eyoel's report
// sat uncounted until Araceli noticed. This is the missing half.
// POST, X-API-Key. Body: { since, limit, dry_run }. dry_run DEFAULTS TO TRUE.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PD_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PD_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const PD = 'https://' + PD_DOMAIN + '.pipedrive.com/api/v1';
const MS_FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const SH = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-API-Key', 'Content-Type': 'application/json' };
const respond = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });
const sleep = (ms) => new Promise(function (r) { setTimeout(r, ms); });
exports.handler = async (event) => {
  const scheduled = !event || !event.httpMethod;
  if (!scheduled) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
    const k = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || '';
    if (!INTERNAL_API_KEY || k !== INTERNAL_API_KEY) return respond(401, { error: 'Invalid or missing X-API-Key' });
  }
  let body = {};
  try { body = JSON.parse((event && event.body) || '{}'); } catch (e) {}
  const dryRun = body.dry_run !== false;
  const since = body.since || '2026-08-01';
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 40, 1), 200);
  const report = { dry_run: dryRun, since: since, checked: 0, would_fill: [], filled: [], blank_in_pipedrive_too: 0, errors: [] };
  // Option id -> label, straight from Pipedrive so new options never go unmapped.
  let msMap = {};
  try {
    const fr = await fetch(PD + '/dealFields?api_token=' + PD_KEY + '&limit=500');
    const fj = await fr.json();
    const fld = ((fj && fj.data) || []).find(function (x) { return x.key === MS_FIELD; });
    for (const o of ((fld && fld.options) || [])) msMap[String(o.id)] = o.label;
  } catch (e) { return respond(502, { error: 'could not load the monitoring site options: ' + e.message }); }
  if (!Object.keys(msMap).length) return respond(502, { error: 'monitoring site option map came back empty - refusing to run blind' });
  let rows = [];
  try {
    const q = SUPABASE_URL + '/rest/v1/cs_deals?monitoring_site=is.null&call_center_rep_name=not.is.null&deal_created_at=gte.' + since + '&select=deal_id,deal_title,call_center_rep_name,pipeline_name,stage_name,deal_created_at,deal_updated_at&order=deal_created_at.desc&limit=' + limit;
    rows = await fetch(q, { headers: SH }).then(function (r) { return r.json(); });
    if (!Array.isArray(rows)) return respond(500, { error: 'cs_deals read failed' });
  } catch (e) { return respond(500, { error: 'cs_deals read threw: ' + e.message }); }
  for (const row of rows) {
    report.checked++;
    await sleep(350);
    let deal = null;
    try {
      const dj = await fetch(PD + '/deals/' + row.deal_id + '?api_token=' + PD_KEY).then(function (r) { return r.json(); });
      deal = dj && dj.data;
    } catch (e) { report.errors.push({ deal_id: row.deal_id, error: 'pipedrive: ' + e.message }); continue; }
    if (!deal) { report.errors.push({ deal_id: row.deal_id, error: 'deal fetch returned nothing (rate limit?)' }); continue; }
    const raw = deal[MS_FIELD];
    const optId = raw && typeof raw === 'object' ? (raw.id || raw.value) : raw;
    if (optId === null || optId === undefined || optId === '') { report.blank_in_pipedrive_too++; continue; }
    const label = msMap[String(optId)] || null;
    if (!label) { report.errors.push({ deal_id: row.deal_id, error: 'option ' + optId + ' has no label in the field definition' }); continue; }
    const setAt = row.deal_updated_at || new Date().toISOString();
    const item = { deal_id: row.deal_id, title: row.deal_title, rep: row.call_center_rep_name, site: label, would_credit_month: String(setAt).slice(0, 7), pipeline: row.pipeline_name, stage: row.stage_name };
    if (dryRun) { report.would_fill.push(item); continue; }
    try {
      const upd = { monitoring_site: label, monitoring_site_set_at: setAt, monitoring_site_set_pipeline: row.pipeline_name || null, monitoring_site_set_stage: row.stage_name || null };
      const pr = await fetch(SUPABASE_URL + '/rest/v1/cs_deals?deal_id=eq.' + row.deal_id, { method: 'PATCH', headers: Object.assign({}, SH, { Prefer: 'return=minimal' }), body: JSON.stringify(upd) });
      if (pr.ok) report.filled.push(item);
      else report.errors.push({ deal_id: row.deal_id, error: 'patch failed ' + pr.status });
    } catch (e) { report.errors.push({ deal_id: row.deal_id, error: 'patch threw: ' + e.message }); }
  }
  report.would_fill_count = report.would_fill.length;
  report.filled_count = report.filled.length;
  return respond(200, report);
};