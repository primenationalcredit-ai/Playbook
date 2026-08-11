import sys
f = 'netlify/functions/payment-enrich.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """            const s = sibs[0];
            await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${payment.id}`, {
              method: 'PATCH',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
              body: JSON.stringify({
                pipedrive_deal_id: s.pipedrive_deal_id,
                consultant_name: s.consultant_name,
                consultant_id: s.consultant_id ?? null,
                is_va: s.is_va ?? null,
                referrer_org: s.referrer_org ?? null,
                is_affiliate_deal: s.is_affiliate_deal ?? null,
                org_email: s.org_email ?? null,
                org_has_email: s.org_has_email ?? null
              })
            });
            healed++; enriched++;
            continue;"""
new = """            const s = sibs[0];
            // VERIFIED BORROW (Mackenzie Haight 8/10: blind copy inherited a 2018
            // won deal + its 2018 consultant for a 2026 returning client). The
            // sibling only NOMINATES a deal - we fetch it, and if it isn't open we
            // walk forward to the person's newest OPEN deal (returning clients get
            // a fresh file; the old one must not claim their payments). Enrichment
            // then derives the consultant LIVE from the resolved deal's owner_name -
            // never copied from an old row.
            let borrowDeal = await getDeal(s.pipedrive_deal_id, dealCache);
            if (borrowDeal && borrowDeal.status !== 'open') {
              try {
                const pid = borrowDeal.person_id?.value || borrowDeal.person_id || null;
                if (pid) {
                  const odRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${pid}/deals?status=open&limit=50&api_token=${PIPEDRIVE_API_KEY}`);
                  if (odRes.ok) {
                    const od = (await odRes.json()).data || [];
                    if (od.length) {
                      od.sort((a, b) => b.id - a.id);
                      borrowDeal = await getDeal(od[0].id, dealCache) || borrowDeal;
                    }
                  }
                }
              } catch (e) { /* open-deal walk failed - keep the sibling's deal */ }
            }
            if (borrowDeal && await enrichFromDeal(payment, borrowDeal, personToAM)) {
              healed++; enriched++;
              continue;
            }
            // sibling nomination failed entirely - fall through to the search tiers"""
if s.count(old) != 1: print(f"ABORTED: borrow anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("payment-enrich: verified borrow in")
