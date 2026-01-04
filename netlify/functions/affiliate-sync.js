// Netlify Function for receiving affiliate data from Zapier/Pipedrive
// Endpoint: POST /.netlify/functions/affiliate-sync

export async function handler(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

    const data = JSON.parse(event.body);
    const { action } = data;

    // Action: sync_affiliate - Create or update affiliate from Pipedrive
    if (action === 'sync_affiliate') {
      const {
        pipedrive_id,
        organization_name,
        contact_name,
        email,
        phone,
        type,
        classification,
        consultant_email,
        created_date,
        leads_count,
        sold_count,
        inactive_count
      } = data;

      if (!pipedrive_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'pipedrive_id is required' })
        };
      }

      // Find consultant by email if provided
      let consultantId = null;
      if (consultant_email) {
        const userRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(consultant_email)}&select=id`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
        );
        const users = await userRes.json();
        if (users && users.length > 0) {
          consultantId = users[0].id;
        }
      }

      // Check if affiliate exists
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/affiliates?pipedrive_id=eq.${encodeURIComponent(pipedrive_id)}&select=id`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      const existing = await existingRes.json();

      const affiliateData = {
        pipedrive_id,
        name: contact_name || organization_name || 'Unknown',
        organization_name,
        email,
        phone,
        type: type || 'other',
        classification: classification || 'referrer',
        pipedrive_created_date: created_date,
        acquired_date: created_date || new Date().toISOString().split('T')[0],
        leads_count: parseInt(leads_count) || 0,
        sold_count: parseInt(sold_count) || 0,
        inactive_count: parseInt(inactive_count) || 0,
        updated_at: new Date().toISOString()
      };

      if (consultantId) {
        affiliateData.consultant_id = consultantId;
      }

      let result;
      if (existing && existing.length > 0) {
        // Update existing
        result = await fetch(
          `${SUPABASE_URL}/rest/v1/affiliates?pipedrive_id=eq.${encodeURIComponent(pipedrive_id)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(affiliateData)
          }
        );
      } else {
        // Create new - set up follow-up schedule
        affiliateData.followup_stage = 'day_1';
        affiliateData.next_followup_date = affiliateData.acquired_date;
        
        result = await fetch(
          `${SUPABASE_URL}/rest/v1/affiliates`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(affiliateData)
          }
        );
      }

      if (result.ok) {
        const savedAffiliate = await result.json();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            action: existing?.length > 0 ? 'updated' : 'created',
            affiliate: savedAffiliate[0] || savedAffiliate
          })
        };
      } else {
        const errorText = await result.text();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: errorText })
        };
      }
    }

    // Action: sync_referral - Create or update a referral/lead from an affiliate
    if (action === 'sync_referral') {
      const {
        pipedrive_deal_id,
        affiliate_pipedrive_id,
        client_name,
        client_email,
        client_phone,
        status,
        referred_date,
        consultation_date,
        sold_date,
        deal_value
      } = data;

      if (!affiliate_pipedrive_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'affiliate_pipedrive_id is required' })
        };
      }

      // Find affiliate by pipedrive_id
      const affiliateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/affiliates?pipedrive_id=eq.${encodeURIComponent(affiliate_pipedrive_id)}&select=id`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      const affiliates = await affiliateRes.json();
      
      if (!affiliates || affiliates.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: `Affiliate not found with pipedrive_id: ${affiliate_pipedrive_id}` })
        };
      }

      const affiliateId = affiliates[0].id;

      const referralData = {
        affiliate_id: affiliateId,
        pipedrive_deal_id,
        client_name,
        client_email,
        client_phone,
        status: status || 'lead',
        referred_date: referred_date || new Date().toISOString().split('T')[0],
        consultation_date,
        sold_date,
        deal_value: parseFloat(deal_value) || 0,
        updated_at: new Date().toISOString()
      };

      // Check if referral exists (by deal ID)
      let result;
      if (pipedrive_deal_id) {
        const existingRef = await fetch(
          `${SUPABASE_URL}/rest/v1/affiliate_referrals?pipedrive_deal_id=eq.${encodeURIComponent(pipedrive_deal_id)}&select=id`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
        );
        const existingReferral = await existingRef.json();

        if (existingReferral && existingReferral.length > 0) {
          result = await fetch(
            `${SUPABASE_URL}/rest/v1/affiliate_referrals?pipedrive_deal_id=eq.${encodeURIComponent(pipedrive_deal_id)}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(referralData)
            }
          );
        } else {
          result = await fetch(
            `${SUPABASE_URL}/rest/v1/affiliate_referrals`,
            {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(referralData)
            }
          );
        }
      } else {
        // No deal ID, just create new
        result = await fetch(
          `${SUPABASE_URL}/rest/v1/affiliate_referrals`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(referralData)
          }
        );
      }

      if (result.ok) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, referral: await result.json() })
        };
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: await result.text() })
        };
      }
    }

    // Action: log_followup - Log a follow-up activity from Pipedrive
    if (action === 'log_followup') {
      const {
        affiliate_pipedrive_id,
        consultant_email,
        followup_type,
        followup_date,
        notes,
        outcome
      } = data;

      if (!affiliate_pipedrive_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'affiliate_pipedrive_id is required' })
        };
      }

      // Find affiliate
      const affiliateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/affiliates?pipedrive_id=eq.${encodeURIComponent(affiliate_pipedrive_id)}&select=id`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      const affiliates = await affiliateRes.json();
      
      if (!affiliates || affiliates.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Affiliate not found' })
        };
      }

      // Find consultant
      let consultantId = null;
      if (consultant_email) {
        const userRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(consultant_email)}&select=id`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
        );
        const users = await userRes.json();
        if (users?.length > 0) consultantId = users[0].id;
      }

      const followupData = {
        affiliate_id: affiliates[0].id,
        consultant_id: consultantId,
        followup_type: followup_type || 'call',
        followup_date: followup_date || new Date().toISOString().split('T')[0],
        notes,
        outcome
      };

      const result = await fetch(
        `${SUPABASE_URL}/rest/v1/affiliate_followups`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(followupData)
        }
      );

      if (result.ok) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Follow-up logged' })
        };
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: await result.text() })
        };
      }
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Invalid action',
        valid_actions: ['sync_affiliate', 'sync_referral', 'log_followup']
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
}
