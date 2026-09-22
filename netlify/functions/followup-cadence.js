// netlify/functions/followup-cadence.js
// SCHEDULED TWIN (every 5 minutes) for followup-cadence-manual.
// Netlify blocks direct HTTP to scheduled functions, and require() between
// function files does not work in this repo, so the scheduler calls its keyed
// twin over HTTP - the same pattern review-reconcile uses.
// It stays a PREVIEW until CADENCE_LIVE=1 is set in Netlify.
const KEY = process.env.INTERNAL_API_KEY;
const BASE = process.env.PLAYBOOK_BASE_URL || 'https://cute-cat-d9631c.netlify.app';

exports.handler = async () => {
  const out = { ok: true };
  try {
    const res = await fetch(`${BASE}/.netlify/functions/followup-cadence-manual?hours=1&max=40`, { headers: { 'X-API-Key': KEY } });
    const j = await res.json().catch(() => ({}));
    out.mode = j.mode; out.summary = j.summary; out.elapsed_ms = j.elapsed_ms;
    const s = j.summary || {};
    const touched = (s.would_advance || 0) + (s.would_start || 0) + (s.would_move || 0);
    if (touched > 0 || (s.errors || 0) > 0) {
      await require('./automation-log').log(
        'followup-cadence',
        `${j.mode === 'LIVE' ? 'Created' : 'Would create'} ${touched} follow-up activities`,
        `build cadence-v1 ${j.mode}: advanced ${s.would_advance || 0}, started ${s.would_start || 0}, moved ${s.would_move || 0}, skipped ${s.skipped || 0}, errors ${s.errors || 0}${j.truncated ? ', TRUNCATED' : ''}`,
        (s.errors || 0) > 0 ? 'alert' : 'success'
      ).catch(() => {});
    }
  } catch (e) {
    out.ok = false; out.error = e.message;
    await require('./automation-log').log('followup-cadence', 'Run failed', String(e.message).slice(0, 300), 'alert').catch(() => {});
  }
  return { statusCode: 200, body: JSON.stringify(out) };
};
