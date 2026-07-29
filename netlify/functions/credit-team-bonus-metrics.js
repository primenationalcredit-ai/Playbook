// Credit Team Bonus Metrics
// Computes the 5 operational metrics for the monthly $300 team bonus.
// Four run automatically off Pipedrive round date fields + the Reports Received filter;
// Round 3 Results Rate is read from the manual credit_team_bonus table until a source is wired.

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { GoogleAuth } = require('google-auth-library');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1ABQEwlRRLYTszraGaLSDli1MxRZE4adAemWm9UF9aHw';

const CRS_PIPELINE_ID = 45;
const REPORTS_RECEIVED_FILTER = 134716;
const R1_DUE_FILTER = 17093; // Round 1 deals due by the 5th business day; should be empty by 5pm CST
const POOL = 300;

// Daterange custom fields: start lives at the key, end at `${key}_until`.
const F = {
  rd1Start: '6979c70df67f42c28dfcff39284ae17d564d600f',
  rd3Start: '8d681007c089ee4c7390c02ee2f027ca60374708',
  rd4Start: '1d1bc8fbf1b8982640ef70131f010908788a7bd0',
};
const RD3_END = '8d681007c089ee4c7390c02ee2f027ca60374708_until';

// Standards
const STD = { round3_cohort: 80, ontime_r1: 100, day4_delay: 0, fourth_round: 25, round3_results: 80 };

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function parseDate(v) {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(v.length <= 10 ? v + 'T00:00:00Z' : v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysBetween(a, b) { return Math.floor((b - a) / 86400000); }
function businessDaysDiff(start, end) {
  let count = 0; const s = new Date(start);
  while (s < end) { const d = s.getUTCDay(); if (d !== 0 && d !== 6) count++; s.setUTCDate(s.getUTCDate() + 1); }
  return count;
}

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_API_KEY}`);
  if (!res.ok) throw new Error(`Pipedrive ${res.status}`);
  return res.json();
}

async function supaGet(pathQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return [];
  return res.json();
}

// Round 3 Results Rate from the Master Dispute Tracking sheet (Data tab).
// A row where column C ("Starting Rounds and Round Result") = 3 records that client's Round 3 result;
// column N ("Total Items Removed from this letter") > 0 means results were achieved.
async function fetchRound3ResultsRate(month, debugNames) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  const keyB64 = process.env.GOOGLE_PRIVATE_KEY_B64;
  if (keyB64) { try { key = Buffer.from(keyB64, 'base64').toString('utf8'); } catch (e) {} }
  else if (key) { key = key.split('\\n').join('\n'); }
  if (!email || !key) return null;
  const auth = new GoogleAuth({ credentials: { client_email: email, private_key: key }, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent('Data!A:Z')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token.token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const rows = data.values || [];
  let den = 0, num = 0;
  const clients = [];
  const debugRows = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || Number(r[2]) !== 3) continue;       // Round 3 result row
    const d = new Date(r[0]);
    if (Number.isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (ym !== month) continue;
    den++;
    const removed = Number(r[13]) > 0;
    if (removed) num++;
    clients.push({ name: r[1] || 'Unknown', removed });
  }
  // Debug: dump raw rows for named clients across ALL months (row index, date, name, col C, col N)
  if (debugNames && debugNames.length) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const nm = String(r[1] || '').toLowerCase();
      if (debugNames.some((q) => nm.includes(q))) debugRows.push({ row: i + 1, date: r[0], name: r[1], roundCol: r[2], removedCol: r[13] });
    }
  }
  return { rate: den > 0 ? Math.round((num / den) * 100) : null, num, den, clients, debugRows: debugRows.length ? debugRows : undefined };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const now = new Date();
    const qsMonth = event.queryStringParameters && event.queryStringParameters.month;
    const month = qsMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = month.split('-').map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    const asOf = monthEnd < now ? monthEnd : now;        // don't measure into the future
    const cohortNewest = new Date(asOf.getTime() - 120 * 86400000); // started at least 120 days ago (should be in R3)
    const cohortOldest = new Date(asOf.getTime() - 210 * 86400000); // but no older than 210 days (recent rolling cohort)

    // --- Read cached CRS round dates (filled by credit-team-cache-background) ---
    const SITE = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
    let cache = null;
    try {
      const cr = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.credit_team_round_dates&select=cache_value,updated_at`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      if (cr.ok) { const rows = await cr.json(); if (rows[0]) { cache = JSON.parse(rows[0].cache_value); cache._updatedAt = rows[0].updated_at; } }
    } catch (e) {}

    // Lazily refresh if the cache is missing or older than 6 hours (fire-and-forget).
    const ageMs = cache && cache.scannedAt ? (Date.now() - new Date(cache.scannedAt).getTime()) : Infinity;
    if (ageMs > 6 * 3600 * 1000) {
      fetch(`${SITE}/.netlify/functions/credit-team-cache-background`, { method: 'POST' }).catch(() => {});
    }
    const warming = !cache || !cache.deals;
    const cacheDeals = (cache && cache.deals) || [];

    // --- Metric 1: Round 3 Cohort Rate / Metric 4: 4th Round Started % (both from cached round dates) ---
    // Per Astrid (2026-07-08): clients stuck at Round 1 BECAUSE OF PAYMENT are
    // excluded from the cohort entirely; all other stalls stay counted but are
    // bucketed by reason so the list is actionable.
    const PAYMENT_STATUSES = new Set([1616, 1777]); // OWES MONEY *AUTO PILOT*, RD 1 DONE WANTS RESULTS (OWES MONEY)
    const LOGIN_STATUSES = new Set([934, 937]);     // LOGINS NOT READY (INDIVIDUAL), ******CHECK LOGINS******
    let dealStatusMap = {};
    try {
      const sr = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_deal_status&select=cache_value`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      if (sr.ok) { const rows = await sr.json(); if (rows[0]) dealStatusMap = (JSON.parse(rows[0].cache_value).dealStatus) || {}; }
    } catch (e) {}
    const cohortExcludedPayment = [];
    let cohortDen = 0, cohortNum = 0, r4Den = 0, r4Num = 0;
    const cohortStalled = [], r4Started = [];
    const r3EndWindowStart = new Date(asOf.getTime() - 90 * 86400000); // 4th round: Round 3 ended in last 90 days
    for (const x of cacheDeals) {
      const rd1 = parseDate(x.a), rd2 = parseDate(x.b), rd3 = parseDate(x.c), rd3end = parseDate(x.e), rd4 = parseDate(x.d);
      if (rd1 && rd1 <= cohortNewest && rd1 >= cohortOldest) {
        const stRaw = dealStatusMap[String(x.id)];
        const st = stRaw != null ? Number(stRaw) : null;
        if (!rd2 && !rd3 && st != null && PAYMENT_STATUSES.has(st)) {
          // Stuck at Round 1 on a payment hold: out of the cohort (per Astrid).
          cohortExcludedPayment.push({ name: x.n || `Deal ${x.id}`, dealId: x.id || null, statusId: st });
        } else {
          cohortDen++;
          if (rd3) cohortNum++;
          else {
            const bucket = st != null && PAYMENT_STATUSES.has(st) ? 'payment'
              : st != null && LOGIN_STATUSES.has(st) ? 'logins'
              : rd2 ? 'round2_in_progress' : 'other';
            cohortStalled.push({ name: x.n || `Deal ${x.id}`, dealId: x.id || null, bucket, statusId: st });
          }
        }
      }
      if (rd3end && rd3end >= r3EndWindowStart && rd3end <= asOf) {
        r4Den++;
        if (rd4) { r4Num++; r4Started.push({ name: x.n || `Deal ${x.id}`, dealId: x.id || null }); }
      }
    }
    const round3CohortRate = cohortDen > 0 ? Math.round((cohortNum / cohortDen) * 100) : 0;
    const stallBuckets = { payment: 0, logins: 0, round2_in_progress: 0, other: 0 };
    for (const sb of cohortStalled) stallBuckets[sb.bucket] = (stallBuckets[sb.bucket] || 0) + 1;
    const fourthRoundRate = r4Den > 0 ? Math.round((r4Num / r4Den) * 100) : 0;

    // --- Day 4+ Delay (all rounds): deals in Reports Received past the 4-business-day window ---
    // Fixes (7/10, Marycruz's ticket): (1) only deals whose CURRENT stage is actually
    // Reports Received count - the filter can lag behind stage moves (Missing Docs etc);
    // (2) clients with an open balance are a PAYMENT HOLD, not a team delay; (3) the clock
    // runs from stage_change_time (update_time removed - any deal edit was resetting it).
    let day4Count = 0, queueTotal = 0;
    const day4List = [];
    const day4PaymentHold = [];
    const day4WrongStage = [];
    const day4ClientBlocked = [];
    try {
      const rr = await pdGet(`/deals?filter_id=${REPORTS_RECEIVED_FILTER}&start=0&limit=500`);
      const rrDeals = rr.data || [];
      // Stage ids named Reports Received (any pipeline). If the lookup fails, fall back
      // to trusting the filter rather than zeroing the metric.
      let rrStageIds = null;
      try {
        const st = await pdGet('/stages');
        const ids = (st.data || []).filter(x => /reports\s*received/i.test(x.name || '')).map(x => x.id);
        if (ids.length > 0) rrStageIds = new Set(ids);
      } catch (e) {}
      // Open balances for the queue's deals (payment hold), from the hourly-reconciled mirror.
      const holdDeals = new Set();
      try {
        const ids = rrDeals.map(d => d.id).filter(Boolean);
        for (let c = 0; c < ids.length; c += 100) {
          const chunk = ids.slice(c, c + 100);
          const invs = await supaGet(`consultant_invoices?pipedrive_deal_id=in.(${chunk.join(',')})&balance=gt.1&select=pipedrive_deal_id`);
          for (const inv of invs) holdDeals.add(String(inv.pipedrive_deal_id));
        }
      } catch (e) {}
      // Person Update Status option ids that mean the CLIENT is blocking progress
      // (owes money / missing docs). Matched by label so renamed or new variants
      // (e.g. "OWES MONEY *AUTO PILOT*", "***MISSING DOCS***") are caught automatically.
      const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';
      let blockedStatusIds = new Set();
      try {
        const pf = await pdGet('/personFields');
        const usField = (pf.data || []).find(fl => fl.key === UPDATE_STATUS_FIELD);
        for (const o of (usField && usField.options) || []) {
          if (/owes money|missing docs/i.test(String(o.label || ''))) blockedStatusIds.add(Number(o.id));
        }
      } catch (e) {}
      for (const deal of rrDeals) {
        if (rrStageIds && !rrStageIds.has(deal.stage_id)) {
          day4WrongStage.push({ name: deal.title || `Deal ${deal.id}`, dealId: deal.id });
          continue; // filter lag - deal is really in another stage (e.g. Missing Docs)
        }
        if (holdDeals.has(String(deal.id))) {
          day4PaymentHold.push({ name: deal.title || `Deal ${deal.id}`, dealId: deal.id });
          continue; // client owes money - hold, not a team delay
        }
        queueTotal++;
        const t = deal.stage_change_time || deal.add_time;
        const bd = t ? businessDaysDiff(new Date(t.replace(' ', 'T') + 'Z'), now) : 0;
        if (bd > 4) {
          // Marycruz 7/15: before counting an overdue deal against the team, check the
          // PERSON's Update Status - owes-money / missing-docs clients are excluded.
          let blocked = false;
          if (blockedStatusIds.size > 0) {
            try {
              const pid = deal.person_id && (deal.person_id.value || deal.person_id.id || deal.person_id);
              if (pid) {
                const pr = await pdGet(`/persons/${pid}`);
                const sid = Number(pr && pr.data && pr.data[UPDATE_STATUS_FIELD]) || 0;
                blocked = blockedStatusIds.has(sid);
              }
            } catch (e) {}
          }
          if (blocked) {
            day4ClientBlocked.push({ name: deal.title || `Deal ${deal.id}`, dealId: deal.id, days: bd });
            queueTotal--;
            continue;
          }
          day4Count++; day4List.push({ name: deal.title || `Deal ${deal.id}`, dealId: deal.id, days: bd });
        }
      }
    } catch (e) { /* leave zeros */ }

    // --- On-Time R1: filter 17093 holds Round 1 deals due by the 5th business day; should be empty by 5pm CST ---
    let r1DueCount = 0;
    const r1List = [];
    try {
      let s = 0, m2 = true, p = 0;
      while (m2 && p < 10) {
        const r1 = await pdGet(`/deals?filter_id=${R1_DUE_FILTER}&start=${s}&limit=500`);
        (r1.data || []).forEach((deal) => r1List.push({ name: deal.title || `Deal ${deal.id}`, dealId: deal.id }));
        r1DueCount += (r1.data || []).length;
        m2 = r1.additional_data && r1.additional_data.pagination && r1.additional_data.pagination.more_items_in_collection;
        s = (r1.additional_data && r1.additional_data.pagination && r1.additional_data.pagination.next_start) || (s + 500);
        p++;
      }
    } catch (e) { /* leave zero */ }
    const ontimeR1Rate = r1DueCount === 0 ? 100 : 0;

    // --- Round 3 Results Rate (live from the Master Dispute Tracking sheet; manual fallback) ---
    let results = null, resultsSource = 'manual', resultsDetail = {};
    try {
      const r3 = await fetchRound3ResultsRate(month, (event.queryStringParameters && event.queryStringParameters.debug_names ? String(event.queryStringParameters.debug_names).toLowerCase().split(',').map(x => decodeURIComponent(x).trim()).filter(Boolean) : null));
      if (r3) { results = r3.rate; resultsSource = 'auto'; resultsDetail = { gotResults: r3.num, completed: r3.den, clients: (r3.clients || []).slice(0, 300) }; }
    } catch (e) {}
    if (results == null && resultsSource === 'manual') {
      try {
        const rows = await supaGet(`credit_team_bonus?month=eq.${month}&select=round3_results_rate`);
        if (rows[0] && rows[0].round3_results_rate != null) results = Number(rows[0].round3_results_rate);
      } catch (e) {}
    }
    const manualResults = results;

    // --- Members ---
    let members = [];
    try { members = await supaGet('users?department=eq.credit_team&select=id,name&order=name'); } catch (e) {}
    const memberCount = members.length || 3;

    const metrics = {
      round3_cohort: { value: round3CohortRate, standard: STD.round3_cohort, unit: '%', source: 'auto',
        met: round3CohortRate >= STD.round3_cohort, detail: { reachedR3: cohortNum, cohort: cohortDen, stalled: cohortDen - cohortNum, buckets: stallBuckets, excludedPayment: cohortExcludedPayment.length, excludedPaymentClients: cohortExcludedPayment.slice(0, 100), clients: cohortStalled.slice(0, 300) } },
      ontime_r1: { value: ontimeR1Rate, standard: STD.ontime_r1, unit: '%', source: 'auto',
        met: ontimeR1Rate >= STD.ontime_r1, detail: { dueOrLate: r1DueCount, clients: r1List.slice(0, 300) } },
      day4_delay: { value: day4Count, standard: STD.day4_delay, unit: '', source: 'auto',
        met: day4Count === STD.day4_delay, detail: { overdue: day4Count, queue: queueTotal, paymentHold: day4PaymentHold.length, wrongStage: day4WrongStage.length, paymentHoldClients: day4PaymentHold.slice(0, 100), wrongStageClients: day4WrongStage.slice(0, 100), clients: day4List.slice(0, 300) } },
      fourth_round: { value: fourthRoundRate, standard: STD.fourth_round, unit: '%', source: 'auto',
        met: fourthRoundRate <= STD.fourth_round, detail: { startedR4: r4Num, endedR3In90d: r4Den, clients: r4Started.slice(0, 300) } },
      round3_results: { value: manualResults, standard: STD.round3_results, unit: '%', source: resultsSource,
        met: manualResults != null && manualResults >= STD.round3_results, detail: resultsDetail },
    };

    const allMet = Object.values(metrics).every((x) => x.met === true);
    const perMember = POOL / memberCount;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        month, metrics, allMet, pool: POOL, perMember, members, warming,
        debug: {
          cacheDeals: cacheDeals.length,
          cacheComplete: cache ? cache.complete : false,
          cachePagesScanned: cache ? cache.pagesScanned : null,
          cacheAgeMin: ageMs === Infinity ? null : Math.round(ageMs / 60000),
          cohortWindow: `${cohortOldest.toISOString().slice(0, 10)} to ${cohortNewest.toISOString().slice(0, 10)}`, asOf: asOf.toISOString().slice(0, 10),
        },
      }),
    };
  } catch (error) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: error.message }) };
  }
};
