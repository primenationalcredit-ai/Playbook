// Netlify Function for receiving scorecard data from Zapier
// Endpoint: POST /.netlify/functions/scorecard-entry

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
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

    const data = JSON.parse(event.body);
    
    // Support both single entry and batch entries
    const entries = Array.isArray(data) ? data : [data];
    const results = [];
    const errors = [];

    for (const entry of entries) {
      const { 
        user_email, 
        metric_key, 
        value, 
        date, 
        notes,
        // Alternative field names Zapier might use
        email,
        metric,
        amount
      } = entry;

      const finalEmail = user_email || email;
      const finalMetricKey = metric_key || metric;
      const finalValue = value || amount;
      const finalDate = date || new Date().toISOString().split('T')[0];

      if (!finalEmail || !finalMetricKey || finalValue === undefined) {
        errors.push({
          entry,
          error: 'Missing required fields: user_email, metric_key, value'
        });
        continue;
      }

      // Get user ID from email
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(finalEmail)}&select=id`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      const users = await userRes.json();
      
      if (!users || users.length === 0) {
        errors.push({ entry, error: `User not found: ${finalEmail}` });
        continue;
      }
      const userId = users[0].id;

      // Get metric ID from key
      const metricRes = await fetch(
        `${SUPABASE_URL}/rest/v1/scorecard_metrics?key=eq.${encodeURIComponent(finalMetricKey)}&select=id`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      const metrics = await metricRes.json();
      
      if (!metrics || metrics.length === 0) {
        errors.push({ entry, error: `Metric not found: ${finalMetricKey}` });
        continue;
      }
      const metricId = metrics[0].id;

      // Upsert the entry
      const upsertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/scorecard_entries`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            user_id: userId,
            metric_id: metricId,
            entry_date: finalDate,
            value: parseFloat(finalValue),
            notes: notes || null,
            source: 'zapier',
            updated_at: new Date().toISOString()
          })
        }
      );

      if (upsertRes.ok) {
        results.push({
          user_email: finalEmail,
          metric_key: finalMetricKey,
          value: finalValue,
          date: finalDate,
          status: 'success'
        });
      } else {
        const errorText = await upsertRes.text();
        errors.push({ entry, error: errorText });
      }
    }

    return {
      statusCode: errors.length > 0 && results.length === 0 ? 400 : 200,
      headers,
      body: JSON.stringify({
        success: results.length > 0,
        processed: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
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
