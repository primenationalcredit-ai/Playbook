s = open('netlify/functions/payment-enrich.js', encoding='utf-8').read()
ok = True
for n in ["VERIFIED BORROW", "status !== 'open'", "persons/${pid}/deals?status=open", "enrichFromDeal(payment, borrowDeal"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
if "pipedrive_deal_id: s.pipedrive_deal_id," in s: ok = False; print("old blind-copy PATCH still present")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
