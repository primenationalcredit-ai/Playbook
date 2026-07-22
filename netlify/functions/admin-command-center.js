// netlify/functions/admin-command-center.js
// COMMAND CENTER P1: month-cohort funnel + live pipeline census.
// CSR/AM/Consultant/Credit panels are fetched client-side from their
// existing metric functions; this function owns what no other does.
// GET ?month=YYYY-MM (default: current month, America/Chicago)
// 10-minute in-memory cache per month.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CACHE_TTL_MS = 10 * 60 * 1000;
globalThis.__ccCache = globalThis.__ccCache || {};

const PIPELINE_RANK = {
  'new leads': 1, 'reports': 2, 'quoted 2.0': 3, 'sold': 4,
  'c.r.s.': 5, 'additional c.r.s.': 5,
};
function rankOf(p) {
  const k = String(p || '').trim().toLowerCase();
  return PIPELINE_RANK[k] || 0;
}

function respond(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

async function supaPage(table, query, offset, limit) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}&limit=${limit}&offset=${offset}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(`${table} fetch failed (${r.status})`);
  return r.json();
}

// Paginate a query fully (1000-row pages, hard cap to protect the function)
async function supaAll(table, query, maxPages = 30) {
  const out = [];
  for (let p = 0; p < maxPages; p++) {
    const rows = await supaPage(table, query, p * 1000, 1000);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

exports.handler = async (event) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return respond(500, { error: 'Server misconfigured' });
    const now = new Date();
    const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const defMonth = `${ct.getFullYear()}-${String(ct.getMonth() + 1).padStart(2, '0')}`;
    const month = (event.queryStringParameters?.month || defMonth).slice(0, 7);
    const force = event.queryStringParameters?.force === '1';

    const cached = globalThis.__ccCache[month];
    if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return respond(200, { ...cached.data, cached: true });
    }

    // ---- MONTH COHORT: every deal created this month ----
    const cohort = await supaAll(
      'cs_deals',
      `deal_created_at=gte.${month}-01T00:00:00Z&deal_created_at=lt.${month}-31T23:59:59Z` +
      `&select=deal_id,deal_title,pipeline_name,stage_name,call_center_rep_name,monitoring_site,has_doc_fee,deal_created_at,deal_status`
    );

    const funnel = {
      leadsIn: cohort.length,
      stillNewLeads: 0, reachedReports: 0, reachedQuoted: 0, soldDocFee: 0,
      claimed: 0, unclaimed: 0,
      lists: { stillNewLeads: [], reachedReports: [], reachedQuoted: [], soldDocFee: [] },
    };
    for (const d of cohort) {
      const rank = rankOf(d.pipeline_name);
      const item = {
        dealId: d.deal_id, title: d.deal_title || `Deal #${d.deal_id}`,
        rep: d.call_center_rep_name || null, pipeline: d.pipeline_name || '(none)',
        stage: d.stage_name || null, created: (d.deal_created_at || '').slice(0, 10),
      };
      if (d.call_center_rep_name) funnel.claimed++; else funnel.unclaimed++;
      if (rank === 1) { funnel.stillNewLeads++; funnel.lists.stillNewLeads.push(item); }
      if (rank >= 2) { funnel.reachedReports++; funnel.lists.reachedReports.push(item); }
      if (rank >= 3) { funnel.reachedQuoted++; funnel.lists.reachedQuoted.push(item); }
      if (d.has_doc_fee) { funnel.soldDocFee++; funnel.lists.soldDocFee.push(item); }
    }
    const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);
    funnel.rates = {
      spokenTo: pct(funnel.reachedReports, funnel.leadsIn),          // leads -> reports
      reportsToQuoted: pct(funnel.reachedQuoted, funnel.reachedReports),
      quotedToSold: pct(funnel.soldDocFee, funnel.reachedQuoted),
      overallClose: pct(funnel.soldDocFee, funnel.leadsIn),
      claimRate: pct(funnel.claimed, funnel.leadsIn),
    };

    // ---- LIVE CENSUS: whole mirror, open deals, per pipeline+stage ----
    const census = {};
    const all = await supaAll('cs_deals', `deal_status=eq.open&select=pipeline_name,stage_name`);
    for (const d of all) {
      const p = (d.pipeline_name || '(no pipeline)').trim() || '(no pipeline)';
      const s = (d.stage_name || '(no stage)').trim() || '(no stage)';
      census[p] = census[p] || { total: 0, stages: {} };
      census[p].total++;
      census[p].stages[s] = (census[p].stages[s] || 0) + 1;
    }
    const censusOut = Object.entries(census)
      .map(([pipeline, v]) => ({
        pipeline, total: v.total,
        stages: Object.entries(v.stages).map(([stage, count]) => ({ stage, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);

    const data = {
      month, generatedAt: new Date().toISOString(),
      funnel, census: censusOut,
      censusTotalOpen: all.length,
      notes: {
        soldTouchTime: 'Pending stage-timestamp data (collection starts P2).',
        leadSources: 'Organization data lands in P3.',
      },
    };
    globalThis.__ccCache[month] = { at: Date.now(), data };
    return respond(200, data);
  } catch (err) {
    console.error('command-center error:', err);
    return respond(500, { error: err.message });
  }
};
