import sys
f = 'src/pages/Invoices.jsx'
b = open(f, 'rb').read()

old = b"            : rows.map(r => <BillingRow key={r.id} r={r} showDecline={showDecline} />)}"
new = b"""            : rows.map(r => (
                <div key={r.id}>
                  <BillingRow r={r} showDecline={showDecline} />
                  {showDecline && <DeclineOutreachBar r={r} />}
                </div>
              ))}"""
if b.count(old) != 1: print(f"ABORTED: row anchor x{b.count(old)}"); sys.exit(1)
b = b.replace(old, new, 1)

old = b"function BillingOverview() {"
new = b"""// Astrid 7/30: outreach tracking under each declined card - attempts badge,
// deal owner, Log attempt button (server: log_outreach -> app_cache counter).
function DeclineOutreachBar({ r }) {
  const [attempts, setAttempts] = useState(r.outreach_attempts || 0);
  const [busy, setBusy] = useState(false);
  const badge = attempts === 0
    ? { cls: 'bg-slate-100 text-slate-500', label: 'No attempts yet' }
    : attempts < 3
      ? { cls: 'bg-amber-100 text-amber-800', label: `Attempt ${attempts}` }
      : { cls: 'bg-red-100 text-red-700', label: `Attempt ${attempts} \u2014 escalate` };
  const initials = (r.owner_name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const logAttempt = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callApi('log_outreach', { charge_id: r.id });
      if (res && res.attempts != null) setAttempts(res.attempts);
      else setAttempts(a => a + 1);
    } catch (e) { alert('Could not log attempt: ' + (e.message || e)); }
    setBusy(false);
  };
  return (
    <div className="flex items-center justify-between gap-2 mt-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        {r.outreach_last_at && (
          <span className="text-[11px] text-slate-400">last {new Date(r.outreach_last_at).toLocaleDateString()} by {(r.outreach_last_by || '').split('@')[0]}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {r.owner_name && (
          <span className="flex items-center gap-1.5" title="Deal owner">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold flex items-center justify-center">{initials}</span>
            <span className="text-[11px] text-slate-500 whitespace-nowrap">{r.owner_name}</span>
          </span>
        )}
        <button onClick={logAttempt} disabled={busy}
          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
          {busy ? 'Logging\u2026' : 'Log attempt'}
        </button>
        {r.pipedrive_deal_id && (
          <a href={`https://asapcreditrepair.pipedrive.com/deal/${r.pipedrive_deal_id}`} target="_blank" rel="noreferrer"
            className="text-[11px] font-semibold text-blue-700 hover:underline whitespace-nowrap">Deal \u2197</a>
        )}
      </div>
    </div>
  );
}
function BillingOverview() {"""
if b.count(old) != 1: print(f"ABORTED: component anchor x{b.count(old)}"); sys.exit(1)
b = b.replace(old, new, 1)
open(f, 'wb').write(b)
print("OUTREACH BAR: badge + owner + Log attempt + deal link under every declined card")
