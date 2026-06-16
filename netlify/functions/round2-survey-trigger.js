// round2-survey-trigger.js  (Playbook, scheduled daily)
// Finds clients whose CURRENT STATUS = 2ND RD DONE (option 708), and that haven't
// already been sent the Round 2 survey, then sends via the payment-processor sender
// and logs each send to survey_sends (so the AM view + resend have data, and nobody
// gets it twice).
//
// Manual use:
//   ?dryRun=1   -> returns who WOULD be sent (count + sample), sends nothing
//   ?limit=N    -> override the per-run cap (default 50)

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENDER_URL = process.env.SURVEY_SENDER_URL || 'https://asap-payment-processor.netlify.app/.netlify/functions/send-round2-survey';

const CURRENT_STATUS_FIELD = '612856f2221d04679c1809eadb77b30300936445';
const TARGET_STATUS = 708; // 2ND RD DONE
const AM_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const FILTER_NAME = 'ASAP Round2 Survey Auto (do not edit)';
const DEFAULT_CAP = 50;

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = (event && event.queryStringParameters) || {};
    const dryRun = params.dryRun === '1' || params.dryRun === 'true';
    const seedSkip = params.seedSkip === '1' || params.seedSkip === 'true';
    const cap = params.limit ? parseInt(params.limit, 10) : DEFAULT_CAP;

    // TEST MODE: send to a specified address + log a real row (source 'manual_test').
    // Bypasses Pipedrive and dedupe so you can exercise the full pipeline + Survey
    // Results list + Resend in one click. e.g. ?test=1&email=you@x.com&name=Test&am=Dex-Ann
    if (params.test === '1' || params.test === 'true') {
      const t = {
        person_id: 'test-' + Date.now(),
        name: params.name || 'Test Client',
        am: params.am || '',
        email: params.email || '',
        phone: params.phone || '',
      };
      if (!t.email && !t.phone) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide ?email= and/or ?phone=' }) };
      }
      let emailResult = null, smsResult = null;
      try {
        const sres = await fetch(SENDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
        const sjson = await sres.json().catch(() => ({}));
        emailResult = sjson.email || null; smsResult = sjson.sms || null;
      } catch (e) { emailResult = 'error: ' + e.message; }
      await fetch(`${SUPABASE_URL}/rest/v1/survey_sends`, {
        method: 'POST', headers: { ...supa, Prefer: 'return=minimal' },
        body: JSON.stringify({ person_id: t.person_id, client_name: t.name, client_email: t.email, client_phone: t.phone, am_name: t.am, survey_type: 'round2_am', source: 'manual_test', email_result: emailResult, sms_result: smsResult }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ test: true, sent_to: { email: t.email, phone: t.phone }, email: emailResult, sms: smsResult, note: 'Logged as manual_test. It now shows in Survey Results with a Resend button.' }) };
    }

    // 1) Field metadata: numeric id for the status field + AM option labels
    const fields = (await pd('/personFields?limit=500')).data || [];
    const statusField = fields.find(f => f.key === CURRENT_STATUS_FIELD);
    if (!statusField) throw new Error('CURRENT STATUS field not found');
    const amField = fields.find(f => f.key === AM_FIELD);
    const amMap = {};
    (amField?.options || []).forEach(o => { amMap[o.id] = o.label; });

    // 2) Find-or-create the saved filter for status = 708
    let filterId = null;
    const filters = (await pd('/filters?type=people')).data || [];
    const existing = filters.find(f => f.name === FILTER_NAME);
    if (existing) {
      filterId = existing.id;
    } else {
      const created = await pd('/filters', 'POST', {
        name: FILTER_NAME,
        type: 'people',
        conditions: {
          glue: 'and',
          conditions: [
            { glue: 'and', conditions: [{ object: 'person', field_id: statusField.id, operator: '=', value: TARGET_STATUS, extra_value: null }] },
            { glue: 'or', conditions: [] },
          ],
        },
      });
      filterId = created.data.id;
    }

    // 3) Pull matching persons
    const people = [];
    let start = 0, more = true, guard = 0;
    while (more && guard < 30) {
      const r = await pd(`/persons?filter_id=${filterId}&start=${start}&limit=500`);
      (r.data || []).forEach(p => people.push(p));
      more = r.additional_data?.pagination?.more_items_in_collection || false;
      start = r.additional_data?.pagination?.next_start || (start + 500);
      guard++;
      if (!r.data || r.data.length === 0) break;
    }

    // 4) Who has already been sent (paginate; the REST read caps at 1000 rows/page)
    const alreadySent = new Set();
    let offset = 0;
    while (offset <= 200000) {
      const sentRes = await fetch(`${SUPABASE_URL}/rest/v1/survey_sends?survey_type=eq.round2_am&select=person_id&limit=1000&offset=${offset}`, { headers: supa });
      if (!sentRes.ok) break;
      const rows = await sentRes.json();
      rows.forEach(r => alreadySent.add(String(r.person_id)));
      if (rows.length < 1000) break;
      offset += 1000;
    }

    // 5) Build the to-send list (defensive: confirm status, has a contact method, not already sent)
    const toSend = [];
    for (const p of people) {
      if (String(p[CURRENT_STATUS_FIELD]) !== String(TARGET_STATUS)) continue;
      if (alreadySent.has(String(p.id))) continue;
      const c = contact(p);
      if (!c.email && !c.phone) continue;
      toSend.push({ person_id: String(p.id), name: p.name || '', am: amNameOf(p[AM_FIELD]) || amMap[p[AM_FIELD]] || "", email: c.email, phone: c.phone });
    }

    if (dryRun) {
      return { statusCode: 200, headers, body: JSON.stringify({ dryRun: true, matched: people.length, eligible: toSend.length, sample: toSend.slice(0, 10) }) };
    }

    // Seed-skip: mark everyone currently at this status as already handled (no sends),
    // so the daily trigger only ever sends to clients who arrive at the status later.
    if (seedSkip) {
      const rows = people
        .filter(p => !alreadySent.has(String(p.id)))
        .map(p => ({ person_id: String(p.id), client_name: p.name || '', am_name: amNameOf(p[AM_FIELD]) || amMap[p[AM_FIELD]] || '', survey_type: 'round2_am', source: 'backlog_seed' }));
      let seeded = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/survey_sends`, { method: 'POST', headers: { ...supa, Prefer: 'return=minimal' }, body: JSON.stringify(chunk) });
        if (res.ok) seeded += chunk.length;
      }
      return { statusCode: 200, headers, body: JSON.stringify({ seedSkip: true, matched: people.length, seeded, note: 'Backlog marked as handled. Only new arrivals at this status will be surveyed going forward.' }) };
    }

    // 6) Send (capped) and log
    let sent = 0; const results = [];
    for (const t of toSend.slice(0, cap)) {
      let emailResult = null, smsResult = null;
      try {
        const sres = await fetch(SENDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
        const sjson = await sres.json().catch(() => ({}));
        emailResult = sjson.email || null; smsResult = sjson.sms || null;
      } catch (e) { emailResult = 'error: ' + e.message; }
      await fetch(`${SUPABASE_URL}/rest/v1/survey_sends`, {
        method: 'POST', headers: { ...supa, Prefer: 'return=minimal' },
        body: JSON.stringify({ person_id: t.person_id, client_name: t.name, client_email: t.email, client_phone: t.phone, am_name: t.am, survey_type: 'round2_am', source: 'auto', email_result: emailResult, sms_result: smsResult }),
      });
      sent++; results.push({ name: t.name, email: emailResult, sms: smsResult });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ matched: people.length, eligible: toSend.length, sent, remaining: Math.max(0, toSend.length - sent), results }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
