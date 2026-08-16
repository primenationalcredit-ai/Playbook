// netlify/functions/mobile-metrics.js
//
// Joe's phone dashboard (8/15): a bookmarkable, key-gated link that returns
// today's real numbers as simple {label, value} boxes. Adding a metric later
// is just adding one more entry to the array below - the mobile page just
// loops over whatever comes back, no redesign needed.
//
// Definitions reused from consultant-metrics.js (the trusted, already-live
// per-consultant dashboard) so this shows the same numbers everyone else
// already trusts, not a slightly-different guess:
//   consultation = deal with both "Quoted Pipeline Changed At" AND
//                  "Consultant Intro Text Sent At" non-null
//   sold         = deal with "Sold Pipeline Changed At" set (Pipedrive filter
//                  178773, SOLD_THIS_MONTH, mirrored into Supabase by the
//                  deals webhook)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AR_KEY = process.env.AR_INTERNAL_API_KEY;
const PROCESSOR = process.env.PROCESSOR_BASE_URL || 'https://asap-payment-processor.netlify.app';
const ACCESS_KEY = 'YLk7xzTw4K1okgbfM_7RsFiVEWrlSnvr';

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const key = (event.queryStringParameters && event.queryStringParameters.key) || '';
  if (key !== ACCESS_KEY) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid key' }) };

  const boxes = [];
  const SBH = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  // ===== Today's window, America/Chicago (business timezone) =====
  const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const startISO = `${todayCT}T00:00:00-06:00`;
  const nextDay = new Date(new Date(`${todayCT}T00:00:00-06:00`).getTime() + 24 * 60 * 60 * 1000);
  const endISO = nextDay.toISOString();

  // ===== Today's Collected (real, gateway-verified, cross-site to the processor's proven ticker) =====
  try {
    const r = await fetch(`${PROCESSOR}/.netlify/functions/authnet-today`, { headers: { 'X-API-Key': AR_KEY } });
    const d = await r.json().catch(() => ({}));
    if (d && d.authnet) {
      boxes.push({ label: "Today's Collected", value: `$${Number(d.authnet.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sublabel: `${d.authnet.count || 0} transactions` });
    } else {
      boxes.push({ label: "Today's Collected", value: '—', sublabel: 'unavailable right now' });
    }
  } catch (e) {
    boxes.push({ label: "Today's Collected", value: '—', sublabel: 'unavailable right now' });
  }

  // ===== Consultations Today =====
  let consultDealIds = new Set();
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/deals?select=deal_id&"Quoted Pipeline Changed At"=not.is.null&"Consultant Intro Text Sent At"=gte.${startISO}&"Consultant Intro Text Sent At"=lt.${endISO}`,
      { headers: SBH }
    );
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows)) rows.forEach(row => consultDealIds.add(String(row.deal_id)));
    boxes.push({ label: 'Consultations Today', value: String(consultDealIds.size) });
  } catch (e) {
    boxes.push({ label: 'Consultations Today', value: '—', sublabel: 'unavailable right now' });
  }

  // ===== Sold Today =====
  let soldDealIds = new Set();
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/deals?select=deal_id&"Sold Pipeline Changed At"=gte.${startISO}&"Sold Pipeline Changed At"=lt.${endISO}`,
      { headers: SBH }
    );
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows)) rows.forEach(row => soldDealIds.add(String(row.deal_id)));
    boxes.push({ label: 'Sold Today', value: String(soldDealIds.size) });
  } catch (e) {
    boxes.push({ label: 'Sold Today', value: '—', sublabel: 'unavailable right now' });
  }

  // ===== Not Sold Today (had a consultation today, hasn't sold today) =====
  let notSold = 0;
  consultDealIds.forEach(id => { if (!soldDealIds.has(id)) notSold++; });
  boxes.push({ label: 'Not Sold Today', value: String(notSold), sublabel: 'consulted today, not yet sold' });

  return { statusCode: 200, headers, body: JSON.stringify({ date: todayCT, boxes }) };
};
