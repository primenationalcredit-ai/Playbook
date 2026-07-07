// CS Deals Initial Sync (page-based)
// Loads CS deals from the Pipedrive filter into Supabase one page per call to stay under the
// function time limit. Call with no params to start, then follow the returned nextUrl until done.
// Webhooks handle ongoing updates after the initial backfill.

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Filter ID for CS deals
const CS_DEALS_FILTER = 136445;

// Person fields
const CALL_CENTER_REP_FIELD = 'fee42f0cb3d515239d602de62533887bfd58d384';
const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
// Monitoring Site (1) field on Deal — distinguishes IDIQ vs SmartCredit reports
const MONITORING_SITE_FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';

// Build id->name maps for the monitoring-site options, stages, and pipelines (deal lists only return IDs).
async function loadMaps(baseUrl) {
  const maps = { ms: {}, stage: {}, pipeline: {} };
  try {
    const r = await fetch(`${baseUrl}/dealFields?api_token=${PIPEDRIVE_API_KEY}&limit=500`);
    if (r.ok) {
      const f = await r.json();
      const field = (f.data || []).find(x => x.key === MONITORING_SITE_FIELD);
      for (const opt of (field && field.options ? field.options : [])) maps.ms[String(opt.id)] = opt.label;
    }
  } catch (e) {}
  try {
    const r = await fetch(`${baseUrl}/stages?api_token=${PIPEDRIVE_API_KEY}&limit=500`);
    if (r.ok) { const s = await r.json(); for (const st of (s.data || [])) maps.stage[String(st.id)] = st.name; }
  } catch (e) {}
  try {
    const r = await fetch(`${baseUrl}/pipelines?api_token=${PIPEDRIVE_API_KEY}`);
    if (r.ok) { const p = await r.json(); for (const pl of (p.data || [])) maps.pipeline[String(pl.id)] = pl.name; }
  } catch (e) {}
  return maps;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const startTime = Date.now();
  try {
    const params = event.queryStringParameters || {};
    const startAt = parseInt(params.start) || 0;
    const PAGE = Math.min(parseInt(params.limit) || 40, 100);
    const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
    const maps = await loadMaps(baseUrl);

    // Fetch ONE page of deals from the filter
    const url = `${baseUrl}/deals?api_token=${PIPEDRIVE_API_KEY}&filter_id=${CS_DEALS_FILTER}&start=${startAt}&limit=${PAGE}`;
    const response = await fetch(url);
    const data = await response.json();
    const deals = (data && data.data) ? data.data : [];
    const moreItems = data && data.additional_data && data.additional_data.pagination
      ? data.additional_data.pagination.more_items_in_collection : false;
    const nextStart = startAt + PAGE;

    const dealsToInsert = [];
    let foundReps = 0, foundAms = 0;

    for (const deal of deals) {
      const personId = deal.person_id && typeof deal.person_id === 'object' ? deal.person_id.value : deal.person_id;
      let callCenterRepId = null, callCenterRepName = null, accountManagerId = null, accountManagerName = null;

      if (personId) {
        try {
          const personResponse = await fetch(`${baseUrl}/persons/${personId}?api_token=${PIPEDRIVE_API_KEY}`);
          if (personResponse.ok) {
            const personData = await personResponse.json();
            if (personData.data) {
              const repField = personData.data[CALL_CENTER_REP_FIELD];
              if (repField) {
                callCenterRepId = typeof repField === 'object' ? (repField.id || repField.value) : repField;
                callCenterRepName = typeof repField === 'object' ? repField.name : repField;
                if (callCenterRepName) foundReps++;
              }
              const amField = personData.data[ACCOUNT_MANAGER_FIELD];
              if (amField) {
                accountManagerId = typeof amField === 'object' ? (amField.id || amField.value) : amField;
                accountManagerName = typeof amField === 'object' ? amField.name : amField;
                if (accountManagerName) foundAms++;
              }
            }
          }
          await new Promise(r => setTimeout(r, 80));
        } catch (err) {
          console.log(`CS Deals Sync: person ${personId} error: ${err.message}`);
        }
      }

      // Monitoring Site (1) — resolve the option id to its label
      const msRaw = deal[MONITORING_SITE_FIELD];
      const msId = msRaw && typeof msRaw === 'object' ? (msRaw.id || msRaw.value) : msRaw;
      const monitoringSite = (msId !== null && msId !== undefined && msId !== '')
        ? (maps.ms[String(msId)] || String(msId)) : null;

      dealsToInsert.push({
        deal_id: deal.id,
        person_id: personId || null,
        deal_title: deal.title || null,
        pipeline_id: deal.pipeline_id || null,
        pipeline_name: maps.pipeline[String(deal.pipeline_id)] || null,
        stage_id: deal.stage_id || null,
        stage_name: maps.stage[String(deal.stage_id)] || null,
        deal_status: deal.status || 'open',
        deal_value: deal.value || 0,
        call_center_rep_id: callCenterRepId,
        call_center_rep_name: callCenterRepName,
        account_manager_id: accountManagerId,
        account_manager_name: accountManagerName,
        monitoring_site: monitoringSite,
        deal_created_at: deal.add_time || null,
        deal_updated_at: deal.update_time || null,
        synced_at: new Date().toISOString()
      });
    }

    // ------------------------------------------------------------------
    // Stamp monitoring_site_set_at for backfilled deals so they CREDIT.
    // Rule: deal has a monitoring_site + is in an early credit pipeline
    // (New Leads / Reports / Quoted 2.0) + does NOT already have a set_at.
    // Use deal update_time as the proxy for when the site was set.
    const EARLY_CREDIT_PIPELINES = ['NEW LEADS', 'Reports', 'Quoted 2.0'];
    try {
      const pageIds = dealsToInsert.map(r => r.deal_id).filter(Boolean);
      let existingSetAt = {};
      if (SUPABASE_URL && SUPABASE_KEY && pageIds.length > 0) {
        const exRes = await fetch(`${SUPABASE_URL}/rest/v1/cs_deals?deal_id=in.(${pageIds.join(',')})&select=deal_id,monitoring_site_set_at`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (exRes.ok) {
          for (const row of await exRes.json()) {
            if (row.monitoring_site_set_at) existingSetAt[String(row.deal_id)] = true;
          }
        }
      }
      for (const r of dealsToInsert) {
        const alreadyStamped = existingSetAt[String(r.deal_id)];
        const inEarlyPipeline = r.pipeline_name && EARLY_CREDIT_PIPELINES.includes(r.pipeline_name);
        if (r.monitoring_site && inEarlyPipeline && !alreadyStamped) {
          r.monitoring_site_set_at = r.deal_updated_at || new Date().toISOString();
          r.monitoring_site_set_pipeline = r.pipeline_name;
        }
      }
    } catch (e) { console.error('set_at stamping skipped:', e.message); }

    // Upsert this page (merge on deal_id). No delete-all, so chunked runs are safe.
    if (SUPABASE_URL && SUPABASE_KEY && dealsToInsert.length > 0) {
      const upsert = await fetch(`${SUPABASE_URL}/rest/v1/cs_deals?on_conflict=deal_id`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(dealsToInsert)
      });
      if (!upsert.ok) console.error(`CS Deals Sync upsert error: ${await upsert.text()}`);
    }

    // Recalculate metrics only on the final page
    if (!moreItems && SUPABASE_URL && SUPABASE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/recalculate_cs_metrics`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: '{}'
        });
      } catch (e) {}
    }

    const nextUrl = moreItems ? `/.netlify/functions/cs-deals-initial-sync?start=${nextStart}` : null;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        page: { start: startAt, size: deals.length },
        foundReps,
        foundAms,
        done: !moreItems,
        nextUrl,
        elapsed: `${Date.now() - startTime}ms`
      })
    };
  } catch (error) {
    console.error('CS Deals Sync Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
