// lead-provider-daily-metrics.js (Playbook)
// Daily agent-facing metrics for Vertimedia (Joe 9/14), matching the categories
// their previous provider reported (not copying that provider's exact design,
// just the categories Joe flagged as the important ones):
//   Handled Calls, Calls over 120s, Reports Pulled, Consultations Done, Proceeded
// (Initial Payment Taken). GET ?date=YYYY-MM-DD (defaults to today, Chicago time).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PD_BASE = 'https://asapcreditrepairusa.pipedrive.com/api/v1';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

// Ready to Quote stage id - a deal LEAVING this stage (into any other Quoted 2.0
// stage) is what counts as "consultation done" for the day it happens.
const READY_TO_QUOTE_STAGE = 490;
const QUOTED_PIPELINE = 42;
const SOLD_PIPELINE = 7;
const CRS_PIPELINE = 45;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!SUPABASE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }) };

  const qs = event.queryStringParameters || {};
  const dayStr = qs.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const dayStart = `${dayStr}T00:00:00.000Z`;
  const dayEnd = `${dayStr}T23:59:59.999Z`;

  try {
    const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

    // Calls for the day, straight from the gateway/RingCentral sync.
    const callsRes = await fetch(`${SUPABASE_URL}/rest/v1/lead_provider_calls?call_start=gte.${dayStart}&call_start=lte.${dayEnd}&select=*`, { headers: SB });
    const calls = await callsRes.json().catch(() => []);
    const callList = Array.isArray(calls) ? calls : [];
    const handledCalls = callList.length;
    const callsOver120 = callList.filter(c => c.qualifying).length;

    // Every deal ever tagged to a call - checked live against Pipedrive for
    // today's activity, since Pipedrive doesn't keep field-change history.
    const allTaggedRes = await fetch(`${SUPABASE_URL}/rest/v1/lead_provider_calls?pipedrive_deal_id=not.is.null&select=pipedrive_deal_id`, { headers: SB });
    const allTagged = await allTaggedRes.json().catch(() => []);
    const taggedDealIds = [...new Set((Array.isArray(allTagged) ? allTagged : []).map(c => c.pipedrive_deal_id).filter(Boolean))];

    let reportsToday = 0, consultationsToday = 0, proceededToday = 0;
    for (const dealId of taggedDealIds) {
      try {
        const r = await fetch(`${PD_BASE}/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`);
        const j = await r.json().catch(() => null);
        const deal = j && j.data ? j.data : null;
        if (!deal) continue;

        // Report pulled today: deal created today AND currently sitting past the
        // brand-new-lead stage (a report only gets pulled once the deal is real).
        const createdDay = String(deal.add_time || '').slice(0, 10);
        if (createdDay === dayStr) reportsToday++;

        const changedDay = String(deal.stage_change_time || '').slice(0, 10);
        if (changedDay === dayStr) {
          if (deal.pipeline_id === QUOTED_PIPELINE && deal.stage_id !== READY_TO_QUOTE_STAGE) consultationsToday++;
          if (deal.pipeline_id === SOLD_PIPELINE || deal.pipeline_id === CRS_PIPELINE) proceededToday++;
        }
      } catch (e) { /* one bad deal lookup shouldn't kill the whole report */ }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        date: dayStr,
        handled_calls: handledCalls,
        calls_over_120s: callsOver120,
        reports_pulled: reportsToday,
        consultations_done: consultationsToday,
        proceeded_initial_payment: proceededToday,
      })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
