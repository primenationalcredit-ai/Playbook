// Creates a simple 'daily_out' table for tracking who's out today
// Run once: /.netlify/functions/migrate-daily-out
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  try {
    // Test if table already exists
    const testRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_out?select=*&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    
    if (testRes.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'daily_out table already exists!' }) };
    }
    
    // Create table via SQL
    const sqlRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          CREATE TABLE IF NOT EXISTS daily_out (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id uuid NOT NULL,
            date date NOT NULL DEFAULT CURRENT_DATE,
            marked_by text DEFAULT 'admin',
            created_at timestamptz DEFAULT now(),
            UNIQUE(user_id, date)
          );
          ALTER TABLE daily_out DISABLE ROW LEVEL SECURITY;
        `
      })
    });

    if (!sqlRes.ok) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({
          message: 'Could not auto-create table. Please create it manually in Supabase SQL Editor:',
          sql: `CREATE TABLE daily_out (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  marked_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE daily_out DISABLE ROW LEVEL SECURITY;`
        })
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ message: 'daily_out table created successfully!' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
