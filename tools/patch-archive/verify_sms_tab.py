import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-sms?phone=", "loadSms", "sendSms", "setTab('sms')", "Texts</button>", "tab === 'sms'"]:
    if needle not in s: ok = False; print(f"ClientFile MISSING: {needle}")
if "Phone" not in s.split("from 'lucide-react'")[0]: print("NOTE: check Phone icon import")
w = open('netlify/functions/crm-sms.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-sms-relay", "auth/v1/user", "action: 'send'", "ASAP Credit Repair"]:
    if needle not in w: ok = False; print(f"crm-sms MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
