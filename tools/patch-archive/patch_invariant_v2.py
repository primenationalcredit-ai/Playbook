import sys
f = 'netlify/functions/invoice-mirror-invariant.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
# 1) load the skip set before repairs
a1 = """    const orphans = await collectOrphans(days);
    let repaired = [], failed = [];"""
if s.count(a1) != 1: print(f"ABORTED: a1 x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, """    const orphans = await collectOrphans(days);
    // SKIP LIST: deals a prior repair attempt could not fix (no Zoho invoice under
    // that name - usually pre-Zoho-era clients). They stay counted + reported but
    // stop clogging the repair queue; clear the app_cache row to retry them all.
    let skip = {};
    try {
      const sk = await supaGet(`app_cache?cache_key=eq.invoice_mirror_skip&select=cache_value`);
      if (Array.isArray(sk) && sk[0]) skip = JSON.parse(sk[0].cache_value) || {};
    } catch (e) {}
    const repairable = orphans.filter(o => !skip[o.dealId]);
    let repaired = [], failed = [];""", 1)
# 2) repair from repairable, not orphans
a2 = """    if (!dry && orphans.length) {
      for (const o of orphans.slice(0, limit)) {"""
if s.count(a2) != 1: print(f"ABORTED: a2 x{s.count(a2)}"); sys.exit(1)
s = s.replace(a2, """    if (!dry && repairable.length) {
      for (const o of repairable.slice(0, limit)) {""", 1)
# 3) re-verify: mark unfixables into the skip set + detect invoices under OTHER deal ids
a3 = """    let verified = null;
    if (repaired.length) {
      const after = await collectOrphans(days);
      const stillBad = new Set(after.map(o => o.dealId));
      verified = repaired.map(r => ({ dealId: r.dealId, client: r.client, fixed: !stillBad.has(r.dealId) }));
    }"""
if s.count(a3) != 1: print(f"ABORTED: a3 x{s.count(a3)}"); sys.exit(1)
s = s.replace(a3, """    let verified = null;
    if (repaired.length) {
      const after = await collectOrphans(days);
      const stillBad = new Set(after.map(o => o.dealId));
      verified = [];
      for (const r of repaired) {
        const fixed = !stillBad.has(r.dealId);
        let otherDeals = [];
        if (!fixed && r.client) {
          // Did the search bring in invoices for this NAME under a different deal id?
          // (returning-client trap: payments point at one deal, Zoho invoiced another)
          try {
            const rows = await supaGet(`consultant_invoices?customer_name=ilike.${encodeURIComponent('*' + r.client.trim().split(/\\s+/).join('*') + '*')}&select=pipedrive_deal_id,invoice_number,total,balance,invoice_date&limit=10`);
            otherDeals = (rows || []).filter(x => String(x.pipedrive_deal_id) !== String(r.dealId));
          } catch (e) {}
          skip[r.dealId] = { client: r.client, reason: otherDeals.length ? 'invoices exist under other deal id(s) - needs repoint ruling' : 'no Zoho invoice found by name - likely pre-Zoho era', other_deal_ids: [...new Set(otherDeals.map(x => String(x.pipedrive_deal_id)))], skipped_at: new Date().toISOString() };
        }
        verified.push({ dealId: r.dealId, client: r.client, fixed, ...(otherDeals.length && !fixed ? { invoices_under_other_deals: otherDeals.slice(0, 5) } : {}) });
      }
      await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ cache_key: 'invoice_mirror_skip', cache_value: JSON.stringify(skip), updated_at: new Date().toISOString() }) }).catch(() => {});
    }""", 1)
# 4) summary reflects the queue honestly
a4 = """    const summary = { ran_at: new Date().toISOString(), days, dry, orphans_found: orphans.length, orphans: orphans.slice(0, 40), repaired_this_run: repaired.length, verified, failed, remaining_estimate: Math.max(0, orphans.length - repaired.length) };"""
if s.count(a4) != 1: print(f"ABORTED: a4 x{s.count(a4)}"); sys.exit(1)
s = s.replace(a4, """    const skippedCount = Object.keys(skip).length;
    const summary = { ran_at: new Date().toISOString(), days, dry, orphans_found: orphans.length, skipped_known_unfixable: skippedCount, repair_queue: Math.max(0, repairable.length - repaired.length), orphans: orphans.slice(0, 40), attempted_this_run: repaired.length, verified, failed };""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("walker v2: skip list + cross-deal detection + honest queue numbers")
