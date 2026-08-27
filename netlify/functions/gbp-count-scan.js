// gbp-count-scan.js - REAL GOOGLE REVIEW COUNTS (Joe 8/27, v2 resumable)
// v1 scanned all 13 locations in one invocation and hit Netlify's time limit (502).
// v2 scans up to BATCH locations per call (stalest first), merges results into
// app_cache key gbp_review_counts, and reports how many remain. The daily schedule
// gets a fresh pass over a few days' worth of calls; the manual door loops until done.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;
const supa = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const BATCH = 3;
const BUDGET_MS = 19000;
const LOCATIONS = [
  'ASAP Credit Repair Detroit', 'ASAP Credit Repair Houston', 'ASAP Credit Repair San Antonio',
  'ASAP Credit Repair El Paso', 'ASAP Credit Repair Albuquerque', 'ASAP Credit Repair Fort Myers',
  'ASAP Credit Repair San Jose', 'ASAP Credit Repair Birmingham', 'ASAP Credit Repair Phoenix',
  'ASAP Credit Repair Victoria', 'ASAP Credit Repair Fort Washington', 'ASAP Credit Repair McAllen',
  'ASAP Credit Repair New York'
];
async function readCache() {
  try { const r = await fetch(SUPABASE_URL + '/rest/v1/app_cache?cache_key=eq.gbp_review_counts&select=cache_value', { headers: supa }); if (r.ok) { const rows = await r.json(); if (rows[0]) return JSON.parse(rows[0].cache_value); } } catch (e) {}
  return { counts: {}, errors: {}, scanned_at: null };
}
exports.handler = async () => {
  if (!OUTSCRAPER_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'OUTSCRAPER_API_KEY not set' }) };
  const cache = await readCache();
  cache.counts = cache.counts || {}; cache.errors = cache.errors || {};
  // Stalest first: never scanned, then oldest scan date.
  const order = [...LOCATIONS].sort((a, b) => {
    const ta = cache.counts[a] && cache.counts[a].at ? cache.counts[a].at : '';
    const tb = cache.counts[b] && cache.counts[b].at ? cache.counts[b].at : '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  const started = Date.now(); let scanned = 0;
  for (const loc of order) {
    if (scanned >= BATCH || (Date.now() - started) > BUDGET_MS) break;
    try {
      const url = 'https://api.outscraper.cloud/maps/reviews-v3?query=' + encodeURIComponent(loc) + '&reviewsLimit=1&async=false';
      const res = await fetch(url, { headers: { 'X-API-KEY': OUTSCRAPER_API_KEY } });
      if (!res.ok) { cache.errors[loc] = 'outscraper ' + res.status; scanned++; continue; }
      const json = await res.json().catch(() => ({}));
      const place = Array.isArray(json && json.data) ? json.data[0] : null;
      const total = place ? parseInt(place.reviews != null ? place.reviews : (place.reviews_count != null ? place.reviews_count : place.review_count)) : NaN;
      if (!isNaN(total)) { cache.counts[loc] = { total: total, rating: parseFloat(place.rating) || null, at: new Date().toISOString() }; delete cache.errors[loc]; }
      else cache.errors[loc] = 'no count in response';
    } catch (e) { cache.errors[loc] = e.message; }
    scanned++;
  }
  const today = new Date().toISOString().slice(0, 10);
  const remaining = LOCATIONS.filter(l => !(cache.counts[l] && String(cache.counts[l].at).slice(0, 10) === today)).length;
  cache.scanned_at = new Date().toISOString();
  await fetch(SUPABASE_URL + '/rest/v1/app_cache', { method: 'POST', headers: Object.assign({}, supa, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ cache_key: 'gbp_review_counts', cache_value: JSON.stringify(cache), updated_at: new Date().toISOString() }) });
  return { statusCode: 200, headers, body: JSON.stringify({ scanned_this_call: scanned, remaining_stale_today: remaining, counts: cache.counts, errors: cache.errors }) };
};