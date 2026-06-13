// One-time migration: Add 'links' jsonb column to task_templates
// Hit this endpoint once after deploy: /.netlify/functions/migrate-links
// Can be deleted after running successfully

exports.handler = async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Add links column (jsonb) if it doesn't exist
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS links jsonb DEFAULT NULL;`
      })
    });

    if (!res.ok) {
      // If rpc/exec_sql doesn't exist, try direct SQL via PostgREST
      // Fallback: just test if column exists by trying a query
      const testRes = await fetch(`${SUPABASE_URL}/rest/v1/task_templates?select=links&limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      if (testRes.ok) {
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'links column already exists!' })
        };
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            message: 'Could not add column automatically. Please add it manually in Supabase Dashboard:',
            instructions: 'Go to Table Editor > task_templates > Add Column > Name: "links", Type: "jsonb", Default: null'
          })
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Migration complete - links column added!' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
