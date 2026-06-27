import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck, ArrowLeft, Clock, CheckCircle2, XCircle, CalendarClock,
  PauseCircle, Send, AlertTriangle, RefreshCw, MessageSquare, DollarSign,
} from 'lucide-react';

const PIPEDRIVE_DOMAIN = 'asapcredit';
const DEAL_URL = (id) => `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/deal/${id}`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const RESTRICTED_LEADER_IDS = [
  'f7b8bc3a-74e6-46c2-a378-d19d204d7133', // Mariana Navarro
  '3ae5ad73-46eb-404f-8dc9-6d5cf53e9df0', // Kim Sanchez
];

const fmtMoney = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (s) => {
  if (!s) return '';
  const d = String(s).slice(0, 10).split('-');
  if (d.length !== 3) return s;
  return `${MONTHS[parseInt(d[1], 10) - 1]} ${parseInt(d[2], 10)}, ${d[0]}`;
};
const fmtWhen = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return s;
  const h = d.getHours() % 12 || 12;
  const am = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${h}:${String(d.getMinutes()).padStart(2, '0')} ${am}`;
};

async function callApi(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  const res = await fetch('/.netlify/functions/invoices-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function StatusPill({ status }) {
  const map = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status || 'unknown'}</span>;
}

function RequestSummary({ a }) {
  const isPause = a.request_type === 'pause';
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {isPause ? <PauseCircle size={18} className="text-amber-600" /> : <CalendarClock size={18} className="text-asap-blue" />}
        <span className="font-semibold text-slate-800">{isPause ? 'Pause request' : 'Date change request'}</span>
        <StatusPill status={a.status} />
      </div>
      <div className="text-xs text-slate-600 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
        <span className="text-slate-400">Client</span>
        <span className="font-semibold col-span-1 md:col-span-2">{a.client_name || 'N/A'}{a.pipedrive_deal_id ? <> · <a href={DEAL_URL(a.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="text-asap-blue hover:underline">#{a.pipedrive_deal_id}</a></> : null}</span>
        <span className="text-slate-400">Payment</span>
        <span className="font-semibold col-span-1 md:col-span-2">{fmtMoney(a.amount)}{a.sequence_number ? ` · payment #${a.sequence_number}` : ''}</span>
        <span className="text-slate-400">Current due</span>
        <span className="font-semibold">{fmtDate(a.current_due_date)}</span>
        {isPause ? (
          <>
            <span className="text-slate-400">Pause</span>
            <span className="font-semibold">{a.pause_indefinite ? 'Indefinitely' : `until ${fmtDate(a.pause_until_date)}`}</span>
          </>
        ) : (
          <>
            <span className="text-slate-400">New due</span>
            <span className="font-semibold">{fmtDate(a.new_due_date)}</span>
          </>
        )}
        <span className="text-slate-400">Requested by</span>
        <span className="font-semibold col-span-1 md:col-span-2">{a.requested_by_name || a.requested_by_email}</span>
        <span className="text-slate-400">Reason</span>
        <span className="italic col-span-1 md:col-span-2">{a.reason || '—'}</span>
        {a.status === 'rejected' && a.rejection_reason && (
          <>
            <span className="text-slate-400">Rejected because</span>
            <span className="italic text-red-700 col-span-1 md:col-span-2">{a.rejection_reason}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Thread({ messages, myEmail }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  if (!messages || messages.length === 0) {
    return <p className="text-sm text-slate-400 italic text-center py-6">No messages yet. Add a note below to discuss before a decision.</p>;
  }
  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {messages.map((m, i) => {
        const mine = (m.sender_email || '').toLowerCase() === (myEmail || '').toLowerCase();
        const isAdmin = m.sender_role === 'admin';
        return (
          <div key={m.id || i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'bg-asap-blue text-white' : isAdmin ? 'bg-violet-100 text-slate-800' : 'bg-slate-100 text-slate-800'}`}>
              <div className={`text-[10px] mb-0.5 ${mine ? 'text-blue-100' : 'text-slate-500'}`}>
                {isAdmin ? 'Leadership' : 'Requester'} · {m.sender_email} · {fmtWhen(m.created_at)}
              </div>
              <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function DetailView({ approvalId, isAdmin, myEmail, onBack, onChanged }) {
  const [approval, setApproval] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await callApi('list_approval_messages', { approval_id: approvalId });
      setApproval(d.approval || null);
      setMessages(d.messages || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // poll the thread while open
    return () => clearInterval(t);
  }, [load]);

  const decided = approval && approval.status !== 'pending';

  const postMessage = async () => {
    if (!reply.trim()) return;
    setBusy(true); setNotice(null);
    try {
      await callApi('post_approval_message', { approval_id: approvalId, body: reply.trim() });
      setReply('');
      await load();
    } catch (e) {
      setNotice({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (approve) => {
    setBusy(true); setNotice(null);
    try {
      if (approve) {
        await callApi('approve_request', { approval_id: approvalId });
        setNotice({ type: 'success', text: 'Approved. The change has been applied.' });
      } else {
        if (!rejectReason.trim() || rejectReason.trim().length < 3) { setNotice({ type: 'error', text: 'Add a short reason for the rejection.' }); setBusy(false); return; }
        await callApi('reject_request', { approval_id: approvalId, rejection_reason: rejectReason.trim() });
        setNotice({ type: 'success', text: 'Rejected. The requester has been notified.' });
        setRejecting(false);
      }
      await load();
      onChanged && onChanged();
    } catch (e) {
      setNotice({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-asap-blue hover:underline">
        <ArrowLeft size={16} /> All approvals
      </button>

      {loading ? (
        <div className="text-center py-12 text-slate-500"><RefreshCw size={20} className="inline animate-spin mr-2" /> Loading…</div>
      ) : err ? (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" /> <span>{err}</span>
        </div>
      ) : approval ? (
        <>
          <RequestSummary a={approval} />

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <MessageSquare size={18} className="text-asap-blue" />
              <h3 className="text-base font-semibold text-asap-blue">Discussion</h3>
            </div>

            <Thread messages={messages} myEmail={myEmail} />

            {decided ? (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 text-center">
                This request was <span className="font-semibold">{approval.status}</span>{approval.approved_at ? ` on ${fmtDate(approval.approved_at)}` : ''}. The conversation is closed.
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Write a message to discuss before a decision…"
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue resize-none"
                  />
                  <button onClick={postMessage} disabled={busy || !reply.trim()}
                    className="px-4 self-stretch inline-flex items-center gap-1 bg-asap-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50">
                    <Send size={15} /> Send
                  </button>
                </div>
              </div>
            )}

            {notice && (
              <div className={`mt-3 p-2 rounded text-sm ${notice.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {notice.text}
              </div>
            )}
          </div>

          {/* Decision controls — leadership only, and only while pending */}
          {isAdmin && !decided && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <h3 className="text-base font-semibold text-asap-blue mb-3">Decision</h3>
              {!rejecting ? (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => decide(true)} disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                    <CheckCircle2 size={16} /> Approve &amp; apply
                  </button>
                  <button onClick={() => setRejecting(true)} disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-300 text-sm font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50">
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500">Reason for rejection (sent to the requester)</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue resize-none"
                    placeholder="Explain why this can't be approved…" />
                  <div className="flex gap-2">
                    <button onClick={() => decide(false)} disabled={busy}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">Confirm rejection</button>
                    <button onClick={() => { setRejecting(false); setRejectReason(''); }} disabled={busy}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Cancel</button>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-3">Approving applies the date change or pause immediately in the payment processor. The requester is notified either way.</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400 italic text-center py-12">Approval not found.</p>
      )}
    </div>
  );
}

function ListView({ isAdmin, onOpen }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const d = await callApi('list_pending_approvals');
      const arr = Array.isArray(d) ? d : (d.approvals || d.data || d.rows || []);
      setItems(arr);
    } catch (e) {
      setErr(e.message); setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const shown = items.filter(a => filter === 'all' ? true : (a.status || 'pending') === filter);
  const counts = {
    pending: items.filter(a => (a.status || 'pending') === 'pending').length,
    approved: items.filter(a => a.status === 'approved').length,
    rejected: items.filter(a => a.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-asap-blue text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {f}{f !== 'all' && counts[f] != null ? ` (${counts[f]})` : ''}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500"><RefreshCw size={20} className="inline animate-spin mr-2" /> Loading…</div>
      ) : err ? (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">{err}</div>
      ) : shown.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm italic">
          {isAdmin ? 'No ' : 'You have no '}{filter === 'all' ? '' : filter + ' '}approval requests{isAdmin ? '' : ' right now'}.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(a => {
            const isPause = a.request_type === 'pause';
            return (
              <button key={a.id} onClick={() => onOpen(a.id)}
                className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:border-asap-blue transition-colors">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    {isPause ? <PauseCircle size={18} className="text-amber-600 flex-shrink-0" /> : <CalendarClock size={18} className="text-asap-blue flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {isPause ? 'Pause' : 'Date change'} · {a.client_name || 'Client'} · {fmtMoney(a.amount)}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isPause
                          ? <>Pause {a.pause_indefinite ? 'indefinitely' : `until ${fmtDate(a.pause_until_date)}`}</>
                          : <>{fmtDate(a.current_due_date)} → {fmtDate(a.new_due_date)}</>}
                        {' · by '}{a.requested_by_name || a.requested_by_email}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={a.status} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Approvals() {
  const { currentUser } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();

  const isRestrictedLeader = RESTRICTED_LEADER_IDS.includes(currentUser?.id);
  const isAdmin = !!currentUser && (currentUser.role === 'admin' || currentUser.department === 'leadership') && !isRestrictedLeader;
  const myEmail = currentUser?.email || '';

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <ShieldCheck size={28} className="text-asap-blue" /> Approvals
        </h1>
        <p className="text-slate-500 text-sm">
          {isAdmin
            ? 'Payment date-change and pause requests. Discuss with the requester, then approve or reject.'
            : 'Your payment change requests. Message leadership here while they review your request.'}
        </p>
      </div>

      {id
        ? <DetailView approvalId={id} isAdmin={isAdmin} myEmail={myEmail} onBack={() => navigate('/approvals')} onChanged={() => {}} />
        : <ListView isAdmin={isAdmin} onOpen={(aid) => navigate(`/approvals/${aid}`)} />}
    </div>
  );
}
