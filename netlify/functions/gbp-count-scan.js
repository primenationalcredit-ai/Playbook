// gbp-count-scan.js - REAL GOOGLE REVIEW COUNTS (Joe 8/27)
// The randomizer was weighting by incoming_reviews (our bonus-tracking table),
// which only holds reviews the webhook captured - Fort Myers read 0 while its
// listing holds 120+. This scan asks Outscraper for each location with
// reviewsLimit=1 (~pennies) and stores the listing's TOTAL review count in
// app_cache key gbp_review_counts. Daily schedule + manual door (?run=1 not needed - always runs; it is cheap).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;
const supa = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const LOCATIONS = [
  'ASAP Credit Repair Detroit', 'ASAP Credit Repair Houston', 'ASAP Credit Repair San Antonio',
  'ASAP Credit Repair El Paso', 'ASAP Credit Repair Albuquerque', 'ASAP Credit Repair Fort Myers',
  'ASAP Credit Repair San Jose', 'ASAP Credit Repair Birmingham', 'ASAP Credit Repair Phoenix',
  'ASAP Credit Repair Victoria', 'ASAP Credit Repair Fort Washington', 'ASAP Credit Repair McAllen',
  'ASAP Credit Repair New York'
];
exports.handler = async () => {
  if (!OUTSCRAPER_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'OUTSCRAPER_API_KEY not set' }) };
  const counts = {}; const errors = {};
  for (const loc of LOCATIONS) {
    try {
      const url = 'https://api.outscraper.cloud/maps/reviews-v3?query=' + encodeURIComponent(loc) + '&reviewsLimit=1&async=false';
      const res = await fetch(url, { headers: { 'X-API-KEY': OUTSCRAPER_API_KEY } });
      if (!res.ok) { errors[loc] = 'outscraper ' + res.status; continue; }
      const json = await res.json().catch(() => ({}));
      const place = Array.isArray(json?.data) ? json.data[0] : null;
      const total = place ? parseInt(place.reviews ?? place.reviews_count ?? place.review_count) : NaN;
      if (!isNaN(total)) counts[loc] = { total, rating: parseFloat(place.rating) || null };
      else errors[loc] = 'no count in response';
    } catch (e) { errors[loc] = e.message; }
  }
  const payload = { counts, errors, scanned_at: new Date().toISOString() };
  await fetch(SUPABASE_URL + '/rest/v1/app_cache', { method: 'POST', headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: 'gbp_review_counts', cache_value: JSON.stringify(payload), updated_at: new Date().toISOString() }) });
  return { statusCode: 200, headers, body: JSON.stringify(payload) };
};
