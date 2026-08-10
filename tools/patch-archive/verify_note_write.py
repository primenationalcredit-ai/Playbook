import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-note-write", "postNote", "noteDraft", "setPostingNote(false)"]:
    if needle not in s: ok = False; print(f"ClientFile MISSING: {needle}")
if "CLIENT SEARCH:" in s: ok = False; print("diagnostic still present")
w = open('netlify/functions/crm-note-write.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["auth/v1/user", "api.pipedrive.com/v1/notes", "on_conflict=pipedrive_note_id", "source: 'playbook'"]:
    if needle not in w: ok = False; print(f"crm-note-write MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
