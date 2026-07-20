// netlify/functions/affiliate-engine-status.js
//
// One call answers: is the engine alive, what has it done today, and who is
// UP NEXT. Reads config + today's touches, and runs the cadence runner in its
// built-in dry mode (?dry=1) - the dry list IS the send logic, so the preview
// can never drift from reality.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
    const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    // Config: engine flag + caps + anything else affiliate_*
    const cfgRows = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=like.affiliate*&select=key,value`, { headers: H }).then(r => r.json()).catch(() => []);
    const cfg = {}; for (const r of (Array.isArray(cfgRows) ? cfgRows : [])) cfg[r.key] = r.value;

    // Today's touches (CT day) + last touch overall
    const since = new Date(); // generous window, filter to CT day below
    since.setDate(since.getDate() - 2);
    const touches = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_touches?created_at=gte.${since.toISOString()}&select=channel,status,created_at&order=created_at.desc&limit=500`, { headers: H }).then(r => r.json()).catch(() => []);
    const todayTouches = (Array.isArray(touches) ? touches : []).filter(t => new Date(t.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) === todayCT);
    const count = (arr, ch) => arr.filter(t => t.channel === ch).length;
    const lastRow = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_touches?select=channel,created_at&order=created_at.desc&limit=1`, { headers: H }).then(r => r.json()).catch(() => []);

    // Up Next: the runner's own dry mode.
    let upNext = [], dryProcessed = 0, dryError = null;
    try {
      const dry = await fetch(`${base}/.netlify/functions/affiliate-cadence-runner?dry=1`).then(r => r.json());
      dryProcessed = dry.processed || 0;
      upNext = (dry.skipped || []).filter(x => x.dry).map(x => ({ org: x.org, plan: x.dry }));
    } catch (e) { dryError = e.message; }

    return { statusCode: 200, headers, body: JSON.stringify({
      enabled: cfg.affiliate_engine_enabled === 'true',
      config: cfg,
      today: { emails: count(todayTouches, 'email'), sms: count(todayTouches, 'sms'), calls: count(todayTouches, 'call'), total: todayTouches.length },
      lastTouch: (Array.isArray(lastRow) && lastRow[0]) || null,
      upNext, upNextCount: upNext.length || dryProcessed,
      dryError,
      checkedAt: new Date().toISOString()
    }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
