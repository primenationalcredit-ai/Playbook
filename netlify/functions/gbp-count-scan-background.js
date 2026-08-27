// gbp-count-scan-background.js - REAL GOOGLE REVIEW COUNTS (Joe 8/27 v3)
// Netlify kills regular functions at ~10s; one sync Outscraper call can take 15-30s,
// so v1 (all 13) and v2 (batches of 3) both 502'd before the cache write. Background
// functions get 15 MINUTES. This scans all 13 locations, writes app_cache key
// gbp_review_counts after EVERY location (crash-safe), and returns 202 immediately.
// Read results from app_cache, not the HTTP response.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;
const supa = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
const LOCATIONS = [
  'ASAP Credit Repair Detroit', 'ASAP Credit Repair Houston', 'ASAP Credit Repair San Antonio',
  'ASAP Credit Repair El Paso', 'ASAP Credit Repair Albuquerque', 'ASAP Credit Repair Fort Myers',
  'ASAP Credit Repair San Jose', 'ASAP Credit Repair Birmingham', 'ASAP Credit Repair Phoenix',
  'ASAP Credit Repair Victoria', 'ASAP Credit Repair Fort Washington', 'ASAP Credit Repair McAllen',
  'ASAP Credit Repair New York'
];
async function readCache() {
  try { const r = await fetch(SUPABASE_URL + '/rest/v1/app_cache?cache_key=eq.gbp_review_counts&select=cache_value', { headers: supa }); if (r.ok) { const rows = await r.json(); if (rows[0]) return JSON.parse(rows[0].cache_value); } } catch (e) {}
  return { counts: {}, errors: {} };
}
async function writeCache(cache) {
  cache.scanned_at = new Date().toISOString();
  await fetch(SUPABASE_URL + '/rest/v1/app_cache', { method: 'POST', headers: Object.assign({}, supa, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ cache_key: 'gbp_review_counts', cache_value: JSON.stringify(cache), updated_at: new Date().toISOString() }) });
}
exports.handler = async () => {
  if (!OUTSCRAPER_API_KEY) return { statusCode: 500, body: 'OUTSCRAPER_API_KEY not set' };
  const cache = await readCache();
  cache.counts = cache.counts || {}; cache.errors = cache.errors || {};
  cache.run_started_at = new Date().toISOString(); cache.run_finished_at = null;
  await writeCache(cache);
  for (const loc of LOCATIONS) {
    try {
      const url = 'https://api.outscraper.cloud/maps/reviews-v3?query=' + encodeURIComponent(loc) + '&reviewsLimit=1&async=false';
      const res = await fetch(url, { headers: { 'X-API-KEY': OUTSCRAPER_API_KEY } });
      if (!res.ok) { cache.errors[loc] = 'outscraper ' + res.status; }
      else {
        const json = await res.json().catch(() => ({}));
        const place = Array.isArray(json && json.data) ? json.data[0] : null;
        const total = place ? parseInt(place.reviews != null ? place.reviews : (place.reviews_count != null ? place.reviews_count : place.review_count)) : NaN;
        if (!isNaN(total)) { cache.counts[loc] = { total: total, rating: parseFloat(place.rating) || null, at: new Date().toISOString() }; delete cache.errors[loc]; }
        else cache.errors[loc] = 'no count in response';
      }
    } catch (e) { cache.errors[loc] = e.message; }
    await writeCache(cache); // crash-safe: every location's result lands immediately
  }
  cache.run_finished_at = new Date().toISOString();
  await writeCache(cache);
  return { statusCode: 200, body: 'done' };
};