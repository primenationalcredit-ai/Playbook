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

  const payRefund = async (r) => {
    const amtStr = window.prompt('Refund amount to attempt on the card(s):', String(r.amount || ''));
    if (amtStr === null) return;
    const amt = parseFloat(amtStr);
    if (!amt || amt <= 0) { window.alert('Enter a positive amount.'); return; }
    if (!window.confirm(`Attempt to refund $${amt.toFixed(2)} to ${r.client_name}'s card(s) now?`)) return;
    setBusy(true);
    try {
      const resp = await fetch('/.netlify/functions/pay-refund', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: r.id, amount: amt, requested_by: currentUser?.email })
      });
      const d = await resp.json();
      if (!resp.ok || d.error) throw new Error(d.error || 'Failed');
      const lines = (d.results || []).map(x => x.ok ? `OK  $${x.amount.toFixed(2)} -> ${x.card}` : `FAIL ${x.source}: ${x.error}`).join('\n');
      window.alert(
        `Refunded to card: $${(d.refunded_to_card || 0).toFixed(2)}\n` +
        (d.check_needed > 0 ? `CHECK NEEDED: $${d.check_needed.toFixed(2)}` : 'Fully covered - request closed as card refunded') +
        (d.email_sent ? '\nClient emailed.' : '') +
        (lines ? `\n\n${lines}` : '') +
        (d.no_candidates ? '\n\nNo refundable card transactions were found on this deal.' : '')
      );
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
        <button onClick={() => { setLoading(true); load(); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
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
                  {(r.release_signed_at || ['ready_to_pay', 'check_needed'].includes(r.status)) && (
                    <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700" title={r.release_signed_at ? `Release signed ${String(r.release_signed_at).slice(0, 10)}` : 'Release signed'}>&#10003; Release signed - OK to pay</span>
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
        Card refunds are recorded automatically for consultant payroll deductions. Refunds must be requested from the client's charge on the Invoices page - there is no manual entry here.
      </p>
    </div>
  );
}
