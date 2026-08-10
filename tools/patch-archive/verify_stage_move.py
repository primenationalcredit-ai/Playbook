import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-deal-update?action=stages", "moveStage", "openStageEdit", "optgroup key={p.id}"]:
    if needle not in s: ok = False; print(f"ClientFile MISSING: {needle}")
w = open('netlify/functions/crm-deal-update.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["action !== 'move'", "api.pipedrive.com/v1/deals/", "crm_deals?pipedrive_deal_id=eq.", "crm_stages_catalog"]:
    if needle not in w: ok = False; print(f"crm-deal-update MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
