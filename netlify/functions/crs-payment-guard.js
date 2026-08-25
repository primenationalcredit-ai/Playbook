// crs-payment-guard.js - alert-only tripwire (Joe 8/25)
// When a deal ENTERS CRS (512) or Additional CRS (608), check payments vs fee.
// Short = email management + note on deal. Never deletes/moves/changes anything.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const PD_TOKEN = process.env.PIPEDRIVE_API_KEY || process.env.PD_API_TOKEN || process.env.PIPEDRIVE_API_TOKEN;
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TARGET_STAGES = [608]; // 8/25: CRS entry is normal with doc fee only - watch Additional CRS until 2nd-round trigger is defined
const ALERT_TO = 'management@asapcreditrepairusa.com';

exports.handler = async (event) => {
  const out = { ranAt: new Date().toISOString(), result: 'noop' };
  try {
    const body = JSON.parse(event.body || '{}');
    const entity = body.meta && (body.meta.entity || body.meta.object);
    const cur = body.data || body.current;
    const prev = body.previous;
    if (!cur) return ok(out);
    // two triggers: (a) a note saying the 2nd round is starting, (b) deal enters Additional CRS
    let dealId = null, trigger = '';
    if (entity === 'note') {
      const txt = String(cur.content || '').replace(/<[^>]+>/g, ' ');
      if (!/2nd round started automation/i.test(txt)) return ok(out);
      dealId = cur.deal_id; trigger = 'is starting its 2nd round';
    } else if (entity === 'deal') {
  
  
  
  
      dealId = cur.id; trigger = 'entered Additional CRS';
    } else return ok(out);
    if (!dealId) return ok(out);
    // note payloads carry no deal value - fetch the deal either way so both paths read the same
    const drr = await fetch('https://asapcreditrepair.pipedrive.com/api/v1/deals/' + dealId + '?api_token=' + PD_TOKEN);
    const dj = drr.ok ? await drr.json() : null;
    const deal = dj && dj.data;
    if (!deal) return ok(out);
    const fee = parseFloat(deal.value) || 0;








    out.deal = dealId; out.fee = fee;
    if (fee <= 0) { out.result = 'no fee on deal - nothing to compare'; return ok(out); }

    // add up what this client has actually paid
    const pr = await fetch(SB_URL + '/rest/v1/consultant_payments?pipedrive_deal_id=eq.' + dealId + '&select=amount', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    const rows = pr.ok ? await pr.json() : [];
    const paid = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    // client check: a deal with NO payment history is a lead, not a client - it cannot be short.
    // Added 8/25 after bad stage events fired the guard on 2019 cold leads mid marketing cadence.
    if (!rows.length) { out.result = 'no payment history - not a client - silent'; return ok(out); }
    const short = fee - paid;
    out.paid = paid; out.short = short;
    if (short <= 1) { out.result = 'payments add up - silent'; return ok(out); }

    // dedupe: if we already left a guard note on this deal, do not alert again
    const nr = await fetch('https://asapcreditrepair.pipedrive.com/api/v1/notes?deal_id=' + dealId + '&limit=25&sort=add_time%20DESC&api_token=' + PD_TOKEN);
    const nd = nr.ok ? await nr.json() : null;
    const already = nd && nd.data && nd.data.some(n => (n.content || '').includes('CRS PAYMENT GUARD'));
    if (already) { out.result = 'already alerted for this deal - silent'; return ok(out); }

    const title = deal.title || ('deal ' + dealId);
    const link = 'https://asapcreditrepair.pipedrive.com/deal/' + dealId;
    const msg = 'CRS PAYMENT GUARD: ' + title + ' ' + trigger + ' but payments do not add up to the fee. ' +
      'Fee $' + fee.toFixed(2) + ', collected $' + paid.toFixed(2) + ', SHORT $' + short.toFixed(2) + '. ' +
      'Please review before services continue: ' + link;

    // note on the deal (so the file itself shows the warning)
    await fetch('https://asapcreditrepair.pipedrive.com/api/v1/notes?api_token=' + PD_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: dealId, content: '\u26a0 ' + msg })
    });

    // email management
    const er = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + SENDGRID_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ALERT_TO }] }],
        from: { email: 'info@asapcreditrepairusa.com', name: 'ASAP Payment Guard' },
        subject: 'PAYMENT SHORT: ' + title + ' ' + trigger + ' owing $' + short.toFixed(2),
        content: [{ type: 'text/plain', value: msg }]
      })
    });
    out.emailStatus = er.status;
    out.result = 'ALERTED - short $' + short.toFixed(2);
    return ok(out);
  } catch (e) {
    out.result = 'error: ' + e.message;
    return ok(out);
  }
};
function ok(o) { return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }; }

