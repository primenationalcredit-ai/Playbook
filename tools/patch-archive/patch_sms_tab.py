import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
state_anchor = """  const [stageEditId, setStageEditId] = useState(null);"""
if s.count(state_anchor) != 1: print(f"ABORTED: state anchor x{s.count(state_anchor)}"); sys.exit(1)
s = s.replace(state_anchor, """  const [smsMsgs, setSmsMsgs] = useState(null);
  const [smsDraft, setSmsDraft] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsError, setSmsError] = useState(null);
""" + state_anchor, 1)
fn_anchor = """  const searchMergeCands = async (q) => {"""
if s.count(fn_anchor) != 1: print(f"ABORTED: fn anchor x{s.count(fn_anchor)}"); sys.exit(1)
s = s.replace(fn_anchor, """  const smsAuthed = async (method, body) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess && sess.session && sess.session.access_token;
    const url = method === 'GET' ? `/.netlify/functions/crm-sms?phone=${encodeURIComponent(client.phone)}` : '/.netlify/functions/crm-sms';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j;
  };

  const loadSms = async () => {
    if (!client || !client.phone) { setSmsMsgs([]); setSmsError('No phone number on file.'); return; }
    setSmsMsgs(null); setSmsError(null);
    try { const j = await smsAuthed('GET'); setSmsMsgs(j.messages || []); }
    catch (e) { setSmsMsgs([]); setSmsError(e.message); }
  };

  const sendSms = async () => {
    const text = smsDraft.trim();
    if (!text || smsSending) return;
    setSmsSending(true);
    try {
      await smsAuthed('POST', { phone: client.phone, text });
      setSmsMsgs([...(smsMsgs || []), { id: `local-${Date.now()}`, direction: 'Outbound', time: new Date().toISOString(), text: text, status: 'Queued' }]);
      setSmsDraft('');
    } catch (e) { alert('SMS failed: ' + e.message); }
    setSmsSending(false);
  };

  """ + fn_anchor, 1)
tabbar_anchor = """              <button onClick={() => setTab('activities')} className={`px-5 py-3 text-sm font-medium flex items-center gap-1.5 ${tab === 'activities' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><CheckSquare className="w-4 h-4" /> Activities ({activities.length})</button>"""
if s.count(tabbar_anchor) != 1: print(f"ABORTED: tabbar anchor x{s.count(tabbar_anchor)}"); sys.exit(1)
s = s.replace(tabbar_anchor, tabbar_anchor + """
              <button onClick={() => { setTab('sms'); if (smsMsgs === null) loadSms(); }} className={`px-5 py-3 text-sm font-medium flex items-center gap-1.5 ${tab === 'sms' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><Phone className="w-4 h-4" /> Texts</button>""", 1)
panel_anchor = """            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">"""
if s.count(panel_anchor) != 1: print(f"ABORTED: panel anchor x{s.count(panel_anchor)}"); sys.exit(1)
s = s.replace(panel_anchor, """            {tab === 'sms' && (
              <div className="p-4">
                {smsMsgs === null && <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading conversation...</div>}
                {smsError && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">{smsError}</div>}
                {smsMsgs !== null && !smsError && smsMsgs.length === 0 && <div className="text-sm text-gray-400 mb-2">No texts with {client.phone} in the last 180 days.</div>}
                {smsMsgs !== null && smsMsgs.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto mb-3 pr-1">
                    {smsMsgs.map(m => (
                      <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.direction === 'Outbound' ? 'ml-auto bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {m.text}
                        <div className={`text-[10px] mt-1 ${m.direction === 'Outbound' ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(m.time).toLocaleString()} {m.status && m.status !== 'Delivered' ? `- ${m.status}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
                {client.phone && (
                  <div className="flex gap-2">
                    <textarea value={smsDraft} onChange={e => setSmsDraft(e.target.value)} rows={2}
                      placeholder={`Text ${client.phone} from the ASAP number...`}
                      className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={sendSms} disabled={smsSending || !smsDraft.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 self-start">
                      {smsSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                )}
              </div>
            )}
""" + panel_anchor, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: SMS tab in")
