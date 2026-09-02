// doc-threshold-map.js (Joe 9/2, Cindy's accelerator 360 -> 280): a doc qualifies
// when payments PAST the doc fee reach the client's second-payment threshold, and it
// qualifies in the month that happens - locked, never moved by later payments. The old
// code credited the LAST advance payment and preferred a final over an earlier partial,
// so a client who paid doc + partial in August but their final on 9/01 had the whole
// doc yanked into September. Threshold = (Total Fee - 149) / 2 for a partial plan, or
// the full (Total Fee - 149) for a full plan. Plan type: PAYMENT TYPE 74 = partial,
// 75 = full, 1516 = non-guarantee (AGREEMENT INFO says PARTIAL or FULL).
// Built here on a schedule because the bonus page cannot afford a deal lookup per client.
const SB = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PDT = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
const PD = 'https://asapcreditrepairusa.pipedrive.com/api/v1';
const F_TOTAL = '32ede4b1f12ad63d381425517a80af3430062502';
const F_AGREE = 'bc61560b919c05b5dc3a051267d630d7693c05d1';
const F_PAYTYPE = 'f58600db4c14bc33f67274903675226912efaa07';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const scheduled = !event || !event.headers || !event.httpMethod;
  if (!scheduled) {
    const k = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || q.key || '';
    if (k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, body: '{"error":"unauthorized"}' };
  }
  // BATCHED 9/2: several hundred deal lookups blow the function's time budget, so
  // each run merges into the existing map and stops on a deadline. Repeat until done:0.
  const since = q.since || '2026-07-01';
  const t0 = Date.now();
  const BUDGET = 20000;
  const out = { deals: 0, mapped: 0, noFee: 0, errors: 0 };
  let map = {};
  try {
    const prev = await fetch(SB + '/rest/v1/app_cache?cache_key=eq.doc_threshold_map&select=cache_value', { headers: H }).then(r => r.json()).catch(() => []);
    if (prev && prev[0] && prev[0].cache_value) map = JSON.parse(prev[0].cache_value);
  } catch (e) {}
  try {
    const rows = await fetch(SB + '/rest/v1/consultant_payments?payment_date=gte.' + since + '&pipedrive_deal_id=not.is.null&select=pipedrive_deal_id&limit=5000', { headers: H }).then(r => r.json()).catch(() => []);
    const ids = [...new Set((Array.isArray(rows) ? rows : []).map(r => String(r.pipedrive_deal_id)))];
    out.deals = ids.length;
    for (const id of ids) {
      if (map[id]) { continue; }
      if (Date.now() - t0 > BUDGET) { out.stoppedEarly = true; break; }
      try {
        const d = await fetch(PD + '/deals/' + id + '?api_token=' + PDT).then(r => r.json()).then(j => j && j.data).catch(() => null);
        if (!d) { out.errors++; continue; }
        const total = parseFloat(d[F_TOTAL]) || 0;
        if (!total) { out.noFee++; continue; }
        const payType = String(d[F_PAYTYPE] || '');
        const agree = String(d[F_AGREE] || '').toUpperCase();
        let isPartial;
        if (payType === '74') isPartial = true;
        else if (payType === '75') isPartial = false;
        else isPartial = agree.indexOf('PARTIAL') >= 0;
        const remainder = Math.max(0, total - 149);
        const threshold = isPartial ? Math.round((remainder / 2) * 100) / 100 : remainder;
        map[id] = { t: threshold, p: isPartial ? 1 : 0, f: total };
        out.mapped++;
      } catch (e) { out.errors++; }
    }
    await fetch(SB + '/rest/v1/app_cache?on_conflict=cache_key', { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: 'doc_threshold_map', cache_value: JSON.stringify(map), updated_at: new Date().toISOString() }) });
  } catch (e) { out.fatal = String(e.message).slice(0, 150); }
  out.total = Object.keys(map).length;
  out.done = out.stoppedEarly ? 0 : 1;
  return { statusCode: 200, body: JSON.stringify(out) };
};
