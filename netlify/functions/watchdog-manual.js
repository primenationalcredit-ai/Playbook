// netlify/functions/qualified-doc-watchdog.js
// Nightly self-healer for the qualified-doc pipeline (built 7/30 after the
// 4th manual repair in a week - Donaldo, Daeyanna, et al).
// TRUTH SOURCE: consultant_payments (money actually collected).
// For every final/PIF payment in the last N days it verifies the Pipedrive
// checkboxes (DOC_1 / FINAL_1) and the consultant_bonus_events rows, stamps
// and writes whatever is missing, and reports what it healed.
// Runs nightly at 09:30 UTC (3:30am MT - after the 2am autobill + sync).
// Manual: GET/POST with ?dry_run=1 to preview, ?days=N to widen the window.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PD_KEY = process.env.PIPEDRIVE_API_KEY;
const PD_BASE = 'https://api.pipedrive.com/v1';
const F = {
  DOC_1: '314d267ebc05d3623ffd8aab701baae7bea29aa8',
  PARTIAL_1: '35c626c805984517bacdba0b20aa20ab7ee3c48a',
  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4'
};
const YES = { DOC_1: '1104', PARTIAL_1: '1106', FINAL_1: '1108' };
const sb = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
});
function bizDaysSince(addTime, now) {
  if (!addTime) return 99;
  let biz = 0, d = new Date(addTime); d.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(0, 0, 0, 0);
  while (d <= end && biz <= 6) { const w = d.getDay(); if (w !== 0 && w !== 6) biz++; d.setDate(d.getDate() + 1); }
  return biz;
}
const runWatchdog = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const params = (event && event.queryStringParameters) || {};
  const dryRun = params.dry_run === '1' || params.dry_run === 'true';
  const days = Math.min(parseInt(params.days) || 4, 31);
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0];
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const report = { checked: 0, healthy: 0, healed: [], stamped: [], problems: [], dryRun, since };
  try {
    // 1) Money truth: final/PIF payments in the window, with a deal id
    const payRes = await sb(`consultant_payments?payment_type=in.(final,paid_in_full)&payment_date=gte.${since}&pipedrive_deal_id=not.is.null&refunded_at=is.null&select=client_name,pipedrive_deal_id,amount,payment_date`);
    const pays = payRes.ok ? await payRes.json() : [];
    const byDeal = new Map();
    for (const p of pays) { if (!byDeal.has(String(p.pipedrive_deal_id))) byDeal.set(String(p.pipedrive_deal_id), p); }
    // 2) Existing events for those deals
    const ids = [...byDeal.keys()];
    report.checked = ids.length;
    if (ids.length === 0) return { statusCode: 200, headers, body: JSON.stringify(report) };
    const evRes = await sb(`consultant_bonus_events?deal_id=in.(${ids.join(',')})&select=deal_id,event_type`);
    const evs = evRes.ok ? await evRes.json() : [];
    const has = new Set(evs.map(e => `${e.deal_id}-${e.event_type}`));
    for (const [dealId, pay] of byDeal) {
      const needsQD = !has.has(`${dealId}-qualified_doc`);
      const needsPif = !has.has(`${dealId}-pif`) && !has.has(`${dealId}-pif_fast_start`);
      if (!needsQD && !needsPif) { report.healthy++; continue; }
      // 3) Deal truth from Pipedrive
      let deal = null;
      try { const dr = await fetch(`${PD_BASE}/deals/${dealId}?api_token=${PD_KEY}`); const dj = await dr.json(); deal = dj.data; } catch (e) {}
      if (!deal) { report.problems.push({ deal: dealId, client: pay.client_name, issue: 'deal fetch failed' }); continue; }
      const doc1 = String(deal[F.DOC_1]) === YES.DOC_1;
      const final1 = String(deal[F.FINAL_1]) === YES.FINAL_1;
      const partial1 = String(deal[F.PARTIAL_1]) === YES.PARTIAL_1;
      // 4) Stamp FINAL_1 from payment truth if the deal disagrees with the money
      if (!final1 && !dryRun) {
        try {
          await fetch(`${PD_BASE}/deals/${dealId}?api_token=${PD_KEY}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [F.FINAL_1]: YES.FINAL_1 })
          });
          report.stamped.push({ deal: dealId, client: pay.client_name, field: 'FINAL_1' });
        } catch (e) { report.problems.push({ deal: dealId, client: pay.client_name, issue: 'FINAL_1 stamp failed' }); }
      } else if (!final1) { report.stamped.push({ deal: dealId, client: pay.client_name, field: 'FINAL_1 (dry run)' }); }
      if (!doc1) {
        // Final collected but no doc-fee checkbox: unusual - report, don't guess.
        report.problems.push({ deal: dealId, client: pay.client_name, issue: 'final paid but DOC_1 not set - needs human eyes' });
        continue;
      }
      // 5) Write the missing events (sync's own shapes, incl. fast-start rule)
      const base = {
        deal_id: Number(dealId), deal_title: deal.title || pay.client_name,
        deal_value: deal.value || 0, owner_name: deal.owner_name || 'Unassigned',
        owner_id: (deal.user_id && deal.user_id.id) || deal.user_id || null,
        org_name: deal.org_name || null, is_affiliate: false,
        doc1: true, partial1, final1: true,
        deal_add_time: deal.add_time || null, deal_won_time: deal.won_time || null,
        pipeline_id: deal.pipeline_id || null, stage_id: deal.stage_id || null,
        event_month: month, event_date: now.toISOString().split('T')[0]
      };
      const toWrite = [];
      if (needsQD) toWrite.push({ ...base, event_type: 'qualified_doc' });
      if (needsPif) toWrite.push({ ...base, event_type: bizDaysSince(deal.add_time, now) <= 5 ? 'pif_fast_start' : 'pif' });
      if (toWrite.length && !dryRun) {
        const ins = await sb('consultant_bonus_events', {
          method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
          body: JSON.stringify(toWrite)
        });
        if (!ins.ok) { report.problems.push({ deal: dealId, client: pay.client_name, issue: 'event insert failed: ' + (await ins.text()).slice(0, 120) }); continue; }
      }
      report.healed.push({ deal: dealId, client: pay.client_name, events: toWrite.map(t => t.event_type), owner: base.owner_name });
    }
    // 5.5) Anything healed -> bust the bonus-metrics cache so dashboards update
    if (report.healed.length && !dryRun) {
      fetch(`https://cute-cat-d9631c.netlify.app/.netlify/functions/consultant-bonus-metrics?month=${month}&refresh=1`).catch(() => {});
    }
    // 6) Leave the morning report where humans and dashboards can read it
    const summary = { ranAt: now.toISOString(), ...report };
    if (!dryRun) {
      await sb('app_cache?on_conflict=cache_key', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ cache_key: 'watchdog:qualified_doc:last_report', cache_value: JSON.stringify(summary) }])
      });
    }
    console.log('[watchdog]', JSON.stringify(summary));
    return { statusCode: 200, headers, body: JSON.stringify(summary) };
  } catch (err) {
    console.error('[watchdog] fatal:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// ---- Manual door (inlined; cross-function require breaks under esbuild) ----
exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || '';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try { return await runWatchdog(event); }
  catch (err) { return { statusCode: 200, headers, body: JSON.stringify({ wrapper_error: String(err && err.stack || err).slice(0, 800) }) }; }
};
