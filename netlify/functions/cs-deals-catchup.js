// netlify/functions/cs-deals-catchup.js
//
// Scheduled twin of cs-deals-catchup-manual.js. Every 30 minutes it re-checks the
// most recently updated CS deals and repairs any whose Playbook row is missing the
// deal, the monitoring site, or the rep. See the manual file for the full reasoning.
//
// The logic lives in one place on purpose: this file only sets the schedule's
// parameters. Netlify blocks direct HTTP calls to scheduled functions, which is why
// the manual twin exists for on-demand runs and testing.

const core = require('./cs-deals-catchup-manual.js');

exports.handler = async () => {
  const res = await core.runCatchup({ pages: 3, repairLimit: 25, dryRun: false });
  console.log('[cs-deals-catchup] ' + JSON.stringify(res).slice(0, 500));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(res) };
};
