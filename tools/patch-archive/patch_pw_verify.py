import sys
f = 'netlify/functions/payment-webhook.js'
s = open(f, encoding='utf-8').read()
old = "    console.log(`Payment recorded: ${record.client_name} - $${record.amount} - ${record.payment_type} - ${record.consultant_name}`);"
new = """    console.log(`Payment recorded: ${record.client_name} - $${record.amount} - ${record.payment_type} - ${record.consultant_name}`);
    // EVENT-DRIVEN VERIFY (Joe 7/30): a partial/final recorded in Zoho - via ANY
    // channel (Zapier, portal, manual entry) - triggers the credit verification
    // for that deal the moment it lands: checkbox stamped, events written,
    // metrics cache rebuilt. No waiting for syncs or nightlies.
    const vt = String(record.payment_type || '').toLowerCase();
    const vkind = (vt === 'final' || vt === 'paid_in_full') ? 'final' : (vt === 'partial' ? 'partial' : null);
    if (vkind && record.pipedrive_deal_id) {
      fetch('https://cute-cat-d9631c.netlify.app/.netlify/functions/final-credit-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.PIPEDRIVE_API_KEY || '' },
        body: JSON.stringify({ deal_id: record.pipedrive_deal_id, kind: vkind, source: 'zoho-payment-webhook' })
      }).then(async r => console.log(`[event-verify ${vkind}] deal ${record.pipedrive_deal_id}:`, JSON.stringify(await r.json().catch(() => ({}))).slice(0, 150)))
        .catch(e => console.error('[event-verify] failed:', e.message));
    }"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("ZOHO EVENTS -> INSTANT VERIFY: any partial/final recorded triggers per-deal credit check")
