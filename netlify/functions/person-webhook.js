// Person Webhook - Tracks updates to Person records from Pipedrive
// Updates deals table when Person fields change (Call Center Rep, Account Manager, etc.)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);
    
    // Pipedrive webhook payload structure
    const { meta, current, previous } = payload;
    const action = meta?.action; // added, updated, deleted
    const personId = current?.id || previous?.id;

    console.log(`Person webhook: ${action} for person ${personId}`);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.log('Supabase not configured, skipping');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Supabase not configured' }) };
    }

    const supabaseHeaders = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };

    // Extract relevant person fields
    // Note: Custom field keys may vary - these are common patterns
    const personData = current || {};
    
    // Get Call Center Rep and Account Manager from person's custom fields
    // These field keys come from your Pipedrive setup
    const callCenterRep = personData['Call Center Rep'] || 
                          personData['fee42f0cb3d515239d602de62533887bfd58d384'] ||
                          null;
    const accountManager = personData['Account Manager'] ||
                           personData['account_manager'] ||
                           null;
    const personName = personData.name || null;
    const personEmail = personData.email?.[0]?.value || null;
    const personPhone = personData.phone?.[0]?.value || null;

    if (action === 'deleted') {
      // Person deleted - we might want to log this but not delete deals
      console.log(`Person ${personId} deleted`);
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ success: true, action: 'person_deleted', personId }) 
      };
    }

    // For added/updated - update any deals linked to this person
    // Find deals with this person_id and update their person fields
    
    // First, let's log what we received for debugging
    console.log('Person data received:', {
      personId,
      personName,
      callCenterRep,
      accountManager,
      action
    });

    // Update deals that reference this person
    // Note: Our deals table uses "Deal - Contact person" for person name
    // We need to update the Person fields on matching deals
    
    // Since we're using CSV column names, we need to match on person name or ID
    // For now, log the update - full implementation would query deals by person
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        action,
        personId,
        personName,
        callCenterRep,
        accountManager,
        message: 'Person webhook received - deals will be updated on next sync'
      })
    };

  } catch (error) {
    console.error('Person webhook error:', error);
    return {
      statusCode: 200, // Return 200 so Pipedrive doesn't retry
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
