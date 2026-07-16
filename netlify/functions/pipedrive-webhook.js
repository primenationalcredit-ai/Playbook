// Pipedrive Webhook Receiver
// Receives real-time updates when deals/persons change in Pipedrive

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// Quick Buttons field key
const QUICK_BUTTONS_FIELD = '928261a2cb90f4c404d6b7ab89a5542d8561350c';

// Stage ID for "Ready To Quote" - you may need to update this
// To find it: Go to Pipedrive Settings > Pipelines > Click on stage > Check URL for stage ID
const READY_TO_QUOTE_STAGE_ID = null; // Will be detected from stage_name if not set
const READY_TO_QUOTE_STAGE_NAME = 'Ready To Quote';

// Quick Buttons values
const INTRO_TEXT_VALUE = 'Consultant Send Intro Text';
const SCHEDULED_CONSULT_VALUE = 'Wants Consult at Later Time';

// Business hours configuration (CST)
const BUSINESS_START_HOUR = 9; // 9am CST
const TIMEZONE = 'America/Chicago'; // CST

// Helper function to adjust time to business hours
function adjustToBusinessHours(timestamp) {
  // Convert to CST
  const date = new Date(timestamp);
  const cstOptions = { timeZone: TIMEZONE };
  
  // Get CST components
  const cstString = date.toLocaleString('en-US', cstOptions);
  const cstDate = new Date(cstString);
  
  const dayOfWeek = cstDate.getDay(); // 0 = Sunday
  const hour = cstDate.getHours();
  
  // If Sunday, move to Monday 9am
  if (dayOfWeek === 0) {
    cstDate.setDate(cstDate.getDate() + 1);
    cstDate.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    return cstDate.toISOString();
  }
  
  // If before 9am, set to 9am same day
  if (hour < BUSINESS_START_HOUR) {
    cstDate.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    return cstDate.toISOString();
  }
  
  // Otherwise return original time
  return timestamp;
}

// Label mappings - must match what's in Pipedrive
const ESCALATION_LABELS = {
  'ESC - Open': 'open',
  'ESC - Resolved (No Refund)': 'resolved_no_refund',
  'ESC - Resolved (Partial Refund)': 'resolved_partial_refund',
  'ESC - Resolved (Full Refund)': 'resolved_full_refund'
};

const ERROR_LABELS = {
  'ERR - Documentation': 'documentation',
  'ERR - Processing': 'processing',
  'ERR - Communication': 'communication',
  'ERR - Billing': 'billing',
  'ERR - Other': 'other'
};

// Deal stages for retention tracking (customize these to match your Pipedrive)
const RETENTION_STAGES = {
  'won': 'completed',
  'lost': 'dropped',
  'open': 'active'
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

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  // Initialize Supabase
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Supabase credentials not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database not configured' })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const payload = JSON.parse(event.body);
    
    console.log('Pipedrive webhook received:', JSON.stringify(payload, null, 2));

    const { meta, current, previous } = payload;
    const eventType = meta?.action; // added, updated, deleted
    const objectType = meta?.object; // deal, person, etc.

    // Handle Person updates (for escalations and errors)
    if (objectType === 'person') {
      await handlePersonUpdate(supabase, current, previous, eventType);
    }

    // Handle Deal updates (for retention and conversion tracking)
    if (objectType === 'deal') {
      await handleDealUpdate(supabase, current, previous, eventType);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        processed: objectType,
        action: eventType 
      })
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Handle person label changes (escalations & errors)
async function handlePersonUpdate(supabase, current, previous, action) {
  if (!current) return;

  const personId = current.id?.toString();
  const personName = current.name;
  const personEmail = current.email?.[0]?.value;
  
  // Get labels from person (Pipedrive stores labels in a custom field or as tags)
  // The exact field depends on your Pipedrive setup - adjust as needed
  const labels = current.label || [];
  const labelNames = Array.isArray(labels) ? labels : [labels];

  // Check for escalation labels
  for (const [labelName, status] of Object.entries(ESCALATION_LABELS)) {
    const hasLabel = labelNames.some(l => 
      l?.toLowerCase?.() === labelName.toLowerCase() ||
      l?.name?.toLowerCase?.() === labelName.toLowerCase()
    );

    if (hasLabel) {
      // Upsert escalation record
      const { error } = await supabase
        .from('pipedrive_escalations')
        .upsert({
          pipedrive_person_id: personId,
          client_name: personName,
          client_email: personEmail,
          status: status,
          opened_at: status === 'open' ? new Date().toISOString() : undefined,
          resolved_at: status !== 'open' ? new Date().toISOString() : undefined,
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'pipedrive_person_id',
          ignoreDuplicates: false
        });

      if (error) console.error('Error upserting escalation:', error);
      else console.log(`Escalation ${status} recorded for ${personName}`);
    }
  }

  // Check for error labels
  for (const [labelName, errorType] of Object.entries(ERROR_LABELS)) {
    const hasLabel = labelNames.some(l => 
      l?.toLowerCase?.() === labelName.toLowerCase() ||
      l?.name?.toLowerCase?.() === labelName.toLowerCase()
    );

    if (hasLabel) {
      // Insert error record (we want to track each error, not upsert)
      const { error } = await supabase
        .from('pipedrive_errors')
        .insert({
          pipedrive_person_id: personId,
          client_name: personName,
          error_type: errorType,
          flagged_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        });

      if (error && !error.message.includes('duplicate')) {
        console.error('Error inserting error record:', error);
      } else {
        console.log(`Error ${errorType} recorded for ${personName}`);
      }
    }
  }
}

// Handle deal updates (retention, conversion tracking, consultation timing)
async function handleDealUpdate(supabase, current, previous, action) {
  if (!current) return;

  const dealId = current.id?.toString();
  const dealTitle = current.title;
  const dealStatus = current.status; // open, won, lost
  const dealValue = current.value;
  const personId = current.person_id?.toString();
  const personName = current.person_name;
  const ownerId = current.owner_id; // Consultant who owns the deal
  const ownerName = current.owner_name;
  const stageId = current.stage_id;
  const stageName = current.stage_name || current.stage?.name;
  const pipelineId = current.pipeline_id;
  const addTime = current.add_time;
  const wonTime = current.won_time;
  const lostTime = current.lost_time;
  const lostReason = current.lost_reason;
  const stageChangeTime = current.stage_change_time;

  // Get Quick Buttons value
  const quickButtonsValue = current[QUICK_BUTTONS_FIELD];

  // Track deal for retention metrics
  const { error } = await supabase
    .from('pipedrive_deals')
    .upsert({
      pipedrive_deal_id: dealId,
      pipedrive_person_id: personId,
      title: dealTitle,
      client_name: personName,
      status: dealStatus,
      value: dealValue,
      owner_id: ownerId?.toString(),
      stage_id: stageId?.toString(),
      pipeline_id: pipelineId?.toString(),
      created_at: addTime,
      won_at: wonTime,
      lost_at: lostTime,
      lost_reason: lostReason,
      last_synced_at: new Date().toISOString()
    }, {
      onConflict: 'pipedrive_deal_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error upserting deal:', error);
  } else {
    console.log(`Deal ${dealTitle} (${dealStatus}) synced`);
  }

  // If deal status changed, log it for conversion tracking
  if (previous && previous.status !== current.status) {
    await supabase
      .from('pipedrive_deal_history')
      .insert({
        pipedrive_deal_id: dealId,
        previous_status: previous.status,
        new_status: current.status,
        changed_at: new Date().toISOString()
      });
  }

  // === CONSULTATION TIMING TRACKING ===
  
  // Check if deal just entered "Ready To Quote" stage
  const enteredReadyToQuote = 
    stageName?.toLowerCase().includes('ready to quote') ||
    (previous && previous.stage_id !== current.stage_id && stageName?.toLowerCase().includes('ready to quote'));

  if (enteredReadyToQuote) {
    console.log(`Deal ${dealId} entered Ready To Quote stage`);
    
    // Adjust timestamp to business hours (9am CST start, no Sundays)
    const rawTimestamp = stageChangeTime || new Date().toISOString();
    const adjustedTimestamp = adjustToBusinessHours(rawTimestamp);
    
    console.log(`Raw time: ${rawTimestamp}, Adjusted to business hours: ${adjustedTimestamp}`);
    
    // Create or update consultation timing record
    const { error: timingError } = await supabase
      .from('consultation_timing')
      .upsert({
        deal_id: dealId,
        deal_title: dealTitle,
        person_name: personName,
        consultant_name: ownerName,
        consultant_id: ownerId?.toString(),
        ready_to_quote_at: adjustedTimestamp
      }, {
        onConflict: 'deal_id',
        ignoreDuplicates: false
      });

    if (timingError) {
      console.error('Error creating consultation timing:', timingError);
    } else {
      console.log(`Consultation timer started for deal ${dealId}`);
    }
  }

  // Check Quick Buttons value
  const previousQuickButtons = previous?.[QUICK_BUTTONS_FIELD];
  const quickButtonsChanged = quickButtonsValue !== previousQuickButtons;

  // Check if Quick Buttons = "Consultant Send Intro Text" (completed on time)
  const introTextSent = 
    quickButtonsValue === INTRO_TEXT_VALUE ||
    (typeof quickButtonsValue === 'object' && quickButtonsValue?.name === INTRO_TEXT_VALUE);

  // Check if Quick Buttons = "Wants Consult at Later Time" (scheduled - doesn't count against them)
  const scheduledConsult = 
    quickButtonsValue === SCHEDULED_CONSULT_VALUE ||
    (typeof quickButtonsValue === 'object' && quickButtonsValue?.name === SCHEDULED_CONSULT_VALUE);

  if (quickButtonsChanged) {
    if (introTextSent) {
      console.log(`Deal ${dealId} - Intro text sent!`);
      
      // Update consultation timing record with completion time
      const { error: timingError } = await supabase
        .from('consultation_timing')
        .update({
          intro_text_sent_at: new Date().toISOString()
        })
        .eq('deal_id', dealId);

      if (timingError) {
        console.error('Error updating consultation timing:', timingError);
      } else {
        console.log(`Consultation timer stopped for deal ${dealId}`);
      }
    } else if (scheduledConsult) {
      console.log(`Deal ${dealId} - Client wants scheduled consultation (excluded from timing)`);
      
      // Mark as scheduled - won't count against consultant's metrics
      const { error: timingError } = await supabase
        .from('consultation_timing')
        .update({
          is_scheduled: true,
          is_complete: true,
          met_target: true, // Doesn't count against them
          intro_text_sent_at: new Date().toISOString(),
          notes: 'Client requested scheduled consultation'
        })
        .eq('deal_id', dealId);

      if (timingError) {
        console.error('Error marking consultation as scheduled:', timingError);
      } else {
        console.log(`Consultation marked as scheduled for deal ${dealId}`);
      }
    }
  }
}
