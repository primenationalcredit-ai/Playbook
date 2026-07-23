import { useEffect, useState } from 'react';

// ADDITIONAL ROUNDS (ComplianceStrike) - offer tracking + Zelle verification.
// Tracker: every offer with live status; Verify releases a pending Zelle claim.
// Send: fire the offer (email + SMS + PD note; left side untouched by design).

const API = '/.netlify/functions/ar-tracker';
const DEAL_URL = (id) => `https://asapcreditrepair.pipedrive.com/deal/${id}`;

const STATUS_STYLE = {
  offered: 'bg-slate-100 text-slate-700',
  zelle_pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  signed: 'bg-indigo-100 text-indigo-800',
};
const STATUS_LABEL = {
  offered: 'Offered', zelle_pending: 'Zelle - verify', paid: 'Paid', signed: 'Paid + Signed',
};

export default function AdditionalRounds() {
  const [tab, setTab] = useState('tracker');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null); // deal_id being acted on
  const [filter, setFilter] = useState('all');
  const [sendDeal, setSendDeal] = useState('');
  const [sendResult, setSendResult] = useState(null);

  const load = () => {
    setErr(null);
    fetch(API).then((r) => r.json()).then((d) => {
      if (d.error) setErr(d.error); else setData(d);
    }).catch((e) => setErr(String(e)));
  };
  useEffect(load, []);

  const confirmZelle = async (dealId, currentConf) => {
    const entered = window.prompt(
      `Verify the Zelle for deal ${dealId} is IN the teamelite account.\n\nConfirmation number below - correct it or add it if the client's was wrong or missing, then press OK to release the invoice, agreement, and scheduling. Cancel aborts.`,
      currentConf && currentConf !== 'no-conf' ? currentConf : ''
    );
    if (entered === null) return;
    setBusy(dealId);
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm_zelle', deal_id: dealId, conf: entered.trim() }) });
      const d = await r.json();
      alert(d.success ? `Verified. Steps:\n- ${(d.notes || []).join('\n- ')}` : `Failed: ${d.error || 'unknown'}`);
      load();
    } catch (e) { alert('Error: ' + e); }
    setBusy(null);
  };

  const sendOffer = async () => {
    const id = sendDeal.trim();
    if (!id) return;
    setBusy('send');
    setSendResult(null);
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_offer', deal_id: id }) });
      const d = await r.json();
      setSendResult(d);
      if (d.success) { setSendDeal(''); load(); }
    } catch (e) { setSendResult({ error: String(e) }); }
    setBusy(null);
  };

  const offers = (data?.offers || []).filter((o) => filter === 'all' || o.status === filter);
  const counts = (data?.offers || []).reduce((a, o) => { a[o.status] = (a[o.status] || 0) + 1; return a; }, {});

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-800">Additional Rounds &mdash; ComplianceStrike&trade;</h1>
        <div className="flex gap-1.5">
          {[['tracker', 'Tracker'], ['send', 'Send Offer']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${tab === k ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-600'}`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'tracker' && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            {['all', 'offered', 'zelle_pending', 'paid', 'signed'].map((k) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border ${filter === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-600'}`}>
                {k === 'all' ? `All (${data?.count ?? '...'})` : `${STATUS_LABEL[k]} (${counts[k] || 0})`}
              </button>
            ))}
            <button onClick={load} className="ml-auto text-xs text-indigo-600 hover:underline">Refresh</button>
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr>
                <th className="text-left font-medium px-3 py-2">Client</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-right font-medium px-3 py-2">Amount</th>
                <th className="text-left font-medium px-3 py-2">Offered</th>
                <th className="text-left font-medium px-3 py-2">Agreement</th>
                <th className="text-right font-medium px-3 py-2">Actions</th>
              </tr></thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.deal_id + o.offered_at} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <a href={DEAL_URL(o.deal_id)} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-indigo-600">{o.client_name || `Deal ${o.deal_id}`}</a>
                      <div className="text-[11px] text-slate-400">{o.client_email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[o.status] || ''}`}>{STATUS_LABEL[o.status] || o.status}</span>
                      {o.status === 'zelle_pending' && o.zelle_conf && <div className="text-[11px] text-amber-700 mt-0.5">conf: {o.zelle_conf}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">${Number(o.amount || 0).toFixed(0)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{String(o.offered_at || '').slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{o.agreement ? (o.agreement.signed_at ? `signed ${String(o.agreement.signed_at).slice(0, 10)}` : o.agreement.status) : '-'}</td>
                    <td className="px-3 py-2 text-right">
                      {o.status === 'zelle_pending' && (
                        <button disabled={busy === o.deal_id} onClick={() => confirmZelle(o.deal_id, o.zelle_conf)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                          {busy === o.deal_id ? 'Verifying\u2026' : 'Verify Zelle received'}
                        </button>
                      )}
                      {o.status === 'offered' && (
                        <button onClick={() => { navigator.clipboard.writeText(o.pay_link); }} title="Copy the team payment link"
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-slate-600 hover:border-indigo-400">Copy pay link</button>
                      )}
                    </td>
                  </tr>
                ))}
                {offers.length === 0 && !err && <tr><td colSpan="6" className="px-3 py-6 text-center text-xs text-slate-400">Nothing here yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Zelle claims hold everything (no invoice, agreement, or status) until someone verifies the money in the teamelite account and presses Verify. Follow-up view: filter Offered to see everyone who has not bought yet.</p>
        </>
      )}

      {tab === 'send' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 max-w-lg">
          <p className="text-sm text-slate-700">Send the ComplianceStrike&trade; offer to a client: email (your template) + text + PD note with the team payment link. The left side is never touched; status moves only when they pay.</p>
          <div className="flex gap-2">
            <input value={sendDeal} onChange={(e) => setSendDeal(e.target.value)} placeholder="Pipedrive deal ID"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1" />
            <button disabled={busy === 'send' || !sendDeal.trim()} onClick={sendOffer}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              {busy === 'send' ? 'Sending\u2026' : 'Send offer'}
            </button>
          </div>
          {sendResult && (
            <div className={`text-xs rounded-lg p-3 ${sendResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
              {sendResult.success
                ? `Sent. Invoice ${sendResult.steps?.invoice?.number} \u00b7 email ${sendResult.steps?.email} \u00b7 sms ${sendResult.steps?.sms}`
                : `Not sent: ${sendResult.error || 'unknown error'}`}
            </div>
          )}
          <p className="text-[11px] text-slate-400">Before launch, sends only work for allow-listed test deals (everything else is refused by the launch gate). An automatic list of clients finishing round 3 lands here next.</p>
        </div>
      )}
    </div>
  );
}
