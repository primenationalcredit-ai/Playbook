import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
state_anchor = """  const [noteDraft, setNoteDraft] = useState('');"""
if s.count(state_anchor) != 1: print(f"ABORTED: state anchor x{s.count(state_anchor)}"); sys.exit(1)
s = s.replace(state_anchor, """  const [statusEdit, setStatusEdit] = useState(false);
  const [statusDraft, setStatusDraft] = useState({});
  const [savingStatus, setSavingStatus] = useState(false);
""" + state_anchor, 1)
fn_anchor = """  const postNote = async () => {"""
if s.count(fn_anchor) != 1: print(f"ABORTED: fn anchor x{s.count(fn_anchor)}"); sys.exit(1)
s = s.replace(fn_anchor, """  const optList = (key) => Object.entries(options[key] || {}).map(([id, label]) => ({ id: parseInt(id), label })).sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  const saveStatus = async () => {
    if (savingStatus || !client) return;
    const changes = {};
    for (const k of ['current_status', 'update_status', 'quick_buttons']) {
      if (statusDraft[k] !== undefined && statusDraft[k] !== '' && parseInt(statusDraft[k]) !== client[k]) changes[k] = parseInt(statusDraft[k]);
    }
    if (!Object.keys(changes).length) { setStatusEdit(false); return; }
    setSavingStatus(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-person-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ person_id: client.pipedrive_person_id, ...changes })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setClient({ ...client, ...changes });
      setStatusEdit(false); setStatusDraft({});
    } catch (e) { alert('Status update failed: ' + e.message); }
    setSavingStatus(false);
  };

  """ + fn_anchor, 1)
ui_anchor = """            <div className="mt-3 text-xs text-gray-500">
              {client.account_manager_name && <span className="mr-4">AM: <b>{client.account_manager_name}</b></span>}"""
if s.count(ui_anchor) != 1: print(f"ABORTED: ui anchor x{s.count(ui_anchor)}"); sys.exit(1)
s = s.replace(ui_anchor, """            {!statusEdit && (
              <button onClick={() => { setStatusDraft({ current_status: client.current_status ?? '', update_status: client.update_status ?? '', quick_buttons: client.quick_buttons ?? '' }); setStatusEdit(true); }}
                className="mt-3 text-xs text-blue-600 font-medium hover:underline">Change status</button>
            )}
            {statusEdit && (
              <div className="mt-3 flex flex-wrap items-end gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                {[['current_status', 'Current Status'], ['update_status', 'Update Status'], ['quick_buttons', 'Quick Buttons']].map(([k, lbl]) => (
                  <label key={k} className="text-xs text-gray-600">
                    <div className="mb-1 font-medium">{lbl}</div>
                    <select value={statusDraft[k] ?? ''} onChange={e => setStatusDraft({ ...statusDraft, [k]: e.target.value })}
                      className="border rounded-md p-1.5 text-sm bg-white min-w-[180px]">
                      <option value="">(no change)</option>
                      {optList(k).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </label>
                ))}
                <div className="flex gap-2">
                  <button onClick={saveStatus} disabled={savingStatus} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50">{savingStatus ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => { setStatusEdit(false); setStatusDraft({}); }} className="px-3 py-1.5 border rounded-md text-sm">Cancel</button>
                </div>
                <div className="text-[11px] text-gray-500 w-full">Saves to Pipedrive too - all existing automations fire as normal.</div>
              </div>
            )}
""" + ui_anchor, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: status editor in")
