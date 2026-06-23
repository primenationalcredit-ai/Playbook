// Posts a Pipedrive note on a deal that a review was left, and stores the deal id on the review.
// Called when a review is approved/assigned (the deal id is captured at claim or assign time).
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const { reviewId, dealId, reviewerName, rating, reviewText, creditedTo } = JSON.parse(event.body || '{}');
    if (!dealId) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'deal_id required' }) };

    const supa = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

    // Save the deal id on the review row
    if (reviewId) {
      await fetch(`${SUPABASE_URL}/rest/v1/incoming_reviews?id=eq.${reviewId}`, {
        method: 'PATCH', headers: supa, body: JSON.stringify({ pipedrive_deal_id: String(dealId) }),
      }).catch(() => {});
    }

    // Post the note on the deal
    const stars = rating ? `${rating}-star ` : '';
    const credit = creditedTo ? ` Credited to ${creditedTo}.` : '';
    const snippet = reviewText ? `<br><br>"${String(reviewText).slice(0, 300)}"` : '';
    const content = `Review left by ${reviewerName || 'a client'} (${stars}review). Logged in the ASAP Playbook.${credit}${snippet}`;
    const noteRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/notes?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: Number(dealId), content }),
    });
    const noteJson = await noteRes.json().catch(() => ({}));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: !!noteJson.success }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
