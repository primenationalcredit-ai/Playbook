// CS Deals Webhook Handler
// Receives webhooks from Pipedrive when deals or persons change
// Updates cs_deals table and recalculates metrics

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Call Center Rep field on Person
const CALL_CENTER_REP_FIELD = 'fee42f0cb3d515239d602de62533887bfd58d384';
const MONITORING_SITE_FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';

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
      const msRaw = deal[MONITORING_SITE_FIELD];
      const monitoringSite = msRaw && typeof msRaw === 'object' ? (msRaw.name || msRaw.value || null) : (msRaw || null);
      const dealRecord = {
        deal_id: deal.id,
        person_id: personId || null,
        deal_title: deal.title || null,
        pipeline_id: deal.pipeline_id || null,
        pipeline_name: deal.pipeline?.name || null,
        stage_id: deal.stage_id || null,
        stage_name: deal.stage?.name || null,
        deal_status: deal.status || 'open',
        deal_value: deal.value || 0,
        call_center_rep_id: callCenterRepId,
        call_center_rep_name: callCenterRepName,
        monitoring_site: monitoringSite,
        deal_created_at: deal.add_time || null,
        deal_updated_at: deal.update_time || null,
        synced_at: new Date().toISOString()
      };

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
