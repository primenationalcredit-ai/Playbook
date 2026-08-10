// crm-compare-tick.js - daily scheduled run of the mirror comparison (7am CT).
const SITE = 'https://cute-cat-d9631c.netlify.app';
exports.handler = async () => {
  try {
    const r = await fetch(`${SITE}/.netlify/functions/crm-compare?key=${process.env.PAYMENT_API_KEY}`);
    const j = await r.json().catch(() => ({}));
    console.log('crm compare:', j.ok, JSON.stringify(j).slice(0, 400));
    return { statusCode: 200, body: JSON.stringify({ ok: j.ok }) };
  } catch (e) { return { statusCode: 200, body: JSON.stringify({ error: e.message }) }; }
};
