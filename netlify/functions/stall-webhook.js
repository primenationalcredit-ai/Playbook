// netlify/functions/stall-webhook.js
//
// ASAP Credit Repair - Stall Real-Time Webhook
// --------------------------------------------
// Receives webhooks from Pipedrive when a DEAL or PERSON is updated, and keeps
// the stall_clients table current in real time. One record per event, no scans.
//
// Register TWO Pipedrive webhooks pointing here:
//   updated.deal    (catches stage/pipeline/round-date changes)
//   updated.person  (catches Update Status / Account Manager changes)
//
// Stall rules (per Astrid, identical to am-pipeline-cache):
//   Population = OPEN deal in CRS(45)/Incomplete(71), has an AM, latest round
//     STARTED 45-90 days ago.
//   Stalled = in population AND Update Status = "LOGINS NOT READY (INDIVIDUAL)"
//     (option 934) AND latest round ENDED >= 14 days ago.
//
// On each event it recomputes ONE client and either upserts their row (if in the
// population) or deletes it (if no longer in the population). A separate daily
// sweep (stall-daily-sweep.js) handles time-based transitions that fire no event.
//
// Env vars (same ones the other functions use):
//   PIPEDRIVE_API_KEY, PIPEDRIVE_DOMAIN,
//   VITE_SUPABASE_URL / SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   STALL_WEBHOOK_SECRET (optional Basic-auth shared secret)

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STALL_WEBHOOK_SECRET = process.env.STALL_WEBHOOK_SECRET;

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';
const LOGINS_NOT_READY = 934;
const STALL_MIN_DAYS = 14;
const START_WINDOW_MIN_DAYS = 45;
const START_WINDOW_MAX_DAYS = 90;

const ROUND_KEYS = [
  '6979c70df67f42c28dfcff39284ae17d564d600f',
  'ff3697496664744d64d9f290766f919f40c23aa0',
  '8d681007c089ee4c7390c02ee2f027ca60374708',
];
const PIPELINE_IDS = new Set([45, 71]);
const PIPELINE_NAMES = { 45: 'CRS', 71: 'Incomplete' };

const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
const SUPABASE_HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
}
function respond(statusCode, body) { return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) }; }

function parseDate(v) {
  if (!v) return null;
  const s = String(typeof v === 'object' ? (v.value || v.until || '') : v).slice(0, 10);
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a, b) { return Math.floor((a - b) / 86400000); }
function statusIdOf(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object') return Number(v.id || v.value || 0) || 0;
  return Number(v) || 0;
}
function amNameOf(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.trim() || null;
  return (v.name || v.value || '').toString().trim() || null;
}
function roundDates(deal) {
  let maxStart = null, maxEnd = null;
  for (const k of ROUND_KEYS) {
    const s = parseDate(deal[k]);
    const e = parseDate(deal[k + '_until']);
    if (s && (!maxStart || s > maxStart)) maxStart = s;
    if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
  }
  return { maxStart, maxEnd };
}
async function pdGet(path) {
  const url = `${baseUrl}${path}${path.includes('?') ? '&' : '?'}api_token=${PIPEDRIVE_API_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return j.success ? j.data : null;
  } catch (e) { return null; }
}

// Pick the client's most relevant OPEN deal in CRS/Incomplete: newest round start wins.
function pickBestDeal(deals) {
  let best = null, bestStart = null;
  for (const d of deals || []) {
    if (d.status !== 'open') continue;
    if (!PIPELINE_IDS.has(Number(d.pipeline_id))) continue;
    const { maxStart, maxEnd } = roundDates(d);
    if (!maxStart) continue;
    if (!best || maxStart > bestStart) { best = { deal: d, maxStart, maxEnd }; bestStart = maxStart; }
  }
  return best;
}

async function upsertRow(row) {
  // Upsert on deal_id (merge duplicates).
  const r = await fetch(`${SUPABASE_URL}/rest/v1/stall_clients?on_conflict=deal_id`, {
    method: 'POST',
    headers: { ...SUPABASE_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([row]),
  });
  return r.ok;
}
async function deleteByDeal(dealId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/stall_clients?deal_id=eq.${dealId}`, { method: 'DELETE', headers: SUPABASE_HEADERS });
  return r.ok || r.status === 404;
}
async function deleteByPerson(personDealIds) {
  // remove any stall rows for this person's deals that are no longer in-population
  for (const id of personDealIds) await deleteByDeal(id);
}

// Given a person object + their best open CRS/Incomplete deal, compute the row (or null if not in population).
function computeRow(person, best) {
  if (!best) return null;
  const now = new Date();
  const daysSinceStart = best.maxStart <= now ? daysBetween(now, best.maxStart) : null;
  if (daysSinceStart === null || daysSinceStart < START_WINDOW_MIN_DAYS || daysSinceStart > START_WINDOW_MAX_DAYS) return null;
  const am = amNameOf(person[ACCOUNT_MANAGER_FIELD]);
  if (!am) return null;
  const statusId = statusIdOf(person[UPDATE_STATUS_FIELD]);
  const roundEnded = !!(best.maxEnd && best.maxEnd <= now);
  const daysSinceEnd = roundEnded ? daysBetween(now, best.maxEnd) : null;
  const isStalled = statusId === LOGINS_NOT_READY && roundEnded && daysSinceEnd >= STALL_MIN_DAYS;
  return {
    deal_id: best.deal.id,
    client_name: (person.name || '').slice(0, 120),
    account_manager: am.slice(0, 80),
    update_status: (typeof person[UPDATE_STATUS_FIELD] === 'object' ? (person[UPDATE_STATUS_FIELD]?.name || String(statusId)) : String(person[UPDATE_STATUS_FIELD] ?? '')).slice(0, 80),
    pipeline: PIPELINE_NAMES[Number(best.deal.pipeline_id)] || null,
    round_start: best.maxStart.toISOString().slice(0, 10),
    round_end: best.maxEnd ? best.maxEnd.toISOString().slice(0, 10) : null,
    days_since_start: daysSinceStart,
    days_since_end: daysSinceEnd,
    in_population: true,
    is_stalled: isStalled,
    synced_at: new Date().toISOString(),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' };
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return respond(500, { error: 'Supabase not configured' });

  if (STALL_WEBHOOK_SECRET) {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Basic ')) return respond(401, { error: 'Missing webhook authentication' });
    const decoded = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [, password] = decoded.split(':');
    if (password !== STALL_WEBHOOK_SECRET) return respond(401, { error: 'Invalid webhook credentials' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (err) { return respond(400, { error: 'Invalid JSON' }); }

  // Pipedrive: { event: "updated.deal"|"updated.person", current: {...}, previous: {...} }
  const evt = payload.event || '';
  const current = payload.current || payload.data;
  if (!current || !current.id) return respond(200, { skipped: true, reason: 'No object in payload' });

  try {
    // ----- PERSON event: recompute this person's best deal -----
    if (evt.includes('person')) {
      const person = await pdGet(`/persons/${current.id}`);
      if (!person) return respond(200, { skipped: true, reason: 'person fetch failed' });
      const deals = await pdGet(`/persons/${current.id}/deals?status=open&limit=100`);
      const dealIds = (deals || []).map(d => d.id);
      const best = pickBestDeal(deals);
      const row = computeRow(person, best);
      if (row) { await upsertRow(row); return respond(200, { ok: true, action: 'upsert', deal_id: row.deal_id, is_stalled: row.is_stalled }); }
      await deleteByPerson(dealIds);
      return respond(200, { ok: true, action: 'removed-or-skip', person_id: current.id });
    }

    const deal = await pdGet(`/deals/${current.id}`) || current;
    const openInScope = deal.status === 'open' && PIPELINE_IDS.has(Number(deal.pipeline_id));
    if (!openInScope) { await deleteByDeal(current.id); return respond(200, { ok: true, action: 'removed (not open/in-scope)', deal_id: current.id }); }
    const personId = deal.person_id && typeof deal.person_id === 'object' ? deal.person_id.value : deal.person_id;
    if (!personId) { await deleteByDeal(current.id); return respond(200, { ok: true, action: 'removed (no person)', deal_id: current.id }); }
    const person = await pdGet(`/persons/${personId}`);
    if (!person) return respond(200, { skipped: true, reason: 'person fetch failed' });
    const { maxStart, maxEnd } = roundDates(deal);
    const best = maxStart ? { deal, maxStart, maxEnd } : null;
    const row = computeRow(person, best);
    if (row) { await upsertRow(row); return respond(200, { ok: true, action: 'upsert', deal_id: row.deal_id, is_stalled: row.is_stalled }); }
    await deleteByDeal(current.id);
    return respond(200, { ok: true, action: 'removed (out of window)', deal_id: current.id });
  } catch (err) {
    return respond(500, { error: err.message, cause: String(err.cause || '') });
  }
};
