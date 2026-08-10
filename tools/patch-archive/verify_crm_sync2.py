import sys
s = open('netlify/functions/crm-sync.js', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle, want in [("upsert('crm_clients', rows, 'pipedrive_person_id')", 1), ("upsert('crm_deals', rows, 'pipedrive_deal_id')", 1), ("upsert('crm_rounds', rrows, 'pipedrive_deal_id,round_label')", 1), ("upsert('crm_field_options', opts, 'field_key,option_id')", 1), ("rest/v1/crm_sync_state", 2), ("q.key !== process.env.PAYMENT_API_KEY", 1), ("sort=update_time DESC", 2), ("d[key + '_until']", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"crm-sync: '{needle[:52]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
