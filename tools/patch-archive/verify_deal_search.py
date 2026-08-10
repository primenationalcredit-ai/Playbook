import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm_deal_search", "r.pipedrive_deal_id}", "focusDealId", "r.person_name", "r.stage_name"]:
    if needle not in s: ok = False; print(f"MISSING: {needle}")
if "crm_client_search" in s: ok = False; print("old person search still referenced")
if "r.latest_stage" in s or "r.latest_deal_status" in s: ok = False; print("stale field refs remain")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
