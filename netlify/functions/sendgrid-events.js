// netlify/functions/sendgrid-events.js
//
// Wave 2 of outreach visibility: receives SendGrid's Event Webhook and stamps
// open/click/bounce onto the matching affiliate touch (matched by the
// touch_ref custom_arg embedded at send time; stored in the touch's detail
// JSON packet). Zero-DDL: progress lives in the existing status column -
// sent -> opened -> clicked (never downgrades), bounces -> 'bounced'.
// Optional shared secret: set SENDGRID_EVENTS_KEY and add &k=<key> to the URL.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

const RANK = { sent: 1, opened: 2, clicked: 3 };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const wantKey = process.env.SENDGRID_EVENTS_KEY;
  if (wantKey && (event.queryStringParameters || {}).k !== wantKey) return { statusCode: 401, body: 'bad key' };

  let events;
  try { events = JSON.parse(event.body || '[]'); } catch (e) { return { statusCode: 400, body: 'bad json' }; }
  if (!Array.isArray(events)) events = [events];

  const out = { received: events.length, matched: 0, updated: 0, skipped: 0 };
  for (const ev of events) {
    try {
      const ref = ev.touch_ref || (ev.custom_args && ev.custom_args.touch_ref) || null;
      const kind = String(ev.event || '').toLowerCase();
      if (!ref || !['open', 'click', 'bounce', 'dropped', 'spamreport'].includes(kind)) { out.skipped++; continue; }

      // Find the touch whose detail packet carries this ref.
      const pattern = encodeURIComponent(`*"ref":"${ref}"*`);
      const rows = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_touches?detail=like.${pattern}&select=id,status&limit=1`, { headers: SB }).then(r => r.json());
      const t = Array.isArray(rows) && rows[0];
      if (!t) { out.skipped++; continue; }
      out.matched++;

      let newStatus = null;
      if (kind === 'bounce' || kind === 'dropped' || kind === 'spamreport') newStatus = 'bounced';
      else if (kind === 'open' && (RANK[t.status] || 0) < RANK.opened) newStatus = 'opened';
      else if (kind === 'click' && (RANK[t.status] || 0) < RANK.clicked) newStatus = 'clicked';
      if (!newStatus || newStatus === t.status) { continue; }

      await fetch(`${SUPABASE_URL}/rest/v1/affiliate_touches?id=eq.${t.id}`, {
        method: 'PATCH', headers: { ...SB, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: newStatus })
      });
      out.updated++;
    } catch (e) { out.skipped++; }
  }
  console.log('sendgrid-events:', JSON.stringify(out));
  return { statusCode: 200, body: JSON.stringify(out) };
};
