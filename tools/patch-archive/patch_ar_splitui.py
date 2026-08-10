import sys
f = 'src/pages/AdditionalRounds.jsx'
s = open(f, encoding='utf-8').read()

# 1) state + payload in sendOffer
old = """  const sendOffer = async () => {
    const id = sendDeal.trim();
    if (!id) return;
    setBusy('send');
    setSendResult(null);
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_offer', deal_id: id }) });
      let d = await r.json();
      if (d && !d.success && String(d.error || '').includes('already exists') && window.confirm('An offer/invoice already exists for this deal:\\n\\n' + String(d.error) + '\\n\\nVoid the old invoice and resend a fresh offer?')) {
        const r2 = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_offer', deal_id: id, force: true }) });
        d = await r2.json();
      }"""
new = """  const AR_PRICE = 299;
  const [splitOn, setSplitOn] = useState(false);
  const [splitFirst, setSplitFirst] = useState('149.50');
  const [splitDate, setSplitDate] = useState('');
  const splitSecond = splitOn ? Math.max(0, Math.round((AR_PRICE - (parseFloat(splitFirst) || 0)) * 100) / 100) : 0;
  const sendOffer = async () => {
    const id = sendDeal.trim();
    if (!id) return;
    if (splitOn && (!splitDate || !(parseFloat(splitFirst) > 0) || !(splitSecond > 0))) { alert('Split payment needs a first amount, and a future date for the remainder.'); return; }
    const splitPayload = splitOn ? { split: { first: parseFloat(splitFirst), second: splitSecond, second_date: splitDate } } : {};
    setBusy('send');
    setSendResult(null);
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_offer', deal_id: id, ...splitPayload }) });
      let d = await r.json();
      if (d && !d.success && String(d.error || '').includes('already exists') && window.confirm('An offer/invoice already exists for this deal:\\n\\n' + String(d.error) + '\\n\\nVoid the old invoice and resend a fresh offer?')) {
        const r2 = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_offer', deal_id: id, force: true, ...splitPayload }) });
        d = await r2.json();
      }"""
if s.count(old) != 1: print(f"ABORTED: sendOffer anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

# 2) the fields under the deal-id row
old = """          {sendResult && (
            <div className={`text-xs rounded-lg p-3 ${sendResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>"""
new = """          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={splitOn} onChange={(e) => setSplitOn(e.target.checked)} />
              Split payment (client pays part now, rest on a set date - the round does NOT start until the full ${AR_PRICE} is collected)
            </label>
            {splitOn && (
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-xs text-slate-500">Now:</span>
                <input type="number" step="0.01" min="1" value={splitFirst} onChange={(e) => setSplitFirst(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-24" />
                <span className="text-xs text-slate-500">Later: <b>${'{'}splitSecond.toFixed(2){'}'}</b> on</span>
                <input type="date" value={splitDate} onChange={(e) => setSplitDate(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
              </div>
            )}
          </div>
          {sendResult && (
            <div className={`text-xs rounded-lg p-3 ${sendResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>"""
if s.count(old) != 1: print(f"ABORTED: render anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
ok = s.count('splitOn') >= 5 and 'split: {' in s
print(f"Send Offer split UI wired {'OK' if ok else 'INCOMPLETE - DO NOT PUSH'}")
if not ok: sys.exit(1)
