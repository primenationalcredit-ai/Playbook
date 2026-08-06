// connections-proxy.js - read-only window into the credentials vault for the
// Automations page. Forwards ONLY the list action (names/services/dates -
// never values) to the processor's connection-admin. Set/delete stay behind
// the X-API-Key admin door; this proxy refuses them.
const KEY = process.env.PROCESSOR_INTERNAL_API_KEY || 'LmxMO6Ua81Q7qtvVHoNhsriGyTYud2lKepRjAP9wkbc5ZJD3';
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '{"error":"POST only"}' };
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  if (b.action !== 'list') return { statusCode: 403, body: '{"error":"this proxy only lists connections - changes go through the admin door"}' };
  try {
    const r = await fetch('https://asap-payment-processor.netlify.app/.netlify/functions/connection-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY }, body: '{"action":"list"}'
    });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await r.json()) };
  } catch (e) { return { statusCode: 502, body: JSON.stringify({ error: e.message }) }; }
};
