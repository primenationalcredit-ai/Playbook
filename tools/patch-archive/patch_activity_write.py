import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
state_anchor = """  const [statusEdit, setStatusEdit] = useState(false);"""
if s.count(state_anchor) != 1: print(f"ABORTED: state anchor x{s.count(state_anchor)}"); sys.exit(1)
s = s.replace(state_anchor, """  const [taskDraft, setTaskDraft] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [postingTask, setPostingTask] = useState(false);
  const [completingId, setCompletingId] = useState(null);
""" + state_anchor, 1)
fn_anchor = """  const postNote = async () => {"""
if s.count(fn_anchor) != 1: print(f"ABORTED: fn anchor x{s.count(fn_anchor)}"); sys.exit(1)
s = s.replace(fn_anchor, """  const authedPost = async (payload) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess && sess.session && sess.session.access_token;
    const res = await fetch('/.netlify/functions/crm-activity-write', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j;
  };

  const createTask = async () => {
    const subject = taskDraft.trim();
    if (!subject || postingTask || !client) return;
    setPostingTask(true);
    try {
      const j = await authedPost({ action: 'create', subject, due_date: taskDue || null, person_id: client.pipedrive_person_id, deal_id: (deals[0] && deals[0].pipedrive_deal_id) || null });
      setActivities([{ pipedrive_activity_id: j.activity_id, pd_add_time: new Date().toISOString(), subject, activity_type: 'task', done: false, due_date: taskDue || null, owner_name: j.author }, ...activities]);
      setTaskDraft(''); setTaskDue('');
    } catch (e) { alert('Task failed: ' + e.message); }
    setPostingTask(false);
  };

  const completeActivity = async (a) => {
    if (!a.pipedrive_activity_id || completingId) return;
    setCompletingId(a.pipedrive_activity_id);
    try {
      await authedPost({ action: 'complete', activity_id: a.pipedrive_activity_id });
      setActivities(activities.map(x => x.pipedrive_activity_id === a.pipedrive_activity_id ? { ...x, done: true } : x));
    } catch (e) { alert('Complete failed: ' + e.message); }
    setCompletingId(null);
  };

  """ + fn_anchor, 1)
sel_anchor = """      supabase.from('crm_activities').select('pd_add_time,subject,activity_type,done,due_date,owner_name,note')"""
if s.count(sel_anchor) != 1: print(f"ABORTED: select anchor x{s.count(sel_anchor)}"); sys.exit(1)
s = s.replace(sel_anchor, """      supabase.from('crm_activities').select('pipedrive_activity_id,pd_add_time,subject,activity_type,done,due_date,owner_name,note')""", 1)
ui_anchor = """              {tab === 'activities' && activities.map((a, i) => ("""
if s.count(ui_anchor) != 1: print(f"ABORTED: ui anchor x{s.count(ui_anchor)}"); sys.exit(1)
s = s.replace(ui_anchor, """              {tab === 'activities' && (
                <div className="flex gap-2 pb-1">
                  <input value={taskDraft} onChange={e => setTaskDraft(e.target.value)} placeholder="Add a task - posts here and to Pipedrive..."
                    className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} className="border rounded-lg p-2 text-sm" />
                  <button onClick={createTask} disabled={postingTask || !taskDraft.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{postingTask ? 'Adding...' : 'Add'}</button>
                </div>
              )}
              {tab === 'activities' && activities.map((a, i) => (""", 1)
badge_anchor = """                    <Badge color={a.done ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{a.done ? 'done' : 'open'}</Badge>"""
if s.count(badge_anchor) != 1: print(f"ABORTED: badge anchor x{s.count(badge_anchor)}"); sys.exit(1)
s = s.replace(badge_anchor, """                    <div className="flex items-center gap-2">
                      <Badge color={a.done ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{a.done ? 'done' : 'open'}</Badge>
                      {!a.done && a.pipedrive_activity_id && (
                        <button onClick={() => completeActivity(a)} disabled={completingId === a.pipedrive_activity_id}
                          className="text-xs text-green-700 font-medium hover:underline disabled:opacity-50">
                          {completingId === a.pipedrive_activity_id ? 'Saving...' : 'Mark done'}
                        </button>
                      )}
                    </div>""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: task composer + mark-done in")
