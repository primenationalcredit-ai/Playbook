// Manual trigger for the qualified-doc watchdog (the scheduled function itself
// rejects direct HTTP). Auth: X-API-Key must equal SUPABASE_SERVICE_ROLE_KEY.
const inner = require('./qualified-doc-watchdog.js');
exports.handler = async (event) => {
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || '';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  return inner.handler(event);
};
