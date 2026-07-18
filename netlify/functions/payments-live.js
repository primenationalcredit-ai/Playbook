// netlify/functions/payments-live.js
//
// Zoho-truth replacement for paysheet-live: serves consultant_payments rows in
// the SAME response shape the ConsultantPayments page expects from the legacy
// Google Sheet ({ success, months: { 'yyyy-MM': { rows: [...] } } }), so the
// page's math works unchanged - but the money now comes from the synced Zoho
// data and can never lag manual data entry.
// Sheet-only fields (total_price, refund, negative_items) return empty until
// those get proper sources.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };

const FEE_TYPE_LABEL = {
  doc_fee: 'Doc Fee', partial: 'Partial Payment', final: 'Final Payment',
  paid_in_full: 'Paid in Full', additional_round: '2 Additional Rounds'
};
const CODE_FOR = {
  doc_fee: 'doc', partial: 'par', final: 'fin', paid_in_full: 'fin', additional_round: 'ar'
};

exports.handler = async (event) => {
  try {
    const monthsParam = (event.queryStringParameters || {}).months || '';
    const months = monthsParam.split(',').map(m => m.trim()).filter(m => /^\d{4}-\d{2}$/.test(m));
    if (months.length === 0) return { statusCode: 400, body: JSON.stringify({ success: false, error: 'months required (yyyy-MM,csv)' }) };

    const out = {};
    for (const ym of months) {
      const rows = [];
      let from = 0;
      const page = 1000;
      while (true) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${ym}&excluded_from_bonus=eq.false&select=client_name,consultant_name,payment_type,amount,payment_date,pipedrive_deal_id,referrer_org,is_affiliate_deal&order=payment_date.asc`, {
          headers: { ...SB, Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }
        });
        const batch = await res.json();
        if (!Array.isArray(batch)) break;
        for (const p of batch) {
          rows.push({
            date_paid: p.payment_date,
            client: p.client_name || '',
            consultant: p.consultant_name || 'Unknown',
            fee_paid: p.amount,
            fee_type: FEE_TYPE_LABEL[p.payment_type] || (p.payment_type || 'Other'),
            code: CODE_FOR[p.payment_type] || 'other',
            deal_id: p.pipedrive_deal_id || '',
            referrer_org: p.referrer_org || '',
            is_affiliate: !!p.is_affiliate_deal,
            source: 'Zoho',
            // sheet-only fields - empty until re-homed:
            total_price: '', refund: '', negative_items: 0
          });
        }
        if (batch.length < page) break;
        from += page;
      }
      out[ym] = { rows };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true, source: 'consultant_payments (Zoho sync)', months: out }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
