import sys, re
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()

old = """function DeclineOutreachBar({ r }) {
  const [attempts, setAttempts] = useState(r.outreach_attempts || 0);
  const [busy, setBusy] = useState(false);"""
new = """function DeclineOutreachBar({ r }) {
  const [attempts, setAttempts] = useState(r.outreach_attempts || 0);
  const [busy, setBusy] = useState(false);
  // Joe 7/31: charge the client straight from the declined card, and show how
  // many card attempts have happened (auto retries + manual tries here).
  const [charging, setCharging] = useState(false);
  const [chargeTries, setChargeTries] = useState(r.retry_count || 0);
  const [outcome, setOutcome] = useState(null);
  const chargeNow = async () => {
    if (charging) return;
    if (!window.confirm(`Charge ${r.client_name || 'this client'} $${Number(r.amount).toFixed(2)} on the card on file right now?`)) return;
    setCharging(true); setOutcome(null);
    try {
      const res = await callApi('charge_now', { charge_id: r.id });
      const paid = !!(res && (res.charged || res.success === true || res.status === 'paid'));
      setChargeTries(t => t + 1);
      setOutcome(paid
        ? { ok: true, text: `Collected $${Number((res && res.amount) || r.amount).toFixed(2)}` }
        : { ok: false, text: (res && (res.decline_reason || res.message || res.error)) || 'Declined' });
    } catch (e) {
      setChargeTries(t => t + 1);
      setOutcome({ ok: false, text: e.message || 'Charge failed' });
    }
    setCharging(false);
  };"""
if s.count(old) != 1: print(f"ABORTED: state anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """        {r.outreach_last_at && (
          <span className="text-[11px] text-slate-400">last {new Date(r.outreach_last_at).toLocaleDateString()} by {(r.outreach_last_by || '').split('@')[0]}</span>
        )}
      </div>"""
new = """        {r.outreach_last_at && (
          <span className="text-[11px] text-slate-400">last {new Date(r.outreach_last_at).toLocaleDateString()} by {(r.outreach_last_by || '').split('@')[0]}</span>
        )}
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600" title="Card charge attempts (auto retries + manual)">
          {'\\u{1F4B3}'} {chargeTries} {chargeTries === 1 ? 'card try' : 'card tries'}
        </span>
        {outcome && (
          <span className={`text-[11px] font-semibold ${outcome.ok ? 'text-green-700' : 'text-red-600'}`}>{outcome.text}</span>
        )}
      </div>"""
if s.count(old) != 1: print(f"ABORTED: chips anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

pat = re.compile(r"\n\s*\{r\.pipedrive_deal_id && \(\s*\n\s*<a href=\{`https://asapcreditrepair\.pipedrive\.com/deal/\$\{r\.pipedrive_deal_id\}`\}[\s\S]*?\)\}")
hits = pat.findall(s)
if len(hits) != 1: print(f"ABORTED: dup-Deal regex x{len(hits)}"); sys.exit(1)
s = pat.sub("""
        <button onClick={chargeNow} disabled={charging}
          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
          {charging ? 'Charging\\u2026' : 'Charge card'}
        </button>""", s, count=1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("declined cards: Charge button + card-tries counter + outcome inline; duplicate Deal link gone")
