// netlify/functions/review-reconcile-manual.js
//
// Keyed on-demand twin of review-reconcile.js (Joe 9/19). Netlify refuses direct
// HTTP calls to a scheduled function (403), so a fix to the review check could not
// be tested or run on demand. This runs the exact same code - it calls the scheduled
// function's own handler - behind the internal API key.
//   /.netlify/functions/review-reconcile-manual?location=ASAP%20Credit%20Repair%20Albuquerque
//   /.netlify/functions/review-reconcile-manual            (one location per call, loop until done)

const core = require('./review-reconcile.js');

exports.handler = async (event) => {
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) ||
    ((event.queryStringParameters || {}).key);
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid API key' }) };
  }
  return core.handler(event);
};
