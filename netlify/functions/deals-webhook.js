// Deals Webhook - Keeps Supabase deals table in sync with Pipedrive
// TRACKS CHANGES: Records timestamps when key fields change
// - Doc(1) changed to Yes → "Doc (1) Changed At"
// - QUICK_BUTTONS changed to "Consultant Send Intro Text" → "Consultant Intro Text Sent At"
// - Pipeline changed → "Pipeline Changed At"  
// - Stage changed → "Stage Changed At"

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pipedrive custom field keys
const FIELDS = {
  DOC_1: '314d267ebc05d3623ffd8aab701baae7bea29aa8',
  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4',
  RD1_START_END_DATES: '6979c70df67f42c28dfcff39284ae17d564d600f',
  CALL_CENTER_REP: 'fee42f0cb3d515239d602de62533887bfd58d384',
  QUICK_BUTTONS: '928261a2cb90f4c404d6b7ab89a5542d8561350c'
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase not configured');
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  const supabaseHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const payload = JSON.parse(event.body);
    
    const eventType = payload.meta?.action || payload.event;
    const dealData = payload.current || payload.data || payload;
    
    console.log(`Webhook received: ${eventType}`, { dealId: dealData?.id });

    if (!dealData?.id) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No deal ID in payload' }) };
    }

    const dealId = dealData.id;
    const now = new Date().toISOString();

    // Handle delete event
    if (eventType === 'deleted' || eventType === 'deal.deleted') {
      await fetch(
        `${SUPABASE_URL}/rest/v1/deals?deal_id=eq.${dealId}`,
        {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({ "Deal - Status": "deleted" })
        }
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'deleted', dealId }) };
    }

    // 1. Fetch EXISTING deal from Supabase (to compare changes)
    const existingDealResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/deals?deal_id=eq.${dealId}&select=*`,
      { headers: supabaseHeaders }
    );
    const existingDeals = await existingDealResponse.json();
    console.log(`Existing deal lookup for ${dealId}:`, Array.isArray(existingDeals) ? existingDeals.length : 0, 'found');
    const existingDeal = Array.isArray(existingDeals) && existingDeals.length > 0 ? existingDeals[0] : null;

    // 2. Fetch full deal data from Pipedrive API
    const fullDeal = await fetchDealFromPipedrive(dealId);
    
    if (!fullDeal) {
      console.error('Could not fetch deal from Pipedrive:', dealId);
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Could not fetch deal from Pipedrive' }) };
    }

    // Log the raw deal data to see what we're getting
    console.log('Pipedrive deal data:', JSON.stringify({
      id: fullDeal.id,
      stage_id: fullDeal.stage_id,
      stage: fullDeal.stage,
      pipeline_id: fullDeal.pipeline_id,
      pipeline: fullDeal.pipeline
    }));

    // 3. Build the new deal object
    const newDoc1 = normalizeDoc1(fullDeal[FIELDS.DOC_1]);
    const newPipeline = fullDeal.pipeline?.name || getPipelineName(fullDeal.pipeline_id);
    
    // Get stage name - Pipedrive returns stage_id, need to fetch stage name
    let newStage = null;
    if (fullDeal.stage_id) {
      newStage = await getStageName(fullDeal.stage_id);
    }
    console.log('Resolved stage name:', newStage);

    const deal = {
      "deal_id": fullDeal.id,
      "Deal - Title": fullDeal.title,
      "Deal - Owner": fullDeal.owner_name || fullDeal.user_id?.name || null,
      "Deal - Pipeline": newPipeline,
      "Deal - Stage": newStage,
      "Deal - Status": fullDeal.status,
      "Deal - Value": fullDeal.value || 0,
      "Deal - Doc (1)": newDoc1,
      "Deal - Final (1)": normalizeYesNo(fullDeal[FIELDS.FINAL_1]),
      "Deal - RD 1 Start/End Dates": fullDeal[FIELDS.RD1_START_END_DATES] || null,
      "Deal - Quick Buttons": fullDeal[FIELDS.QUICK_BUTTONS] || null,
      "Person - Call Center Rep ": extractName(fullDeal[FIELDS.CALL_CENTER_REP]),
      "Deal - Contact person": fullDeal.person_id?.name || fullDeal.person_name || null,
      "Deal - Organization": fullDeal.org_id?.name || fullDeal.org_name || null,
      "Deal - Deal created": fullDeal.add_time,
      "Deal - Update time": fullDeal.update_time,
      "Deal - Moved into Pipeline": fullDeal.stage_change_time || fullDeal.update_time
    };
    
    // Get current QUICK_BUTTONS value
    const newQuickButtons = fullDeal[FIELDS.QUICK_BUTTONS] || null;

    // 4. TRACK CHANGES - Compare with existing deal
    const changes = {
      doc1Changed: false,
      quickButtonsChanged: false,
      pipelineChanged: false,
      stageChanged: false,
      movedToQuoted: false,
      movedToSold: false,
      movedToReadyToQuote: false,
      isNewDeal: !existingDeal
    };

    if (existingDeal) {
      // Check if Doc(1) changed TO "Yes"
      const oldDoc1 = existingDeal["Deal - Doc (1)"];
      if (oldDoc1 !== newDoc1 && (newDoc1 === 'Yes' || newDoc1 === 'yes')) {
        deal["Doc (1) Changed At"] = now;
        changes.doc1Changed = true;
        console.log(`Doc(1) changed to Yes for deal ${dealId} at ${now}`);
      } else if (existingDeal["Doc (1) Changed At"]) {
        // Preserve existing timestamp
        deal["Doc (1) Changed At"] = existingDeal["Doc (1) Changed At"];
      }

      // Check if QUICK_BUTTONS changed TO "Consultant Send Intro Text"
      const oldQuickButtons = existingDeal["Deal - Quick Buttons"];
      if (oldQuickButtons !== newQuickButtons && newQuickButtons === 'Consultant Send Intro Text') {
        deal["Consultant Intro Text Sent At"] = now;
        changes.quickButtonsChanged = true;
        console.log(`QUICK_BUTTONS changed to "Consultant Send Intro Text" for deal ${dealId} at ${now}`);
      } else if (existingDeal["Consultant Intro Text Sent At"]) {
        // Preserve existing timestamp
        deal["Consultant Intro Text Sent At"] = existingDeal["Consultant Intro Text Sent At"];
      }

      // Check if Pipeline changed
      const oldPipeline = existingDeal["Deal - Pipeline"];
      if (oldPipeline !== newPipeline) {
        deal["Pipeline Changed At"] = now;
        changes.pipelineChanged = true;
        changes.fromPipeline = oldPipeline;
        changes.toPipeline = newPipeline;
        console.log(`Pipeline changed from "${oldPipeline}" to "${newPipeline}" for deal ${dealId} at ${now}`);
        
        // Track specific pipeline changes
        if (newPipeline === 'Quoted 2.0') {
          deal["Quoted Pipeline Changed At"] = now;
          changes.movedToQuoted = true;
          console.log(`Deal ${dealId} moved to Quoted 2.0 pipeline at ${now}`);
        }
        if (newPipeline === 'SOLD') {
          deal["Sold Pipeline Changed At"] = now;
          changes.movedToSold = true;
          console.log(`Deal ${dealId} moved to SOLD pipeline at ${now}`);
        }
      } else {
        // Preserve existing timestamps
        if (existingDeal["Pipeline Changed At"]) {
          deal["Pipeline Changed At"] = existingDeal["Pipeline Changed At"];
        }
        if (existingDeal["Quoted Pipeline Changed At"]) {
          deal["Quoted Pipeline Changed At"] = existingDeal["Quoted Pipeline Changed At"];
        }
        if (existingDeal["Sold Pipeline Changed At"]) {
          deal["Sold Pipeline Changed At"] = existingDeal["Sold Pipeline Changed At"];
        }
      }

      // Check if Stage changed
      const oldStage = existingDeal["Deal - Stage"];
      if (oldStage !== newStage) {
        deal["Stage Changed At"] = now;
        changes.stageChanged = true;
        changes.fromStage = oldStage;
        changes.toStage = newStage;
        console.log(`Stage changed from "${oldStage}" to "${newStage}" for deal ${dealId} at ${now}`);
        
        // Track Ready to Quote stage specifically
        if (newStage === 'Ready to Quote') {
          deal["Ready to Quote Changed At"] = now;
          changes.movedToReadyToQuote = true;
          console.log(`Deal ${dealId} moved to Ready to Quote stage at ${now}`);
        }
      } else {
        // Preserve existing timestamps
        if (existingDeal["Stage Changed At"]) {
          deal["Stage Changed At"] = existingDeal["Stage Changed At"];
        }
        if (existingDeal["Ready to Quote Changed At"]) {
          deal["Ready to Quote Changed At"] = existingDeal["Ready to Quote Changed At"];
        }
      }
    } else {
      // NEW DEAL - set initial timestamps if applicable
      console.log(`New deal ${dealId} being created`);
      if (newDoc1 === 'Yes' || newDoc1 === 'yes') {
        deal["Doc (1) Changed At"] = now;
        changes.doc1Changed = true;
      }
      if (newQuickButtons === 'Consultant Send Intro Text') {
        deal["Consultant Intro Text Sent At"] = now;
        changes.quickButtonsChanged = true;
      }
      deal["Pipeline Changed At"] = now;
      deal["Stage Changed At"] = now;
      changes.pipelineChanged = true;
      changes.stageChanged = true;
      
      // Set specific timestamps for new deals
      if (newPipeline === 'Quoted 2.0') {
        deal["Quoted Pipeline Changed At"] = now;
        changes.movedToQuoted = true;
      }
      if (newPipeline === 'SOLD') {
        deal["Sold Pipeline Changed At"] = now;
        changes.movedToSold = true;
      }
      if (newStage === 'Ready to Quote') {
        deal["Ready to Quote Changed At"] = now;
        changes.movedToReadyToQuote = true;
      }
    }

    // 5. Upsert to Supabase
    const upsertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/deals`,
      {
        method: 'POST',
        headers: {
          ...supabaseHeaders,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(deal)
      }
    );

    if (!upsertResponse.ok) {
      const errText = await upsertResponse.text();
      console.error('Supabase upsert failed:', errText);
      throw new Error(`Supabase upsert failed: ${errText}`);
    }

    console.log(`Deal ${dealId} successfully synced. Changes:`, changes);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        action: existingDeal ? 'updated' : 'created',
        dealId: deal["Deal - ID"],
        pipeline: deal["Deal - Pipeline"],
        stage: deal["Deal - Stage"],
        doc1: deal["Deal - Doc (1)"],
        changes
      })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return { statusCode: 200, headers, body: JSON.stringify({ error: error.message }) };
  }
};

// Fetch full deal data from Pipedrive API
async function fetchDealFromPipedrive(dealId) {
  if (!PIPEDRIVE_API_KEY) return null;
  
  try {
    const response = await fetch(
      `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_KEY}`
    );
    const data = await response.json();
    return data.data || null;
  } catch (err) {
    console.error('Pipedrive fetch error:', err);
    return null;
  }
}

// Get stage name from stage ID
async function getStageName(stageId) {
  if (!PIPEDRIVE_API_KEY || !stageId) return null;
  
  try {
    const response = await fetch(
      `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/stages/${stageId}?api_token=${PIPEDRIVE_API_KEY}`
    );
    const data = await response.json();
    return data.data?.name || null;
  } catch (err) {
    console.error('Pipedrive stage fetch error:', err);
    return null;
  }
}

// Pipeline ID to name mapping
function getPipelineName(pipelineId) {
  const names = {
    42: 'Quoted 2.0',
    7: 'SOLD',
    45: 'C.R.S.',
    21: 'NEW LEADS',
    37: 'Reports',
    63: 'Missed Opportunities'
  };
  return names[pipelineId] || `Pipeline ${pipelineId}`;
}

// Normalize Doc(1) field value to Yes/No
function normalizeDoc1(value) {
  if (!value) return null;
  if (value === 1104 || value === '1104' || value === 'Yes' || value === 'yes') return 'Yes';
  if (value === 1105 || value === '1105' || value === 'No' || value === 'no') return 'No';
  if (value === 'Add Rounds Paid') return 'Add Rounds Paid';
  return String(value);
}

// Normalize Yes/No fields
function normalizeYesNo(value) {
  if (!value) return null;
  if (value === true || value === 1 || value === '1' || value === 'Yes' || value === 'yes') return 'Yes';
  if (value === false || value === 0 || value === '0' || value === 'No' || value === 'no') return 'No';
  return String(value);
}

// Extract name from various field formats
function extractName(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (field.name) return field.name;
  if (field.value) return field.value;
  return null;
}
