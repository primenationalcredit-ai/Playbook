// payment-enrich-manual.js (8/30): the enricher is scheduled Mon-Sat, so direct
// HTTP gets 403 and Sundays never run at all. Same manual-door pattern as
// zoho-payment-sync-manual: wraps the SAME handler in-process behind X-API-Key.
const { handler: enrich } = require('./payment-enrich.js');
exports.handler = async (event) => {
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || '';
  if (key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, body: '{"error":"unauthorized"}' };
  return enrich({ httpMethod: 'GET', queryStringParameters: (event.queryStringParameters || {}) });
};
