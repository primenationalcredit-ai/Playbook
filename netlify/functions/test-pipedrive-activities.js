// Test endpoint to verify Pipedrive activities API is working
// URL: /.netlify/functions/test-pipedrive-activities

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (!PIPEDRIVE_API_KEY) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, error: 'PIPEDRIVE_API_KEY not set' })
    };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get first batch of overdue activities
    const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/activities?done=0&end_date=${today}&limit=50&api_token=${PIPEDRIVE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, error: data.error })
      };
    }
    
    // Show sample activities with both activity owner AND deal_id
    const samples = data.data.slice(0, 10).map(a => ({
      id: a.id,
      subject: a.subject?.substring(0, 40),
      activity_owner: a.owner_name,  // This is who owns the ACTIVITY
      deal_id: a.deal_id,            // This is the deal it's linked to
      due_date: a.due_date
    }));
    
    // Count by activity owner (what we were doing wrong)
    const byActivityOwner = {};
    data.data.forEach(a => {
      const owner = a.owner_name || 'Unknown';
      byActivityOwner[owner] = (byActivityOwner[owner] || 0) + 1;
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Activities are owned by activity_owner, but we need to look up DEAL owner',
        today,
        totalReturned: data.data.length,
        hasMore: data.additional_data?.pagination?.more_items_in_collection,
        byActivityOwner,
        note: 'All activities show Joe Mahlow as owner, but the DEAL is owned by consultants. We need to match deal_id to deals table to get consultant.',
        sampleActivities: samples
      }, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
