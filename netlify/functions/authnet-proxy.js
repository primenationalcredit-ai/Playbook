// authnet-proxy.js - forwards the Financial Dashboard's balance-check request
// to the processor's authnet-today endpoint. Read-only numbers (totals/counts),
// no transaction details, no credentials exposed to the browser.
const KEY = process.env.PROCESSOR_INTERNAL_API_KEY || 'LmxMO6Ua81Q7qtvVHoNhsriGyTYud2lKepRjAP9wkbc5ZJD3';
exports.handler = async () => {
  try {
    const r = await fetch(`https://asap-payment-processor.netlify.app/.netlify/functions/authnet-today?key=${KEY}`);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await r.json()) };
  } catch (e) { return { statusCode: 502, body: JSON.stringify({ error: e.message }) }; }
};
