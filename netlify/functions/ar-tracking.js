// netlify/functions/ar-tracking.js
// ADDITIONAL ROUNDS TRACKING (Joe 7/24): every AR client in two buckets -
//   inService:  open deals in ADDITIONAL C.R.S. (pipeline 65) - client, AM/owner, days in service
//   interested: persons marked INTERESTED ADD ROUNDS (1893) or AR Quoted (1890), never SOLD (1901),
//               grouped by Account Manager, each with live campaign state (offer day, stopped, purchased)
// Results cached 10 min in app_cache (key ar_tracking); ?refresh=1 forces rebuild.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const PD_TOKEN = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PD_BASE = 'https://asapcreditrepairusa.pipedrive.com/api/v1';
const F_UPDATE_STATUS = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad'; // 1893 INTERESTED ADD ROUNDS
const F_CURRENT_STATUS = '612856f2221d04679c1809eadb77b30300936445'; // 1890 AR Quoted, 1901 SOLD
const CACHE_KEY = 'ar_tracking';
const CACHE_TTL_MIN = 10;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

async function sb(path, opts) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts && opts.headers ? opts.headers : {}) },
    ...(opts || {})
  });
  const t = await r.text();
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
async function pd(path) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${PD_BASE}${path}${sep}api_token=${PD_TOKEN}`);
  const j = await r.json().catch(() => null);
  return j && j.data !== undefined ? j.data : null;
}
async function pdPost(path, body) {
  const r = await fetch(`${PD_BASE}${path}?api_token=${PD_TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  return j && j.data !== undefined ? j.data : null;
}
async function pdDelete(path) { try { await fetch(`${PD_BASE}${path}?api_token=${PD_TOKEN}`, { method: 'DELETE' }); } catch (e) {} }

async function buildInService() {
  // Temp deals filter: open + pipeline 65 (same proven pattern as the backfills)
  const filt = await pdPost('/filters', {
    name: 'AR tracking temp (deals)', type: 'deals',
    conditions: { glue: 'and', conditions: [ { glue: 'and', conditions: [
      { object: 'deal', field_id: '13', operator: '=', value: '65' } // pipeline
    ] } ] }
  });
  const rows = [];
  try {
    let start = 0, more = true;
    while (more && start < 5000) {
      const pg = await fetch(`${PD_BASE}/deals?filter_id=${filt.id}&status=open&limit=500&start=${start}&api_token=${PD_TOKEN}`);
      const j = await pg.json().catch(() => null);
      const data = (j && j.data) || [];
      for (const d of data) {
        const added = d.add_time ? new Date(d.add_time) : null;
        rows.push({
          deal_id: d.id,
          client: d.title,
          owner: d.user_id && d.user_id.name ? d.user_id.name : null,
          person_id: d.person_id && (d.person_id.value || d.person_id) || null,
          entered: d.add_time || null,
          days_in_service: added ? Math.floor((Date.now() - added.getTime()) / 86400000) : null,
          deal_value: d.value || 0
        });
      }
      const p = j && j.additional_data && j.additional_data.pagination;
      more = p && p.more_items_in_collection; start = p ? p.next_start : 0;
    }
  } finally { if (filt && filt.id) await pdDelete(`/filters/${filt.id}`); }
  rows.sort((a, b) => (b.days_in_service || 0) - (a.days_in_service || 0));
  return rows;
}

async function buildInterested() {
  const pfs = await pd('/personFields?limit=500');
  const usId = (pfs || []).find(f => f.key === F_UPDATE_STATUS);
  const csId = (pfs || []).find(f => f.key === F_CURRENT_STATUS);
  const filt = await pdPost('/filters', {
    name: 'AR tracking temp (people)', type: 'people',
    conditions: { glue: 'and', conditions: [ { glue: 'or', conditions: [
      { object: 'person', field_id: String(usId.id), operator: '=', value: '1893' },
      { object: 'person', field_id: String(csId.id), operator: '=', value: '1890' }
    ] } ] }
  });
  const people = [];
  try {
    let start = 0, more = true;
    while (more && start < 5000) {
      const pg = await fetch(`${PD_BASE}/persons?filter_id=${filt.id}&limit=500&start=${start}&api_token=${PD_TOKEN}`);
      const j = await pg.json().catch(() => null);
      for (const p of ((j && j.data) || [])) {
        if (String(p[F_CURRENT_STATUS]) === '1901') continue; // SOLD - not interested anymore
        people.push({
          person_id: p.id, name: p.name,
          interested: String(p[F_UPDATE_STATUS]) === '1893',
          quoted: String(p[F_CURRENT_STATUS]) === '1890',
          last_update: p.update_time || null
        });
      }
      const pag = j && j.additional_data && j.additional_data.pagination;
      more = pag && pag.more_items_in_collection; start = pag ? pag.next_start : 0;
    }
  } finally { if (filt && filt.id) await pdDelete(`/filters/${filt.id}`); }

  // person -> AM from the cache am-pipeline-cache maintains
  let amMap = {};
  try {
    const c = await sb(`app_cache?cache_key=eq.am_person_to_am&select=cache_value`);
    if (c && c[0]) amMap = JSON.parse(c[0].cache_value) || {};
  } catch (e) {}

  // live campaign state (arc:<person_id> rows)
  const arcState = {};
  try {
    const rows = await sb(`app_cache?cache_key=like.arc:*&select=cache_key,cache_value&limit=2000`);
    for (const r of (rows || [])) {
      try {
        const v = JSON.parse(r.cache_value);
        arcState[String(r.cache_key).replace('arc:', '')] = { status: v.status, last_step: v.last_step, track: v.track, stop_reason: v.stop_reason || null };
      } catch (e) {}
    }
  } catch (e) {}

  const byAm = {};
  for (const p of people) {
    const am = amMap[String(p.person_id)] || 'Unassigned';
    const arc = arcState[String(p.person_id)] || null;
    let campaign = 'not enrolled';
    if (arc) {
      if (arc.status === 'purchased') campaign = 'PURCHASED';
      else if (arc.status === 'stopped') campaign = `stopped (${arc.stop_reason || 'rule'})`;
      else if (arc.status === 'active') campaign = arc.last_step >= 0 ? `offer sent (day ${arc.last_step})` : 'queued';
      else campaign = arc.status;
    }
    if (!byAm[am]) byAm[am] = [];
    byAm[am].push({ ...p, am, campaign });
  }
  for (const am of Object.keys(byAm)) byAm[am].sort((a, b) => String(b.last_update || '').localeCompare(String(a.last_update || '')));
  return byAm;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const params = event.queryStringParameters || {};
  try {
    if (!params.refresh) {
      const cached = await sb(`app_cache?cache_key=eq.${CACHE_KEY}&select=cache_value,updated_at`);
      if (cached && cached[0]) {
        const age = (Date.now() - new Date(cached[0].updated_at).getTime()) / 60000;
        if (age < CACHE_TTL_MIN) return { statusCode: 200, headers, body: cached[0].cache_value };
      }
    }
    const [inService, interestedByAm] = [await buildInService(), await buildInterested()];
    const payload = JSON.stringify({
      built_at: new Date().toISOString(),
      in_service: inService,
      in_service_count: inService.length,
      interested_by_am: interestedByAm,
      interested_count: Object.values(interestedByAm).reduce((s, arr) => s + arr.length, 0)
    });
    await sb(`app_cache?on_conflict=cache_key`, {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ cache_key: CACHE_KEY, cache_value: payload, updated_at: new Date().toISOString() })
    });
    return { statusCode: 200, headers, body: payload };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
