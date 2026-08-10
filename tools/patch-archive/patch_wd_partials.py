import sys
f = 'netlify/functions/qualified-doc-watchdog.js'
s = open(f, encoding='utf-8').read()
old = "    // 5.5) Anything healed -> bust the bonus-metrics cache so dashboards update"
new = """    // 5.4) PARTIAL coverage (Joe 7/31): the watchdog was finals-only - a
    // partial-payer who slipped past the real-time hook stayed unqualified
    // forever. Every partial payment in the window now runs through the same
    // idempotent hook (stamps PARTIAL_1 + monthly qualified_doc; no-ops when
    // already correct).
    report.partials_checked = 0; report.partials_healed = [];
    try {
      const ppRes = await sb(`consultant_payments?payment_type=eq.partial&payment_date=gte.${since}&pipedrive_deal_id=not.is.null&refunded_at=is.null&select=client_name,pipedrive_deal_id`);
      const pp = ppRes.ok ? await ppRes.json() : [];
      const pDeals = new Map();
      for (const p of pp) { if (!pDeals.has(String(p.pipedrive_deal_id))) pDeals.set(String(p.pipedrive_deal_id), p); }
      report.partials_checked = pDeals.size;
      for (const [pDealId, p] of pDeals) {
        if (dryRun) continue;
        try {
          const hr = await fetch('https://cute-cat-d9631c.netlify.app/.netlify/functions/final-credit-hook', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': PD_KEY },
            body: JSON.stringify({ deal_id: pDealId, kind: 'partial' })
          });
          const hj = await hr.json().catch(() => ({}));
          if (hj && Array.isArray(hj.actions) && hj.actions.length) report.partials_healed.push({ deal: pDealId, client: p.client_name, actions: hj.actions });
        } catch (e) { report.problems.push({ deal: pDealId, client: p.client_name, issue: 'partial hook failed: ' + e.message }); }
      }
    } catch (e) { report.problems.push({ issue: 'partial scan failed: ' + e.message }); }
    // 5.5) Anything healed -> bust the bonus-metrics cache so dashboards update"""
if s.count(old) != 1: print(f"ABORTED: insert anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = "    if (report.healed.length && !dryRun) {"
new = "    if ((report.healed.length || report.partials_healed.length) && !dryRun) {"
if s.count(old) != 1: print(f"ABORTED: bust anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("watchdog widened: partials in the nightly net")
