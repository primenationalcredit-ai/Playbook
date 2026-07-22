// netlify/functions/admin-command-center.js
// COMMAND CENTER P2 server: range cohort funnel + census + RANGE-FILTERED
// REVIEWS (all employees, from incoming_reviews + users name join).
// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD (defaults: current month, America/Chicago)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CACHE_TTL_MS = 10 * 60 * 1000;
globalThis.__ccCache = globalThis.__ccCache || {};

const PIPELINE_RANK = {
  'new leads': 1, 'reports': 2, 'quoted 2.0': 3, 'sold': 4,
  'c.r.s.': 5, 'additional c.r.s.': 5,
};
const rankOf = (p) => PIPELINE_RANK[String(p || '').trim().toLowerCase()] || 0;
const respond = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

async function supaAll(table, query, maxPages = 30) {
  const out = [];
  for (let p = 0; p < maxPages; p++) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}&limit=1000&offset=${p * 1000}`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!r.ok) throw new Error(`${table} fetch failed (${r.status})`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

exports.handler = async (event) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return respond(500, { error: 'Server misconfigured' });
    const ct = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const q = event.queryStringParameters || {};
    const start = (q.start || `${ct.getFullYear()}-${String(ct.getMonth() + 1).padStart(2, '0')}-01`).slice(0, 10);
    const end = (q.end || iso(ct)).slice(0, 10);
    const force = q.force === '1';
    const cacheKey = `${start}_${end}`;
    const cached = globalThis.__ccCache[cacheKey];
    if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return respond(200, { ...cached.data, cached: true });
    }

    // ---- COHORT FUNNEL ----
    const cohort = await supaAll(
      'cs_deals',
      `deal_created_at=gte.${start}T00:00:00Z&deal_created_at=lte.${end}T23:59:59Z` +
      `&select=deal_id,deal_title,pipeline_name,stage_name,call_center_rep_name,monitoring_site,has_doc_fee,deal_created_at,deal_status`
    );
    const funnel = {
      leadsIn: cohort.length,
      stillNewLeads: 0, reachedReports: 0, reachedQuoted: 0, closed: 0, docFeePaid: 0,
      claimed: 0, unclaimed: 0,
      lists: { stillNewLeads: [], reachedReports: [], reachedQuoted: [], closed: [] },
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
      if (rank >= 4) { funnel.closed++; funnel.lists.closed.push(item); }
      if (d.has_doc_fee) funnel.docFeePaid++;
    }
    const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
    funnel.rates = {
      spokenTo: pct(funnel.reachedReports, funnel.leadsIn),
      reportsToQuoted: pct(funnel.reachedQuoted, funnel.reachedReports),
      quotedToClosed: pct(funnel.closed, funnel.reachedQuoted),
      overallClose: pct(funnel.closed, funnel.leadsIn),
      claimRate: pct(funnel.claimed, funnel.leadsIn),
    };

    // ---- REVIEWS (range-filtered, all employees) ----
    let reviews = [];
    try {
      const revRows = await supaAll(
        'incoming_reviews',
        `review_date=gte.${start}&review_date=lte.${end}&select=assigned_to,review_date,location_name,reviewer_name`
      );
      let nameByUid = {};
      try {
        const users = await supaAll('users', 'select=*', 2);
        for (const u of users) {
          const nm = u.name || u.full_name || u.display_name || u.email || null;
          if (u.id != null && nm) nameByUid[u.id] = nm;
        }
      } catch (e) { /* name join optional */ }
      const agg = {};
      for (const r of revRows) {
        const key = r.assigned_to != null ? (nameByUid[r.assigned_to] || `User ${r.assigned_to}`) : 'Unassigned';
        agg[key] = agg[key] || { count: 0, bbb: 0 };
        agg[key].count++;
        if ((r.location_name || '').toLowerCase().includes('bbb') || (r.location_name || '').toLowerCase().includes('better business')) agg[key].bbb++;
      }
      reviews = Object.entries(agg).map(([name, v]) => ({ name, count: v.count, bbb: v.bbb }))
        .sort((a, b) => b.count - a.count);
    } catch (e) { reviews = [{ name: `reviews unavailable: ${e.message}`, count: 0, bbb: 0 }]; }

    // ---- CENSUS ----
    const all = await supaAll('cs_deals', `deal_status=eq.open&select=pipeline_name,stage_name`);
    const census = {};
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
        stages: Object.entries(v.stages).map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);

    const data = {
      start, end, generatedAt: new Date().toISOString(),
      funnel, reviews, census: censusOut, censusTotalOpen: all.length,
    };
    globalThis.__ccCache[cacheKey] = { at: Date.now(), data };
    return respond(200, data);
  } catch (err) {
    console.error('command-center error:', err);
    return respond(500, { error: err.message });
  }
};
