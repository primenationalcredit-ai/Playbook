// netlify/functions/monitoring-site-drift-sweep.js
//
// Scheduled twin of monitoring-site-drift-check.js (Joe 8/15, permanent fix
// for the Wilbur Pack / Reni "removed from my total reports" class of bug).
// No auth key needed - Netlify blocks direct HTTP on any function registered
// with a schedule regardless of the code inside it, same as
// zoho-markpaid-retry.js / -manual.js already do in this codebase.
//
// Remembers its position between runs via a cursor in app_cache, so each
// scheduled invocation continues where the last one left off instead of
// restarting at 0 every time. Wraps back to the beginning once it reaches
// the end of the table, so it keeps circling continuously - clearing the
// historical backlog first, then catching any future drift automatically.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';
const BATCH_SIZE = 100;
const CURSOR_KEY = 'monitoring_site_drift_cursor';

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

exports.handler = async () => {
  const report = { checked: 0, healed: [], stillMatching: 0, noLongerTracked: 0, errors: [] };

  try {
    const cursorRow = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.${CURSOR_KEY}&select=cache_value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    }).then((r) => r.json());
    let offset = (cursorRow && cursorRow[0]) ? parseInt(cursorRow[0].cache_value, 10) || 0 : 0;

    const totalRes = await fetch(`${SUPABASE_URL}/rest/v1/cs_deals?monitoring_site=not.is.null&select=deal_id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact', Range: '0-0' }
    });
    const totalCount = parseInt((totalRes.headers.get('content-range') || '0-0/0').split('/')[1] || '0', 10);

    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/cs_deals?monitoring_site=not.is.null&select=deal_id,monitoring_site,person_id,call_center_rep_name&order=deal_id.asc&limit=${BATCH_SIZE}&offset=${offset}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    ).then((r) => r.json());

    for (const row of (rows || [])) {
      report.checked++;
      try {
        const pd = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${row.deal_id}?api_token=${PD_TOKEN}`);
        const pdJson = await pd.json().catch(() => ({}));
        const deal = pdJson.data;
        if (!deal) { report.noLongerTracked++; continue; }

        // REP DRIFT HEAL (Joe 8/28, Araceli x2 + Erick Rivera Perez 269286 in one
        // day): the Call Center Rep lives on the PERSON and the deal-event webhook
        // never sees person edits, so the mirror's rep goes stale/blank and deals
        // vanish from CSR lists. Opposite direction from the site heal: Pipedrive
        // is the truth, the mirror gets corrected. Runs BEFORE the site continue
        // so every tracked row gets the rep check every cycle.
        try {
          const personIdSw = row.person_id || (deal.person_id && (deal.person_id.value || deal.person_id));
          if (personIdSw) {
            const pRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/persons/${personIdSw}?api_token=${PD_TOKEN}`);
            const pJson = await pRes.json().catch(() => ({}));
            const repF = pJson.data && pJson.data['fee42f0cb3d515239d602de62533887bfd58d384'];
            const repName = repF ? (typeof repF === 'object' ? repF.name : String(repF)) : null;
            if (repName && repName !== row.call_center_rep_name) {
              const repId = repF && typeof repF === 'object' ? (repF.id || repF.value || null) : null;
              await fetch(`${SUPABASE_URL}/rest/v1/cs_deals?deal_id=eq.${row.deal_id}`, {
                method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
                body: JSON.stringify({ call_center_rep_name: repName, call_center_rep_id: repId, synced_at: new Date().toISOString() })
              });
              if (!report.repHealed) report.repHealed = [];
              report.repHealed.push({ deal_id: row.deal_id, from: row.call_center_rep_name || '(blank)', to: repName });
            }
            await sleep(80);
          }
        } catch (eRep) { report.errors.push({ deal_id: row.deal_id, error: 'rep heal: ' + eRep.message }); }

        if (deal[FIELD]) { report.stillMatching++; continue; }

        const optionId = LABEL_TO_ID[row.monitoring_site];
        if (!optionId) {
          report.errors.push({ deal_id: row.deal_id, error: `mirror value "${row.monitoring_site}" has no known option_id` });
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
            content: `<p><b>Monitoring Site auto-restored</b></p><p>Field was found blank but our records showed it was correctly set to "${row.monitoring_site}" - restored automatically so this report counts correctly. (Automated drift sweep, Joe 8/15.)</p>`
          })
        }).catch(() => {});

        report.healed.push({ deal_id: row.deal_id, restored_to: row.monitoring_site });
      } catch (e) {
        report.errors.push({ deal_id: row.deal_id, error: e.message });
      }
      await sleep(250);
    }

    const nextOffset = (rows && rows.length === BATCH_SIZE) ? offset + BATCH_SIZE : 0; // wrap to 0 when we reach the end
    await fetch(`${SUPABASE_URL}/rest/v1/app_cache?on_conflict=cache_key`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ cache_key: CURSOR_KEY, cache_value: String(nextOffset) }])
    });

    report.offsetUsed = offset;
    report.nextOffset = nextOffset;
    report.totalTracked = totalCount;
    console.log('monitoring-site-drift-sweep:', JSON.stringify(report));
  } catch (e) {
    console.error('monitoring-site-drift-sweep fatal:', e.message);
  }

  return { statusCode: 200, body: JSON.stringify(report) };
};
