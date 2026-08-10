import sys
f = 'src/pages/CSRBonus.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

A1 = """export default function CSRBonus() {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';"""
NEW1 = A1 + """
  // DAILY BONUS VISIBILITY GATE (Astrid spec 8/6): CSRs must self-attest 5
  // check-in items each day before bonus figures render. Company day boundary
  // = America/Chicago (server-consistent, not browser-gameable). Admins and
  // leadership see through the gate. History kept in csr_daily_checklist.
  const GATE_SB = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
  const GATE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
  const GATE_H = { apikey: GATE_KEY, Authorization: `Bearer ${GATE_KEY}`, 'Content-Type': 'application/json' };
  const gateDay = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const gateWho = currentUser?.email || currentUser?.name || '';
  const CHECK_ITEMS = [
    ['item1', 'Joined the daily Google Meet'],
    ['item2', 'Unmuted with camera on during the Meet'],
    ['item3', 'Logged into Insightful'],
    ['item4', 'Posted in the Everyone chat'],
    ['item5', "Checked today's timed calls in Pipedrive"],
  ];
  const [gateRow, setGateRow] = useState(null);
  const [gateBusy, setGateBusy] = useState(false);
  useEffect(() => {
    if (isAdmin || !gateWho) { setGateRow({}); return; }
    fetch(`${GATE_SB}/rest/v1/csr_daily_checklist?csr_email=eq.${encodeURIComponent(gateWho)}&day=eq.${gateDay}&select=*`, { headers: GATE_H })
      .then((r) => r.json()).then((rows) => setGateRow(rows[0] || { item1: false, item2: false, item3: false, item4: false, item5: false }))
      .catch(() => setGateRow({ item1: false, item2: false, item3: false, item4: false, item5: false }));
  }, []);
  const gateToggle = async (key) => {
    if (gateBusy) return;
    setGateBusy(true);
    const nv = !gateRow?.[key];
    const body = { csr_email: gateWho, day: gateDay, [key]: nv, [`${key}_at`]: nv ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    try {
      await fetch(`${GATE_SB}/rest/v1/csr_daily_checklist?on_conflict=csr_email,day`, { method: 'POST', headers: { ...GATE_H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
      setGateRow((prev) => ({ ...(prev || {}), [key]: nv }));
    } catch (e) { alert('Could not save - try again'); }
    setGateBusy(false);
  };
  const gateUnlocked = isAdmin || (gateRow && CHECK_ITEMS.every(([k]) => gateRow[k]));"""
if s.count(A1) != 1: print(f"ABORTED: component anchor x{s.count(A1)}"); sys.exit(1)
s = s.replace(A1, NEW1, 1)

A2 = "  if (!data) return null;"
NEW2 = A2 + """
  if (gateRow === null) return <div className="p-6 text-center text-slate-500">Loading\u2026</div>;
  if (!gateUnlocked) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="relative">
          <div className="grid grid-cols-3 gap-4 blur-md select-none pointer-events-none opacity-60" aria-hidden="true">
            {[...Array(6)].map((_, i) => (<div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24" />))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-lg">
              <h2 className="text-lg font-bold text-slate-800 mb-1">Complete today's check-in checklist to view your bonus.</h2>
              <p className="text-xs text-slate-500 mb-4">Resets every day. Check all five to unlock instantly.</p>
              <div className="space-y-2.5">
                {CHECK_ITEMS.map(([k, label]) => (
                  <label key={k} className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer">
                    <input type="checkbox" checked={!!gateRow?.[k]} onChange={() => gateToggle(k)} disabled={gateBusy} className="mt-0.5 w-4 h-4 accent-indigo-600" />
                    <span className="text-sm text-slate-700">
                      {label}
                      {k === 'item5' && (
                        <a href="https://asapcreditrepair.pipedrive.com/activities/list/filter/6156" target="_blank" rel="noopener noreferrer"
                          className="ml-2 text-indigo-600 underline text-xs" onClick={(e) => e.stopPropagation()}>open filter</a>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }"""
if s.count(A2) != 1: print(f"ABORTED: data-null anchor x{s.count(A2)}"); sys.exit(1)
s = s.replace(A2, NEW2, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("CSRBonus: daily visibility gate wired")
