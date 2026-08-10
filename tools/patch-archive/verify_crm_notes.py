import sys
s = open('netlify/functions/crm-sync.js', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle, want in [("upsert('crm_notes', rows, 'pipedrive_note_id')", 1), ("upsert('crm_activities', rows, 'pipedrive_activity_id')", 1), ("getState('notes_cursor')", 1), ("getState('activities_cursor')", 1), ("activities?user_id=0&limit=500", 1), ("notes?limit=500", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"crm-sync: '{needle[:48]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
