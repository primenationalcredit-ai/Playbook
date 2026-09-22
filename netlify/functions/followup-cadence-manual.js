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
async function pdPaged(path, cap) {
  const out = [];
  for (let start = 0; start < (cap || 5000); start += 500) {
    const j = await pd(`${path}&start=${start}&limit=500`);
    const batch = (j && j.data) || [];
    out.push(...batch);
    if (!(j.additional_data && j.additional_data.pagination && j.additional_data.pagination.more_items_in_collection)) break;
  }
  return out;
}

// Every open D activity on a deal. This is the duplicate guard: a deal never
// gets a second live step while one is already open.
async function openDsForDeal(dealId) {
  const j = await pd(`/activities?done=0&user_id=0&type=${TYPE_LIST}&deal_id=${dealId}&limit=100`);
  return (j && j.data) || [];
}

async function run(params) {
  const live = params.live === '1' || params.live === 'true';
  const hours = Math.min(parseInt(params.hours || '24', 10) || 24, 24 * 14);
  const sinceMs = Date.now() - hours * 3600000;
  const out = { mode: live ? 'LIVE' : 'preview', window_hours: hours, advanced: [], started: [], moved: [], skipped: [], errors: [] };

  // ---- 1. ADVANCE: D activities completed inside the window ----
  const doneFrom = ymd(new Date(sinceMs - 400 * 86400000)); // due date can be far in the past
  const doneTo = ymd(new Date(Date.now() + 2 * 86400000));
  let doneActs = [];
  try {
    doneActs = await pdPaged(`/activities?done=1&user_id=0&type=${TYPE_LIST}&start_date=${doneFrom}&end_date=${doneTo}`, 20000);
  } catch (e) { out.errors.push('done pull: ' + e.message); }
  const recentlyDone = doneActs.filter(a => {
    const t = a.marked_as_done_time || a.update_time;
    return t && new Date(String(t).replace(' ', 'T') + 'Z').getTime() >= sinceMs;
  });
  out.completed_in_window = recentlyDone.length;

  for (const act of recentlyDone) {
    try {
      if (!act.deal_id) { out.skipped.push({ activity: act.id, why: 'no deal attached' }); continue; }
      const step = stepFromType(act.type);
      if (step === null) { out.skipped.push({ activity: act.id, why: `type ${act.type} not in the ladder` }); continue; }
      const next = nextStepAfter(step);
      if (next === null) { out.skipped.push({ activity: act.id, deal: act.deal_id, why: 'D372 is the last step' }); continue; }
      const stillOpen = await openDsForDeal(act.deal_id);
      if (stillOpen.length) { out.skipped.push({ activity: act.id, deal: act.deal_id, why: `deal already has ${stillOpen.length} open D (${stillOpen.map(x => x.type).join(',')})` }); continue; }
      const deal = (await pd(`/deals/${act.deal_id}`)).data || {};
      const prefix = STAGES[deal.stage_id] || prefixFromSubject(act.subject) || 'Follow Up';
      const completedYmd = ymd(new Date(String(act.marked_as_done_time || act.update_time).replace(' ', 'T') + 'Z'));
      const due = dueForNext(step, next, completedYmd);
      const owner = (deal.user_id && (deal.user_id.id || deal.user_id.value)) || act.user_id;
      const plan = {
        deal: act.deal_id, client: deal.title || null, from: 'D' + step, to: 'D' + next,
        completed: completedYmd, due, type: 'd' + next, subject: subjectFor(prefix, next), owner
      };
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

  // ---- 2. ARRIVALS: deals that changed into an autopilot stage in the window ----
  for (const stageId of Object.keys(STAGES)) {
    try {
      const deals = await pdPaged(`/deals?stage_id=${stageId}&status=open&sort=update_time%20DESC`, 3000);
      const arrived = deals.filter(d => {
        const t = d.stage_change_time || d.add_time;
        return t && new Date(String(t).replace(' ', 'T') + 'Z').getTime() >= sinceMs;
      });
      for (const deal of arrived) {
        const prefix = STAGES[stageId];
        const open = await openDsForDeal(deal.id);
        const foreign = open.filter(a => (prefixFromSubject(a.subject) || prefix) !== prefix);
        const mine = open.filter(a => (prefixFromSubject(a.subject) || prefix) === prefix);
        if (mine.length) { out.skipped.push({ deal: deal.id, why: `already running in ${prefix} (${mine.map(x => x.type).join(',')})` }); continue; }
        const due = skipSunday(addDays(ymd(new Date()), 1));
        const plan = {
          deal: deal.id, client: deal.title || null, stage: prefix, start_at: 'D' + FIRST_STEP,
          due, type: 'd' + FIRST_STEP, subject: subjectFor(prefix, FIRST_STEP),
          owner: (deal.user_id && (deal.user_id.id || deal.user_id.value)) || null,
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
      }
    } catch (e) { out.errors.push(`stage ${stageId}: ${e.message}`); }
  }

  out.summary = {
    would_advance: out.advanced.length, would_start: out.started.length,
    would_move: out.moved.length, skipped: out.skipped.length, errors: out.errors.length
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
