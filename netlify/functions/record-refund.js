// record-refund.js
// Manual-refund entrance to the ONE refund pipeline. The Refund Tracking tab
// submits here. Does everything in one place:
//   1. Inserts the refunds row (service role; sets refund_date the UI forgot)
//   2. Matches + flags the synced payment (same open-period rule as the card path):
//      current-month payment -> excluded_from_bonus, past months recorded only
//   3. Mirrors into refund_log (single ledger across card + manual refunds)
//   4. Posts a REFUND RECORDED note to the Pipedrive deal

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, status: r.status, json, text };
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  if (!b.client_name || !b.refund_amount) return respond(400, { error: 'client_name and refund_amount are required' });

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const dealId = b.pipedrive_deal_id ? String(b.pipedrive_deal_id).trim() : null;
  const amount = parseFloat(b.refund_amount) || 0;

  // 1. Insert the refunds row (the tab's table), guaranteeing refund_date.
  const row = { ...b, refund_amount: amount, refund_date: b.refund_date || today };
  const ins = await supa('refunds', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  if (!ins.ok) return respond(500, { error: 'refunds insert failed: ' + (ins.text || '').slice(0, 200) });
  const refundId = (Array.isArray(ins.json) && ins.json[0] && ins.json[0].id) || null;

  // 2. Match + flag the synced payment (open-period rule). Deal ID required for matching.
  let matched = null, excluded = false;
  if (dealId) {
    try {
      const cands = await supa(`consultant_payments?pipedrive_deal_id=eq.${encodeURIComponent(dealId)}&refunded_at=is.null&select=id,amount,payment_month&order=payment_date.desc`);
      matched = (cands.json || []).find(r => Math.abs((parseFloat(r.amount) || 0) - amount) < 0.01) || null;
      if (matched) {
        excluded = String(matched.payment_month || '') === currentMonth;
        await supa(`consultant_payments?id=eq.${matched.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ refunded_at: new Date().toISOString(), refund_reason: b.refund_reason || null, excluded_from_bonus: excluded })
        });
      }
    } catch (e) {}
  }

  // 3. Mirror to refund_log (the single cross-source ledger).
  let logResult = null;
  try {
    logResult = await supa('refund_log', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        source: 'manual', pipedrive_deal_id: dealId, client_name: b.client_name,
        amount, refund_transaction_id: null, original_transaction_id: null,
        reason: b.refund_reason || null, refunded_by: b.created_by || b.consultant_name || null,
        matched_payment_id: matched ? matched.id : null, excluded_from_bonus: excluded
      })
    });
  } catch (e) {}

  // 4. Note the deal.
  let noted = false;
  if (dealId) {
    try {
      const content = `<p><b>\u{1F4B8} REFUND RECORDED (manual)</b></p><ul>` +
        `<li>Amount: <b>$${amount.toFixed(2)}</b></li>` +
        `<li>Consultant: ${esc(b.consultant_name || 'n/a')} \u00b7 payroll deduction $${esc(b.deduction_amount != null ? b.deduction_amount : '0')} (${esc(b.deduction_percentage != null ? b.deduction_percentage : 0)}%)</li>` +
        (b.refund_reason ? `<li>Reason: ${esc(b.refund_reason)}</li>` : '') +
        (b.notes ? `<li>Notes: ${esc(b.notes)}</li>` : '') +
        `<li>Status: ${esc(row.status || 'pending')}</li></ul>` +
        `<p>${matched ? (excluded ? 'Matching payment excluded from current-period bonus.' : 'Matching payment marked refunded (past period, already paid out - not clawed back).') : 'No matching synced payment found (normal if the payment predates the sync or has not synced yet).'}</p>`;
      const nr = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/notes?api_token=${PIPEDRIVE_TOKEN}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: parseInt(dealId, 10), content })
      });
      noted = nr.ok;
    } catch (e) {}
  }

  return respond(200, {
    success: true, refund_id: refundId,
    matched_payment: matched ? matched.id : null,
    excluded_from_bonus: excluded,
    deal_noted: noted,
    logged: logResult ? logResult.ok : false,
    log_error: logResult && !logResult.ok ? (logResult.text || '').slice(0, 200) : null
  });
};
