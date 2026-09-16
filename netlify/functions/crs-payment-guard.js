// crs-payment-guard.js - alert-only tripwire (Joe 8/25, rewritten 9/16)
//
// REWRITTEN 9/16 after false alerts on Kristin Willis 144115 (2021 deal) and
// Mudasriu Adepoju 202055 (2023 deal). The old trigger was a Pipedrive NOTE
// containing "2nd round started automation", with the pipeline gate stripped
// out, so it fired on any deal of any age in any pipeline. Joe's actual rule:
//
//   CRS (pipeline 45):        RD 2 Start date == today  -> full fee must be collected
//   Additional Rounds (608):  Additional RD 1 Start == today -> AR fee must be paid
//
// Never deletes, moves, or changes anything. Note + email only.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const PD_TOKEN = process.env.PIPEDRIVE_API_KEY || process.env.PD_API_TOKEN || process.env.PIPEDRIVE_API_TOKEN;
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const ALERT_TO = 'management@asapcreditrepairusa.com';

const PIPE_CRS = 45;
const PIPE_ADDITIONAL_CRS = 608;
const F_TOTAL_FEE = '32ede4b1f12ad63d381425517a80af3430062502';
const F_RD2_START = 'ff3697496664744d64d9f290766f919f40c23aa0';
const F_ADD_RD1_START = '39ec0518ee030288f8ea6ddb9fb0ff62576d44c5';
const AR_FEE_AMOUNTS = [249, 299];

function ok(o) { return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }; }
function todayCT() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); }
function dateOnly(v) { return String(v || '').slice(0, 10); }

exports.handler = async (event) => {
  const out = { ranAt: new Date().toISOString(), result: 'noop' };
  try {
    const body = JSON.parse(event.body || '{}');
    const cur = body.data || body.current;
    if (!cur) return ok(out);

    const dealId = cur.id || cur.deal_id;
    if (!dealId) return ok(out);

    const drr = await fetch('https://asapcreditrepair.pipedrive.com/api/v1/deals/' + dealId + '?api_token=' + PD_TOKEN);
    const dj = drr.ok ? await drr.json() : null;
    const deal = dj && dj.data;
    if (!deal) return ok(out);

    const pipeId = Number((deal.pipeline_id && (deal.pipeline_id.value || deal.pipeline_id)) || 0);
    const today = todayCT();
    out.deal = dealId; out.pipeline = pipeId; out.today = today;

    // ---- decide which rule applies, and whether it fires TODAY ----
    let mode = null, trigger = '';
    if (pipeId === PIPE_CRS) {
      const rd2 = dateOnly(deal[F_RD2_START]);
      out.rd2Start = rd2;
      if (rd2 !== today) { out.result = 'skipped - RD 2 Start is ' + (rd2 || '(blank)') + ', not today'; return ok(out); }
      mode = 'crs'; trigger = 'is starting its 2nd round';
    } else if (pipeId === PIPE_ADDITIONAL_CRS) {
      const ar1 = dateOnly(deal[F_ADD_RD1_START]);
      out.addRd1Start = ar1;
      if (ar1 !== today) { out.result = 'skipped - Additional RD 1 Start is ' + (ar1 || '(blank)') + ', not today'; return ok(out); }
      mode = 'additional'; trigger = 'is starting Additional Round 1';
    } else {
      out.result = 'skipped - pipeline ' + pipeId + ' is not CRS or Additional CRS';
      return ok(out);
    }
    out.mode = mode;

    // ---- what has this client actually paid ----
    const pr = await fetch(SB_URL + '/rest/v1/consultant_payments?pipedrive_deal_id=eq.' + dealId + '&excluded_from_bonus=not.is.true&select=amount,payment_type,payment_date', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    const pays = pr.ok ? await pr.json() : [];
    if (!Array.isArray(pays) || !pays.length) {
      // No payment history at all = not a real client record here. Stay silent
      // rather than alarm on a deal this system has no financial view of.
      out.result = 'no payment history - silent';
      return ok(out);
    }
    const collected = pays.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    out.collected = collected;

    let shortBy = 0, feeLabel = 0;
    if (mode === 'crs') {
      const fee = parseFloat(deal[F_TOTAL_FEE]) || parseFloat(deal.value) || 0;
      feeLabel = fee;
      if (fee <= 0) { out.result = 'no fee on deal - nothing to compare'; return ok(out); }
      shortBy = fee - collected;
    } else {
      // Additional Rounds: the AR fee is its own charge (249 or 299). Look for a
      // rounds-type payment, or a payment matching an AR price exactly.
      const hasAR = pays.some(p => String(p.payment_type || '').toLowerCase() === 'rounds'
        || AR_FEE_AMOUNTS.includes(Math.round(parseFloat(p.amount) || 0)));
      out.hasArFee = hasAR;
      if (hasAR) { out.result = 'AR fee paid - silent'; return ok(out); }
      feeLabel = AR_FEE_AMOUNTS[AR_FEE_AMOUNTS.length - 1];
      shortBy = feeLabel;
    }
    out.shortBy = shortBy;
    if (shortBy <= 1) { out.result = 'payments add up - silent'; return ok(out); }

    // ---- dedupe: never alert twice on the same deal ----
    const nr = await fetch('https://asapcreditrepair.pipedrive.com/api/v1/notes?deal_id=' + dealId + '&limit=25&sort=add_time%20DESC&api_token=' + PD_TOKEN);
    const nd = nr.ok ? await nr.json() : null;
    const already = nd && nd.data && nd.data.some(n => (n.content || '').includes('CRS PAYMENT GUARD'));
    if (already) { out.result = 'already alerted for this deal - silent'; return ok(out); }

    const title = deal.title || ('deal ' + dealId);
    const link = 'https://asapcreditrepair.pipedrive.com/deal/' + dealId;
    const msg = 'CRS PAYMENT GUARD: ' + title + ' ' + trigger + ' but payments do not add up. '
      + (mode === 'crs'
          ? ('Fee $' + feeLabel.toFixed(2) + ', collected $' + collected.toFixed(2) + ', SHORT $' + shortBy.toFixed(2) + '. ')
          : ('No Additional Rounds fee ($249/$299) found on this deal. Collected to date $' + collected.toFixed(2) + '. '))
      + 'Please review before services continue: ' + link;

    await fetch('https://asapcreditrepair.pipedrive.com/api/v1/notes?api_token=' + PD_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: Number(dealId), content: '\u26a0 ' + msg })
    });

    if (SENDGRID_API_KEY) {
      const er = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + SENDGRID_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: ALERT_TO }] }],
          from: { email: 'info@asapcreditrepairusa.com', name: 'ASAP Payment Guard' },
          subject: 'PAYMENT SHORT: ' + title + ' ' + trigger,
          content: [{ type: 'text/plain', value: msg }]
        })
      });
      out.emailStatus = er.status;
    }
    out.result = 'ALERTED';
    return ok(out);
  } catch (e) {
    out.result = 'error: ' + e.message;
    return ok(out);
  }
};
