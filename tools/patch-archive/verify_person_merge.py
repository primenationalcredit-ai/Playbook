import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-person-merge", "mergeDuplicate", "searchMergeCands", "Merge duplicate", "isLeadership && !mergeOpen"]:
    if needle not in s: ok = False; print(f"ClientFile MISSING: {needle}")
w = open('netlify/functions/crm-person-merge.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["/merge?api_token=", "merge_with_id: survivorId", "leadership only", "deleted: true"]:
    if needle not in w: ok = False; print(f"crm-person-merge MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
