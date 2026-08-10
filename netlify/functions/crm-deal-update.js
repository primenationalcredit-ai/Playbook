// crm-deal-update.js - deal stage moves (CRM migration, Joe 8/10).
// GET ?action=stages -> the live pipeline/stage catalog (PD, cached 1h in app_cache).
// POST {action:'move', deal_id, stage_id} -> PD first (stage automations fire
// natively, incl. pointscrm TrackStagesDeals), then instant crm_deals mirror.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

async function stageCatalog() {
  const KEY = 'crm_stages_catalog';
  try {
    const rows = await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${KEY}&select=cache_value,updated_at`, { headers: H }).then(r => r.json());
    if (rows && rows[0] && (Date.now() - new Date(rows[0].updated_at).getTime()) < 3600000) return JSON.parse(rows[0].cache_value);
  } catch (_) {}
  const pj = await fetch(`https://api.pipedrive.com/v1/pipelines?api_token=${PD}`).then(r => r.json());
  const sj = await fetch(`https://api.pipedrive.com/v1/stages?limit=500&api_token=${PD}`).then(r => r.json());
  const pipelines = (pj.data || []).map(p => ({ id: p.id, name: p.name, stages: [] }));
  const byId = {}; for (const p of pipelines) byId[p.id] = p;
  for (const s of (sj.data || [])) if (byId[s.pipeline_id]) byId[s.pipeline_id].stages.push({ id: s.id, name: s.name });
  const cat = { pipelines };
  try {
    await fetch(`${SU}/rest/v1/app_cache?on_conflict=cache_key`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ cache_key: KEY, cache_value: JSON.stringify(cat), updated_at: new Date().toISOString() }]) });
  } catch (_) {}
  return cat;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      if ((event.queryStringParameters || {}).action !== 'stages') return respond(400, { error: 'action=stages' });
      return respond(200, await stageCatalog());
    }
    if (event.httpMethod !== 'POST') return respond(405, { error: 'POST or GET' });
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return respond(401, { error: 'no session' });
    const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: authHeader } });
    if (!uRes.ok) return respond(401, { error: 'invalid session' });
    const body = JSON.parse(event.body || '{}');
    if (body.action !== 'move') return respond(400, { error: 'action must be move' });
    const dealId = parseInt(body.deal_id), stageId = parseInt(body.stage_id);
    if (!dealId || !stageId) return respond(400, { error: 'deal_id and stage_id required' });
    const pdRes = await fetch(`https://api.pipedrive.com/v1/deals/${dealId}?api_token=${PD}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: stageId }) });
    const pdJson = await pdRes.json().catch(() => ({}));
    if (!pdJson.success) return respond(502, { error: `Pipedrive: ${pdJson.error || pdRes.status}` });
    const cat = await stageCatalog();
    let stageName = null, pipelineId = null, pipelineName = null;
    for (const p of cat.pipelines) for (const st of p.stages) if (st.id === stageId) { stageName = st.name; pipelineId = p.id; pipelineName = p.name; }
    await fetch(`${SU}/rest/v1/crm_deals?pipedrive_deal_id=eq.${dealId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ stage_id: stageId, stage_name: stageName, pipeline_id: pipelineId, pipeline_name: pipelineName, stage_entered_at: new Date().toISOString(), synced_at: new Date().toISOString() }) });
    return respond(200, { ok: true, stage_name: stageName, pipeline_id: pipelineId, pipeline_name: pipelineName });
  } catch (e) { return respond(500, { error: e.message }); }
};
