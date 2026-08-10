// crm-deep-verify-tick.js - daily scheduled spot audit (7:30am CT, after the 7am compare).
const SITE = 'https://cute-cat-d9631c.netlify.app';
exports.handler = async () => {
  try {
    const r = await fetch(`${SITE}/.netlify/functions/crm-deep-verify?key=${process.env.PAYMENT_API_KEY}`);
    const j = await r.json().catch(() => ({}));
    console.log('deep verify:', j.clean, `deals=${j.deals_checked} persons=${j.persons_checked} mismatches=${(j.mismatches || []).length} healed=${j.healed}`);
    return { statusCode: 200, body: JSON.stringify({ clean: j.clean }) };
  } catch (e) { return { statusCode: 200, body: JSON.stringify({ error: e.message }) }; }
};
