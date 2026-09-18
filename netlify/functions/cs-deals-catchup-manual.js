// netlify/functions/cs-deals-catchup-manual.js
//
// CS DEALS CATCH-UP (Joe 9/18, Floyd Gordon 270982, Jenifer Venegas ticket)
//
// THE PROBLEM THIS SOLVES:
// cs-deals-webhook keeps cs_deals current in real time, but it is fire-and-forget.
// Pipedrive announces a deal change once. If the Playbook database is slow or down
// at that moment the upsert fails, Pipedrive gives up after its own retries, and
// that change is lost permanently - nothing ever goes back to look. Floyd Gordon's
// row sat frozen at a snapshot taken two minutes after creation, still titled
// "There Hi", with no rep and no monitoring site, while Pipedrive had all three.
// His CSR lost the report credit and only found out by raising a ticket.
//
// WHAT THIS DOES:
// Walks the most recently updated CS deals, compares each against cs_deals, and
// re-runs the real webhook for any deal where the difference costs someone credit.
// It deliberately does NOT repair deals that are merely a few minutes behind on a
// stage name - those cost nothing and the next webhook fixes them. Repairing them
// would mean churning through 200 rows every run and hiding the real failures.
//
// REPAIRED (in this order):
//   1. missing_row    - the Playbook has no record of the deal at all
//   2. lost_site      - Pipedrive has a monitoring site, the Playbook has none
//   3. no_rep         - Pipedrive has a site but the Playbook has no rep on it
//   4. site_mismatch  - the two disagree on which site
// COUNTED ONLY:
//   stale            - anything else where Pipedrive is newer (pass include_stale=1)
//
// Repair is done by POSTing the real deal object to cs-deals-webhook, so there is
// exactly one piece of logic deciding what a row should look like. Nothing here
// writes to cs_deals directly.
//
// Scheduled twin: cs-deals-catchup.js (every 30 min). This one is keyed and manual.

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const CS_WEBHOOK_SECRET = process.env.CS_WEBHOOK_SECRET;

const MONITORING_SITE_FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';
const CS_DEALS_FILTER = 136445;
const SITE_URL = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
const WEBHOOK_URL = SITE_URL + '/.netlify/functions/cs-deals-webhook';
const baseUrl = 'https://' + PIPEDRIVE_DOMAIN + '.pipedrive.com/api/v1';

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

function pdTime(s) {
  if (!s) return 0;
  const t = Date.parse(String(s).replace(' ', 'T') + (String(s).indexOf('Z') < 0 && String(s).indexOf('+') < 0 ? 'Z' : ''));
  return isNaN(t) ? 0 : t;
}

async function loadSiteMap() {
  const map = {};
  try {
    const r = await fetch(baseUrl + '/dealFields?api_token=' + PIPEDRIVE_API_KEY + '&limit=500');
    if (!r.ok) return map;
    const j = await r.json();
    const field = (j.data || []).find(function (x) { return x.key === MONITORING_SITE_FIELD; });
    for (const opt of (field && field.options ? field.options : [])) map[String(opt.id)] = opt.label;
  } catch (e) {}
  return map;
}

async function runCatchup(opts) {
  opts = opts || {};
  const started = Date.now();
  const budgetMs = Math.min(parseInt(opts.budgetMs) || 21000, 23000);
  const pages = Math.max(1, Math.min(parseInt(opts.pages) || 3, 8));
  const repairLimit = Math.max(1, Math.min(parseInt(opts.repairLimit) || 25, 60));
  const dryRun = !!opts.dryRun;
  const includeStale = !!opts.includeStale;

  const out = {
    ok: true, dry_run: dryRun, checked: 0,
    missing_row: 0, lost_site: 0, no_rep: 0, site_mismatch: 0, stale: 0,
    repaired: 0, repairs: [], failed: [], note: null, ms: 0
  };

  if (!SUPABASE_URL || !SUPABASE_KEY) { out.ok = false; out.note = 'supabase not configured'; return out; }

  // GUARD (same as cs-deals-initial-sync): if the option map fails to load we cannot
  // tell a real site from a missing one, and acting would be worse than doing nothing.
  const siteMap = await loadSiteMap();
  if (!Object.keys(siteMap).length) {
    out.ok = false;
    out.note = 'monitoring-site field map unavailable - aborted rather than risk wrong reads';
    out.ms = Date.now() - started;
    return out;
  }

  const deals = [];
  for (let p = 0; p < pages; p++) {
    if (Date.now() - started > budgetMs * 0.4) break;
    try {
      const r = await fetch(baseUrl + '/deals?filter_id=' + CS_DEALS_FILTER + '&start=' + (p * 100) +
        '&limit=100&sort=update_time%20DESC&api_token=' + PIPEDRIVE_API_KEY);
      if (!r.ok) break;
      const j = await r.json();
      if (!j.data || !j.data.length) break;
      for (const d of j.data) deals.push(d);
      const pg = j.additional_data && j.additional_data.pagination;
      if (pg && pg.more_items_in_collection === false) break;
    } catch (e) { break; }
  }
  out.checked = deals.length;
  if (!deals.length) { out.note = 'no deals returned from Pipedrive'; out.ms = Date.now() - started; return out; }

  const rowMap = {};
  for (let i = 0; i < deals.length; i += 100) {
    const ids = deals.slice(i, i + 100).map(function (d) { return d.id; }).join(',');
    try {
      const rr = await fetch(SUPABASE_URL + '/rest/v1/cs_deals?deal_id=in.(' + ids +
        ')&select=deal_id,deal_title,monitoring_site,call_center_rep_name,synced_at&limit=200', { headers: SB });
      const rows = await rr.json().catch(function () { return []; });
      for (const row of (Array.isArray(rows) ? rows : [])) rowMap[String(row.deal_id)] = row;
    } catch (e) {}
  }

  const work = [];
  for (const d of deals) {
    const row = rowMap[String(d.id)];
    const rawSite = d[MONITORING_SITE_FIELD];
    const pdSite = (rawSite !== null && rawSite !== undefined && String(rawSite) !== '')
      ? (siteMap[String(rawSite)] || null) : null;

    if (!row) { out.missing_row++; work.push({ d: d, why: 'missing_row', pri: 1 }); continue; }
    if (pdSite && !row.monitoring_site) { out.lost_site++; work.push({ d: d, why: 'lost_site', pri: 2 }); continue; }
    if (pdSite && !row.call_center_rep_name) { out.no_rep++; work.push({ d: d, why: 'no_rep', pri: 3 }); continue; }
    if (pdSite && row.monitoring_site && pdSite !== row.monitoring_site) {
      out.site_mismatch++; work.push({ d: d, why: 'site_mismatch', pri: 4, was: row.monitoring_site, now: pdSite }); continue;
    }
    const pu = pdTime(d.update_time);
    const sy = Date.parse(row.synced_at);
    if (pu && sy && pu > sy + 120000) {
      out.stale++;
      if (includeStale) work.push({ d: d, why: 'stale', pri: 5 });
    }
  }

  work.sort(function (a, b) { return a.pri - b.pri; });

  const authHeaders = { 'Content-Type': 'application/json' };
  if (CS_WEBHOOK_SECRET) {
    authHeaders.Authorization = 'Basic ' + Buffer.from('catchup:' + CS_WEBHOOK_SECRET).toString('base64');
  }

  for (const item of work) {
    if (out.repaired >= repairLimit) { out.note = 'hit repair limit of ' + repairLimit + '; remaining work picked up next run'; break; }
    if (Date.now() - started > budgetMs) { out.note = 'ran out of time; remaining work picked up next run'; break; }
    if (dryRun) {
      out.repairs.push({ deal_id: item.d.id, title: item.d.title, why: item.why, would_repair: true });
      out.repaired++;
      continue;
    }
    try {
      const rr = await fetch(WEBHOOK_URL, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ current: item.d })
      });
      const rj = await rr.json().catch(function () { return {}; });
      if (rr.ok && rj.success) {
        out.repaired++;
        out.repairs.push({
          deal_id: item.d.id, title: item.d.title, why: item.why,
          site: rj.monitoring_site || null, rep: rj.rep || null,
          site_just_set: !!rj.site_just_set
        });
      } else {
        out.failed.push({ deal_id: item.d.id, why: item.why, error: rj.error || rr.status });
      }
    } catch (e) {
      out.failed.push({ deal_id: item.d.id, why: item.why, error: e.message });
    }
  }

  out.ms = Date.now() - started;

  try {
    await fetch(SUPABASE_URL + '/rest/v1/automation_runs', {
      method: 'POST', headers: Object.assign({}, SB, { Prefer: 'return=minimal' }),
      body: JSON.stringify({
        automation_id: 'cs-deals-catchup',
        ran_at: new Date().toISOString(),
        subject: 'CS deals catch-up: repaired ' + out.repaired + ' of ' + out.checked + ' checked',
        status: out.failed.length ? 'partial' : 'success',
        detail: 'checked ' + out.checked + ', repaired ' + out.repaired +
          ' (missing ' + out.missing_row + ', lost_site ' + out.lost_site +
          ', no_rep ' + out.no_rep + ', mismatch ' + out.site_mismatch +
          '), stale ' + out.stale + ', failed ' + out.failed.length +
          (dryRun ? ' [DRY RUN]' : '')
      })
    });
  } catch (e) { console.error('[cs-deals-catchup] run log failed:', e.message); }

  return out;
}

exports.runCatchup = runCatchup;

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) ||
    ((event.queryStringParameters || {}).key);
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid API key' }) };
  }
  let body = {};
  if (event.body) { try { body = JSON.parse(event.body); } catch (e) {} }
  const q = event.queryStringParameters || {};
  const res = await runCatchup({
    pages: body.pages || q.pages,
    repairLimit: body.repair_limit || q.repair_limit,
    dryRun: body.dry_run === true || q.dry_run === '1',
    includeStale: body.include_stale === true || q.include_stale === '1'
  });
  return { statusCode: 200, headers, body: JSON.stringify(res) };
};
