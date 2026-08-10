// crm-compare.js - the daily proof (CRM migration Phase 1, Joe 8/9).
// Pulls everything Pipedrive says changed in the last 24h and verifies each
// record exists in the crm_* mirror at least as fresh. Writes the verdict to
// crm_sync_state (key last_compare) and returns it. Zero missing + zero stale
// = the mirror is provably correct for that day. Guard: ?key= PAYMENT_API_KEY.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

async function pd(path) {
  const r = await fetch(`https://api.pipedrive.com/v1/${path}${path.includes('?') ? '&' : '?'}api_token=${PD}`);
  const j = await r.json().catch(() => ({}));
  if (!j.success) throw new Error(`PD ${path.split('?')[0]}: ${j.error || r.status}`);
  return j;
}
const norm = (t) => (t || '').replace(' ', 'T').slice(0, 19); // "2026-08-09 12:00:00" ~ "2026-08-09T12:00:00"

async function recentPd(endpoint, cutoff, maxPages, extra) {
  const items = []; let start = 0;
  for (let p = 0; p < maxPages; p++) {
    const j = await pd(`${endpoint}?${extra ? extra + '&' : ''}limit=500&start=${start}&sort=update_time DESC`);
    let past = false;
    for (const d of (j.data || [])) {
      if (norm(d.update_time) < cutoff) { past = true; break; }
      items.push({ id: d.id, u: norm(d.update_time) });
    }
    const pag = j.additional_data && j.additional_data.pagination;
    if (past || !(pag && pag.more_items_in_collection)) break;
    start = pag.next_start;
  }
  return items;
}
async function mirrorCheck(table, idCol, items) {
  const missing = [], stale = [];
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const ids = chunk.map(x => x.id).join(',');
    const rows = await fetch(`${SU}/rest/v1/${table}?${idCol}=in.(${ids})&select=${idCol},pd_update_time`, { headers: H }).then(r => r.json()).catch(() => []);
    const byId = {}; for (const r of (Array.isArray(rows) ? rows : [])) byId[r[idCol]] = norm(r.pd_update_time);
    for (const it of chunk) {
      if (!(it.id in byId)) missing.push(it.id);
      else if (byId[it.id] < it.u) stale.push(it.id);
    }
  }
  return { checked: items.length, missing: missing.slice(0, 20), missing_count: missing.length, stale: stale.slice(0, 20), stale_count: stale.length };
}

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  if (q.key !== process.env.PAYMENT_API_KEY) return { statusCode: 401, body: 'unauthorized' };
  const cutoff = norm(new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  const out = { ran_at: new Date().toISOString(), window_start: cutoff };
  try {
    out.persons = await mirrorCheck('crm_clients', 'pipedrive_person_id', await recentPd('persons', cutoff, 4));
    out.deals = await mirrorCheck('crm_deals', 'pipedrive_deal_id', await recentPd('deals', cutoff, 4));
    out.notes = await mirrorCheck('crm_notes', 'pipedrive_note_id', await recentPd('notes', cutoff, 3));
    out.activities = await mirrorCheck('crm_activities', 'pipedrive_activity_id', await recentPd('activities', cutoff, 4, 'user_id=0'));
    out.ok = ['persons', 'deals', 'notes', 'activities'].every(k => out[k].missing_count === 0 && out[k].stale_count === 0);
    await fetch(`${SU}/rest/v1/crm_sync_state?on_conflict=key`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: 'last_compare', value: JSON.stringify(out), updated_at: new Date().toISOString() }]) });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
  } catch (e) {
    out.error = e.message;
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
  }
};
