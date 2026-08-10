import sys
f = 'netlify/functions/deals-webhook.js'
s = open(f, encoding='utf-8').read()

old = "  DOC_1: '314d267ebc05d3623ffd8aab701baae7bea29aa8',"
new = "  DOC_1: '314d267ebc05d3623ffd8aab701baae7bea29aa8',\n  PARTIAL_1: '35c626c805984517bacdba0b20aa20ab7ee3c48a',"
if s.count(old) != 1: print(f"ABORTED: fields anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "    const newDoc1 = normalizeDoc1(fullDeal[FIELDS.DOC_1]);"
new = "    const newDoc1 = normalizeDoc1(fullDeal[FIELDS.DOC_1]);\n    const newFinal1 = normalizeYesNo(fullDeal[FIELDS.FINAL_1]);\n    const newPartial1 = normalizeYesNo(fullDeal[FIELDS.PARTIAL_1]);"
if s.count(old) != 1: print(f"ABORTED: vars anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = '      "Deal - Final (1)": normalizeYesNo(fullDeal[FIELDS.FINAL_1]),'
new = '      "Deal - Final (1)": newFinal1,\n      "Deal - Partial (1)": newPartial1,'
if s.count(old) != 1: print(f"ABORTED: dealobj anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """      } else if (existingDeal["Doc (1) Changed At"]) {
        // Preserve existing timestamp
        deal["Doc (1) Changed At"] = existingDeal["Doc (1) Changed At"];
      }"""
new = """      } else if (existingDeal["Doc (1) Changed At"]) {
        // Preserve existing timestamp
        deal["Doc (1) Changed At"] = existingDeal["Doc (1) Changed At"];
      }
      // EVENT-DRIVEN VERIFY (Joe 7/30): a bonus checkbox flipping to Yes triggers
      // an immediate check against payment truth. Real payment on record -> heal
      // via the credit hook (idempotent: events + cache). NO payment on record ->
      // flag it on the deal; a checkbox click alone never invents a bonus event.
      try {
        const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const PDK = process.env.PIPEDRIVE_API_KEY;
        const verifies = [];
        if (existingDeal["Deal - Final (1)"] !== newFinal1 && newFinal1 === 'Yes') verifies.push(['final', 'final,paid_in_full']);
        if (existingDeal["Deal - Partial (1)"] !== newPartial1 && newPartial1 === 'Yes') verifies.push(['partial', 'partial']);
        for (const [vk, types] of verifies) {
          const pr = await fetch(`${SB_URL}/rest/v1/consultant_payments?pipedrive_deal_id=eq.${dealId}&payment_type=in.(${types})&refunded_at=is.null&select=id&limit=1`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
          const pays = pr.ok ? await pr.json() : [];
          if (Array.isArray(pays) && pays.length) {
            const hr = await fetch('https://cute-cat-d9631c.netlify.app/.netlify/functions/final-credit-hook', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': PDK || '' },
              body: JSON.stringify({ deal_id: dealId, kind: vk, source: 'pd-checkbox-verify' })
            });
            console.log(`[pd-verify ${vk}] deal ${dealId}:`, JSON.stringify(await hr.json().catch(() => ({}))).slice(0, 150));
          } else if (PDK) {
            await fetch(`https://api.pipedrive.com/v1/notes?api_token=${PDK}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deal_id: Number(dealId), content: `\\u26a0\\ufe0f <b>VERIFY</b>: ${vk === 'final' ? 'Final (1)' : 'Partial (1)'} was just set to Yes but no matching ${vk} payment is on record. Either the payment was not logged or the box was clicked early - please confirm before this counts toward bonuses. (Auto-posted change verifier)` })
            });
            console.log(`[pd-verify ${vk}] deal ${dealId}: checkbox Yes but NO payment - flagged on deal`);
          }
        }
      } catch (e) { console.error(`[pd-verify] deal ${dealId} failed:`, e.message); }"""
if s.count(old) != 1: print(f"ABORTED: verify anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("PD EVENTS -> INSTANT VERIFY: checkbox change checked against payment truth in the same second")
