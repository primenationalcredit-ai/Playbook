// crm-sync-tick.js - scheduled heartbeat for the CRM mirror (Joe 8/8).
// Calls crm-sync in incremental mode every 10 minutes: only persons/deals
// updated since the last cursor come over, so Pipedrive movements appear
// on our side within ~10 min. Full backfills stay manual (?full=1).
const SITE = 'https://cute-cat-d9631c.netlify.app';
exports.handler = async () => {
  try {
    const r = await fetch(`${SITE}/.netlify/functions/crm-sync?key=${process.env.PAYMENT_API_KEY}&mode=all&max_pages=3`);
    const j = await r.json().catch(() => ({}));
    console.log('crm tick:', JSON.stringify(j).slice(0, 300));
    return { statusCode: 200, body: JSON.stringify({ ok: r.ok, persons: j.persons, deals: j.deals }) };
  } catch (e) { return { statusCode: 200, body: JSON.stringify({ error: e.message }) }; }
};
