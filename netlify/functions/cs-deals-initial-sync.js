// CS Deals Initial Sync
// One-time function to load all current CS deals from Pipedrive filter into Supabase
// Run this once to populate the database, then webhooks handle updates

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Filter ID for CS deals
const CS_DEALS_FILTER = 136445;

// Call Center Rep field on Person
const CALL_CENTER_REP_FIELD = 'fee42f0cb3d515239d602de62533887bfd58d384';
// Monitoring Site (1) field on Deal — distinguishes IDIQ vs SmartCredit reports
const MONITORING_SITE_FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('CS Deals Initial Sync: Starting...');
  const startTime = Date.now();

  try {
    const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

    // ============================================
    // STEP 1: Fetch all deals from filter (with pagination)
    // ============================================
    let allDeals = [];
    let start = 0;
    const limit = 100; // Smaller batches
    let hasMore = true;

    while (hasMore) {
      const url = `${baseUrl}/deals?api_token=${PIPEDRIVE_API_KEY}&filter_id=${CS_DEALS_FILTER}&start=${start}&limit=${limit}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        allDeals = allDeals.concat(data.data);
        start += limit;
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
        console.log(`CS Deals Sync: Fetched ${allDeals.length} deals...`);
      } else {
        hasMore = false;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`CS Deals Sync: Total ${allDeals.length} deals to process`);

    // ============================================
    // STEP 2: For each deal, get person's Call Center Rep
    // Process sequentially with delays to avoid rate limiting
    // ============================================
    const dealsToInsert = [];
    let processed = 0;
    let foundReps = 0;

    for (const deal of allDeals) {
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
                if (callCenterRepName) foundReps++;
              }
            }
          }
          
          // Small delay between person lookups
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.log(`CS Deals Sync: Error fetching person ${personId}: ${err.message}`);
        }
      }

      // Monitoring Site (1) — value can be a string or an option object
      const msRaw = deal[MONITORING_SITE_FIELD];
      const monitoringSite = msRaw && typeof msRaw === 'object' ? (msRaw.name || msRaw.value || null) : (msRaw || null);

      // Prepare deal record
      dealsToInsert.push({
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
      });

      processed++;
      if (processed % 20 === 0) {
        console.log(`CS Deals Sync: Processed ${processed}/${allDeals.length} deals, found ${foundReps} with reps`);
      }
    }

    console.log(`CS Deals Sync: Finished processing. ${foundReps}/${allDeals.length} deals have Call Center Rep`);

    // ============================================
    // STEP 3: Insert into Supabase (upsert)
    // ============================================
    if (SUPABASE_URL && SUPABASE_KEY && dealsToInsert.length > 0) {
      // Clear existing data first
      const deleteResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/cs_deals?deal_id=gt.0`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      console.log(`CS Deals Sync: Cleared existing data`);

      // Insert in batches of 50
      const batchSize = 50;
      for (let i = 0; i < dealsToInsert.length; i += batchSize) {
        const batch = dealsToInsert.slice(i, i + batchSize);
        
        const insertResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/cs_deals`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(batch)
          }
        );

        if (!insertResponse.ok) {
          const errorText = await insertResponse.text();
          console.error(`CS Deals Sync: Insert error: ${errorText}`);
        }
      }
      console.log(`CS Deals Sync: Inserted ${dealsToInsert.length} deals into Supabase`);

      // ============================================
      // STEP 4: Recalculate metrics
      // ============================================
      const rpcResponse = await fetch(
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
      
      if (rpcResponse.ok) {
        console.log(`CS Deals Sync: Metrics recalculated`);
      } else {
        console.log(`CS Deals Sync: Metrics recalc failed: ${await rpcResponse.text()}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`CS Deals Sync: Completed in ${elapsed}ms`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        dealsProcessed: allDeals.length,
        dealsWithReps: foundReps,
        elapsed: `${elapsed}ms`
      })
    };

  } catch (error) {
    console.error('CS Deals Sync Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
