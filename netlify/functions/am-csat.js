// am-csat.js — AM satisfaction score from the Round 2 survey.
// Each response carries an am_rating (1-10). An AM's monthly score is the average
// of their ratings that month. A minimum number of responses is required before
// the score is considered eligible (so one angry client can't define an AM).
// Bonus tiers are intentionally NOT applied yet — calibrate against real data first.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIN_RESPONSES = 5;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();

    const url = `${SUPABASE_URL}/rest/v1/client_surveys?survey_type=eq.round2_am&created_at=gte.${start}&created_at=lt.${end}&am_rating=not.is.null&select=am_name,am_rating,overall_satisfaction`;
    const res = await fetch(url, { headers: supa });
    const rows = res.ok ? await res.json() : [];

    const byAM = {};
    for (const r of rows) {
      const name = (r.am_name || '').trim();
      if (!name) continue;
      if (!byAM[name]) byAM[name] = { responses: 0, sumRating: 0, sumOverall: 0, overallCount: 0 };
      byAM[name].responses += 1;
      byAM[name].sumRating += Number(r.am_rating) || 0;
      if (r.overall_satisfaction != null) { byAM[name].sumOverall += Number(r.overall_satisfaction); byAM[name].overallCount += 1; }
    }

    const result = {};
    for (const [name, d] of Object.entries(byAM)) {
      result[name] = {
        responses: d.responses,
        avgRating: d.responses ? Math.round((d.sumRating / d.responses) * 10) / 10 : null,
        avgOverall: d.overallCount ? Math.round((d.sumOverall / d.overallCount) * 10) / 10 : null,
        eligible: d.responses >= MIN_RESPONSES,
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ month, minResponses: MIN_RESPONSES, byAM: result, calculatedAt: new Date().toISOString() }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
