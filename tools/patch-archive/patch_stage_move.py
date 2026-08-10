import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
state_anchor = """  const [taskDraft, setTaskDraft] = useState('');"""
if s.count(state_anchor) != 1: print(f"ABORTED: state anchor x{s.count(state_anchor)}"); sys.exit(1)
s = s.replace(state_anchor, """  const [stageEditId, setStageEditId] = useState(null);
  const [stageCatalog, setStageCatalog] = useState([]);
  const [stageDraft, setStageDraft] = useState('');
  const [savingStage, setSavingStage] = useState(false);
""" + state_anchor, 1)
fn_anchor = """  const authedPost = async (payload) => {"""
if s.count(fn_anchor) != 1: print(f"ABORTED: fn anchor x{s.count(fn_anchor)}"); sys.exit(1)
s = s.replace(fn_anchor, """  const openStageEdit = async (d) => {
    let cat = stageCatalog;
    if (!cat.length) {
      try {
        const res = await fetch('/.netlify/functions/crm-deal-update?action=stages');
        const j = await res.json();
        cat = j.pipelines || [];
        setStageCatalog(cat);
      } catch (e) { alert('Could not load stages: ' + e.message); return; }
    }
    setStageDraft(String(d.stage_id || ''));
    setStageEditId(d.pipedrive_deal_id);
  };

  const moveStage = async (d) => {
    const sid = parseInt(stageDraft);
    if (!sid || savingStage) return;
    if (sid === d.stage_id) { setStageEditId(null); return; }
    setSavingStage(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-deal-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'move', deal_id: d.pipedrive_deal_id, stage_id: sid })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setDeals(deals.map(x => x.pipedrive_deal_id === d.pipedrive_deal_id ? { ...x, stage_id: sid, stage_name: j.stage_name, pipeline_id: j.pipeline_id, pipeline_name: j.pipeline_name } : x));
      setStageEditId(null);
    } catch (e) { alert('Stage move failed: ' + e.message); }
    setSavingStage(false);
  };

  """ + fn_anchor, 1)
badge_anchor = """                        <Badge color="bg-gray-100 text-gray-700">{d.stage_name || `stage ${d.stage_id}`}</Badge>"""
if s.count(badge_anchor) != 1: print(f"ABORTED: badge anchor x{s.count(badge_anchor)}"); sys.exit(1)
s = s.replace(badge_anchor, """                        {stageEditId !== d.pipedrive_deal_id && (
                          <>
                            <Badge color="bg-gray-100 text-gray-700">{d.stage_name || `stage ${d.stage_id}`}</Badge>
                            {d.status === 'open' && (
                              <button onClick={() => openStageEdit(d)} className="text-xs text-blue-600 font-medium hover:underline">Move</button>
                            )}
                          </>
                        )}
                        {stageEditId === d.pipedrive_deal_id && (
                          <span className="flex items-center gap-1.5">
                            <select value={stageDraft} onChange={e => setStageDraft(e.target.value)} className="border rounded-md p-1 text-xs bg-white max-w-[220px]">
                              {stageCatalog.map(p => (
                                <optgroup key={p.id} label={p.name}>
                                  {p.stages.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            <button onClick={() => moveStage(d)} disabled={savingStage} className="text-xs bg-blue-600 text-white rounded px-2 py-1 disabled:opacity-50">{savingStage ? '...' : 'Save'}</button>
                            <button onClick={() => setStageEditId(null)} className="text-xs text-gray-500 px-1">Cancel</button>
                          </span>
                        )}""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: stage mover in")
