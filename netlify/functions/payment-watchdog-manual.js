// payment-integrity-watchdog.js - THE PAYMENT SHEET MONITOR (Joe 8/26-27)
// Nightly: finds duplicate payment rows (same deal + amount + date, ANY source),
// auto-merges keep-the-best (consultant known > zoho ids > oldest), donates zoho
// ids to the survivor, deletes the extras, and emails a receipt. Same-amount rows
// on ADJACENT days are REPORTED ONLY - never auto-merged (could be a real repeat
// payment). Real run: scheduled tick (body.next_run) or ?run=1. Else dry-run.
const SU = process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY;
const SB = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ALERT_TO = process.env.ALERT_TO || 'management@asapcreditrepairusa.com';
const MAX_MERGES = 25;

exports.handler = async (event) => {
  let scheduled = false;
  try { scheduled = !!JSON.parse(event.body || '{}').next_run; } catch (e) {}
  const qs = (event && event.queryStringParameters) || {};
  const real = scheduled || qs.run === '1';
  const report = { mode: real ? 'REAL' : 'DRY_RUN', merged: [], adjacent_day_pairs: [], errors: [] };
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const r = await fetch(SU + '/rest/v1/consultant_payments?select=id,client_name,pipedrive_deal_id,amount,payment_date,source,consultant_name,zoho_payment_id,zoho_invoice_id,created_at&payment_date=gte.' + since + '&refunded_at=is.null&pipedrive_deal_id=not.is.null&order=payment_date.desc&limit=1000', { headers: SB });
    const rows = r.ok ? await r.json() : [];
    const byKey = {};
    for (const row of rows) {
      const k = row.pipedrive_deal_id + '|' + row.amount + '|' + row.payment_date;
      (byKey[k] = byKey[k] || []).push(row);
    }
    const groups = Object.values(byKey).filter(g => g.length > 1);
    for (const g of groups.slice(0, MAX_MERGES)) {
      const sorted = g.slice().sort((a, b) => {
        const an = (a.consultant_name && a.consultant_name !== 'pending_enrichment') ? 0 : 1;
        const bn = (b.consultant_name && b.consultant_name !== 'pending_enrichment') ? 0 : 1;
        if (an !== bn) return an - bn;
        const az = a.zoho_payment_id ? 0 : 1, bz = b.zoho_payment_id ? 0 : 1;
        if (az !== bz) return az - bz;
        return String(a.created_at).localeCompare(String(b.created_at));
      });
      const keep = sorted[0], kills = sorted.slice(1);
      const entry = { client: keep.client_name, deal: keep.pipedrive_deal_id, amount: keep.amount, date: keep.payment_date, kept: keep.id, deleted: kills.map(k => k.id + ' (' + k.source + ')') };
      if (real) {
        try {
          const donor = kills.find(k => k.zoho_payment_id);
          if (donor && !keep.zoho_payment_id) {
            await fetch(SU + '/rest/v1/consultant_payments?id=eq.' + keep.id, { method: 'PATCH', headers: { ...SB, Prefer: 'return=minimal' }, body: JSON.stringify({ zoho_payment_id: donor.zoho_payment_id, zoho_invoice_id: keep.zoho_invoice_id || donor.zoho_invoice_id || null }) });
          }
          for (const k of kills) {
            const d = await fetch(SU + '/rest/v1/consultant_payments?id=eq.' + k.id, { method: 'DELETE', headers: SB });
            if (!d.ok) throw new Error('delete ' + k.id + ' -> ' + d.status);
          }
        } catch (e) { report.errors.push({ deal: keep.pipedrive_deal_id, error: e.message }); continue; }
      }
      report.merged.push(entry);
    }
    // Adjacent-day same-amount pairs: report only.
    const byDealAmt = {};
    for (const row of rows) {
      const k = row.pipedrive_deal_id + '|' + row.amount;
      (byDealAmt[k] = byDealAmt[k] || []).push(row);
    }
    for (const g of Object.values(byDealAmt)) {
      if (g.length < 2) continue;
      const dates = [...new Set(g.map(x => x.payment_date))].sort();
      for (let i = 1; i < dates.length; i++) {
        const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        if (diff === 1) report.adjacent_day_pairs.push({ client: g[0].client_name, deal: g[0].pipedrive_deal_id, amount: g[0].amount, dates: [dates[i - 1], dates[i]] });
      }
    }
    if (real && (report.merged.length || report.adjacent_day_pairs.length || report.errors.length) && SENDGRID_API_KEY) {
      const lines = [];
      for (const m of report.merged) lines.push('MERGED: ' + m.client + ' deal ' + m.deal + ' $' + m.amount + ' ' + m.date + ' - kept ' + m.kept + ', deleted ' + m.deleted.join(', '));
      for (const p of report.adjacent_day_pairs) lines.push('REVIEW (adjacent days, NOT merged): ' + p.client + ' deal ' + p.deal + ' $' + p.amount + ' on ' + p.dates.join(' and '));
      for (const e of report.errors) lines.push('ERROR: deal ' + e.deal + ' - ' + e.error);
      await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: 'Bearer ' + SENDGRID_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: ALERT_TO }] }], from: { email: 'info@asapcreditrepairusa.com', name: 'ASAP Payment Watchdog' }, subject: 'Payment watchdog: ' + report.merged.length + ' duplicate(s) auto-merged', content: [{ type: 'text/plain', value: lines.join('\n') }] }) }).catch(() => {});
    }
    return { statusCode: 200, body: JSON.stringify(report) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message, report }) };
  }
};
