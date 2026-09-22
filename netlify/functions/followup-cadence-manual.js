// netlify/functions/followup-cadence-manual.js
// AUTOPILOT FOLLOW-UP CADENCE (Joe 9/22) - replaces the Zapier D-activity chain.
//
// Two things happen, and nothing else:
//   1. A D activity is marked done  -> create the NEXT step in the ladder.
//   2. A deal lands in an autopilot stage -> start the ladder at D2 (first
//      contact already happened before the move, so D1 is skipped).
//      Moving between autopilot stages deletes the old stage's open D first.
//
// Rules Joe set 9/22:
//   - Due date = completion date + the gap between the two D numbers. Late
//     clears slide the whole chain. Sunday pushes to Monday.
//   - Only a person deleting the activity stops a chain. Pause-automation
//     stages do NOT stop it (they only stop texts and emails).
//   - Activity TYPE stays the D type so every existing filter keeps working.
//     Subject reads "<Stage> Day <n>".
//   - Owner = the deal owner.
//
// ?preview=1 (default) reports what it WOULD do and writes nothing.
// ?live=1 actually creates/deletes. Key required either way.

const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN || process.env.PD_API_TOKEN || process.env.PIPEDRIVE_API_KEY;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-API-Key', 'Content-Type': 'application/json' };

// Joe's ladder, 9/22. The number IS the day number and the type key (D11 -> 'd11').
const STEPS = [1, 2, 3, 4, 6, 8, 11, 14, 18, 22, 27, 32, 37, 42, 49, 56, 63, 70, 84, 98, 112, 126, 140, 154, 168, 189, 210, 231, 252, 282, 312, 342, 372];
const FIRST_STEP = 2; // D1 is skipped on arrival: first contact happened before the move
const STAGES = { 580: 'New Lead', 581: 'Reports', 588: 'Quoted' };
// A chain keeps running after a deal leaves autopilot (only a delete stops it),
// so the subject falls back to the deal's CURRENT pipeline name - Joe's spec is
// "pipeline name + day number". Friendly labels for the three autopilot ones.
const PIPELINE_LABEL = { 21: 'New Lead', 37: 'Reports', 42: 'Quoted' };
let _pipelineNames = null;
async function pipelineLabel(pipelineId) {
  if (!pipelineId) return null;
  if (PIPELINE_LABEL[pipelineId]) return PIPELINE_LABEL[pipelineId];
  if (!_pipelineNames) {
    try {
      const j = await pd('/pipelines');
      _pipelineNames = {};
      for (const p of (j.data || [])) _pipelineNames[p.id] = p.name;
    } catch (e) { _pipelineNames = {}; }
  }
  const raw = _pipelineNames[pipelineId];
  if (!raw) return null;
  // "C.R.S." -> "C.R.S.", "SOLD" -> "Sold", "Quoted 2.0" -> "Quoted"
  const cleaned = String(raw).replace(/\s*2\.0\s*$/i, '').trim();
  return /[a-z]/.test(cleaned) ? cleaned : cleaned.charAt(0) + cleaned.slice(1).toLowerCase();
}
const TYPE_LIST = STEPS.map(n => 'd' + n).join(',');

function nextStepAfter(n) {
  const i = STEPS.indexOf(Number(n));
  if (i === -1 || i === STEPS.length - 1) return null;
  return STEPS[i + 1];
}
function stepFromType(t) {
  const m = /^d(\d+)$/.exec(String(t || '').trim().toLowerCase());
  if (!m) return null;
  const n = Number(m[1]);
  return STEPS.includes(n) ? n : null;
}
// Dates are handled as plain YYYY-MM-DD at UTC noon so DST never shifts a day.
function toDate(ymd) { return new Date(String(ymd).slice(0, 10) + 'T12:00:00Z'); }
function ymd(d) { return d.toISOString().slice(0, 10); }
function addDays(ymdStr, days) { const d = toDate(ymdStr); d.setUTCDate(d.getUTCDate() + Number(days)); return ymd(d); }
function skipSunday(ymdStr) { return toDate(ymdStr).getUTCDay() === 0 ? addDays(ymdStr, 1) : ymdStr; }
function dueForNext(fromStep, toStep, completedYmd) {
  return skipSunday(addDays(completedYmd, Number(toStep) - Number(fromStep)));
}
function subjectFor(prefix, step) { return `${prefix} Day ${step}`; }
function prefixFromSubject(s) {
  const m = /^(.*?)\s+Day\s+\d+$/i.exec(String(s || '').trim());
  return m ? m[1] : null;
}

async function pd(path, method, body) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: method || 'GET' };
  if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  const res = await fetch(`https://api.pipedrive.com/v1${path}${sep}api_token=${PD_TOKEN}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PD ${opts.method} ${path.split('?')[0]} -> ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}
// Every open D activity on a deal. This is the duplicate guard: a deal never
// gets a second live step while one is already open.
// 9/22: the first cut asked /activities?deal_id=... which IGNORES the deal
// filter and hands back a global list - the preview showed every deal
// reporting the same 100 activities, so nothing could ever advance. The deal's
// own activities endpoint is the one that actually scopes to the deal.
async function openDsForDeal(dealId) {
  const j = await pd(`/deals/${dealId}/activities?done=0&limit=100`);
  const rows = (j && j.data) || [];
  return rows.filter(a => stepFromType(a.type) !== null);
}

// WHAT CHANGED SINCE X (9/22): the first cut paged every completed D activity
// over a 400 day window and blew the function's time limit. Pipedrive has a
// "recents" feed built for exactly this, so each run only looks at what moved
// since the last run.
async function recents(sinceIso, items) {
  const out = [];
  const since = sinceIso.replace('T', ' ').slice(0, 19);
  for (let start = 0; start < 2000; start += 500) {
    const j = await pd(`/recents?since_timestamp=${encodeURIComponent(since)}&items=${items}&start=${start}&limit=500`);
    const batch = (j && j.data) || [];
    out.push(...batch);
    if (!(j.additional_data && j.additional_data.pagination && j.additional_data.pagination.more_items_in_collection)) break;
  }
  return out;
}

async function run(params) {
  // CUTOVER SWITCH: stays a preview until CADENCE_LIVE=1 is set in Netlify (or
  // ?live=1 is passed by hand). Joe turns the Zaps off, then this goes on.
  const live = params.live === '1' || params.live === 'true' || process.env.CADENCE_LIVE === '1';
  const hours = Math.min(parseInt(params.hours || '24', 10) || 24, 24 * 7);
  const sinceMs = Date.now() - hours * 3600000;
  const sinceIso = new Date(sinceMs).toISOString();
  const budgetMs = Math.min(parseInt(params.budget_ms || '20000', 10) || 20000, 24000);
  const t0 = Date.now();
  const timeLeft = () => (Date.now() - t0) < budgetMs;
  const out = { build: 'cadence-v5', mode: live ? 'LIVE' : 'preview', window_hours: hours, since: sinceIso, advanced: [], started: [], moved: [], skipped: [], errors: [], truncated: false };

  // ---- 1. ADVANCE: D activities completed since the window opened ----
  let acts = [];
  try {
    const raw = await recents(sinceIso, 'activity');
    acts = raw.map(r => r.data || r).filter(a => a && a.done === true && stepFromType(a.type) !== null);
  } catch (e) { out.errors.push('recents(activity): ' + e.message); }
  out.completed_in_window = acts.length;
  // One deal can have several steps cleared in the same window; only the
  // newest matters, and a cap keeps a single run inside its time budget.
  const maxPerRun = Math.min(parseInt(params.max || '40', 10) || 40, 200);
  const byDeal = new Map();
  for (const a of acts) {
    if (!a.deal_id) continue;
    const prev = byDeal.get(a.deal_id);
    const t = new Date(String(a.marked_as_done_time || a.update_time || 0).replace(' ', 'T') + 'Z').getTime();
    if (!prev || t > prev._t) { a._t = t; byDeal.set(a.deal_id, a); }
  }
  const candidates = Array.from(byDeal.values()).sort((x, y) => (x._t || 0) - (y._t || 0));
  out.deals_with_a_cleared_step = candidates.length;
  if (candidates.length > maxPerRun) { out.truncated = true; }

  for (const act of candidates.slice(0, maxPerRun)) {
    if (!timeLeft()) { out.truncated = true; break; }
    try {
      if (!act.deal_id) { out.skipped.push({ activity: act.id, why: 'no deal attached' }); continue; }
      const step = stepFromType(act.type);
      const next = nextStepAfter(step);
      if (next === null) { out.skipped.push({ activity: act.id, deal: act.deal_id, why: 'D372 is the last step' }); continue; }
      const stillOpen = await openDsForDeal(act.deal_id);
      if (stillOpen.length) { out.skipped.push({ activity: act.id, deal: act.deal_id, why: `deal already has ${stillOpen.length} open D (${stillOpen.map(x => x.type).join(',')})` }); continue; }
      const deal = (await pd(`/deals/${act.deal_id}`)).data || {};
      // DELETED DEALS (Joe 9/22, caught in preview on Sollie Davis 271148): a
      // chain must never add work to a deal that has been deleted.
      if (!deal.id || deal.status === 'deleted' || deal.active_flag === false) {
        out.skipped.push({ activity: act.id, deal: act.deal_id, why: `deal is ${deal.status || 'gone'}` });
        continue;
      }
      const prefix = STAGES[deal.stage_id] || (await pipelineLabel(deal.pipeline_id)) || prefixFromSubject(act.subject) || 'Follow Up';
      const completedYmd = ymd(new Date(String(act.marked_as_done_time || act.update_time).replace(' ', 'T') + 'Z'));
      const due = dueForNext(step, next, completedYmd);
      const owner = (deal.user_id && (deal.user_id.id || deal.user_id.value)) || act.user_id;
      const plan = { deal: act.deal_id, client: deal.title || null, from: 'D' + step, to: 'D' + next, completed: completedYmd, due, type: 'd' + next, subject: subjectFor(prefix, next), owner };
      if (live) {
        const created = await pd('/activities', 'POST', {
          subject: plan.subject, type: 'd' + next, due_date: due, deal_id: act.deal_id,
          person_id: deal.person_id ? (deal.person_id.value || deal.person_id) : undefined,
          user_id: owner, done: 0
        });
        plan.created_activity = created.data && created.data.id;
      }
      out.advanced.push(plan);
    } catch (e) { out.errors.push(`advance ${act.id}: ${e.message}`); }
  }

  // ---- 2. ARRIVALS + STAGE MOVES: deals that changed since the window opened ----
  let deals = [];
  try {
    const raw = await recents(sinceIso, 'deal');
    deals = raw.map(r => r.data || r).filter(d => d && STAGES[d.stage_id] && d.status === 'open');
  } catch (e) { out.errors.push('recents(deal): ' + e.message); }
  out.deals_changed_in_window = deals.length;

  const maxDeals = Math.min(parseInt(params.max || '40', 10) || 40, 200);
  for (const deal of deals.slice(0, maxDeals)) {
    if (!timeLeft()) { out.truncated = true; break; }
    try {
      if (deal.status === 'deleted' || deal.active_flag === false) { out.skipped.push({ deal: deal.id, why: 'deal is deleted' }); continue; }
      const changed = deal.stage_change_time || deal.add_time;
      if (!changed || new Date(String(changed).replace(' ', 'T') + 'Z').getTime() < sinceMs) { continue; }
      const prefix = STAGES[deal.stage_id];
      const open = await openDsForDeal(deal.id);
      const mine = open.filter(a => (prefixFromSubject(a.subject) || prefix) === prefix);
      const foreign = open.filter(a => (prefixFromSubject(a.subject) || prefix) !== prefix);
      if (mine.length) { out.skipped.push({ deal: deal.id, why: `already running in ${prefix} (${mine.map(x => x.type).join(',')})` }); continue; }
      const due = skipSunday(addDays(ymd(new Date()), 1));
      const plan = {
        deal: deal.id, client: deal.title || null, stage: prefix, start_at: 'D' + FIRST_STEP, due,
        type: 'd' + FIRST_STEP, subject: subjectFor(prefix, FIRST_STEP),
        owner: (deal.user_id && (deal.user_id.id || deal.user_id.value)) || deal.user_id || null,
        moved_into_stage: changed,
        deleting_old: foreign.map(a => ({ activity: a.id, subject: a.subject, type: a.type }))
      };
      if (live) {
        for (const f of foreign) {
          try { await pd(`/activities/${f.id}`, 'DELETE'); } catch (e) { out.errors.push(`delete ${f.id}: ${e.message}`); }
        }
        const created = await pd('/activities', 'POST', {
          subject: plan.subject, type: 'd' + FIRST_STEP, due_date: due, deal_id: deal.id,
          person_id: deal.person_id ? (deal.person_id.value || deal.person_id) : undefined,
          user_id: plan.owner, done: 0
        });
        plan.created_activity = created.data && created.data.id;
      }
      (foreign.length ? out.moved : out.started).push(plan);
    } catch (e) { out.errors.push(`deal ${deal.id}: ${e.message}`); }
  }

  out.elapsed_ms = Date.now() - t0;
  out.summary = {
    would_advance: out.advanced.length, would_start: out.started.length,
    would_move: out.moved.length, skipped: out.skipped.length, errors: out.errors.length, truncated: out.truncated
  };
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const params = event.queryStringParameters || {};
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || params.key;
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid API key' }) };
  try {
    const result = await run(params);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// exported for local tests
exports._test = { nextStepAfter, stepFromType, dueForNext, skipSunday, addDays, subjectFor, prefixFromSubject, STEPS, FIRST_STEP };
