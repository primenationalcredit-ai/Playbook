import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-person-update", "saveStatus", "optList(k).map", "Change status"]:
    if needle not in s: ok = False; print(f"ClientFile MISSING: {needle}")
w = open('netlify/functions/crm-person-update.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["612856f2221d04679c1809eadb77b30300936445", "api.pipedrive.com/v1/persons/", "crm_clients?pipedrive_person_id=eq.", "auth/v1/user"]:
    if needle not in w: ok = False; print(f"crm-person-update MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
