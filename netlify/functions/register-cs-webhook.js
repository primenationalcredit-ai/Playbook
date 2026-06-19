// Checks whether the Pipedrive webhook pointing at cs-deals-webhook exists, and creates it if not.
// Run once: /.netlify/functions/register-cs-webhook
// Returns the existing webhooks (so you can see what's there) and anything it created.

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const TARGET_URL = 'https://cute-cat-d9631c.netlify.app/.netlify/functions/cs-deals-webhook';

exports.handler = async () => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

  try {
    // List existing webhooks
    const listRes = await fetch(`${base}/webhooks?api_token=${PIPEDRIVE_API_KEY}`);
    const list = await listRes.json();
    const all = (list.data || []).map(w => ({
      id: w.id, event_action: w.event_action, event_object: w.event_object, subscription_url: w.subscription_url
    }));
    const mine = all.filter(w => (w.subscription_url || '').includes('cs-deals-webhook'));

    const coversDeal = (action) =>
      mine.some(w =>
        (w.event_object === 'deal' || w.event_object === '*') &&
        (w.event_action === action || w.event_action === '*')
      );

    const created = [];
    const ensure = async (event_action, event_object) => {
      if (coversDeal(event_action)) return;
      const res = await fetch(`${base}/webhooks?api_token=${PIPEDRIVE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_url: TARGET_URL, event_action, event_object, version: '1.0' })
      });
      created.push({ event_action, event_object, status: res.status, response: await res.text() });
    };

    await ensure('updated', 'deal');
    await ensure('added', 'deal');

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        target: TARGET_URL,
        existingWebhooksPointingHere: mine,
        allWebhooks: all,
        created,
        note: created.length ? 'Created missing webhook(s). Try the test deal again.' : 'A matching webhook already existed; nothing created.'
      }, null, 2)
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
