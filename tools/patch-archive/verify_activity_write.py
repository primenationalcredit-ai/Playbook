import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-activity-write", "createTask", "completeActivity", "Mark done", "pipedrive_activity_id,pd_add_time"]:
    if needle not in s: ok = False; print(f"ClientFile MISSING: {needle}")
w = open('netlify/functions/crm-activity-write.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["body.action === 'complete'", "api.pipedrive.com/v1/activities", "on_conflict=pipedrive_activity_id", "source: 'playbook'"]:
    if needle not in w: ok = False; print(f"crm-activity-write MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
