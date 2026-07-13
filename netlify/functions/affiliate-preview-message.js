// affiliate-preview-message.js  (Playbook)
// GET ?id={affiliate_orgs.id}
// Returns the affiliate's next message BOTH ways: the raw merged template and the
// AI-personalized version - the exact same code path the runner uses at send time.
// Read-only: sends nothing, advances nothing, logs nothing.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

async function supa(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return r.ok ? r.json() : [];
}

function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }
function monthName(dateStr) {
  if (!dateStr) return 'a while back';
  const d = new Date(dateStr + 'T12:00:00Z');
  return isNaN(d) ? 'a while back' : d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}
function mergeFields(text, aff, consultantName) {
  return String(text || '')
    .replace(/\{first_name\}/g, firstName(aff.contact_name || aff.org_name))
    .replace(/\{consultant_name\}/g, consultantName)
    .replace(/\{company\}/g, aff.company || aff.org_name || 'your company')
    .replace(/\{sold_clients\}/g, String(aff.sold_clients || 0))
    .replace(/\{client_word\}/g, (aff.sold_clients || 0) === 1 ? 'client' : 'clients')
    .replace(/\{referral_word\}/g, (aff.referred_deals || 0) === 1 ? 'referral' : 'referrals')
    .replace(/\{referred_deals\}/g, String(aff.referred_deals || 0))
    .replace(/\{last_referral_month\}/g, monthName(aff.last_referral_date))
    .replace(/\{portal_link\}/g, aff.portal_link || 'https://portal.asapcreditrepairusa.com')
    .replace(/\{result_story\}/g, 'a client whose bankruptcy was removed and came out 94 points higher');
}

async function aiPersonalize(mergedBody, aff, consultantName) {
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
    portal_link: aff.portal_link || null
  };
  const prompt = `You personalize partner outreach emails for ASAP Credit & Financial Services. Rewrite the email below so it fits this exact partner, using only the facts provided.

FACTS ABOUT THIS PARTNER:
${JSON.stringify(facts, null, 2)}

HARD RULES:
- Keep the same core message, roughly the same length, and the same sign-off exactly as written.
- If referrals_sent is greater than 0, acknowledge it warmly near the top (for example thank them for already sending someone over). Never scold anyone for not referring.
- If clients_sold is 0, never write words that claim this partner has personally seen our results or watched us change lives. Their honest script uses our verifiable credentials (67,000 clients, 13 years, results based billing) instead of personal testimony.
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

exports.handler = async (event) => {
  try {
    const id = parseInt((event.queryStringParameters || {}).id, 10);
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing id' }) };

    const rows = await supa(`affiliate_orgs?id=eq.${id}&select=*`);
    const aff = rows && rows[0];
    if (!aff) return { statusCode: 404, headers, body: JSON.stringify({ error: 'affiliate not found' }) };

    const templates = await supa('affiliate_templates?active=eq.true&select=*&order=segment,step_number');
    const seg = aff.cadence_segment && aff.cadence_segment !== aff.segment ? aff.segment : (aff.cadence_segment || aff.segment);
    const step = (aff.cadence_segment && aff.cadence_segment !== aff.segment) ? 0 : (aff.cadence_step || 0);
    const seq = templates.filter((t) => t.segment === seg);
    const rot = templates.filter((t) => t.segment === 'rotation');
    let tmpl = null;
    const pfirst = templates.filter((t) => t.segment === 'producing_first');
    if (seg === 'producing' && (aff.sold_clients || 0) === 1 && step === 0 && pfirst[0]) {
      tmpl = pfirst[0];
    } else if (step < 100) {
      tmpl = seq.find((t) => t.step_number === step + 1) || (rot.length ? rot[0] : null);
    } else if (rot.length) {
      const rotTouch = step - 100 + 1;
      const rotCall = templates.filter((t) => t.segment === 'rotation_call')[0];
      tmpl = (rotTouch % 3 === 0 && rotCall) ? rotCall : rot[rotTouch % rot.length];
    }
    if (!tmpl) return { statusCode: 200, headers, body: JSON.stringify({ error: 'no template for this affiliate' }) };

    const consultantName = firstName(aff.owner_name || '') || 'Your ASAP team';
    const base = mergeFields(tmpl.body, aff, consultantName);
    const subject = mergeFields(tmpl.subject || '', aff, consultantName);

    let personalized = null, aiError = null;
    if (tmpl.channel === 'email' && ANTHROPIC_KEY) {
      try { personalized = await aiPersonalize(base, aff, consultantName); }
      catch (e) { aiError = String(e.message || e).slice(0, 150); }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        affiliate: aff.org_name, segment: seg, channel: tmpl.channel, subject,
        base, personalized, ai_used: !!personalized, ai_error: aiError,
        note: 'personalized = exactly what the engine would send with AI personalization on'
      })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e).slice(0, 300) }) };
  }
};
