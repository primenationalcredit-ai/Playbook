// review-reconcile.js
// Flags incoming_reviews that have dropped off Google ("delisted"). Google filters
// some reviews after they post (new accounts, similar wording, spam model), which
// removes them from the public page but not from our table. This re-checks the live
// reviews on each location's Google listing via Outscraper and flags any of our
// PENDING/ASSIGNED reviews that are no longer there.
//
// Cost control (Outscraper bills per review at ~$3/1000):
//   - Only locations that actually have pending/assigned reviews are checked. Most
//     days most locations have none, so they cost nothing.
//   - Only the newest REVIEW_CAP reviews per location are pulled.
//   - One location per invocation, resumable, so it never times out and never loops.
//   - A review is judged ONLY if it falls within the date range we actually fetched,
//     so an older review beyond the fetch window is never falsely flagged.
//   - Matching is by Google review id first, with a reviewer-name + rating + text
//     fallback, so a difference in id format between Zapier and Outscraper can't
//     cause a live review to look missing.
//
// Manual:  /.netlify/functions/review-reconcile           (one location per call; loop until done=true)
//          /.netlify/functions/review-reconcile?reset=1   (restart the pass from the first location)
//          /.netlify/functions/review-reconcile?location=ASAP%20Credit%20Repair%20Houston  (single location)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;

const REVIEW_CAP = parseInt(process.env.REVIEW_RECONCILE_CAP || '25', 10); // newest reviews pulled per location
const PROGRESS_KEY = 'review_reconcile_progress';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const snippet = (s) => norm(s).slice(0, 60);

async function readCache(key) {
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.${key}&select=cache_value`, { headers: supa }); if (r.ok) { const rows = await r.json(); if (rows[0]) return JSON.parse(rows[0].cache_value); } } catch (e) {}
  return null;
}
async function writeCache(key, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, { method: 'POST', headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: key, cache_value: JSON.stringify(data), updated_at: new Date().toISOString() }) });
}

// Pull the newest reviews for a location from Outscraper. Returns { live, oldest, capped }
// where live is an array of { id, author, rating, text, date }, oldest is the oldest
// fetched review date (ms) or null, and capped is true if we likely didn't reach the
// bottom of the location's reviews (so older stored reviews must not be judged).
async function fetchLiveReviews(locationName) {
  if (!OUTSCRAPER_API_KEY) throw new Error('OUTSCRAPER_API_KEY not set');
  const url = `https://api.outscraper.cloud/maps/reviews-v3?query=${encodeURIComponent(locationName)}&reviewsLimit=${REVIEW_CAP}&sort=newest&language=en&async=false`;
  const res = await fetch(url, { headers: { 'X-API-KEY': OUTSCRAPER_API_KEY } });
  if (!res.ok) throw new Error(`Outscraper ${res.status}`);
  const json = await res.json().catch(() => ({}));

  // Response shapes vary; find the reviews array defensively.
  let reviewsArr = [];
  const root = json?.data;
  if (Array.isArray(root) && root.length) {
    if (Array.isArray(root[0]?.reviews_data)) reviewsArr = root[0].reviews_data;
    else if (root[0]?.review_id || root[0]?.review_text || root[0]?.author_title) reviewsArr = root;
  } else if (Array.isArray(json?.reviews_data)) {
    reviewsArr = json.reviews_data;
  }

  const live = reviewsArr.map(r => {
    const id = r.review_id || r.reviewId || r.id || null;
    const author = r.author_title || r.author_name || r.name || r.reviewer_name || '';
    const rating = parseInt(r.review_rating ?? r.rating ?? r.stars) || null;
    const text = r.review_text || r.text || r.review || '';
    const dRaw = r.review_datetime_utc || r.review_date || r.date || r.datetime || null;
    const d = dRaw ? new Date(dRaw) : null;
    return { id: id ? String(id) : null, author, rating, text, date: (d && !isNaN(d)) ? d.getTime() : null };
  });

  const dates = live.map(l => l.date).filter(Boolean);
  const oldest = dates.length ? Math.min(...dates) : null;
  // If we got at least REVIEW_CAP reviews, assume there are older ones we didn't see.
  const capped = reviewsArr.length >= REVIEW_CAP;
  return { live, oldest, capped };
}

function isLive(stored, live) {
  // 1) direct google review id match
  if (stored.google_review_id) {
    const sid = String(stored.google_review_id);
    if (live.some(l => l.id && (l.id === sid || l.id.endsWith(sid) || sid.endsWith(l.id)))) return true;
  }
  // 2) fallback: same reviewer + rating + matching text snippet
  const sa = norm(stored.reviewer_name);
  const ss = snippet(stored.review_text);
  return live.some(l => {
    if (norm(l.author) !== sa) return false;
    if (stored.rating && l.rating && stored.rating !== l.rating) return false;
    const ls = snippet(l.text);
    if (!ss || !ls) return true; // name (+rating) match with no text to compare
    return ls === ss || ls.startsWith(ss) || ss.startsWith(ls);
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};

    // Build the worklist: locations that currently have pending/assigned reviews.
    // (Completed reviews are skipped: bonus already credited, and it saves cost.)
    const actRes = await fetch(
      `${SUPABASE_URL}/rest/v1/incoming_reviews?status=in.(pending,assigned)&select=location_name`,
      { headers: supa }
    );
    const actRows = actRes.ok ? await actRes.json() : [];
    const allLocations = Array.from(new Set(actRows.map(r => r.location_name).filter(Boolean))).sort();

    if (allLocations.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ done: true, remaining: 0, message: 'No pending/assigned reviews to reconcile.' }) };
    }

    // Single-location mode
    if (params.location) {
      const result = await reconcileLocation(params.location);
      return { statusCode: 200, headers, body: JSON.stringify({ done: true, remaining: 0, ...result }) };
    }

    // Resumable pass across all locations
    let prog = params.reset ? null : await readCache(PROGRESS_KEY);
    if (!prog || !Array.isArray(prog.queue) || prog.queue.length === 0 || prog.startedFor !== allLocations.join('|')) {
      prog = { startedFor: allLocations.join('|'), queue: [...allLocations], doneCount: 0, totalFlagged: 0, totalCleared: 0, reviewsPulled: 0 };
    }

    const loc = prog.queue.shift();
    const result = await reconcileLocation(loc);
    prog.doneCount += 1;
    prog.totalFlagged += result.flagged;
    prog.totalCleared += result.cleared;
    prog.reviewsPulled += result.reviewsPulled;

    const remaining = prog.queue.length;
    if (remaining === 0) {
      await writeCache(PROGRESS_KEY, { ...prog, finishedAt: new Date().toISOString() });
      return { statusCode: 200, headers, body: JSON.stringify({ done: true, remaining: 0, lastLocation: loc, ...result, totals: { flagged: prog.totalFlagged, cleared: prog.totalCleared, reviewsPulled: prog.reviewsPulled, locations: prog.doneCount } }) };
    }
    await writeCache(PROGRESS_KEY, prog);
    return { statusCode: 200, headers, body: JSON.stringify({ done: false, remaining, lastLocation: loc, ...result, nextUrl: '/.netlify/functions/review-reconcile' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

async function reconcileLocation(locationName) {
  // Our pending/assigned reviews for this location.
  const rRes = await fetch(
    `${SUPABASE_URL}/rest/v1/incoming_reviews?status=in.(pending,assigned)&location_name=eq.${encodeURIComponent(locationName)}&select=id,google_review_id,reviewer_name,rating,review_text,review_date,delisted_at`,
    { headers: supa }
  );
  const stored = rRes.ok ? await rRes.json() : [];
  if (stored.length === 0) return { location: locationName, flagged: 0, cleared: 0, reviewsPulled: 0, checked: 0, note: 'no pending/assigned' };

  let live, oldest, capped, reviewsPulled = 0;
  try {
    const r = await fetchLiveReviews(locationName);
    live = r.live; oldest = r.oldest; capped = r.capped; reviewsPulled = live.length;
  } catch (e) {
    return { location: locationName, flagged: 0, cleared: 0, reviewsPulled: 0, checked: 0, error: e.message };
  }

  let flagged = 0, cleared = 0, checked = 0;
  for (const s of stored) {
    // Only judge reviews within the window we actually fetched. If the fetch was
    // capped (we didn't reach the bottom) and this review is older than the oldest
    // fetched review, we can't know if it's live, so we skip it.
    const sDate = s.review_date ? new Date(s.review_date).getTime() : null;
    if (capped && oldest != null && sDate != null && sDate < oldest) continue;
    checked++;

    const liveNow = isLive(s, live);
    if (!liveNow && !s.delisted_at) {
      await patch(s.id, { delisted_at: new Date().toISOString(), notes: appendNote(s.notes, `Delisted ${new Date().toISOString().slice(0, 10)} — no longer on Google.`) });
      flagged++;
    } else if (liveNow && s.delisted_at) {
      // Reappeared on Google — clear the flag.
      await patch(s.id, { delisted_at: null });
      cleared++;
    }
  }
  return { location: locationName, flagged, cleared, reviewsPulled, checked, capped };
}

function appendNote(existing, line) {
  const e = (existing || '').trim();
  return e ? `${e}\n${line}` : line;
}
async function patch(id, body) {
  await fetch(`${SUPABASE_URL}/rest/v1/incoming_reviews?id=eq.${id}`, {
    method: 'PATCH', headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body),
  });
}
