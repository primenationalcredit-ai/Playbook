// netlify/functions/review-reconcile.js
//
// Schedule for the review check (every 10 min, 13:00-15:50 UTC = 7 to 9:50 AM MT, see
// netlify.toml). The logic lives in review-reconcile-manual.js. Each run checks one location
// at a time, resuming where the last run stopped, for about 20 seconds. Once a full pass of
// every location is done, the rest of that morning's runs return right away.
// COVERAGE FIX (Joe 9/21): this used to call without step=1, so every day restarted at the
// top of the list and only the first 3 of 17 locations were ever checked.
exports.handler = async () => {
  const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
  const started = Date.now();
  const results = [];
  while (Date.now() - started < 20000) {
    try {
      const r = await fetch(base + '/.netlify/functions/review-reconcile-manual?step=1&sched=1', {
        headers: { 'X-API-Key': process.env.INTERNAL_API_KEY || '' }
      });
      const j = await r.json().catch(() => ({}));
      results.push({ status: r.status, location: j.lastLocation || j.location || null, flagged: j.flagged, cleared: j.cleared, added: j.added, done: !!j.done, skipped: j.skipped || null, error: j.error || null });
      if (!r.ok || j.done || j.error) break;
    } catch (e) {
      results.push({ error: e.message });
      break;
    }
  }
  console.log('[review-reconcile] ' + JSON.stringify(results).slice(0, 800));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs: results }) };
};