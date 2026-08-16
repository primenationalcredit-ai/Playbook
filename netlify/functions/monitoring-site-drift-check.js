// netlify/functions/monitoring-site-drift-check.js
//
// Permanent safety net (Joe 8/15, Wilbur Pack 214576 / Reni's "removed from my
// total reports" ticket): Wilbur's Monitoring Site was correctly set by Zapier
// on 8/3, then went silently blank sometime before 8/14 - the exact clearing
// event isn't visible through Pipedrive's v1 API (custom-field changes aren't
// in the dealChange log), so instead of chasing the cause, this catches the
// SYMPTOM directly: any deal where our cs_deals mirror remembers a real
// monitoring_site value but live Pipedrive now shows blank is unambiguous
// proof of exactly this drift pattern, regardless of what caused it.
//
// Batched + paginated (offset/limit) so it can run as small manual test
// batches now and get scheduled to sweep the full set over time later.
// Restores via the same Pipedrive-first-then-mirror pattern as
// set-monitoring-site.js, and always posts an audit note - never silent.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e'; // Monitoring Site (1)

const LABEL_TO_ID = {
  'ProCredit': '479', 'Identity Guard': '480', 'Annual Credit Report': '481',
  'Free Scores': '482', 'Privacy Guard': '483', 'ScoreSense': '484',
  'Credit Check Total': '485', 'Identity IQ': '486', 'CreditBuilder IQ': '3571',
  'CreditScore IQ': '3572', 'Idenity Force': '487', 'Freecreditscore.com': '488',
  'Experian.com': '561', 'Transunion.com': '562', 'Equifax.com': '563',
  'MyFico.com': '1150', 'Free Score Connect': '1278', 'ID Lookout (Scoresense)': '1279',
  'My Free Score Now': '1280', 'National Credit Report': '1690', 'Smart Credit': '1715',
  'Client sent credit reports to us': '1744', 'Lender reports': '1867',
  'Truly ID': '1914', 'My Score IQ': '1917', 'ID Club': '1928',
  'Credit Monitoring Solutions': '1929', 'Identity Iq (Client Sent Reports)': '3703',
  'Smart Credit (Client Sent Reports)': '3704'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.handler = async (event) => {
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) ||
              (event.queryStringParameters && event.queryStringParameters.key);
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid API key' }) };
  }

  const qp = event.queryStringParameters || {};
  const limit = Math.min(parseInt(qp.limit || '50', 10), 200);
  const offset = parseInt(qp.offset || '0', 10);
  const dryRun = qp.dry_run === 'true';

  const report = { checked: 0, healed: [], stillMatching: 0, noLongerTracked: 0, errors: [], offset, limit, nextOffset: offset + limit };

  try {
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/cs_deals?monitoring_site=not.is.null&select=deal_id,monitoring_site&order=deal_id.asc&limit=${limit}&offset=${offset}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    ).then((r) => r.json());

    for (const row of rows) {
      report.checked++;
      try {
        const pd = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${row.deal_id}?api_token=${PD_TOKEN}`);
        const pdJson = await pd.json().catch(() => ({}));
        const deal = pdJson.data;
        if (!deal) { report.noLongerTracked++; continue; }

        const liveValue = deal[FIELD];
        if (liveValue) { report.stillMatching++; continue; }

        // DRIFT FOUND: mirror remembers a value, live Pipedrive is blank.
        const optionId = LABEL_TO_ID[row.monitoring_site];
        if (!optionId) {
          report.errors.push({ deal_id: row.deal_id, error: `mirror value "${row.monitoring_site}" has no known option_id - cannot auto-heal` });
          continue;
        }

        if (dryRun) {
          report.healed.push({ deal_id: row.deal_id, would_restore: row.monitoring_site, dry_run: true });
          continue;
        }

        const restore = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${row.deal_id}?api_token=${PD_TOKEN}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [FIELD]: optionId })
        });
        const restoreJson = await restore.json().catch(() => ({}));
        if (!restore.ok || !restoreJson.success) {
          report.errors.push({ deal_id: row.deal_id, error: `Pipedrive restore failed: ${restoreJson.error || restore.status}` });
          continue;
        }

        await fetch(`${SUPABASE_URL}/rest/v1/cs_deals?deal_id=eq.${row.deal_id}`, {
          method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ synced_at: new Date().toISOString() })
        });

        await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/notes?api_token=${PD_TOKEN}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: row.deal_id,
            content: `<p><b>Monitoring Site auto-restored</b></p><p>Field was found blank but our records showed it was correctly set to "${row.monitoring_site}" - restored automatically so this report counts correctly. (Automated drift check, Joe 8/15.)</p>`
          })
        }).catch(() => {});

        report.healed.push({ deal_id: row.deal_id, restored_to: row.monitoring_site });
      } catch (e) {
        report.errors.push({ deal_id: row.deal_id, error: e.message });
      }
      await sleep(300); // rate-limit friendly
    }
  } catch (e) {
    report.fatal = e.message;
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) };
};
