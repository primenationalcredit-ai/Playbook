// affiliate-unsub.js  (Playbook)
// One-click unsubscribe from partner emails. Linked in every engine email footer.
// GET ?id={affiliate_orgs.id}&k={base64 of pipedrive_org_id} - the k check stops
// casual id-guessing without needing real auth for a public unsub link.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const html = (body) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `<!doctype html><html><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center"><h2>${body}</h2></body></html>`
  });
  try {
    const p = event.queryStringParameters || {};
    const id = parseInt(p.id, 10);
    const k = p.k || '';
    if (!id || !k) return html('Invalid unsubscribe link.');

    const r = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=eq.${id}&select=id,pipedrive_org_id,org_name`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await r.json();
    const aff = rows && rows[0];
    if (!aff) return html('Invalid unsubscribe link.');
    const expected = Buffer.from(String(aff.pipedrive_org_id)).toString('base64');
    if (k !== expected) return html('Invalid unsubscribe link.');

    await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ opted_out: true, updated_at: new Date().toISOString() })
    });
    return html('You are unsubscribed. No more partner emails from us.');
  } catch (e) {
    return html('Something went wrong. Email teamelite@asapcreditrepairusa.com and we will remove you manually.');
  }
};
