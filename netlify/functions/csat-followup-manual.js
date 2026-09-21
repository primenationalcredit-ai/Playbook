// netlify/functions/csat-followup-manual.js
// CSAT FOLLOW-UP keyed door (Joe 9/21). The daily round2-survey-trigger posts the deal note + same-day
// AM call activity automatically after each send (its own copy of notifyAfterSend - require() between
// function files returns nothing in this repo). This door tests it on one client and catches up a day.
//   ?notifyOnly=<person_id>  note + call activity for one client (no survey is sent)
//   ?backfillToday=1         note + call activity for every automatic send logged today
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AM_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
async function pd(path, method = 'GET', body) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pipedrive ${method} ${path.split('?')[0]} -> ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}
function amNameOf(v) { if (!v) return null; if (typeof v === 'string') return v; return v.name || v.value || null; }
function contact(p) {
  const email = Array.isArray(p.email) ? (p.email.find(e => e.primary)?.value || p.email[0]?.value) : (p.email || null);
  const phone = Array.isArray(p.phone) ? (p.phone.find(x => x.primary)?.value || p.phone[0]?.value) : (p.phone || null);
  return { email: email || null, phone: phone || null };
}
// CSAT FOLLOW-UP (Joe 9/21): every Round 2 survey that goes out is posted on the client's deal,
// and the client's account manager gets a call activity due the same day. Fail-open: a Pipedrive
// hiccup never blocks the survey. One post per client per day (a resend or re-run won't double up).
async function notifyAfterSend(t, emailResult, smsResult) {
  const out = { deal_id: null, note_id: null, activity_id: null, assigned_to: null, error: null };
  try {
    const fmt = v => (v == null ? 'not sent' : (typeof v === 'string' ? v : JSON.stringify(v))).slice(0, 80);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const deals = ((await pd(`/persons/${t.person_id}/deals?status=open&limit=50`)).data) || [];
    if (!deals.length) { out.error = 'no open deal'; return out; }
    const deal = deals.find(d => Number(d.pipeline_id) === 45) || deals.sort((a, b) => String(b.update_time).localeCompare(String(a.update_time)))[0];
    out.deal_id = deal.id;
    const notes = ((await pd(`/notes?deal_id=${deal.id}&limit=50&sort=add_time%20DESC`)).data) || [];
    const utcToday = new Date().toISOString().slice(0, 10);
    if (notes.some(n => String(n.content || '').includes('CSAT SURVEY SENT') && String(n.add_time || '').slice(0, 10) === utcToday)) { out.error = 'already posted today'; return out; }
    let userId = null;
    const amName = String(t.am || '').trim().toLowerCase();
    if (amName) {
      const users = ((await pd('/users')).data) || [];
      const first = amName.split(/\s+/)[0];
      const hit = users.find(u => u.active_flag && String(u.name || '').toLowerCase().trim() === amName) || users.find(u => u.active_flag && String(u.name || '').toLowerCase().split(/\s+/)[0] === first);
      if (hit) { userId = hit.id; out.assigned_to = hit.name; }
    }
    if (!userId && deal.user_id) { userId = deal.user_id.id || deal.user_id.value || deal.user_id; out.assigned_to = (deal.user_id.name || 'deal owner') + ' (deal owner)'; }
    const lines = [
      `<b>CSAT SURVEY SENT ${today}</b>`,
      `Round 2 client satisfaction survey sent to ${t.name}.`,
      `Email: ${t.email || 'none on file'} (${fmt(emailResult)})`,
      `Text: ${t.phone || 'none on file'} (${fmt(smsResult)})`,
      `Account manager${t.am ? ' ' + t.am : ''}: please call the client today.`
    ];
    const note = await pd('/notes', 'POST', { deal_id: deal.id, person_id: Number(t.person_id), content: lines.join('<br>') });
    out.note_id = note.data && note.data.id;
    const act = { subject: `CALL TODAY: CSAT survey sent to ${t.name}`, type: 'call', due_date: today, deal_id: deal.id, person_id: Number(t.person_id), done: 0, note: 'The Round 2 CSAT survey just went out. Call the client today to follow up.' };
    if (userId) act.user_id = userId;
    const a = await pd('/activities', 'POST', act);
    out.activity_id = a.data && a.data.id;
  } catch (e) { out.error = e.message; }
  return out;
}
exports.handler = async (event) => {
  const k = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || (event.queryStringParameters || {}).key;
  if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid API key' }) };
  const params = event.queryStringParameters || {};
  try {
    if (params.notifyOnly) {
      const pr = (await pd(`/persons/${params.notifyOnly}`)).data || {};
      const c = contact(pr);
      let am = amNameOf(pr[AM_FIELD]);
      if (!am && pr[AM_FIELD] != null) { const pf = (await pd('/personFields?limit=500')).data || []; const f = pf.find(x => x.key === AM_FIELD); const o = f && (f.options || []).find(x => String(x.id) === String(pr[AM_FIELD])); am = o ? o.label : ''; }
      const t = { person_id: String(pr.id), name: pr.name || '', am: am || '', email: c.email, phone: c.phone };
      const r = await notifyAfterSend(t, 'TEST - no email sent', 'TEST - no text sent');
      return { statusCode: 200, headers, body: JSON.stringify({ notifyOnly: true, client: t.name, am: t.am, ...r }) };
    }
    if (params.backfillToday === '1') {
      const since = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
      const rr = await fetch(`${SUPABASE_URL}/rest/v1/survey_sends?survey_type=eq.round2_am&source=eq.auto&created_at=gte.${since}&select=person_id,client_name,client_email,client_phone,am_name,email_result,sms_result`, { headers: supa });
      const rows = rr.ok ? await rr.json() : [];
      const results = [];
      for (const r of rows) results.push({ client: r.client_name, ...(await notifyAfterSend({ person_id: String(r.person_id), name: r.client_name, am: r.am_name, email: r.client_email, phone: r.client_phone }, r.email_result, r.sms_result)) });
      return { statusCode: 200, headers, body: JSON.stringify({ backfillToday: true, readOk: rr.ok, rows: rows.length, results }) };
    }
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'use ?notifyOnly=<person_id> or ?backfillToday=1' }) };
  } catch (e) { return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }; }
};