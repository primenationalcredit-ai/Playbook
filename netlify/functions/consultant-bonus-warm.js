// Scheduled pre-warm for the consultant bonus dashboard.
// Calls the metrics function with ?refresh=1 so it recomputes and re-caches the result.
// Every normal page load then reads that fresh cache instantly instead of computing live.
const SITE = 'https://cute-cat-d9631c.netlify.app';

exports.handler = async () => {
  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const res = await fetch(`${SITE}/.netlify/functions/consultant-bonus-metrics?refresh=1&month=${month}`);
    return { statusCode: 200, body: JSON.stringify({ warmed: res.ok, status: res.status, month }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ error: e.message }) };
  }
};
