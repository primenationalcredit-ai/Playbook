import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
diag = """      const { data, error } = await supabase.rpc('crm_client_search', { q });
      console.log('CLIENT SEARCH:', q, '->', Array.isArray(data) ? data.length + ' results' : data, error ? ('ERROR: ' + JSON.stringify(error)) : 'no error');
      if (error) console.error('client search error:', error);"""
clean = """      const { data, error } = await supabase.rpc('crm_client_search', { q });
      if (error) console.error('client search error:', error);"""
if s.count(diag) != 1: print(f"ABORTED: diag anchor x{s.count(diag)}"); sys.exit(1)
s = s.replace(diag, clean, 1)
state_anchor = """  const [tab, setTab] = useState('notes');"""
if s.count(state_anchor) != 1: print(f"ABORTED: state anchor x{s.count(state_anchor)}"); sys.exit(1)
s = s.replace(state_anchor, state_anchor + """
  const [noteDraft, setNoteDraft] = useState('');
  const [postingNote, setPostingNote] = useState(false);""", 1)
fn_anchor = """  const Badge = ({ children, color }) =>"""
if s.count(fn_anchor) != 1: print(f"ABORTED: fn anchor x{s.count(fn_anchor)}"); sys.exit(1)
s = s.replace(fn_anchor, """  const postNote = async () => {
    const content = noteDraft.trim();
    if (!content || postingNote || !client) return;
    setPostingNote(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-note-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ person_id: client.pipedrive_person_id, deal_id: (deals[0] && deals[0].pipedrive_deal_id) || null, content })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setNotes([{ pd_add_time: new Date().toISOString(), author: j.author, content, pinned: false }, ...notes]);
      setNoteDraft('');
    } catch (e) { alert('Note failed: ' + e.message); }
    setPostingNote(false);
  };

  """ + fn_anchor, 1)
ui_anchor = """            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">"""
if s.count(ui_anchor) != 1: print(f"ABORTED: ui anchor x{s.count(ui_anchor)}"); sys.exit(1)
s = s.replace(ui_anchor, """            {tab === 'notes' && (
              <div className="p-4 pb-0 flex gap-2">
                <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2}
                  placeholder="Add a note - posts here and to Pipedrive..."
                  className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={postNote} disabled={postingNote || !noteDraft.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 self-start">
                  {postingNote ? 'Posting...' : 'Post'}
                </button>
              </div>
            )}
""" + ui_anchor, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: note composer in, diagnostic out")
