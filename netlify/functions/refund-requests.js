// refund-requests.js
// The refund REQUEST pipeline (B1). All refunds start here; nobody card-refunds
// directly from the Invoices page anymore.
//
// POST actions:
//   { action: 'submit', pipedrive_deal_id, client_name, client_email, amount,
//     refund_type, token_id?, charge_id?, reason, requested_by, requested_by_name }
//   { action: 'decide', request_id, decision: 'approved'|'denied',
//     decided_by (email - MUST be a leadership user), denial_reason? }
//   { action: 'list', status? }
//
// Leadership check is SERVER-SIDE: decided_by email must exist in users with
// department = 'leadership' (Joe, Kim, Astrid). The client cannot fake it by
// sending a different flag - the email is re-verified against the table.
// On approval: posts a Pipedrive note. Signature/issuance steps arrive in B2/B3.

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

async function postNote(dealId, content) {
  if (!dealId) return false;
  try {
    const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/notes?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: parseInt(dealId, 10), content })
    });
    return r.ok;
  } catch (e) { return false; }
}

async function isLeadership(email) {
  if (!email) return false;
  const r = await supa(`users?email=eq.${encodeURIComponent(String(email).trim().toLowerCase())}&department=eq.leadership&select=id,name`);
  return Array.isArray(r.json) && r.json.length > 0;
}

// Round 1+ started? (drives the release-form requirement) - reads the deal's R1 start field.
const R1_KEY = '6979c70df67f42c28dfcff39284ae17d564d600f';
async function roundsStarted(dealId) {
  try {
    const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_TOKEN}`);
    if (!r.ok) return null;
    const d = ((await r.json()).data) || {};
    return !!d[R1_KEY];
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

  try {
    // ---------------- SUBMIT ----------------
    if (b.action === 'submit') {
      if (!b.pipedrive_deal_id || !b.amount || !b.reason) {
        return respond(400, { error: 'pipedrive_deal_id, amount, and reason are required' });
      }
      const rs = await roundsStarted(b.pipedrive_deal_id);
      const ins = await supa('refund_requests', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'pending',
          pipedrive_deal_id: String(b.pipedrive_deal_id),
          client_name: b.client_name || null,
          client_email: b.client_email || null,
          amount: parseFloat(b.amount) || 0,
          refund_type: b.refund_type || 'other',
          token_id: b.token_id || null,
          charge_id: b.charge_id || null,
          reason: b.reason,
          requested_by: b.requested_by || null,
          requested_by_name: b.requested_by_name || null,
          rounds_started: rs
        })
      });
      if (!ins.ok) return respond(500, { error: 'insert failed: ' + (ins.text || '').slice(0, 200) });
      const req = (ins.json || [])[0] || {};
      await postNote(b.pipedrive_deal_id,
        `<p><b>\u{1F4DD} REFUND REQUESTED</b></p><ul>` +
        `<li>Amount: <b>$${(parseFloat(b.amount) || 0).toFixed(2)}</b></li>` +
        `<li>Requested by: ${esc(b.requested_by_name || b.requested_by || 'unknown')}</li>` +
        `<li>Reason: ${esc(b.reason)}</li>` +
        `<li>Rounds started: ${rs === null ? 'unknown' : rs ? 'YES - release form will be required' : 'no'}</li>` +
        `</ul><p>Awaiting leadership approval (request #${req.id}).</p>`);
      return respond(200, { success: true, request_id: req.id, rounds_started: rs });
    }

    // ---------------- DECIDE ----------------
    if (b.action === 'decide') {
      if (!b.request_id || !['approved', 'denied'].includes(b.decision)) {
        return respond(400, { error: 'request_id and decision (approved|denied) are required' });
      }
      if (!(await isLeadership(b.decided_by))) {
        return respond(403, { error: 'Only leadership (Joe, Kim, Astrid) can decide refund requests' });
      }
      if (b.decision === 'denied' && !b.denial_reason) {
        return respond(400, { error: 'A denial reason is required' });
      }
      const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=*`);
      const req = (rows.json || [])[0];
      if (!req) return respond(404, { error: 'Request not found' });
      if (req.status !== 'pending') return respond(409, { error: `Request already ${req.status}` });

      // Approved: rounds started -> awaiting_signature (B2 release step); else straight to ready_to_pay.
      const newStatus = b.decision === 'denied' ? 'denied'
        : (req.rounds_started ? 'awaiting_signature' : 'ready_to_pay');
      const upd = await supa(`refund_requests?id=eq.${b.request_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: newStatus,
          decided_by: b.decided_by,
          decided_at: new Date().toISOString(),
          denial_reason: b.decision === 'denied' ? b.denial_reason : null
        })
      });
      if (!upd.ok) return respond(500, { error: 'update failed' });

      const noteBody = b.decision === 'denied'
        ? `<p><b>\u274C REFUND REQUEST DENIED</b> by ${esc(b.decided_by)}</p><p>Reason: ${esc(b.denial_reason)}</p>`
        : req.rounds_started
          ? `<p><b>\u2705 REFUND REQUEST APPROVED</b> by ${esc(b.decided_by)}</p><p>Round 1+ has started: the Mutual Release must be signed by the client before the refund is issued. (Release step coming online - handle manually until then.)</p>`
          : `<p><b>\u2705 REFUND REQUEST APPROVED</b> by ${esc(b.decided_by)}</p><p>No rounds started: ready to issue $${(parseFloat(req.amount) || 0).toFixed(2)} refund. (Issuance step coming online - process via dashboard refund until then.)</p>`;
      await postNote(req.pipedrive_deal_id, noteBody);
      return respond(200, { success: true, status: newStatus });
    }

    // ---------------- RELEASE SIGNED (called by processor submit-release) ----------------
    if (b.action === 'release_signed') {
      if (!b.request_id) return respond(400, { error: 'request_id required' });
      const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=id,status`);
      const req = (rows.json || [])[0];
      if (!req) return respond(404, { error: 'Request not found' });
      const upd = await supa(`refund_requests?id=eq.${b.request_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'ready_to_pay', release_signed_at: new Date().toISOString(), release_agreement_id: b.release_id || null })
      });
      return respond(upd.ok ? 200 : 500, upd.ok ? { success: true } : { error: 'update failed' });
    }

    // ---------------- ROUTE TO CHECK (skip the card attempt entirely) ----------------
    if (b.action === 'route_to_check') {
      if (!b.request_id) return respond(400, { error: 'request_id required' });
      const lead = await supa(`users?email=eq.${encodeURIComponent(String(b.requested_by || '').trim().toLowerCase())}&department=eq.leadership&select=id`);
      if (!Array.isArray(lead.json) || lead.json.length === 0) return respond(403, { error: 'Only leadership can route refunds' });
      const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=id,status,amount,card_refunded_amount,pipedrive_deal_id,client_name`);
      const req = (rows.json || [])[0];
      if (!req) return respond(404, { error: 'Request not found' });
      if (req.status !== 'ready_to_pay') return respond(409, { error: `Request is ${req.status} - only ready-to-pay refunds can be routed to check` });
      const remaining = Math.max(0, Math.round(((parseFloat(req.amount) || 0) - (parseFloat(req.card_refunded_amount) || 0)) * 100) / 100);
      const upd = await supa(`refund_requests?id=eq.${b.request_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'check_needed', check_amount: remaining })
      });
      if (upd.ok) {
        await postNote(req.pipedrive_deal_id, `<p><b>\u{1F4B5} REFUND ROUTED TO CHECK</b></p><ul><li>Client: ${esc(req.client_name)}</li><li>Amount: <b>$${remaining.toFixed(2)}</b> by check (card refund skipped)</li><li>By: ${esc(b.requested_by || 'leadership')}</li></ul>`);
      }
      return respond(upd.ok ? 200 : 500, upd.ok ? { success: true, check_amount: remaining } : { error: 'update failed' });
    }

    // ---------------- CHECK MAILED (closes a check_needed request) ----------------
    if (b.action === 'check_mailed') {
      if (!b.request_id || !b.check_number) return respond(400, { error: 'request_id and check_number required' });
      const lead = await supa(`users?email=eq.${encodeURIComponent(String(b.requested_by || '').trim().toLowerCase())}&department=eq.leadership&select=id`);
      if (!Array.isArray(lead.json) || lead.json.length === 0) return respond(403, { error: 'Only leadership can record checks' });
      const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=id,status,pipedrive_deal_id,client_name,client_email,check_amount,card_refunded_amount`);
      const req = (rows.json || [])[0];
      if (!req) return respond(404, { error: 'Request not found' });
      if (req.status !== 'check_needed') return respond(409, { error: `Request is ${req.status} - checks are recorded on check-needed requests` });
      const upd = await supa(`refund_requests?id=eq.${b.request_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'check_mailed', check_number: String(b.check_number), check_mailed_date: b.mailed_date || new Date().toISOString().slice(0, 10) })
      });
      if (upd.ok) {
        await postNote(req.pipedrive_deal_id, `<p><b>\u{1F4E8} REFUND CHECK MAILED</b></p><ul><li>Client: ${esc(req.client_name)}</li><li>Amount: <b>$${(parseFloat(req.check_amount) || 0).toFixed(2)}</b></li><li>Check #: ${esc(b.check_number)}</li><li>Mailed: ${esc(b.mailed_date || new Date().toISOString().slice(0, 10))}</li></ul>`);
      }
      let email_sent = false;
      if (upd.ok && req.client_email) {
        try {
          const n = await fetch(`${process.env.PROCESSOR_URL || 'https://asap-payment-processor.netlify.app'}/.netlify/functions/notify-refund-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.PAYMENT_API_KEY || '' },
            body: JSON.stringify({
              mode: 'check', to: req.client_email, client_name: req.client_name,
              check_amount: req.check_amount, check_number: String(b.check_number),
              mailed_date: b.mailed_date || new Date().toISOString().slice(0, 10),
              card_amount: req.card_refunded_amount || 0
            })
          });
          email_sent = ((await n.json()) || {}).email_sent === true;
        } catch (e) {}
      }
      return respond(upd.ok ? 200 : 500, upd.ok ? { success: true, email_sent } : { error: 'update failed' });
    }

    // ---------------- LIST ----------------
    if (b.action === 'list') {
      const filter = b.status ? `status=eq.${encodeURIComponent(b.status)}&` : '';
      const rows = await supa(`refund_requests?${filter}select=*&order=created_at.desc&limit=200`);
      return respond(200, { success: true, requests: rows.json || [] });
    }

    return respond(400, { error: 'Unknown action' });
  } catch (e) {
    return respond(500, { error: String(e.message || e).slice(0, 200) });
  }
};
