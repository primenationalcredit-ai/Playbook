// Creates lead_provider_accounts and lead_provider_calls tables (Joe 9/9 - Vertimedia portal).
// Run once: /.netlify/functions/migrate-lead-provider
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  try {
    const testRes = await fetch(`${SUPABASE_URL}/rest/v1/lead_provider_accounts?select=*&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (testRes.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'lead_provider tables already exist!' }) };
    }
    const sql = `
      CREATE TABLE IF NOT EXISTS lead_provider_accounts (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        provider_name text NOT NULL,
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        extension_number text,
        phone_number text,
        rate_per_call numeric NOT NULL DEFAULT 30,
        threshold_seconds integer NOT NULL DEFAULT 120,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE lead_provider_accounts DISABLE ROW LEVEL SECURITY;

      CREATE TABLE IF NOT EXISTS lead_provider_calls (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        provider_id uuid REFERENCES lead_provider_accounts(id),
        ringcentral_call_id text UNIQUE,
        call_start timestamptz NOT NULL,
        duration_seconds integer NOT NULL,
        from_number text,
        to_number text,
        qualifying boolean NOT NULL,
        payout_amount numeric NOT NULL DEFAULT 0,
        payout_week_friday date,
        paid boolean NOT NULL DEFAULT false,
        pipedrive_deal_id text,
        funnel_stage text NOT NULL DEFAULT 'transferred',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE lead_provider_calls DISABLE ROW LEVEL SECURITY;
    `;
    const sqlRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql })
    });
    if (!sqlRes.ok) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ message: 'Could not auto-create tables. Please create manually in Supabase SQL Editor:', sql })
      };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'lead_provider tables created successfully!' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
