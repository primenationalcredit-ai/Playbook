// affiliate-update-fu-notes.js  (Playbook)
// POST { id, notes } -> writes Additional F/U Notes BOTH ways:
//   PUT to the Pipedrive organization field + PATCH to affiliate_orgs.pipedrive_fu_notes
// So a consultant editing in the Playbook updates the org record in Pipedrive instantly.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const PD_FU_NOTES_KEY = '17c6fcd0a8bcc21bbba680a8fe82697d9f996df9';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  try {
    const { id, notes } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing id' }) };
    const text = String(notes == null ? '' : notes).slice(0, 4000);

    const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=eq.${id}&select=pipedrive_org_id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const aff = ((await affRes.json()) || [])[0];
    if (!aff) return { statusCode: 404, headers, body: JSON.stringify({ error: 'affiliate not found' }) };

    // Pipedrive first - if this fails, we do not want the app claiming success
    const pd = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${aff.pipedrive_org_id}?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [PD_FU_NOTES_KEY]: text })
    });
    if (!pd.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: `pipedrive ${pd.status}` }) };

    await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=eq.${id}`, {
      method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ pipedrive_fu_notes: text || null })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e).slice(0, 300) }) };
  }
};
