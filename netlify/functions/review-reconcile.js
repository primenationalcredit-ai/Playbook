// netlify/functions/review-reconcile.js
//
// Daily schedule for the review check. The logic lives in review-reconcile-manual.js
// (see its header for why). Calls it one location at a time, resuming where the last
// run stopped, until the pass is done or ~20 seconds are used.

exports.handler = async () => {
  const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
  const started = Date.now();
  const results = [];
  while (Date.now() - started < 20000) {
    try {
      const r = await fetch(base + '/.netlify/functions/review-reconcile-manual', {
        headers: { 'X-API-Key': process.env.INTERNAL_API_KEY || '' }
      });
      const j = await r.json().catch(() => ({}));
      results.push({ status: r.status, location: j.lastLocation || j.location || null, flagged: j.flagged, cleared: j.cleared, edited: j.edited, done: !!j.done, error: j.error || null });
      if (!r.ok || j.done || j.error) break;
    } catch (e) {
      results.push({ error: e.message });
      break;
    }
  }
  console.log('[review-reconcile] ' + JSON.stringify(results).slice(0, 800));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs: results }) };
};
