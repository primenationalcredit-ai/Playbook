// lead-provider-daily-email.js (Playbook)
// Sends yesterday's daily metrics to Jeff at Vertimedia (Joe 9/14) - Handled
// Calls, Calls over 120s, Reports Pulled, Consultations Done, Proceeded
// (Initial Payment Taken). Scheduled every morning; also callable manually.
//
// Three guards Joe asked for explicitly (9/14):
//   1. GO-LIVE GATE: does nothing until app_config key
//      'vertimedia_daily_email_enabled' = 'true'. Joe controls when this
//      flips, not "whenever real data shows up" - stays off by default.
//   2. NEVER ON SUNDAYS: no one's working, so yesterday-was-Sunday reports
//      never go out.
//   3. NEVER ALL-ZERO: even once enabled, a day with nothing real to report
//      (all five metrics at zero) is skipped rather than emailed as-is.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TO_EMAIL = 'jeff@vertimedia.net';
const CONFIG_KEY = 'vertimedia_daily_email_enabled';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!SENDGRID_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SENDGRID_API_KEY not configured' }) };
  if (!SUPABASE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }) };

  try {
    // Guard 1: go-live gate. Off by default; Joe flips this on when ready.
    const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.${CONFIG_KEY}&select=value`, { headers: SB });
    const cfgRows = await cfgRes.json().catch(() => []);
    const enabled = Array.isArray(cfgRows) && cfgRows[0] && cfgRows[0].value === 'true';
    if (!enabled) return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'not yet enabled - Joe has not gone live with this' }) };

    // Yesterday, Chicago time.
    const now = new Date();
    const chicagoToday = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const y = new Date(`${chicagoToday}T12:00:00Z`);
    y.setDate(y.getDate() - 1);
    const dayStr = y.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    // Guard 2: never report on a Sunday.
    const dow = y.getUTCDay(); // noon UTC anchor above avoids any DST/midnight edge flip
    if (dow === 0) return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'yesterday was a Sunday - nothing to report' }) };

    const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
    const mRes = await fetch(`${base}/.netlify/functions/lead-provider-daily-metrics?date=${dayStr}`);
    const m = await mRes.json().catch(() => null);
    if (!m || m.error) return { statusCode: 502, headers, body: JSON.stringify({ error: 'metrics fetch failed', detail: m }) };

    // Guard 3: never send an all-zero report.
    const total = (m.handled_calls || 0) + (m.calls_over_120s || 0) + (m.reports_pulled || 0) + (m.consultations_done || 0) + (m.proceeded_initial_payment || 0);
    if (total === 0) return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'all metrics were zero for this day', metrics: m }) };

    const lines = [
      `Daily metrics for ${dayStr}`,
      '',
      `Handled Calls: ${m.handled_calls}`,
      `Calls over 120 seconds: ${m.calls_over_120s}`,
      `Total Reports Pulled: ${m.reports_pulled}`,
      `Total Consultations Done: ${m.consultations_done}`,
      `Total Proceeded (Initial Payment Taken): ${m.proceeded_initial_payment}`,
    ];

    const sendRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + SENDGRID_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: TO_EMAIL }] }],
        from: { email: 'info@asapcreditrepairusa.com', name: 'ASAP Credit Repair' },
        subject: `Vertimedia Daily Metrics - ${dayStr}`,
        content: [{ type: 'text/plain', value: lines.join('\n') }]
      })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: sendRes.ok, sent_to: TO_EMAIL, metrics: m }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
