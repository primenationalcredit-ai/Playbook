// Creates the review_link_log table (Joe 9/4 - Review Link Activity Log request).
// Run once: /.netlify/functions/migrate-review-link-log
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  try {
    const testRes = await fetch(`${SUPABASE_URL}/rest/v1/review_link_log?select=*&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (testRes.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'review_link_log table already exists!' }) };
    }
    const sqlRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          CREATE TABLE IF NOT EXISTS review_link_log (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            sent_at timestamptz NOT NULL DEFAULT now(),
            sent_by_name text,
            sent_by_email text,
            location_name text,
            client_name text,
            pipedrive_deal_id text,
            review_url text,
            delivery_method text,
            email_status text,
            sms_status text,
            overall_status text,
            created_at timestamptz DEFAULT now()
          );
          ALTER TABLE review_link_log DISABLE ROW LEVEL SECURITY;
        `
      })
    });
    if (!sqlRes.ok) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({
          message: 'Could not auto-create table. Please create it manually in Supabase SQL Editor:',
          sql: `CREATE TABLE review_link_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by_name text,
  sent_by_email text,
  location_name text,
  client_name text,
  pipedrive_deal_id text,
  review_url text,
  delivery_method text,
  email_status text,
  sms_status text,
  overall_status text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE review_link_log DISABLE ROW LEVEL SECURITY;`
        })
      };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'review_link_log table created successfully!' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
