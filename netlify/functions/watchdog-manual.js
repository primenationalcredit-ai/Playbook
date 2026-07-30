// Manual trigger for the qualified-doc watchdog. Self-contained (no cross-function
// require - esbuild bundles per-function and runtime requires 502). Auth: X-API-Key
// must equal SUPABASE_SERVICE_ROLE_KEY. Returns real error text on any failure.
exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  try {
    const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || '';
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const inner = require('./qualified-doc-watchdog.js');
    return await inner.handler(event);
  } catch (err) {
    console.error('[watchdog-manual] crash:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ wrapper_error: String(err && err.stack || err).slice(0, 800) }) };
  }
};
