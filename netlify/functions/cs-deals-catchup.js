// netlify/functions/cs-deals-catchup.js
//
// Scheduled twin of cs-deals-catchup-manual.js: every 30 minutes, re-check the most
// recently updated CS deals and repair any Playbook row missing the deal, the
// monitoring site, or the rep. All the logic lives in the manual file.
//
// WHY HTTP, NOT require() (Joe 9/19): in this repo, require()-ing one function file
// from another returns an empty object. The first version of this file did that, so
// every scheduled run from 9/18 on crashed with "runCatchup is not a function" and
// nothing was repaired - the only logged run was a manual one. Calling the keyed
// manual endpoint runs the exact same code the manual runs use.

exports.handler = async () => {
  const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
  try {
    const r = await fetch(base + '/.netlify/functions/cs-deals-catchup-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ pages: 3, repair_limit: 25 })
    });
    const text = await r.text();
    console.log('[cs-deals-catchup] ' + r.status + ' ' + text.slice(0, 500));
    return { statusCode: r.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' }, body: text };
  } catch (e) {
    console.error('[cs-deals-catchup] call failed: ' + e.message);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
