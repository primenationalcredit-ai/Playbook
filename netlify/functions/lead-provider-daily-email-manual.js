// lead-provider-daily-email.js (Playbook)
// Sends yesterday's daily metrics to Jeff at Vertimedia (Joe 9/14) - Handled
// Calls, Calls over 120s, Reports Pulled, Consultations Done, Proceeded
// (Initial Payment Taken). Scheduled every morning; also callable manually.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const TO_EMAIL = 'jeff@vertimedia.net';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!SENDGRID_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SENDGRID_API_KEY not configured' }) };

  try {
    // Yesterday, Chicago time - this is a "here's how yesterday went" email.
    const now = new Date();
    const chicagoToday = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const y = new Date(`${chicagoToday}T12:00:00Z`);
    y.setDate(y.getDate() - 1);
    const dayStr = y.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
    const mRes = await fetch(`${base}/.netlify/functions/lead-provider-daily-metrics?date=${dayStr}`);
    const m = await mRes.json().catch(() => null);
    if (!m || m.error) return { statusCode: 502, headers, body: JSON.stringify({ error: 'metrics fetch failed', detail: m }) };

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
