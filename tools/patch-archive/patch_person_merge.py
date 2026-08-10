import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
imp_anchor = """import { useSearchParams } from 'react-router-dom';"""
if s.count(imp_anchor) != 1: print(f"ABORTED: import anchor x{s.count(imp_anchor)}"); sys.exit(1)
if "useApp" not in s:
    s = s.replace(imp_anchor, imp_anchor + """
import { useApp } from '../context/AppContext';""", 1)
sp_anchor = """  const [searchParams] = useSearchParams();"""
if s.count(sp_anchor) != 1: print(f"ABORTED: sp anchor x{s.count(sp_anchor)}"); sys.exit(1)
s = s.replace(sp_anchor, """  const { currentUser } = useApp();
  const isLeadership = currentUser && ['leadership', 'admin'].includes((currentUser.department || '').toLowerCase());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeCands, setMergeCands] = useState([]);
  const [merging, setMerging] = useState(false);
""" + sp_anchor, 1)
fn_anchor = """  const openStageEdit = async (d) => {"""
if s.count(fn_anchor) != 1: print(f"ABORTED: fn anchor x{s.count(fn_anchor)}"); sys.exit(1)
s = s.replace(fn_anchor, """  const searchMergeCands = async (q) => {
    setMergeQuery(q);
    if (q.trim().length < 2) { setMergeCands([]); return; }
    const { data } = await supabase.from('crm_clients')
      .select('pipedrive_person_id,name,email,phone')
      .eq('deleted', false).neq('pipedrive_person_id', client.pipedrive_person_id)
      .ilike('search_blob', `%${q.trim().toLowerCase()}%`).limit(8);
    setMergeCands(data || []);
  };

  const mergeDuplicate = async (dup) => {
    if (merging) return;
    if (!window.confirm(`Merge "${dup.name}" (#${dup.pipedrive_person_id}) INTO "${client.name}" (#${client.pipedrive_person_id})?\\n\\nThe duplicate is merged in Pipedrive itself - its deals, notes, and activities all move to this client. This cannot be undone.`)) return;
    setMerging(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-person-merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ survivor_id: client.pipedrive_person_id, duplicate_id: dup.pipedrive_person_id })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMergeOpen(false); setMergeQuery(''); setMergeCands([]);
      openClient({ pipedrive_person_id: client.pipedrive_person_id, name: client.name });
    } catch (e) { alert('Merge failed: ' + e.message); }
    setMerging(false);
  };

  """ + fn_anchor, 1)
ui_anchor = """            {!statusEdit && (
              <button onClick={() => { setStatusDraft({ current_status: client.current_status ?? '', update_status: client.update_status ?? '', quick_buttons: client.quick_buttons ?? '' }); setStatusEdit(true); }}
                className="mt-3 text-xs text-blue-600 font-medium hover:underline">Change status</button>
            )}"""
if s.count(ui_anchor) != 1: print(f"ABORTED: ui anchor x{s.count(ui_anchor)}"); sys.exit(1)
s = s.replace(ui_anchor, ui_anchor + """
            {isLeadership && !mergeOpen && (
              <button onClick={() => setMergeOpen(true)} className="mt-3 ml-4 text-xs text-gray-500 font-medium hover:underline">Merge duplicate</button>
            )}
            {mergeOpen && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-medium text-amber-800 mb-2">Merge a duplicate INTO this client (the duplicate is absorbed in Pipedrive itself; cannot be undone)</div>
                <input value={mergeQuery} onChange={e => searchMergeCands(e.target.value)} placeholder="Search the duplicate by name, email, or phone..."
                  className="w-full border rounded-md p-2 text-sm mb-2" autoFocus />
                {mergeCands.map(m => (
                  <button key={m.pipedrive_person_id} onClick={() => mergeDuplicate(m)} disabled={merging}
                    className="block w-full text-left text-xs p-2 rounded hover:bg-amber-100 disabled:opacity-50">
                    <b>{m.name}</b> #{m.pipedrive_person_id} - {m.email || 'no email'} {m.phone ? `- ${m.phone}` : ''}
                  </button>
                ))}
                <button onClick={() => { setMergeOpen(false); setMergeQuery(''); setMergeCands([]); }} className="text-xs text-gray-500 mt-1 hover:underline">Cancel</button>
              </div>
            )}""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: merge tool in (leadership-only)")
