// netlify/functions/db-health-watchdog.js
// Schedule for the database watchdog (every 10 min, see netlify.toml). All logic lives in
// db-health-watchdog-manual.js; this only calls it over HTTP with the internal key.
exports.handler = async () => {
  const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
  try {
    const r = await fetch(`${base}/.netlify/functions/db-health-watchdog-manual`, { method: 'POST', headers: { 'X-API-Key': process.env.INTERNAL_API_KEY } });
    const t = await r.text();
    console.log('db watchdog', r.status, t.slice(0, 300));
  } catch (e) { console.log('db watchdog call failed', e.message); }
  return { statusCode: 200 };
};