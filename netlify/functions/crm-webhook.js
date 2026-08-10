// crm-webhook.js - Pipedrive webhook receiver (CRM migration Phase 1, Joe 8/9).
// PD calls this on every person/deal/note/activity change; we poke crm-sync's
// incremental mode for that object type (one page, cursor-based) so the changed
// record lands in the crm_* masters within seconds. No field mapping lives here
// on purpose - crm-sync is the single mapper. The 10-min tick remains the backstop.
const SITE = 'https://cute-cat-d9631c.netlify.app';
const MODE_BY_OBJECT = { person: 'persons', deal: 'deals', note: 'notes', activity: 'activities' };

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (q.key !== process.env.PAYMENT_API_KEY) return { statusCode: 401, body: 'unauthorized' };
  try {
    const body = JSON.parse(event.body || '{}');
    const obj = (body.meta && (body.meta.object || body.meta.entity)) || '';
    const mode = MODE_BY_OBJECT[obj];
    if (!mode) return { statusCode: 200, body: JSON.stringify({ ignored: obj || 'unknown' }) };
    // Await (never fire-and-forget - Lambda freeze cuts it): incremental one-page
    // pull, newest-first, picks up the changed record. Idempotent under bursts.
    const r = await fetch(`${SITE}/.netlify/functions/crm-sync?key=${process.env.PAYMENT_API_KEY}&mode=${mode}&max_pages=1`);
    const j = await r.json().catch(() => ({}));
    return { statusCode: 200, body: JSON.stringify({ poked: mode, synced: (j[mode] && j[mode].synced) ?? null }) };
  } catch (e) { return { statusCode: 200, body: JSON.stringify({ error: e.message }) }; }
};
