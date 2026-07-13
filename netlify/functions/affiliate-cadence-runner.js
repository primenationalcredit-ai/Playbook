// affiliate-cadence-runner.js  (Playbook)
// The affiliate outreach engine. Runs every 30 minutes during business hours.
// SHIPS DISABLED: app_config.affiliate_engine_enabled must be 'true' before anything sends.
//
// Rails (all enforced here):
//   - skips paused / opted_out / super_affiliate / missing contact
//   - skips any affiliate with an OPEN call task (a human touch is owed - nothing sends)
//   - daily caps from app_config (email + sms separately), counters reset each day
//   - SMS: only 9am to 6pm Central, max one SMS per affiliate per 7 days, never to cold segment
//   - cold segment: email only, min 30 days between touches
//   - per-run processing limit keeps sends gradual (ramp by raising the daily cap)
//   - every send logged to affiliate_touches; call steps create affiliate_call_tasks
//   - segment change (sync recomputes nightly) restarts the cadence in the new segment
//
// Priority order per run: new_never (newest first), dormant, slowing, producing, cold.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const PD_FU_NOTES_KEY = '17c6fcd0a8bcc21bbba680a8fe82697d9f996df9'; // Additional F/U Notes org field

// Write every touch back to Pipedrive so the whole company sees the nurture happening.
// Appends a dated line, keeps the newest ~3500 chars, never blocks a send on failure.
async function appendPipedriveFollowUp(aff, line) {
  if (!PIPEDRIVE_TOKEN || !aff.pipedrive_org_id) return;
  try {
    const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${aff.pipedrive_org_id}`;
    const g = await fetch(`${base}?api_token=${PIPEDRIVE_TOKEN}`);
    const gd = await g.json();
    const existing = (gd && gd.data && gd.data[PD_FU_NOTES_KEY]) ? String(gd.data[PD_FU_NOTES_KEY]) : '';
    let combined = (existing ? existing + '\n' : '') + line;
    if (combined.length > 3500) combined = combined.slice(combined.length - 3500);
    await fetch(`${base}?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [PD_FU_NOTES_KEY]: combined })
    });
  } catch (e) { /* never block outreach on Pipedrive */ }
}
const FROM_EMAIL = process.env.AFFILIATE_FROM_EMAIL || 'teamelite@asapcreditrepairusa.com';
const SITE_BASE = process.env.URL || 'https://cute-cat-d9631c.netlify.app';

let RC_CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID || process.env.RC_CLIENT_ID;
let RC_CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET || process.env.RC_CLIENT_SECRET;
let RC_JWT = process.env.RINGCENTRAL_JWT || process.env.RC_JWT;
let RC_FROM = process.env.RINGCENTRAL_FROM_NUMBER || process.env.RC_FROM_NUMBER;

// Netlify's 4KB Lambda env cap can't hold the RC JWT - credentials live in Supabase
// app_secrets (RLS on, zero policies = service-role reads only). Env vars win if present.
async function loadRcSecrets() {
  if (RC_CLIENT_ID && RC_CLIENT_SECRET && RC_JWT && RC_FROM) return;
  try {
    const res = await supa(`app_secrets?key=in.(rc_client_id,rc_client_secret,rc_jwt,rc_from_number)&select=key,value`);
    const rows = (res && res.json) || [];
    const m = {}; rows.forEach((r) => { m[r.key] = r.value; });
    RC_CLIENT_ID = RC_CLIENT_ID || m.rc_client_id;
    RC_CLIENT_SECRET = RC_CLIENT_SECRET || m.rc_client_secret;
    RC_JWT = RC_JWT || m.rc_jwt;
    RC_FROM = RC_FROM || m.rc_from_number;
  } catch (e) { /* SMS attempts will surface the miss */ }
}
const RC_SERVER = process.env.RINGCENTRAL_SERVER || 'https://platform.ringcentral.com';

const PER_RUN_LIMIT = 25;
const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, status: r.status, json, text };
}

async function getConfig() {
  const r = await supa('app_config?select=key,value');
  const cfg = {};
  for (const row of (r.json || [])) cfg[row.key] = row.value;
  return cfg;
}
async function setConfig(key, value) {
  await supa('app_config?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key, value: String(value), updated_at: new Date().toISOString() }])
  });
}

function centralNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: parseInt(get('hour'), 10) };
}

function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }
function monthName(dateStr) {
  if (!dateStr) return 'a while back';
  const d = new Date(dateStr + 'T12:00:00Z');
  return isNaN(d) ? 'a while back' : d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

function mergeFields(text, aff, consultantName) {
  const monthsQuiet = aff.last_referral_date ? Math.max(0, Math.floor((Date.now() - new Date(aff.last_referral_date)) / (30 * 86400000))) : null;
  return String(text || '')
    .replace(/\{first_name\}/g, firstName(aff.contact_name || aff.org_name))
    .replace(/\{consultant_name\}/g, consultantName)
    .replace(/\{company\}/g, aff.company || aff.org_name || 'your company')
    .replace(/\{sold_clients\}/g, String(aff.sold_clients || 0))
    .replace(/\{client_word\}/g, (aff.sold_clients || 0) === 1 ? 'client' : 'clients')
    .replace(/\{referral_word\}/g, (aff.referred_deals || 0) === 1 ? 'referral' : 'referrals')
    .replace(/\{referred_deals\}/g, String(aff.referred_deals || 0))
    .replace(/\{last_referral_month\}/g, monthName(aff.last_referral_date))
    .replace(/\{months_quiet\}/g, monthsQuiet == null ? 'a few' : String(monthsQuiet))
    .replace(/\{portal_link\}/g, aff.portal_link || 'https://affiliates.asapcreditrepairusa.com')
    .replace(/\{result_story\}/g, 'a client whose bankruptcy was removed and came out 94 points higher');
}

// AI personalization: rewrite the template around THIS affiliate's real history so a
// partner who already referred gets thanked, a long-quiet signup reads differently than a
// fresh one, and industry context shapes the examples. Hard rules in the prompt; any
// failure falls back to the plain merged template.
async function aiPersonalize(subject, mergedBody, aff, consultantName) {
  const facts = {
    first_name: firstName(aff.contact_name || aff.org_name),
    company: aff.company || null,
    occupation: aff.occupation || null,
    industry: aff.industry || null,
    signed_up_days_ago: aff.pipedrive_add_time ? Math.floor((Date.now() - new Date(aff.pipedrive_add_time)) / 86400000) : null,
    referrals_sent: aff.referred_deals || 0,
    clients_won: aff.won_deals || 0,
    clients_sold: aff.sold_clients || 0,
    last_client_month: aff.last_referral_date ? monthName(aff.last_referral_date) : null,
    segment: aff.segment,
    consultant_name: consultantName,
    portal_link: aff.portal_link || null,
    payout_amount: aff.payout_amount || null
  };
  const prompt = `You personalize partner outreach emails for ASAP Credit & Financial Services. Rewrite the email below so it fits this exact partner, using only the facts provided.

FACTS ABOUT THIS PARTNER:
${JSON.stringify(facts, null, 2)}

HARD RULES:
- Keep the same core message, roughly the same length, and the same sign-off exactly as written.
- If referrals_sent is greater than 0, acknowledge it warmly near the top (for example thank them for already sending someone over). Never scold anyone for not referring.
- If clients_sold is 0, never write words that claim this partner has personally seen our results or watched us change lives. Their honest script uses our verifiable credentials (67,000 clients, 13 years, results based billing) instead of personal testimony.
- If payout_amount is null, this partner has no payout arrangement on file: NEVER mention payouts, commissions, earnings, getting paid, or any dollar amounts the partner could make. Remove any such lines from the original entirely and keep the focus on client outcomes and the partnership. If payout_amount has a value, payout mentions are allowed.
- Never invent facts, client names, numbers, or events not in the FACTS or the original email.
- Say "credit accelerator program" if referring to the program. NEVER use the phrase "credit repair".
- Exactly one URL may appear in the email: the portal_link. Keep it where the original put it, or omit if the original had none.
- No em dashes and no hyphens used as punctuation. Write ranges as "60 to 90 days".
- Warm, human, story-driven, short paragraphs, simple words. Not salesy.
- Output ONLY the rewritten email body as plain text. No subject line, no commentary, no markdown.

ORIGINAL EMAIL:
${mergedBody}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const d = await r.json();
  const text = ((d.content || []).find((c) => c.type === 'text') || {}).text || '';
  if (!text || text.length < 100) throw new Error('ai output too short');
  if (/credit repair/i.test(text)) throw new Error('ai used banned phrase');
  return text.trim();
}

async function sendEmail(aff, consultantName, consultantEmail, subject, body) {
  const unsub = `${SITE_BASE}/.netlify/functions/affiliate-unsub?id=${aff.id}&k=${Buffer.from(String(aff.pipedrive_org_id)).toString('base64')}`;
  const fullBody = `${body}\n\n----\nNo longer want partner emails? Unsubscribe: ${unsub}`;
  const payload = {
    personalizations: [{ to: [{ email: aff.contact_email }] }],
    from: { email: FROM_EMAIL, name: `${consultantName} at ASAP` },
    reply_to: { email: consultantEmail || FROM_EMAIL, name: consultantName },
    subject,
    content: [{ type: 'text/plain', value: fullBody }]
  };
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (r.status !== 202) throw new Error(`SendGrid ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

let rcToken = null;
async function rcAuth() {
  if (rcToken) return rcToken;
  const r = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64') },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: RC_JWT })
  });
  if (!r.ok) throw new Error(`RC auth ${r.status}`);
  rcToken = (await r.json()).access_token;
  return rcToken;
}
async function sendSms(toPhone, text) {
  const token = await rcAuth();
  const digits = String(toPhone).replace(/[^\d+]/g, '');
  const to = digits.startsWith('+') ? digits : `+1${digits.replace(/^1/, '')}`;
  const r = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: { phoneNumber: RC_FROM }, to: [{ phoneNumber: to }], text })
  });
  if (!r.ok) throw new Error(`RC sms ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

exports.handler = async (event) => {
  const params = (event && event.queryStringParameters) || {};
  const dryRun = params.dry === '1';
  try {
    const cfg = await getConfig();
    // TEST MODE: ?only={id} targets a single affiliate for a REAL send (engine gate, due-date,
    // and SMS window bypassed). Everything else - AI personalization, logging, Pipedrive
    // write-back, cadence advance - behaves exactly like production.
    const onlyId = parseInt((event.queryStringParameters || {}).only, 10) || null;
    if (cfg.affiliate_engine_enabled !== 'true' && !dryRun && !onlyId) {
      return { statusCode: 200, headers, body: JSON.stringify({ skipped: 'engine disabled (app_config.affiliate_engine_enabled)' }) };
    }

    const { date: todayCT, hour: hourCT } = centralNow();
    // daily counter reset
    if (cfg.affiliate_send_date !== todayCT) {
      await setConfig('affiliate_send_date', todayCT);
      await setConfig('affiliate_emails_sent_today', '0');
      await setConfig('affiliate_sms_sent_today', '0');
      cfg.affiliate_emails_sent_today = '0';
      cfg.affiliate_sms_sent_today = '0';
    }
    let emailsSent = parseInt(cfg.affiliate_emails_sent_today || '0', 10);
    let smsSent = parseInt(cfg.affiliate_sms_sent_today || '0', 10);
    const emailCap = parseInt(cfg.affiliate_daily_email_cap || '150', 10);
    const smsCap = parseInt(cfg.affiliate_daily_sms_cap || '100', 10);
    const smsWindowOpen = onlyId ? true : (hourCT >= 9 && hourCT < 18);
    await loadRcSecrets();

    // templates
    const tRes = await supa('affiliate_templates?active=eq.true&select=*&order=segment,step_number');
    const templates = tRes.json || [];
    const bySegment = {};
    for (const t of templates) { (bySegment[t.segment] = bySegment[t.segment] || []).push(t); }
    const rotation = bySegment['rotation'] || [];

    // consultants (owner name -> email) for reply-to
    const uRes = await supa('users?select=name,email');
    const userEmail = {};
    for (const u of (uRes.json || [])) { if (u.name && u.email) userEmail[u.name.toLowerCase().split(/\s+/)[0]] = u.email; }
    const consultantEmailFor = (owner) => userEmail[String(owner || '').toLowerCase().split(/\s+/)[0]] || null;

    // open call tasks (affiliates with one get NOTHING)
    const ctRes = await supa('affiliate_call_tasks?status=eq.open&select=affiliate_org_id');
    const openCallOrgIds = new Set((ctRes.json || []).map((t) => t.affiliate_org_id));

    // due affiliates: never touched (next_touch_due null) or due today/earlier
    const segPriority = ['new_never', 'dormant', 'slowing', 'producing', 'cold'];
    const dueRes = onlyId
      ? await supa(`affiliate_orgs?id=eq.${onlyId}&select=*`)
      : await supa(
          `affiliate_orgs?paused=eq.false&opted_out=eq.false&super_affiliate=eq.false&missing_contact=eq.false` +
          `&or=(next_touch_due.is.null,next_touch_due.lte.${todayCT})` +
          `&select=*&order=pipedrive_add_time.desc&limit=600`
        );
    let due = (dueRes.json || []).filter((a) => !openCallOrgIds.has(a.id));
    due.sort((a, b) => segPriority.indexOf(a.segment) - segPriority.indexOf(b.segment));

    const results = { processed: 0, emails: 0, sms: 0, calls_created: 0, skipped: [], errors: [] };

    for (const aff of due) {
      if (results.processed >= PER_RUN_LIMIT) break;

      // segment change since cadence started -> restart in new segment
      let step = aff.cadence_step || 0;
      let cadSeg = aff.cadence_segment;
      if (cadSeg && cadSeg !== aff.segment) { step = 0; cadSeg = aff.segment; }
      if (!cadSeg) cadSeg = aff.segment;

      // pick next template: sequence step, else rotation cycle
      const seq = bySegment[cadSeg] || [];
      let tmpl = null, rotationMode = false;
      // Milestone: their very FIRST client just sold (producing = sale within 30 days,
      // so this can never fire stale) and this is the first producing touch -> congrats.
      if (cadSeg === 'producing' && (aff.sold_clients || 0) === 1 && step === 0 && (bySegment['producing_first'] || [])[0]) {
        tmpl = bySegment['producing_first'][0];
      } else if (step < 100) {
        tmpl = seq.find((t) => t.step_number === step + 1) || null;
        if (!tmpl && rotation.length > 0) { rotationMode = true; tmpl = rotation[0]; step = 100 - 1; } // first rotation
      } else {
        rotationMode = true;
        const rotTouch = step - 100 + 1; // 1st, 2nd, 3rd... monthly touch
        const rotCall = (bySegment['rotation_call'] || [])[0];
        if (rotTouch % 3 === 0 && rotCall) {
          tmpl = rotCall; // every 3rd monthly touch is a human call, forever
        } else {
          const idx = rotTouch % rotation.length;
          tmpl = rotation[idx] || rotation[0];
        }
      }
      if (!tmpl) { results.skipped.push({ org: aff.org_name, why: 'no template' }); continue; }

      const consultantName = firstName(aff.owner_name || '') || 'Your ASAP team';
      const consultantEmail = consultantEmailFor(aff.owner_name);

      // channel guards
      if (tmpl.channel === 'email' && !aff.contact_email) { results.skipped.push({ org: aff.org_name, why: 'no email' }); continue; }
      if (tmpl.channel === 'sms') {
        if (aff.segment === 'cold') { results.skipped.push({ org: aff.org_name, why: 'sms to cold blocked' }); continue; }
        if (!aff.contact_phone) { results.skipped.push({ org: aff.org_name, why: 'no phone' }); continue; }
        if (!smsWindowOpen) continue; // try again on a later run today
        if (smsSent >= smsCap) continue;
        // one SMS per 7 days
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const recent = await supa(`affiliate_touches?affiliate_org_id=eq.${aff.id}&channel=eq.sms&created_at=gte.${weekAgo}&select=id&limit=1`);
        if ((recent.json || []).length > 0) continue;
      }
      if (tmpl.channel === 'email' && emailsSent >= emailCap) continue;

      // compute next due date from the FOLLOWING step's offset
      const nextStepNumber = rotationMode ? null : step + 2;
      const nextTmpl = rotationMode ? null : seq.find((t) => t.step_number === nextStepNumber);
      const rotationGap = Math.max(7, parseInt(cfg.affiliate_rotation_gap_days || '30', 10) || 30);
      const gapDays = rotationMode ? rotationGap : (nextTmpl ? Math.max(1, nextTmpl.day_offset - tmpl.day_offset) : rotationGap);
      const nextDue = new Date(Date.now() + gapDays * 86400000).toISOString().slice(0, 10);
      const newStep = rotationMode ? (step < 100 ? 100 : step + 1) : step + 1;

      if (dryRun) {
        results.processed++;
        results.skipped.push({ org: aff.org_name, dry: `${cadSeg} step ${newStep} ${tmpl.channel}${tmpl.subject ? ': ' + tmpl.subject : ''} -> next due ${nextDue}` });
        continue;
      }

      try {
        if (tmpl.channel === 'call') {
          const stats = `${aff.sold_clients || 0} clients, last ${monthName(aff.last_referral_date)}`;
          await supa('affiliate_call_tasks', {
            method: 'POST', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify([{
              affiliate_org_id: aff.id, pipedrive_org_id: aff.pipedrive_org_id, org_name: aff.org_name,
              contact_phone: aff.contact_phone, segment: cadSeg, step_number: newStep,
              assigned_to: aff.owner_name || null, stats_line: stats,
              talking_points: mergeFields(tmpl.body, aff, consultantName),
              due_date: todayCT
            }])
          });
          results.calls_created++;
        } else if (tmpl.channel === 'email') {
          const mergedBody = mergeFields(tmpl.body, aff, consultantName);
          let finalBody = mergedBody, aiUsed = false;
          if (cfg.affiliate_ai_personalization === 'true' && ANTHROPIC_KEY) {
            try { finalBody = await aiPersonalize(tmpl.subject, mergedBody, aff, consultantName); aiUsed = true; }
            catch (e) { finalBody = mergedBody; }
          }
          await sendEmail(aff, consultantName, consultantEmail, mergeFields(tmpl.subject, aff, consultantName), finalBody);
          if (aiUsed) aff.__ai = true;
          emailsSent++; results.emails++;
        } else if (tmpl.channel === 'sms') {
          await sendSms(aff.contact_phone, mergeFields(tmpl.body, aff, consultantName));
          smsSent++; results.sms++;
        }

        await supa('affiliate_touches', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{
            affiliate_org_id: aff.id, pipedrive_org_id: aff.pipedrive_org_id, channel: tmpl.channel,
            segment: cadSeg, step_number: newStep, template_id: tmpl.id, subject: tmpl.subject || null,
            status: tmpl.channel === 'call' ? 'task_created' : 'sent',
            detail: aff.__ai ? 'ai_personalized' : null
          }])
        });
        const fuLine = tmpl.channel === 'call'
          ? `${todayCT}: Call task created for ${aff.owner_name || 'team'} (ASAP outreach)`
          : tmpl.channel === 'sms'
            ? `${todayCT}: SMS sent (ASAP outreach)`
            : `${todayCT}: Email sent: ${tmpl.subject || 'value email'}${aff.__ai ? ' (personalized)' : ''} (ASAP outreach)`;
        await appendPipedriveFollowUp(aff, fuLine);
        await supa(`affiliate_orgs?id=eq.${aff.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            cadence_step: newStep, cadence_segment: cadSeg,
            next_touch_due: tmpl.channel === 'call' ? null : nextDue, // call: resumes when task completes
            last_touch_at: new Date().toISOString(), last_touch_channel: tmpl.channel
          })
        });
        results.processed++;
      } catch (e) {
        results.errors.push({ org: aff.org_name, error: String(e.message || e).slice(0, 150) });
        if (results.errors.length >= 5) break; // stop the run if things are failing
      }
    }

    await setConfig('affiliate_emails_sent_today', emailsSent);
    await setConfig('affiliate_sms_sent_today', smsSent);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, due_count: due.length, ...results, caps: { emailsSent, emailCap, smsSent, smsCap, smsWindowOpen },
      ...(onlyId ? { rc_diag: { client_id: !!RC_CLIENT_ID, client_secret: !!RC_CLIENT_SECRET, jwt_chars: RC_JWT ? String(RC_JWT).length : 0, from_number: RC_FROM || null } } : {}) }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e).slice(0, 300) }) };
  }
};
