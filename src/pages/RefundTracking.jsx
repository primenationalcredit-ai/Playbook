import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DollarSign, CheckCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';

// Refund Tracking - single workflow:
// request (from Invoices) -> leadership approve/deny -> release e-sign -> pay
// (card engine and/or check) -> client emailed -> closed into Completed history.

const OPEN_STATUSES = ['pending', 'awaiting_signature', 'ready_to_pay', 'check_needed'];
const DONE_STATUSES = ['card_refunded', 'check_mailed', 'denied'];

function StatusPill({ status }) {
  const s = status || '';
  const color =
    s === 'pending' ? 'bg-amber-100 text-amber-800' :
    s === 'awaiting_signature' ? 'bg-blue-100 text-blue-700' :
    s === 'ready_to_pay' ? 'bg-emerald-100 text-emerald-700' :
    s === 'check_needed' ? 'bg-rose-100 text-rose-700' :
    s === 'card_refunded' ? 'bg-green-100 text-green-700' :
    s === 'check_mailed' ? 'bg-green-100 text-green-700' :
    s === 'denied' ? 'bg-slate-200 text-slate-600' :
    'bg-slate-100 text-slate-600';
  return <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${color}`}>{s.replace(/_/g, ' ')}</span>;
}

export default function RefundTracking() {
  const { currentUser } = useApp();
  const isLeader = currentUser?.department === 'leadership';
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Card-refund picker modal: { req, target, candidates: [...], allocs: {txn: amountString} }
  const [picker, setPicker] = useState(null);
  // New-request form modal
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ client_name: '', client_email: '', pipedrive_deal_id: '', amount: '', reason: '' });

  const load = async () => {
    try {
      const r = await fetch('/.netlify/functions/refund-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      });
      const d = await r.json();
      setReqs(d.requests || []);
    } catch (e) { /* keep whatever we had */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submitRequest = async () => {
    if (!form.client_name || !form.pipedrive_deal_id || !form.amount || !form.reason) {
      window.alert('Client name, deal ID, amount, and reason are all required.'); return;
    }
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { window.alert('Enter a positive amount.'); return; }
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/refund-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          pipedrive_deal_id: String(form.pipedrive_deal_id).trim(),
          client_name: form.client_name.trim(),
          client_email: form.client_email.trim() || null,
          amount: amt,
          reason: form.reason.trim(),
          requested_by: currentUser?.email,
          requested_by_name: currentUser?.name
        })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      setShowNew(false);
      setForm({ client_name: '', client_email: '', pipedrive_deal_id: '', amount: '', reason: '' });
      await load();
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };

  const decide = async (id, decision) => {
    let denial_reason = null;
    if (decision === 'denied') {
      denial_reason = window.prompt('Reason for denial (required):');
      if (!denial_reason) return;
    }
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/refund-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide', request_id: id, decision, decided_by: currentUser?.email, denial_reason })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      await load();
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };

  const sendRelease = async (id) => {
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/send-release', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, requested_by: currentUser?.email })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      window.alert('Release sent to client. Email: ' + (d.email_sent ? 'sent' : 'not sent') + ' - SMS: ' + (d.sms_sent ? 'sent' : 'not sent'));
      await load();
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };

  // Open the transaction picker: fetch the deal's refundable card transactions,
  // pre-fill a newest-first allocation toward the target, let leadership edit.
  const payRefund = async (r) => {
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/pay-refund', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: r.id, preview: true, requested_by: currentUser?.email })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      const target = Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.card_refunded_amount) || 0));
      // Pre-fill: newest first, up to the target
      let left = target;
      const allocs = {};
      for (const c of (d.candidates || [])) {
        const take = Math.max(0, Math.min(c.refundable, left));
        allocs[c.txn] = take > 0 ? take.toFixed(2) : '';
        left = Math.round((left - take) * 100) / 100;
      }
      setPicker({ req: r, target, candidates: d.candidates || [], skipped: d.skipped || [], allocs });
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };

  const executePicker = async () => {
    const { req, target, candidates, allocs } = picker;
    const allocations = candidates
      .map(c => ({ txn: c.txn, amount: parseFloat(allocs[c.txn]) || 0 }))
      .filter(a => a.amount > 0);
    const toCard = Math.round(allocations.reduce((s, a) => s + a.amount, 0) * 100) / 100;
    const check = Math.max(0, Math.round((target - toCard) * 100) / 100);
    const bad = candidates.find(c => (parseFloat(allocs[c.txn]) || 0) > c.refundable + 0.009);
    if (bad) { window.alert(`Amount on ${bad.source} exceeds its refundable $${bad.refundable.toFixed(2)}.`); return; }
    if (toCard <= 0 && check <= 0) { window.alert('Nothing to do - enter card amounts or use Pay by Check.'); return; }
    if (!window.confirm(`Refund $${toCard.toFixed(2)} to card(s)${check > 0 ? ` and queue a $${check.toFixed(2)} check` : ''} for ${req.client_name}?`)) return;
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/pay-refund', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: req.id, amount: target, allocations, requested_by: currentUser?.email })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      const lines = (d.results || []).map(x => x.ok ? `OK  $${x.amount.toFixed(2)} -> ${x.card}` : `FAIL ${x.source}: ${x.error}`).join('\n');
      window.alert(
        `Refunded to card: $${(d.refunded_to_card || 0).toFixed(2)}\n` +
        (d.check_needed > 0 ? `CHECK NEEDED: $${d.check_needed.toFixed(2)}` : 'Fully covered - request closed as card refunded') +
        (d.email_sent ? '\nClient emailed.' : '') +
        (lines ? `\n\n${lines}` : '')
      );
      setPicker(null);
      await load();
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };

  const payByCheck = async (r) => {
    const remaining = Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.card_refunded_amount) || 0));
    if (!window.confirm(`Skip the card and pay ${r.client_name}'s $${remaining.toFixed(2)} refund by check?`)) return;
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/refund-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'route_to_check', request_id: r.id, requested_by: currentUser?.email })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      await load();
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };

  const markCheckMailed = async (r) => {
    const num = window.prompt(`Check number for ${r.client_name} ($${(parseFloat(r.check_amount) || 0).toFixed(2)}):`);
    if (!num) return;
    const today = new Date().toISOString().slice(0, 10);
    const mailedDate = window.prompt('Date the check was mailed (yyyy-mm-dd):', today);
    if (mailedDate === null) return;
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/refund-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_mailed', request_id: r.id, check_number: num, mailed_date: mailedDate || today, requested_by: currentUser?.email })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      window.alert('Check recorded - request closed.' + (d.email_sent ? ' Client emailed.' : ' (No client email sent - check email on file.)'));
      await load();
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };

  const open = reqs.filter(r => OPEN_STATUSES.includes(r.status));
  const done = reqs.filter(r => DONE_STATUSES.includes(r.status)).slice(0, 25);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refund Tracking</h1>
          <p className="text-gray-600">Requests come in from the Invoices page. Approve, get the release signed, and pay by card or check - the client is emailed automatically at each payment step.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); load(); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 whitespace-nowrap">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white text-sm rounded-lg hover:opacity-90 font-medium whitespace-nowrap">
            <DollarSign size={16} /> New Refund Request
          </button>
        </div>
      </div>

      {/* ---- Open requests: the working queue ---- */}
      <div className="bg-white rounded-xl border border-amber-200 p-5">
        <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" /> Needs Action ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No open refund requests. New requests from the team will appear here.</p>
        ) : (
          <div className="space-y-2">
            {open.map(r => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-semibold">{r.client_name || 'Unknown'}</span>
                  <span className="text-gray-500"> - ${parseFloat(r.amount || 0).toFixed(2)} - deal {r.pipedrive_deal_id}</span>
                  <span className="ml-2"><StatusPill status={r.status} /></span>
                  {r.release_signed_at ? (
                    <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700" title={`Release signed ${String(r.release_signed_at).slice(0, 10)}`}>&#10003; Release signed - OK to pay</span>
                  ) : ['ready_to_pay', 'check_needed'].includes(r.status) && (
                    <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">&#10003; No release required - OK to pay</span>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    By {r.requested_by_name || r.requested_by || 'unknown'}: {r.reason}
                    {r.rounds_started ? ' (rounds started - release required)' : ''}
                  </p>
                </div>

                {isLeader && r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => decide(r.id, 'approved')} className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50">Approve</button>
                    <button disabled={busy} onClick={() => decide(r.id, 'denied')} className="px-3 py-1 text-xs font-semibold text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50">Deny</button>
                  </div>
                )}
                {isLeader && r.status === 'awaiting_signature' && (
                  <button disabled={busy} onClick={() => sendRelease(r.id)} className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">Send Release</button>
                )}
                {isLeader && r.status === 'ready_to_pay' && (
                  <div className="flex items-center gap-2">
                    <button disabled={busy} onClick={() => payRefund(r)} className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50">Refund to Card</button>
                    <button disabled={busy} onClick={() => payByCheck(r)} className="px-3 py-1 text-xs font-semibold text-white bg-slate-700 rounded hover:bg-slate-800 disabled:opacity-50">Pay by Check</button>
                  </div>
                )}
                {isLeader && r.status === 'check_needed' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600">Check: ${(parseFloat(r.check_amount) || 0).toFixed(2)}</span>
                    <button disabled={busy} onClick={() => payRefund(r)} className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50">Retry Card</button>
                    <button disabled={busy} onClick={() => markCheckMailed(r)} className="px-3 py-1 text-xs font-semibold text-white bg-slate-700 rounded hover:bg-slate-800 disabled:opacity-50">Mark Check Mailed</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Completed history ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" /> Completed
        </h2>
        {done.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nothing completed yet.</p>
        ) : (
          <div className="space-y-1.5">
            {done.map(r => {
              const card = parseFloat(r.card_refunded_amount) || 0;
              const check = parseFloat(r.check_amount) || 0;
              let outcome = '';
              if (r.status === 'denied') outcome = `Denied${r.denial_reason ? ` - ${r.denial_reason}` : ''}`;
              else if (r.status === 'card_refunded') outcome = `$${card.toFixed(2)} refunded to card`;
              else if (r.status === 'check_mailed') outcome = `Check #${r.check_number || '?'} for $${check.toFixed(2)} mailed ${r.check_mailed_date || ''}${card > 0 ? ` (+ $${card.toFixed(2)} to card)` : ''}`;
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-50 rounded-lg px-3 py-1.5 text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{r.client_name || 'Unknown'}</span>
                    <span className="text-gray-400"> - deal {r.pipedrive_deal_id}</span>
                    <span className="ml-2"><StatusPill status={r.status} /></span>
                  </div>
                  <span className={`text-xs ${r.status === 'denied' ? 'text-gray-400' : 'text-green-700 font-medium'}`}>{outcome}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 flex items-start gap-1">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        Card refunds are recorded automatically for consultant payroll deductions. The team can also request refunds from the client's charge on the Invoices page.
      </p>

      {/* ---- New request form ---- */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">New Refund Request</h2>
              <p className="text-sm text-gray-500">If the client has started dispute rounds, a signed release will be required automatically before payment.</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
                <input type="text" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client Email</label>
                <input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="for release + refund confirmation emails" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pipedrive Deal ID *</label>
                  <input type="text" value={form.pipedrive_deal_id} onChange={e => setForm(f => ({ ...f, pipedrive_deal_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="267220" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Refund Amount *</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
                <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 text-sm">Cancel</button>
              <button disabled={busy} onClick={submitRequest} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-semibold">{busy ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Card refund picker ---- */}
      {picker && (() => {
        const toCard = Math.round(picker.candidates.reduce((s, c) => s + (parseFloat(picker.allocs[c.txn]) || 0), 0) * 100) / 100;
        const check = Math.max(0, Math.round((picker.target - toCard) * 100) / 100);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPicker(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b">
                <h2 className="text-lg font-bold text-gray-900">Refund {picker.req.client_name} - ${picker.target.toFixed(2)}</h2>
                <p className="text-sm text-gray-500">Choose how much goes back to each card. Anything left over becomes a check.</p>
              </div>
              <div className="p-5 space-y-2">
                {picker.candidates.length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">No refundable card transactions on this deal. Close this and use Pay by Check.</p>
                )}
                {picker.candidates.map(c => (
                  <div key={c.txn} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.source}</p>
                      <p className="text-xs text-gray-500">{c.card}{c.date ? ` - paid ${c.date}` : ''} - up to ${c.refundable.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-gray-400 text-sm">$</span>
                      <input
                        type="number" step="0.01" min="0" max={c.refundable}
                        value={picker.allocs[c.txn]}
                        onChange={e => setPicker(p => ({ ...p, allocs: { ...p.allocs, [c.txn]: e.target.value } }))}
                        className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
                {picker.skipped.length > 0 && (
                  <p className="text-xs text-gray-400">Not refundable: {picker.skipped.map(s => `charge #${s.charge_id} ($${s.amount})`).join(', ')} - no card transaction on record.</p>
                )}
              </div>
              <div className="p-5 border-t bg-gray-50 rounded-b-2xl">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-gray-600">To card(s): <b className="text-emerald-700">${toCard.toFixed(2)}</b></span>
                  <span className="text-gray-600">Check needed: <b className={check > 0 ? 'text-rose-600' : 'text-gray-400'}>${check.toFixed(2)}</b></span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPicker(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 text-sm">Cancel</button>
                  <button disabled={busy} onClick={executePicker} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-semibold">
                    {busy ? 'Working...' : `Refund $${toCard.toFixed(2)}${check > 0 ? ` + $${check.toFixed(2)} check` : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
