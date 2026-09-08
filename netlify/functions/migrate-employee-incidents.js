// Creates the employee_incidents table (Joe 9/9 - Employee Incident Reports Tab).
// Run once: /.netlify/functions/migrate-employee-incidents
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  try {
    const testRes = await fetch(`${SUPABASE_URL}/rest/v1/employee_incidents?select=*&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (testRes.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'employee_incidents table already exists!' }) };
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
          CREATE TABLE IF NOT EXISTS employee_incidents (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_user_id uuid,
            employee_name text NOT NULL,
            incident_type text NOT NULL,
            incident_date date NOT NULL DEFAULT CURRENT_DATE,
            description text,
            reported_by_user_id uuid,
            reported_by_name text,
            follow_up_date date,
            follow_up_completed boolean NOT NULL DEFAULT false,
            follow_up_notes text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );
          ALTER TABLE employee_incidents DISABLE ROW LEVEL SECURITY;
        `
      })
    });
    if (!sqlRes.ok) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({
          message: 'Could not auto-create table. Please create it manually in Supabase SQL Editor:',
          sql: `CREATE TABLE employee_incidents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_user_id uuid,
  employee_name text NOT NULL,
  incident_type text NOT NULL,
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  reported_by_user_id uuid,
  reported_by_name text,
  follow_up_date date,
  follow_up_completed boolean NOT NULL DEFAULT false,
  follow_up_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE employee_incidents DISABLE ROW LEVEL SECURITY;`
        })
      };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'employee_incidents table created successfully!' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
