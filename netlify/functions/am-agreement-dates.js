// am-agreement-dates.js  (VISIBILITY ONLY - never affects the bonus)
//
// "% of clients who kept their agreement dates" per Account Manager.
// Source: the autobilling payment processor's scheduled_charges table, which the
// team's autobill-manager form writes to when a payment date is changed. A charge
// counts as "changed" when its current due_date differs from the original date.
//
// Attribution is by the client's ASSIGNED AM (from the am_person_to_am cache via
// the client's deal), NOT by who clicked the form (the form uses one shared
// passcode). The AM owns the client, so a moved date counts toward that AM.
//
// Requires (set in Netlify when autobilling goes live):
//   PAYMENT_SUPABASE_URL  - the payment processor's Supabase URL
//   PAYMENT_SUPABASE_KEY  - a read key for it
// And the payment processor's scheduled_charges must carry original_due_date
// (added at autobilling launch). Until both exist this returns needsData:true and
// the dashboard shows "Tracking begins at autobilling launch" instead of a number.

const PAYMENT_SUPABASE_URL = process.env.PAYMENT_SUPABASE_URL || '';
const PAYMENT_SUPABASE_KEY = process.env.PAYMENT_SUPABASE_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const localSupa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    if (!PAYMENT_SUPABASE_URL || !PAYMENT_SUPABASE_KEY) {
      return { statusCode: 200, headers, body: JSON.stringify({ needsData: true, byAM: {}, message: 'Tracking begins at autobilling launch.' }) };
    }

    // deal_id -> AM map (from additional-rounds cache + person map)
    let dealToAM = {};
    try {
      const dm = await fetch(`${SUPABASE_URL}/rest/v1/deal_am_map?select=deal_id,am_name`, { headers: localSupa });
      if (dm.ok) { const rows = await dm.json(); rows.forEach(r => { dealToAM[r.deal_id] = r.am_name; }); }
    } catch (e) {}

    // Pull scheduled charges (only need attribution + whether the date moved)
    const paySupa = { apikey: PAYMENT_SUPABASE_KEY, Authorization: `Bearer ${PAYMENT_SUPABASE_KEY}` };
    const scRes = await fetch(`${PAYMENT_SUPABASE_URL}/rest/v1/scheduled_charges?select=pipedrive_deal_id,due_date,original_due_date,status`, { headers: paySupa });
    if (!scRes.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ needsData: true, byAM: {}, message: 'Tracking begins at autobilling launch.' }) };
    }
    const charges = await scRes.json();
    if (!charges.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ needsData: false, byAM: {}, totalClients: 0, message: 'No scheduled charges yet.' }) };
    }

    // One row per client (a client kept their dates only if NONE of their charges moved)
    const perClient = {}; // deal_id -> { changed }
    for (const c of charges) {
      const dealId = c.pipedrive_deal_id;
      if (!dealId) continue;
      const changed = c.original_due_date && c.due_date && c.original_due_date !== c.due_date;
      if (!perClient[dealId]) perClient[dealId] = { changed: false };
      if (changed) perClient[dealId].changed = true;
    }

    const byAM = {};
    let unattributed = 0;
    for (const [dealId, info] of Object.entries(perClient)) {
      const am = dealToAM[dealId];
      if (!am) { unattributed++; continue; }
      if (!byAM[am]) byAM[am] = { total: 0, kept: 0 };
      byAM[am].total++;
      if (!info.changed) byAM[am].kept++;
    }
    for (const am of Object.keys(byAM)) {
      byAM[am].pctKept = byAM[am].total > 0 ? Math.round((byAM[am].kept / byAM[am].total) * 100) : 0;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ needsData: false, byAM, unattributed, calculatedAt: new Date().toISOString() }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
