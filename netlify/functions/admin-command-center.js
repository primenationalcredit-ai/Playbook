// netlify/functions/admin-command-center.js
// COMMAND CENTER P3 server: cohort funnel + JOURNEY (doc fee + dispute rounds)
// + range reviews + census. GET ?start&end (defaults current month CT).

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

// Round-dates cache (filled by credit-team-cache-background). Structure is
// probed tolerantly: we look for per-deal entries carrying rd1/rd3/rd4 dates.
async function loadRoundDates() {
  try {
    const rows = await supaAll('app_cache', `cache_key=eq.credit_team_round_dates&select=cache_value`, 1);
    if (!rows[0]) return null;
    const parsed = JSON.parse(rows[0].cache_value);
    const byDeal = {};
    const ingest = (id, obj) => {
      if (!id || !obj || typeof obj !== 'object') return;
      const keys = Object.keys(obj);
      const find = (frag) => {
        const k = keys.find((x) => x.toLowerCase().includes(frag));
        return k ? obj[k] : null;
      };
      byDeal[String(id)] = { rd1: find('rd1') || find('round1'), rd3: find('rd3') || find('round3'), rd4: find('rd4') || find('round4') };
    };
    if (Array.isArray(parsed)) {
      for (const e of parsed) ingest(e.dealId || e.deal_id || e.id, e);
    } else if (parsed && typeof parsed === 'object') {
      const vals = Object.values(parsed);
      if (vals.length && typeof vals[0] === 'object' && !Array.isArray(vals[0])) {
        for (const [id, e] of Object.entries(parsed)) ingest(id, e);
      } else if (parsed.deals && typeof parsed.deals === 'object') {
        for (const [id, e] of Object.entries(parsed.deals)) ingest(id, e);
      }
    }
    return Object.keys(byDeal).length ? byDeal : null;
  } catch (e) { return null; }
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
    const cohortIds = new Set();
    for (const d of cohort) {
      cohortIds.add(String(d.deal_id));
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

    // ---- JOURNEY: the cohort's full arc including dispute rounds ----
    const roundDates = await loadRoundDates();
    const journey = {
      leadsIn: funnel.leadsIn, claimed: funnel.claimed,
      reachedReports: funnel.reachedReports, reachedQuoted: funnel.reachedQuoted,
      closed: funnel.closed, docFeePaid: funnel.docFeePaid,
      round1Started: 0, round3Started: 0, round4Started: 0,
      roundsAvailable: !!roundDates,
    };
    if (roundDates) {
      for (const id of cohortIds) {
        const r = roundDates[id];
        if (!r) continue;
        if (r.rd1) journey.round1Started++;
        if (r.rd3) journey.round3Started++;
        if (r.rd4) journey.round4Started++;
      }
    }

    // ---- REVIEWS (range) ----
    let reviews = [];
    try {
      const revRows = await supaAll(
        'incoming_reviews',
        `review_date=gte.${start}&review_date=lte.${end}&select=assigned_to,review_date,location_name`
      );
      let nameByUid = {};
      try {
        const users = await supaAll('users', 'select=*', 2);
        for (const u of users) {
          const nm = u.name || u.full_name || u.display_name || u.email || null;
          if (u.id != null && nm) nameByUid[u.id] = nm;
        }
      } catch (e) {}
      const agg = {};
      for (const r of revRows) {
        const key = r.assigned_to != null ? (nameByUid[r.assigned_to] || `User ${r.assigned_to}`) : 'Unassigned';
        agg[key] = agg[key] || { count: 0, bbb: 0 };
        agg[key].count++;
        const loc = (r.location_name || '').toLowerCase();
        if (loc.includes('bbb') || loc.includes('better business')) agg[key].bbb++;
      }
      reviews = Object.entries(agg).map(([name, v]) => ({ name, count: v.count, bbb: v.bbb }))
        .sort((a, b) => b.count - a.count);
    } catch (e) { reviews = []; }

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
      funnel, journey, reviews, census: censusOut, censusTotalOpen: all.length,
    };
    globalThis.__ccCache[cacheKey] = { at: Date.now(), data };
    return respond(200, data);
  } catch (err) {
    console.error('command-center error:', err);
    return respond(500, { error: err.message });
  }
};
