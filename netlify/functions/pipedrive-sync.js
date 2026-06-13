// Pipedrive API Integration for KPI Tracking
// Syncs escalations and errors from Pipedrive labels

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Label mappings
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

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/pipedrive-sync', '');
  const method = event.httpMethod;

  try {
    // GET /status - Check API connection
    if (path === '/status' || path === '') {
      const response = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/users/me?api_token=${PIPEDRIVE_API_KEY}`
      );
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          connected: data.success,
          user: data.data?.name,
          company: data.data?.company_name
        })
      };
    }

    // GET /labels - Get all labels from Pipedrive
    if (path === '/labels' && method === 'GET') {
      // Get person fields to find label field
      const fieldsResponse = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/personFields?api_token=${PIPEDRIVE_API_KEY}`
      );
      const fieldsData = await fieldsResponse.json();
      
      // Find label/tag fields
      const labelFields = fieldsData.data?.filter(f => 
        f.field_type === 'set' || f.field_type === 'enum' || f.name.toLowerCase().includes('label')
      ) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ fields: labelFields })
      };
    }

    // GET /escalations - Fetch persons with escalation labels
    if (path === '/escalations' && method === 'GET') {
      const results = [];
      
      // Search for each escalation label
      for (const [labelName, status] of Object.entries(ESCALATION_LABELS)) {
        const searchResponse = await fetch(
          `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/search?term=${encodeURIComponent(labelName)}&api_token=${PIPEDRIVE_API_KEY}`
        );
        const searchData = await searchResponse.json();
        
        if (searchData.data?.items) {
          for (const item of searchData.data.items) {
            results.push({
              pipedrive_person_id: item.item.id.toString(),
              client_name: item.item.name,
              client_email: item.item.primary_email,
              status: status,
              raw: item.item
            });
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ escalations: results })
      };
    }

    // GET /errors - Fetch persons with error labels
    if (path === '/errors' && method === 'GET') {
      const results = [];
      
      for (const [labelName, errorType] of Object.entries(ERROR_LABELS)) {
        const searchResponse = await fetch(
          `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/search?term=${encodeURIComponent(labelName)}&api_token=${PIPEDRIVE_API_KEY}`
        );
        const searchData = await searchResponse.json();
        
        if (searchData.data?.items) {
          for (const item of searchData.data.items) {
            results.push({
              pipedrive_person_id: item.item.id.toString(),
              client_name: item.item.name,
              error_type: errorType,
              raw: item.item
            });
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ errors: results })
      };
    }

    // POST /sync - Full sync to Supabase
    if (path === '/sync' && method === 'POST') {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Supabase credentials not configured' })
        };
      }

      // This would sync data to Supabase
      // For now, return the data that would be synced
      
      const escalationsResponse = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons?api_token=${PIPEDRIVE_API_KEY}&limit=500`
      );
      const personsData = await escalationsResponse.json();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Sync endpoint ready',
          personsCount: personsData.data?.length || 0
        })
      };
    }

    // GET /filters - Get all filters from Pipedrive
    if (path === '/filters' && method === 'GET') {
      const response = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/filters?api_token=${PIPEDRIVE_API_KEY}`
      );
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ filters: data.data || [] })
      };
    }

    // GET /filter/:id - Get persons from a specific filter
    if (path.startsWith('/filter/') && method === 'GET') {
      const filterId = path.replace('/filter/', '');
      
      const response = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons?filter_id=${filterId}&api_token=${PIPEDRIVE_API_KEY}&limit=500`
      );
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          filter_id: filterId,
          count: data.data?.length || 0,
          persons: data.data || []
        })
      };
    }

    // GET /deals - Get deals for retention tracking
    if (path === '/deals' && method === 'GET') {
      const status = event.queryStringParameters?.status || 'all_not_deleted';
      
      const response = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?status=${status}&api_token=${PIPEDRIVE_API_KEY}&limit=500`
      );
      const data = await response.json();
      
      // Calculate retention metrics
      const deals = data.data || [];
      const won = deals.filter(d => d.status === 'won').length;
      const lost = deals.filter(d => d.status === 'lost').length;
      const open = deals.filter(d => d.status === 'open').length;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          total: deals.length,
          won,
          lost,
          open,
          retention_rate: deals.length > 0 ? ((won / (won + lost)) * 100).toFixed(1) : 0
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' })
    };

  } catch (error) {
    console.error('Pipedrive API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
