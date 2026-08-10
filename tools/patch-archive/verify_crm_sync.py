import sys
s = open('netlify/functions/crm-sync.js', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle, want in [("rest/v1/crm_field_options?on_conflict=", 0), ("on_conflict=${conflict}", 1), ("crm_clients", 2), ("crm_deals", 2), ("crm_rounds", 2), ("crm_sync_state", 2), ("q.key !== process.env.PAYMENT_API_KEY", 1), ("sort=update_time DESC", 2), ("_until", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"crm-sync: '{needle[:44]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
