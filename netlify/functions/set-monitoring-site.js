// netlify/functions/set-monitoring-site.js
//
// Writes a deal's Monitoring Site the RIGHT way: Pipedrive first (source of
// truth, real option id), then mirrors the label to cs_deals for instant UI.
// The cs-deals webhook confirms behind it. Never invents a set_at date -
// existing stamps are kept; null stays null (metrics fall back to deal creation).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const FIELD = 'b8676d1cd8672d9a4214867037af2c94d8367c5e'; // Monitoring Site (1)

const OPTIONS = {
  '479': 'ProCredit', '480': 'Identity Guard', '481': 'Annual Credit Report',
  '482': 'Free Scores', '483': 'Privacy Guard', '484': 'ScoreSense',
  '485': 'Credit Check Total', '486': 'Identity IQ', '3571': 'CreditBuilder IQ',
  '3572': 'CreditScore IQ', '487': 'Idenity Force', '488': 'Freecreditscore.com',
  '561': 'Experian.com', '562': 'Transunion.com', '563': 'Equifax.com',
  '1150': 'MyFico.com', '1278': 'Free Score Connect', '1279': 'ID Lookout (Scoresense)',
  '1280': 'My Free Score Now', '1690': 'National Credit Report', '1715': 'Smart Credit',
  '1744': 'Client sent credit reports to us', '1867': 'Lender reports',
  '1914': 'Truly ID', '1917': 'My Score IQ', '1928': 'ID Club',
  '1929': 'Credit Monitoring Solutions', '3703': 'Identity Iq (Client Sent Reports)',
  '3704': 'Smart Credit (Client Sent Reports)'
};

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  try {
    const { deal_id, option_id } = JSON.parse(event.body || '{}');
    const label = OPTIONS[String(option_id)];
    if (!deal_id || !label) return { statusCode: 400, headers, body: JSON.stringify({ error: 'deal_id and a valid option_id required' }) };

    // 1. Pipedrive - source of truth.
    const pd = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${deal_id}?api_token=${PD_TOKEN}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [FIELD]: String(option_id) })
    });
    const pdData = await pd.json().catch(() => ({}));
    if (!pd.ok || !pdData.success) return { statusCode: 502, headers, body: JSON.stringify({ error: `Pipedrive update failed: ${pdData.error || pd.status}` }) };

    // 2. Mirror to cs_deals (webhook will confirm; this makes the UI instant).
    await fetch(`${SUPABASE_URL}/rest/v1/cs_deals?deal_id=eq.${deal_id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ monitoring_site: label, synced_at: new Date().toISOString() })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deal_id, monitoring_site: label, message: `Monitoring Site set to "${label}" in Pipedrive and the tracker. Refresh metrics to recount.` }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
