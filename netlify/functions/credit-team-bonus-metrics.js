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
const POOL = 300;

// Daterange custom fields: start lives at the key, end at `${key}_until`.
const F = {
  rd1Start: '6979c70df67f42c28dfcff39284ae17d564d600f',
  rd3Start: '8d681007c089ee4c7390c02ee2f027ca60374708',
  rd4Start: '1d1bc8fbf1b8982640ef70131f010908788a7bd0',
};
const RD3_END = '8d681007c089ee4c7390c02ee2f027ca60374708_until';

// Standards
const STD = { round3_cohort: 20, ontime_r1: 100, day4_delay: 0, fourth_round: 25, round3_results: 80 };

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
async function fetchRound3ResultsRate(month) {
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
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || Number(r[2]) !== 3) continue;       // Round 3 result row
    const d = new Date(r[0]);
    if (Number.isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (ym !== month) continue;
    den++;
    if (Number(r[13]) > 0) num++;
  }
  return { rate: den > 0 ? Math.round((num / den) * 100) : null, num, den };
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
    const cohortCutoff = new Date(asOf.getTime() - 120 * 86400000); // RD1 start on/before this = 120+ days old

    // --- Pull active CRS deals (paginated) with round date fields ---
    const scanStart = Date.now();
    const BUDGET_MS = 8500;
    let start = 0, more = true, pages = 0, truncated = false;
    const deals = [];
    while (more && pages < 80) {
      const r = await pdGet(`/deals?pipeline_id=${CRS_PIPELINE_ID}&status=open&start=${start}&limit=500`);
      (r.data || []).forEach((d) => deals.push(d));
      more = r.additional_data && r.additional_data.pagination && r.additional_data.pagination.more_items_in_collection;
      start = (r.additional_data && r.additional_data.pagination && r.additional_data.pagination.next_start) || (start + 500);
      pages++;
      if (more && Date.now() - scanStart > BUDGET_MS) { truncated = true; break; }
    }
    if (more && pages >= 80) truncated = true;

    // --- Metric 1: Round 3 Cohort Rate (reached R3 within 120 days, among clients 120+ days old) ---
    let cohortDen = 0, cohortNum = 0;
    // --- Metric 3: 4th Round Started % (of clients whose R3 ended, how many started R4) ---
    let r4Den = 0, r4Num = 0;
    for (const d of deals) {
      const rd1 = parseDate(d[F.rd1Start]);
      const rd3 = parseDate(d[F.rd3Start]);
      const rd3end = parseDate(d[RD3_END]);
      const rd4 = parseDate(d[F.rd4Start]);

      if (rd1 && rd1 <= cohortCutoff) {
        cohortDen++;
        if (rd3 && daysBetween(rd1, rd3) <= 120) cohortNum++;
      }
      if (rd3end && rd3end <= asOf) {
        r4Den++;
        if (rd4) r4Num++;
      }
    }
    const round3CohortRate = cohortDen > 0 ? Math.round((cohortNum / cohortDen) * 100) : 0;
    const fourthRoundRate = r4Den > 0 ? Math.round((r4Num / r4Den) * 100) : 0;

    // --- Day 4+ delays + On-Time R1 (Reports Received queue) ---
    let day4Count = 0, queueOnTime = 0, queueTotal = 0;
    try {
      const rr = await pdGet(`/deals?filter_id=${REPORTS_RECEIVED_FILTER}&start=0&limit=500`);
      (rr.data || []).forEach((deal) => {
        queueTotal++;
        const t = deal.stage_change_time || deal.update_time || deal.add_time;
        const bd = t ? businessDaysDiff(new Date(t.replace(' ', 'T') + 'Z'), now) : 0;
        if (bd > 3) day4Count++; else queueOnTime++;
      });
    } catch (e) { /* leave zeros */ }
    // On-Time R1 is the same condition as Day 4+ delays: zero delays past 3 business days = 100% on time.
    const ontimeR1Rate = day4Count === 0 ? 100 : 0;

    // --- Round 3 Results Rate (live from the Master Dispute Tracking sheet; manual fallback) ---
    let results = null, resultsSource = 'manual', resultsDetail = {};
    try {
      const r3 = await fetchRound3ResultsRate(month);
      if (r3) { results = r3.rate; resultsSource = 'auto'; resultsDetail = { gotResults: r3.num, completed: r3.den }; }
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
        met: round3CohortRate >= STD.round3_cohort, detail: { reachedR3: cohortNum, cohort: cohortDen } },
      ontime_r1: { value: ontimeR1Rate, standard: STD.ontime_r1, unit: '%', source: 'auto',
        met: ontimeR1Rate >= STD.ontime_r1, detail: { lateSends: day4Count, queue: queueTotal } },
      day4_delay: { value: day4Count, standard: STD.day4_delay, unit: '', source: 'auto',
        met: day4Count === STD.day4_delay, detail: { overdue: day4Count, queue: queueTotal } },
      fourth_round: { value: fourthRoundRate, standard: STD.fourth_round, unit: '%', source: 'auto',
        met: fourthRoundRate >= STD.fourth_round, detail: { startedR4: r4Num, eligible: r4Den } },
      round3_results: { value: manualResults, standard: STD.round3_results, unit: '%', source: resultsSource,
        met: manualResults != null && manualResults >= STD.round3_results, detail: resultsDetail },
    };

    const allMet = Object.values(metrics).every((x) => x.met === true);
    const perMember = POOL / memberCount;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        month, metrics, allMet, pool: POOL, perMember, members, truncated,
        debug: { crsDealsScanned: deals.length, pages, truncated, cohortCutoff: cohortCutoff.toISOString().slice(0, 10), asOf: asOf.toISOString().slice(0, 10) },
      }),
    };
  } catch (error) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: error.message }) };
  }
};
