// netlify/functions/payment-enrich-tick.js
// Hourly (Joe 7/31): consultant names fill in by themselves - nobody has to
// open All Payments to trigger enrichment. Drives the existing HTTP enricher
// (which must stay unscheduled so the page's own calls keep working) to
// completion each hour, within the function time budget.
exports.handler = async () => {
  const base = 'https://cute-cat-d9631c.netlify.app/.netlify/functions/payment-enrich';
  const out = { rounds: 0, enriched: 0, remaining: null };
  const t0 = Date.now();
  while (out.rounds < 12 && Date.now() - t0 < 20000) {
    let d = {};
    try { const r = await fetch(base); d = await r.json().catch(() => ({})); } catch (e) { break; }
    out.rounds++;
    out.enriched += d.enriched || 0;
    out.remaining = typeof d.remaining === 'number' ? d.remaining : out.remaining;
    if (!d.enriched) break; // done, or nothing matchable right now
  }
  console.log('[payment-enrich-tick]', JSON.stringify(out));
  return { statusCode: 200, body: JSON.stringify(out) };
};
