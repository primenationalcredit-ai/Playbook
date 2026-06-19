// CSR Bonus Metrics — computes the CSR Performance & Bonus Plan from cs_deals.
// Phase 1: Report Bonus (fully from cs_deals) + a debug block reporting the data shape
// (distinct monitoring sites + pipeline/stage names) so the gate can be locked precisely.
// Conversion / Review / Spotlight bonuses are wired in once the gate names are confirmed.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CSR_STAFF = ['Kenneth Larios', 'Vic Baltodano', 'Reni', 'Araceli Carrion Garcia', 'Jenifer Venegas', 'CJ'];

// ---- CONFIG: which pipeline/stage names count a report (early-stage only, before later CRS rounds) ----
// Matched case-insensitively (substring) against BOTH pipeline_name and stage_name.
// Adjust to the real Pipedrive names once confirmed from the debug block.
const REPORT_STAGE_GATE = ['new leads', 'reports', 'quoted'];

// ---- Report Bonus rules ----
const FIRST_PAID_REPORT = 35;        // first 35 IDIQ reports don't pay
const TOTAL_REPORTS_QUALIFIER = 50;  // must hit 50 TOTAL reports (any site) to be eligible
function reportTierRate(idiq) {
  if (idiq >= 81) return 7;
  if (idiq >= 66) return 5;
  if (idiq >= FIRST_PAID_REPORT) return 3;
  return 0;
}
function computeReportBonus(idiqCount, totalReports) {
  const qualified = totalReports >= TOTAL_REPORTS_QUALIFIER;
  const paidReports = Math.max(0, idiqCount - FIRST_PAID_REPORT); // reports past #35
  const rate = reportTierRate(idiqCount);
  const bonus = qualified ? paidReports * rate : 0;
  return { qualified, paidReports, rate, bonus };
}

// ---- Base pay (config) ----
const BASE_PAY = { month1: 1000, ongoing: 1280 };

async function supaGet(table, query) {
  // Paginate past the 1000-row cap
  const out = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function monthOf(row) {
  const d = row.monitoring_site_set_at || row.deal_created_at || null;
  return d ? String(d).slice(0, 7) : null;
}
function gatePass(row) {
  const hay = `${(row.pipeline_name || '').toLowerCase()} | ${(row.stage_name || '').toLowerCase()}`;
  return REPORT_STAGE_GATE.some(g => hay.includes(g));
}
function classify(ms) {
  const s = (ms || '').toLowerCase();
  if (!s) return null;
  if (s.includes('identity')) return 'idiq';
  if (s.includes('smart')) return 'smart';
  return 'other';
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const rows = await supaGet('cs_deals', 'select=deal_id,call_center_rep_name,account_manager_name,monitoring_site,monitoring_site_set_at,deal_created_at,pipeline_name,stage_name');

    // Per-CSR tallies for the requested month
    const tally = {};
    for (const name of CSR_STAFF) tally[name] = { idiq: 0, smart: 0, other: 0, total: 0, noAm: 0, outOfMonth: 0, gatedOut: 0 };

    // Debug: what the data actually looks like
    const msSeen = {};            // distinct monitoring_site -> count
    const stageSeen = {};         // "pipeline | stage" -> count

    for (const r of rows) {
      const ms = r.monitoring_site;
      if (ms) msSeen[ms] = (msSeen[ms] || 0) + 1;
      const stageKey = `${r.pipeline_name || '(none)'} | ${r.stage_name || '(none)'}`;
      stageSeen[stageKey] = (stageSeen[stageKey] || 0) + 1;

      const cls = classify(ms);
      if (!cls) continue;                       // no report value -> not a report
      const rep = r.call_center_rep_name;
      if (!rep || !tally[rep]) continue;        // only known CSRs

      if (monthOf(r) !== month) { tally[rep].outOfMonth++; continue; }
      if (!r.account_manager_name) { tally[rep].noAm++; continue; }   // AM required for credit
      if (!gatePass(r)) { tally[rep].gatedOut++; continue; }          // must be in early pipeline/stage

      tally[rep][cls]++;
      tally[rep].total++;
    }

    // Build per-CSR bonus result
    const csrs = {};
    for (const name of CSR_STAFF) {
      const t = tally[name];
      const report = computeReportBonus(t.idiq, t.total);
      csrs[name] = {
        month,
        reports: { idiq: t.idiq, smartcredit: t.smart, other: t.other, total: t.total },
        reportBonus: report,
        excluded: { noAccountManager: t.noAm, outOfMonth: t.outOfMonth, gatedOut: t.gatedOut },
        // placeholders until gate is confirmed and conversion/review sources wired
        conversionBonus: null,
        reviewBonus: null,
        spotlight: null,
        basePay: BASE_PAY
      };
    }

    // Sort debug maps into arrays (desc by count)
    const distinctMonitoringSites = Object.entries(msSeen).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
    const distinctStages = Object.entries(stageSeen).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        month,
        payout: 'Calculated at month-end, paid on the 15th of the following month',
        gateConfig: REPORT_STAGE_GATE,
        csrs,
        debug: {
          totalDeals: rows.length,
          distinctMonitoringSites,
          distinctStages
        }
      }, null, 2)
    };
  } catch (error) {
    console.error('CSR Bonus Metrics Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
