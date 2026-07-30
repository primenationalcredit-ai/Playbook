// netlify/functions/final-credit-hook.js
// REAL-TIME qualified-doc credit. Called by the payment processor the moment a
// FINAL charge succeeds. Stamps FINAL_1 on the deal and writes qualified_doc +
// pif/pif_fast_start events immediately - no waiting for the hourly sync or the
// nightly watchdog. Auth: X-API-Key must equal PIPEDRIVE_API_KEY (shared secret
// both repos already have). Idempotent: merge-duplicates dedupes events; a
// repeat call is harmless.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PD_KEY = process.env.PIPEDRIVE_API_KEY;
const F = {
  DOC_1: '314d267ebc05d3623ffd8aab701baae7bea29aa8',
  PARTIAL_1: '35c626c805984517bacdba0b20aa20ab7ee3c48a',
  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4'
};
const YES = { DOC_1: '1104', PARTIAL_1: '1106', FINAL_1: '1108' };
const fieldIs = (v, want) => { const id = (v && typeof v === 'object') ? String(v.id ?? v.value ?? '') : String(v ?? ''); return id === want; };
function bizDaysSince(addTime, now) {
  if (!addTime) return 99;
  let biz = 0, d = new Date(addTime); d.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(0, 0, 0, 0);
  while (d <= end && biz <= 6) { const w = d.getDay(); if (w !== 0 && w !== 6) biz++; d.setDate(d.getDate() + 1); }
  return biz;
}
exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || '';
  if (!PD_KEY || key !== PD_KEY) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  try {
    const body = JSON.parse(event.body || '{}');
    const dealId = String(body.deal_id || '');
    if (!dealId) return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'no deal_id' }) };
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Deal truth
    const dr = await fetch(`https://api.pipedrive.com/v1/deals/${dealId}?api_token=${PD_KEY}`);
    const deal = (await dr.json().catch(() => ({}))).data;
    if (!deal) return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'deal fetch failed', deal: dealId }) };
    const actions = [];
    // Stamp FINAL_1 from payment truth (caller asserts a final just cleared)
    if (!fieldIs(deal[F.FINAL_1], YES.FINAL_1)) {
      await fetch(`https://api.pipedrive.com/v1/deals/${dealId}?api_token=${PD_KEY}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [F.FINAL_1]: YES.FINAL_1 })
      });
      actions.push('stamped FINAL_1');
    }
    const doc1 = fieldIs(deal[F.DOC_1], YES.DOC_1);
    const partial1 = fieldIs(deal[F.PARTIAL_1], YES.PARTIAL_1);
    const base = {
      deal_id: Number(dealId), deal_title: deal.title || 'Unknown',
      deal_value: deal.value || 0, owner_name: deal.owner_name || 'Unassigned',
      owner_id: (deal.user_id && deal.user_id.id) || deal.user_id || null,
      org_name: deal.org_name || null, is_affiliate: false,
      doc1, partial1, final1: true,
      deal_add_time: deal.add_time || null, deal_won_time: deal.won_time || null,
      pipeline_id: deal.pipeline_id || null, stage_id: deal.stage_id || null,
      event_month: month, event_date: now.toISOString().split('T')[0]
    };
    const toWrite = [{ ...base, event_type: bizDaysSince(deal.add_time, now) <= 5 ? 'pif_fast_start' : 'pif' }];
    if (doc1) toWrite.push({ ...base, event_type: 'qualified_doc' });
    else actions.push('DOC_1 not set - qualified_doc withheld, watchdog will flag');
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/consultant_bonus_events?on_conflict=deal_id,event_type,event_month`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(toWrite)
    });
    if (!ins.ok) return { statusCode: 200, headers, body: JSON.stringify({ deal: dealId, actions, insert_error: (await ins.text()).slice(0, 200) }) };
    actions.push('events: ' + toWrite.map(t => t.event_type).join(', '));
    console.log(`[final-credit-hook] deal ${dealId} (${deal.title}): ${actions.join(' | ')}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deal: dealId, client: deal.title, owner: base.owner_name, actions }) };
  } catch (err) {
    console.error('[final-credit-hook]', err);
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
