// netlify/functions/db-health-watchdog-manual.js
// DATABASE WATCHDOG (Joe 9/21, second Playbook outage in a week). Asks the database one
// tiny question. No answer, or slower than 5 seconds, twice in a row = email management
// right away, so leadership hears about an outage before the team does. The schedule
// lives in db-health-watchdog.js, which calls this over HTTP (Netlify blocks direct calls
// to scheduled functions, and require() between function files returns nothing here).
// Keyed: X-API-Key. ?test=1 sends a test email.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SG_KEY = process.env.SENDGRID_API_KEY;
const FROM = 'info@asapcreditrepairusa.com';
const TO = process.env.DB_WATCHDOG_TO || 'management@asapcreditrepairusa.com';
const SLOW_MS = 5000;

async function probe() {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id&limit=1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, signal: ctrl.signal });
    const ms = Date.now() - started;
    if (!r.ok) return { ok: false, ms, why: 'error HTTP ' + r.status };
    return { ok: ms < SLOW_MS, ms, why: ms < SLOW_MS ? 'ok' : 'slow' };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, why: e.name === 'AbortError' ? 'no answer within 8 seconds' : e.message };
  } finally { clearTimeout(timer); }
}

async function sendEmail(subject, text) {
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SG_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ personalizations: [{ to: [{ email: TO }] }], from: { email: FROM, name: 'Playbook Watchdog' }, subject, content: [{ type: 'text/plain', value: text }] }),
  });
  return r.status;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  const k = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || (event.queryStringParameters || {}).key;
  if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid API key' }) };
  const qs = event.queryStringParameters || {};
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/Denver' });
  if (qs.test === '1') {
    const s = await sendEmail('TEST: Playbook database watchdog is on', `This is a test sent ${when} MT.\n\nFrom now on, the Playbook database is checked every 10 minutes. If it is slow or not answering twice in a row, this address gets an alert right away.`);
    return { statusCode: 200, headers, body: JSON.stringify({ test: true, sendgridStatus: s }) };
  }
  const a = await probe();
  if (a.ok) return { statusCode: 200, headers, body: JSON.stringify({ healthy: true, check: a }) };
  await new Promise((r) => setTimeout(r, 4000));
  const b = await probe();
  if (b.ok) return { statusCode: 200, headers, body: JSON.stringify({ healthy: true, recoveredOnRetry: true, first: a, second: b }) };
  const kind = (a.why === 'slow' && b.why === 'slow') ? 'SLOW' : 'NOT ANSWERING';
  const status = await sendEmail(`ALERT: Playbook database is ${kind}`,
    `Checked twice at ${when} MT.\nTry 1: ${a.why} (${a.ms} ms)\nTry 2: ${b.why} (${b.ms} ms)\n\nWhat to do:\n1. Open https://supabase.com/dashboard/project/kkcbpqbcpzcarxhknzza and look for a warning banner.\n2. If it is frozen: Settings > General > Restart project.\n\nThis email repeats every 10 minutes until the database answers normally.`);
  return { statusCode: 200, headers, body: JSON.stringify({ healthy: false, first: a, second: b, emailed: status }) };
};