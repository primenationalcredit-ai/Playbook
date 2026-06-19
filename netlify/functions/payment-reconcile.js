// Reconciles the Google payment sheet against the Zoho consultant_payments table for a month.
// Shows, per consultant, sheet total vs Zoho total, how much Zoho money is unattributed
// (pending_enrichment), and which sheet payments don't match a Zoho row (and vice versa).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const firstName = (s) => norm(s).split(' ')[0] || '';
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const SITE = process.env.URL || `https://${(event.headers && event.headers.host) || 'cute-cat-d9631c.netlify.app'}`;

    // 1) Sheet side (authoritative — consultant is stamped on each row)
    const sheetRes = await fetch(`${SITE}/.netlify/functions/paysheet-live?months=${month}`);
    const sheetJson = await sheetRes.json().catch(() => ({}));
    const sheetMonth = sheetJson?.months?.[month] || { rows: [], summary: { by_consultant: {}, total_sales: 0 } };
    const sheetRows = sheetMonth.rows || [];

    // 2) Zoho side (consultant_payments)
    const zRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${month}&select=client_name,amount,payment_type,payment_date,consultant_name,pipedrive_deal_id&limit=10000`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: '0-9999' },
    });
    const zohoRows = zRes.ok ? await zRes.json() : [];

    // Index Zoho rows for matching
    const zByDeal = {};
    const zByNameAmt = {};
    zohoRows.forEach(z => {
      if (z.pipedrive_deal_id) zByDeal[String(z.pipedrive_deal_id)] = z;
      zByNameAmt[`${norm(z.client_name)}|${money(z.amount)}`] = z;
    });

    // 3) Match each sheet payment to a Zoho row (deal id first, then name+amount)
    let sheetMatched = 0;
    const sheetMissing = []; // on sheet, not found in Zoho table
    sheetRows.forEach(s => {
      const byDeal = s.deal_id && zByDeal[String(s.deal_id)];
      const byNameAmt = !byDeal && zByNameAmt[`${norm(s.client_name)}|${money(s.fee_paid)}`];
      if (byDeal || byNameAmt) sheetMatched++;
      else sheetMissing.push({ consultant: s.consultant, client: s.client_name, amount: money(s.fee_paid), date: s.date_paid, deal_id: s.deal_id || null });
    });

    // 4) Per-consultant totals: sheet vs Zoho-attributed (by consultant_name first-name match)
    const sheetByC = sheetMonth.summary?.by_consultant || {};
    const consultants = Object.keys(sheetByC);
    const zohoAttributed = {}; // consultantFirst -> {total,count}
    let zohoUnattributed = 0, zohoUnattributedCount = 0, zohoTotal = 0;
    zohoRows.forEach(z => {
      const amt = money(z.amount);
      zohoTotal += amt;
      const cn = (z.consultant_name || '').toLowerCase();
      if (!cn || cn === 'pending_enrichment' || cn === 'unknown') {
        zohoUnattributed += amt; zohoUnattributedCount++;
        return;
      }
      const f = firstName(z.consultant_name);
      if (!zohoAttributed[f]) zohoAttributed[f] = { total: 0, count: 0 };
      zohoAttributed[f].total += amt; zohoAttributed[f].count++;
    });

    const perConsultant = consultants.map(c => {
      const sheetTotal = money(sheetByC[c].total);
      const z = zohoAttributed[firstName(c)] || { total: 0, count: 0 };
      return {
        consultant: c,
        sheet_total: sheetTotal,
        sheet_count: sheetByC[c].count,
        zoho_attributed_total: money(z.total),
        zoho_attributed_count: z.count,
        delta: money(sheetTotal - z.total),
      };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const diagnosis = [];
    if (zohoUnattributedCount > 0) diagnosis.push(`${zohoUnattributedCount} Zoho payments totaling ${money(zohoUnattributed)} are not attributed to any consultant yet (pending enrichment). This money is in the table but credited to nobody.`);
    if (sheetMissing.length > 0) diagnosis.push(`${sheetMissing.length} payments on the sheet did not match any Zoho row by deal id or name+amount. Either they are not in the Zoho table, or the client name/amount differs.`);
    const sheetTotalAll = money(sheetMonth.summary?.total_sales || 0);
    diagnosis.push(`Sheet month total ${sheetTotalAll} vs Zoho table month total ${money(zohoTotal)} (all rows). Difference ${money(sheetTotalAll - zohoTotal)}.`);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        month,
        totals: {
          sheet_total: sheetTotalAll,
          sheet_payments: sheetRows.length,
          zoho_total_all_rows: money(zohoTotal),
          zoho_payments: zohoRows.length,
          zoho_unattributed_total: money(zohoUnattributed),
          zoho_unattributed_count: zohoUnattributedCount,
          sheet_payments_matched_in_zoho: sheetMatched,
          sheet_payments_missing_from_zoho: sheetMissing.length,
        },
        per_consultant: perConsultant,
        diagnosis,
        sheet_payments_missing_from_zoho_sample: sheetMissing.slice(0, 40),
      }, null, 2),
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
