// CS Deals Webhook Handler
// Receives webhooks from Pipedrive when deals or persons change
// Updates cs_deals table and recalculates metrics

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Call Center Rep field on Person
const CALL_CENTER_REP_FIELD = 'fee42f0cb3d515239d602de62533887bfd58d384';
const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const MONITORING_SITE_FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';

// Cached id->name maps (monitoring-site options, stages, pipelines). Refreshed hourly on warm invocations.
let _maps = null, _mapsAt = 0;
async function loadMaps(baseUrl) {
  if (_maps && Date.now() - _mapsAt < 3600000) return _maps;
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
  _maps = maps; _mapsAt = Date.now();
  return maps;
}

// CS-relevant pipelines
const CS_PIPELINES = [21, 37, 42, 45, 7];

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const { event: eventType, current, previous, meta } = payload;

    console.log(`CS Webhook: Received ${eventType}`);

    const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

    // ============================================
    // HANDLE DEAL EVENTS
    // ============================================
    if (eventType === 'added.deal' || eventType === 'updated.deal') {
      const deal = current;
      
      // Check if this is a CS-relevant pipeline
      if (!CS_PIPELINES.includes(deal.pipeline_id)) {
        console.log(`CS Webhook: Deal ${deal.id} not in CS pipeline, skipping`);
        return { statusCode: 200, headers, body: JSON.stringify({ skipped: true }) };
      }

      // Get person's Call Center Rep
      const personId = deal.person_id && typeof deal.person_id === 'object'
        ? deal.person_id.value
        : deal.person_id;

      let callCenterRepId = null;
      let callCenterRepName = null;
      let accountManagerId = null;
      let accountManagerName = null;

      if (personId) {
        try {
          const personUrl = `${baseUrl}/persons/${personId}?api_token=${PIPEDRIVE_API_KEY}`;
          const personResponse = await fetch(personUrl);
          
          if (personResponse.ok) {
            const personData = await personResponse.json();
            if (personData.data) {
              const repField = personData.data[CALL_CENTER_REP_FIELD];
              if (repField) {
                callCenterRepId = typeof repField === 'object' ? repField.id || repField.value : repField;
                callCenterRepName = typeof repField === 'object' ? repField.name : repField;
              }
              const amField = personData.data[ACCOUNT_MANAGER_FIELD];
              if (amField) {
                accountManagerId = typeof amField === 'object' ? amField.id || amField.value : amField;
                accountManagerName = typeof amField === 'object' ? amField.name : amField;
              }
            }
          }
        } catch (err) {
          console.log(`CS Webhook: Error fetching person: ${err.message}`);
        }
      }

      // Only track deals with Call Center Rep assigned
      if (!callCenterRepName) {
        console.log(`CS Webhook: Deal ${deal.id} has no Call Center Rep, skipping`);
        return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'no rep' }) };
      }

      // Upsert deal into Supabase
      const maps = await loadMaps(baseUrl);
      const msRaw = deal[MONITORING_SITE_FIELD];
      const msId = msRaw && typeof msRaw === 'object' ? (msRaw.id || msRaw.value) : msRaw;
      const monitoringSite = (msId !== null && msId !== undefined && msId !== '')
        ? (maps.ms[String(msId)] || String(msId)) : null;
      // Detect a real change by comparing the underlying option id (this is when the report was pulled).
      const prevMsRaw = previous ? previous[MONITORING_SITE_FIELD] : null;
      const prevMsId = prevMsRaw && typeof prevMsRaw === 'object' ? (prevMsRaw.id || prevMsRaw.value) : prevMsRaw;
      const monitoringSiteChanged = (msId !== null && msId !== undefined && msId !== '') && String(msId) !== String(prevMsId ?? '');
      const dealRecord = {
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
      };
      // Only set the timestamp when the value actually changed, so we don't overwrite the original set-date on later updates.
      if (monitoringSiteChanged) dealRecord.monitoring_site_set_at = new Date().toISOString();

      const upsertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/cs_deals?on_conflict=deal_id`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(dealRecord)
        }
      );

      if (upsertResponse.ok) {
        console.log(`CS Webhook: Upserted deal ${deal.id} for ${callCenterRepName}`);
      } else {
        console.error(`CS Webhook: Upsert failed: ${await upsertResponse.text()}`);
      }

      // Recalculate metrics
      await recalculateMetrics();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, action: 'deal_upserted', dealId: deal.id })
      };
    }

    // ============================================
    // HANDLE DEAL DELETED
    // ============================================
    if (eventType === 'deleted.deal') {
      const dealId = previous?.id || meta?.id;
      
      if (dealId) {
        const deleteResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/cs_deals?deal_id=eq.${dealId}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        
        console.log(`CS Webhook: Deleted deal ${dealId}`);
        await recalculateMetrics();
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, action: 'deal_deleted' })
      };
    }

    // ============================================
    // HANDLE PERSON UPDATED (Call Center Rep changed)
    // ============================================
    if (eventType === 'updated.person') {
      const person = current;
      const personId = person.id;

      // Check if Call Center Rep field changed
      const newRepField = person[CALL_CENTER_REP_FIELD];
      const oldRepField = previous?.[CALL_CENTER_REP_FIELD];

      const newRepName = newRepField && typeof newRepField === 'object' ? newRepField.name : newRepField;
      const oldRepName = oldRepField && typeof oldRepField === 'object' ? oldRepField.name : oldRepField;

      if (newRepName !== oldRepName) {
        console.log(`CS Webhook: Person ${personId} rep changed from "${oldRepName}" to "${newRepName}"`);

        // Update all deals for this person
        const updateResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/cs_deals?person_id=eq.${personId}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              call_center_rep_id: newRepField?.id || newRepField?.value || null,
              call_center_rep_name: newRepName || null,
              synced_at: new Date().toISOString()
            })
          }
        );

        console.log(`CS Webhook: Updated deals for person ${personId}`);
        await recalculateMetrics();
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, action: 'person_updated' })
      };
    }

    // Unknown event type
    console.log(`CS Webhook: Unknown event type: ${eventType}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ skipped: true, reason: 'unknown event' })
    };

  } catch (error) {
    console.error('CS Webhook Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Helper function to recalculate metrics
async function recalculateMetrics() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/recalculate_cs_metrics`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      }
    );
    
    if (response.ok) {
      console.log('CS Webhook: Metrics recalculated');
    }
  } catch (err) {
    console.error('CS Webhook: Metrics recalc error:', err.message);
  }
}
