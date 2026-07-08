import React, { useState, useEffect } from 'react';
import { Search, Send, ExternalLink, RefreshCw, FileText, AlertTriangle, CheckCircle2, Clock, XCircle, DollarSign, CalendarClock, PauseCircle, PlayCircle, Zap, Undo2, ChevronDown, ChevronUp, AlarmClock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

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
const fmtDateTime = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return s;
  const h = d.getHours() % 12 || 12;
  const am = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${am}`;
};
const daysUntil = (s) => {
  if (!s) return null;
  const d = new Date(s);
  const today = new Date();
  d.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};
const chargeLabel = (idx, total) => {
  if (total <= 1) return 'Final Payment';
  if (idx === total - 1) return 'Final Payment';
  if (total === 2 && idx === 0) return 'Partial Payment';
  return `Payment #${idx + 1}`;
};

// ===== Authorize.net Accept.js (client-side card tokenization) =====
// These are PUBLIC client credentials (safe to ship to the browser). They must
// match the payment processor's Authorize.net account that update_card_on_file
// saves the card to. TEST values below mirror pay.html; swap to production
// (js.authorize.net + production API Login ID / Client Key) before launch.
const ACCEPT_JS_URL = 'https://jstest.authorize.net/v1/Accept.js';
const AUTH_NET_API_LOGIN_ID = '9fxe738GPVX';
const AUTH_NET_CLIENT_KEY = '727jMf46uPcCgbL32yjCDm54Ax928zd6kKh3yaQE29QyX4emHV2vgP6mXS9C47PU';

let _acceptJsPromise = null;
function loadAcceptJs() {
  if (window.Accept) return Promise.resolve();
  if (_acceptJsPromise) return _acceptJsPromise;
  _acceptJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = ACCEPT_JS_URL;
    s.onload = () => resolve();
    s.onerror = () => { _acceptJsPromise = null; reject(new Error('Could not load the secure card library. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return _acceptJsPromise;
}

// Tokenize a card via Accept.js -> resolves opaqueData {dataDescriptor, dataValue}.
function tokenizeCard({ cardNumber, expMonth, expYear, cardCode, zip, fullName }) {
  return new Promise((resolve, reject) => {
    const secureData = {
      authData: { clientKey: AUTH_NET_CLIENT_KEY, apiLoginID: AUTH_NET_API_LOGIN_ID },
      cardData: { cardNumber, month: expMonth, year: expYear, cardCode, zip, fullName }
    };
    window.Accept.dispatchData(secureData, (response) => {
      if (response.messages.resultCode === 'Error') {
        reject(new Error(response.messages.message.map(m => m.text).join(', ')));
      } else {
        resolve(response.opaqueData);
      }
    });
  });
}

async function callApi(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  const res = await fetch('/.netlify/functions/invoices-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function StatusPill({ status, refunded }) {
  if (refunded) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500">Refunded</span>;
  const map = {
    paid:      'bg-green-100 text-green-700',
    used:      'bg-green-100 text-green-700',
    scheduled: 'bg-blue-100 text-blue-700',
    pending:   'bg-amber-100 text-amber-700',
    failed:    'bg-red-100 text-red-700',
    paused:    'bg-amber-100 text-amber-800',
  };
  const cls = map[status] || 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{status || 'unknown'}</span>;
}

function SummaryTile({ label, value, tone = 'default', sub }) {
  const valTone = {
    success: 'text-green-600',
    warn:    'text-amber-600',
    muted:   'text-slate-500',
    danger:  'text-red-600',
    default: 'text-slate-800',
  }[tone] || 'text-slate-800';
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valTone}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function DocFeeCard({ token, isAdmin, onAction }) {
  if (!token) {
    return <p className="text-sm text-slate-400 italic text-center py-4">No payment token found for this deal yet.</p>;
  }
  const isPaid = token.status === 'used' && token.transaction_id;
  const refunded = !!token.refunded_at;
  const leftBorder = refunded ? 'border-l-slate-400 bg-slate-50 opacity-90' : isPaid ? 'border-l-green-500' : 'border-l-slate-300';
  return (
    <div className={`border border-slate-200 border-l-[4px] ${leftBorder} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800">Doc Fee</p>
          <StatusPill status={token.status} refunded={refunded} />
        </div>
        <p className="text-2xl font-bold text-asap-blue">{fmtMoney(token.initial_amount)}</p>
      </div>
      <div className="text-xs text-slate-600 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mb-3">
        {isPaid && (<><span className="text-slate-400">Paid</span><span className="font-semibold">{fmtDate(token.used_at)}</span></>)}
        {token.transaction_id && (<><span className="text-slate-400">Txn ID</span><span className="font-mono text-[11px] truncate" title={token.transaction_id}>{token.transaction_id}</span></>)}
        {token.card_last_4 && (<><span className="text-slate-400">Card</span><span className="font-semibold">{token.card_type || 'Card'} ending {String(token.card_last_4).replace(/X+/, '')}</span></>)}
        {token.zoho_doc_fee_invoice_id && (<><span className="text-slate-400">Zoho Invoice</span><span className="font-mono text-[11px] truncate" title={token.zoho_doc_fee_invoice_id}>{token.zoho_doc_fee_invoice_id}</span></>)}
        {token.zoho_doc_fee_marked_paid_at && (<><span className="text-slate-400">Zoho Marked Paid</span><span className="font-semibold">{fmtDate(token.zoho_doc_fee_marked_paid_at)}</span></>)}
        {refunded && (<><span className="text-slate-400">Refunded</span><span className="font-semibold">{fmtDate(token.refunded_at)}</span></>)}
        {token.refund_reason && (<><span className="text-slate-400">Refund reason</span><span className="font-semibold italic">{token.refund_reason}</span></>)}
      </div>
      {isAdmin && isPaid && !refunded && (
        <div className="pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onAction({ type: 'refund_initial', token_id: token.id, amount: token.initial_amount, cardLast4: token.card_last_4 })}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700"
          >
            <Undo2 size={12} /> Refund {fmtMoney(token.initial_amount)}
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduledChargeCard({ charge, label, isAdmin, canRequest, onAction, pendingApproval }) {
  const c = charge;
  const refunded = !!c.refunded_at;
  const isPaid = c.status === 'paid';
  const isPaused = c.status === 'paused';
  const isFailed = c.status === 'failed';
  const isScheduled = c.status === 'scheduled';

  const leftBorder =
    refunded   ? 'border-l-slate-400 bg-slate-50 opacity-90' :
    pendingApproval ? 'border-l-amber-500 bg-amber-50' :
    isPaid     ? 'border-l-green-500' :
    isScheduled? 'border-l-blue-500' :
    isFailed   ? 'border-l-red-500 bg-red-50' :
    isPaused   ? 'border-l-amber-500 bg-amber-50' :
                 'border-l-slate-300';

  const days = !isPaid && !refunded ? daysUntil(c.due_date) : null;
  let urgency = null;
  if (days != null) {
    if (days < 0) urgency = <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">{Math.abs(days)} days overdue</span>;
    else if (days <= 3) urgency = <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Due in {days} day{days === 1 ? '' : 's'}</span>;
    else urgency = <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">Due in {days} days</span>;
  }

  return (
    <div className={`border border-slate-200 border-l-[4px] ${leftBorder} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800">{label}</p>
          <StatusPill status={c.status} refunded={refunded} />
          {pendingApproval && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" title={`${pendingApproval.request_type === 'pause' ? 'Pause' : 'Date change'} requested by ${pendingApproval.requested_by_name || pendingApproval.requested_by_email}`}>
              <Clock size={11} /> Pending request
            </span>
          )}
          {urgency}
        </div>
        <p className="text-2xl font-bold text-asap-blue">{fmtMoney(c.amount)}</p>
      </div>
      <div className="text-xs text-slate-600 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mb-3">
        <span className="text-slate-400">Due date</span><span className="font-semibold">{fmtDate(c.due_date)}</span>
        {c.charged_at && (<><span className="text-slate-400">Charged</span><span className="font-semibold">{fmtDate(c.charged_at)}</span></>)}
        {c.transaction_id && (<><span className="text-slate-400">Txn ID</span><span className="font-mono text-[11px] truncate" title={c.transaction_id}>{c.transaction_id}</span></>)}
        {c.zoho_invoice_id && (<><span className="text-slate-400">Zoho Invoice</span><span className="font-mono text-[11px] truncate" title={c.zoho_invoice_id}>{c.zoho_invoice_id}</span></>)}
        {c.pause_until_date && !c.pause_indefinite && (<><span className="text-slate-400">Paused until</span><span className="font-semibold">{fmtDate(c.pause_until_date)}</span></>)}
        {c.pause_indefinite && (<><span className="text-slate-400">Paused</span><span className="font-semibold">Indefinitely</span></>)}
        {c.pause_reason && (<><span className="text-slate-400">Pause reason</span><span className="italic">{c.pause_reason}</span></>)}
        {refunded && (<><span className="text-slate-400">Refunded</span><span className="font-semibold">{fmtDate(c.refunded_at)}</span></>)}
        {c.refund_reason && (<><span className="text-slate-400">Refund reason</span><span className="italic">{c.refund_reason}</span></>)}
      </div>

      {c.last_decline_reason && !isPaid && (
        <div className="mb-3 p-2 rounded border border-red-200 bg-red-50 text-xs text-red-700">
          <span className="font-semibold">Last decline:</span> {c.last_decline_reason}{c.retry_count ? ` · retry ${c.retry_count}` : ''}
        </div>
      )}

      {/* Admin direct actions */}
      {isAdmin && !refunded && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          {(isScheduled || isFailed) && (
            <>
              {c.customer_profile_id ? (
                <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                  <Zap size={12} /> Charge Now
                </button>
              ) : (
                <button onClick={() => onAction({ type: 'add_card', deal_id, client_name, client_email })}
                  title="No card on file yet. Add a card before charging."
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                  <DollarSign size={12} /> Add card to charge
                </button>
              )}
              <button onClick={() => onAction({ type: 'update_due_date', charge_id: c.id, current_due_date: c.due_date, amount: c.amount })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <CalendarClock size={12} /> Edit Date
              </button>
              <button onClick={() => onAction({ type: 'split_charge', charge_id: c.id, amount: c.amount, current_due_date: c.due_date })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded hover:bg-purple-700">
                <Undo2 size={12} /> Split
              </button>
              <button onClick={() => onAction({ type: 'pause_admin', charge_id: c.id, current_due_date: c.due_date, amount: c.amount })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700">
                <PauseCircle size={12} /> Pause
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={() => onAction({ type: 'resume', charge_id: c.id, amount: c.amount })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                <PlayCircle size={12} /> Resume
              </button>
              <button onClick={() => onAction({ type: 'update_due_date', charge_id: c.id, current_due_date: c.due_date, amount: c.amount })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <CalendarClock size={12} /> Edit Date
              </button>
            </>
          )}
          {isPaid && (
            <button onClick={() => onAction({ type: 'refund_scheduled', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700">
              <Undo2 size={12} /> Refund {fmtMoney(c.amount)}
            </button>
          )}
        </div>
      )}

      {/* Non-admin (AM / Consultant) request buttons - only on charges that aren't paid/refunded */}
      {!isAdmin && canRequest && !refunded && !isPaid && (
        pendingApproval ? (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 inline-flex items-center gap-1">
              <Clock size={12} /> A {pendingApproval.request_type === 'pause' ? 'pause' : 'date change'} request is already pending leadership approval. No new request can be made until it's decided.
            </p>
          </div>
        ) : (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            <button onClick={() => onAction({ type: 'request_date_change', charge_id: c.id, current_due_date: c.due_date, amount: c.amount, label })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
              <CalendarClock size={12} /> Request date change
            </button>
            <button onClick={() => onAction({ type: 'request_pause', charge_id: c.id, current_due_date: c.due_date, amount: c.amount, label })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-500 rounded hover:bg-amber-50">
              <PauseCircle size={12} /> Request pause
            </button>
            <span className="text-[11px] text-slate-400 self-center">Requires leadership approval</span>
          </div>
        )
      )}
    </div>
  );
}

function ActivitiesSection({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-3 pb-3 border-b border-slate-100">Pipedrive Activities</h3>
        <p className="text-sm text-slate-400 italic text-center py-4">No open activities on this deal.</p>
      </div>
    );
  }
  const open = activities.filter(a => !a.done);
  const sortedOpen = [...open].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-asap-blue">Pipedrive Activities</h3>
        <span className="text-xs text-slate-500">({sortedOpen.length} open)</span>
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><AlarmClock size={12} /> Open / Upcoming</p>
      <div className="space-y-2">
        {sortedOpen.slice(0, 12).map(a => {
          const days = daysUntil(a.due_date);
          const overdue = days != null && days < 0;
          return (
            <div key={a.id} className={`flex items-start gap-3 p-2 rounded border ${overdue ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${overdue ? 'bg-red-200 text-red-700' : 'bg-slate-200 text-slate-500'}`}>
                {overdue ? <AlertTriangle size={14} /> : <Clock size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate" title={a.subject}>{a.subject || '(no subject)'}</p>
                <p className="text-[11px] text-slate-500">{a.type_name || a.type || 'Activity'}</p>
                <p className={`text-[11px] ${overdue ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                  {overdue ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue — was due ${fmtDate(a.due_date)}` :
                    days === 0 ? `Due today (${fmtDate(a.due_date)})` :
                    days != null ? `Due in ${days} day${days === 1 ? '' : 's'} (${fmtDate(a.due_date)})` :
                    a.due_date ? fmtDate(a.due_date) : ''}
                </p>
              </div>
            </div>
          );
        })}
        {sortedOpen.length > 12 && <p className="text-[11px] text-slate-400 italic text-center pt-1">+{sortedOpen.length - 12} more, see Pipedrive</p>}
      </div>
    </div>
  );
}

function NotesSection({ notes }) {
  const [expanded, setExpanded] = useState(false);
  if (!notes || notes.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-3 pb-3 border-b border-slate-100">Recent Notes</h3>
        <p className="text-sm text-slate-400 italic text-center py-4">No notes on this deal yet.</p>
      </div>
    );
  }
  const sorted = [...notes].sort((a, b) => (b.add_time || '').localeCompare(a.add_time || ''));
  const shown = expanded ? sorted : sorted.slice(0, 3);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-asap-blue">Recent Notes</h3>
        {sorted.length > 3 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-asap-blue hover:underline inline-flex items-center gap-1">
            {expanded ? <>Show recent only <ChevronUp size={12} /></> : <>Show all {sorted.length} <ChevronDown size={12} /></>}
          </button>
        )}
      </div>
      <div className="space-y-3">
        {shown.map(n => (
          <div key={n.id} className="p-3 rounded bg-slate-50 border border-slate-100">
            <p className="text-[11px] text-slate-500 mb-1">{fmtDateTime(n.add_time)}</p>
            <div className="text-sm text-slate-700 [&_a]:text-asap-blue [&_a]:underline [&_p]:my-1 [&_b]:font-semibold prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: n.content || '' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DealView({ data, isAdmin, canRequest, onAction, pendingByCharge = {} }) {
  const { deal_id, client_name, client_email, client_phone, initial_payment, scheduled_charges = [], doc_fee, has_card_on_file, activities = [], notes = [], other_invoices = [] } = data;
  const token = initial_payment;

  let collected = 0, pending = 0, refunded = 0;
  if (token && token.status === 'used' && token.transaction_id && !token.refunded_at) collected += parseFloat(token.initial_amount || 0);
  if (token && token.refunded_at) refunded += parseFloat(token.initial_amount || 0);
  scheduled_charges.forEach(c => {
    const amt = parseFloat(c.amount || 0);
    if (c.refunded_at) refunded += amt;
    else if (c.status === 'paid') collected += amt;
    else if (['scheduled', 'failed', 'paused'].includes(c.status)) pending += amt;
  });
  const lifetime = collected + pending + refunded;

  const cardOnFile = token && token.card_last_4 ? `${token.card_type || 'Card'} ending in ${String(token.card_last_4).replace(/X+/, '')}` : 'No card on file yet';

  const sortedCharges = [...scheduled_charges].sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));

  return (
    <div className="space-y-5">
      {doc_fee && (
        doc_fee.paid ? (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-green-200 bg-green-50">
            <CheckCircle2 size={20} className="text-green-600 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-semibold">Doc fee: PAID{doc_fee.invoice_number ? ` (Invoice ${doc_fee.invoice_number})` : ''}</p>
              <p className="text-xs mt-1">First payment confirmed in Zoho.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
            <AlertTriangle size={20} className="text-red-600 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">Doc fee: NOT PAID{doc_fee.invoice_number ? ` (Invoice ${doc_fee.invoice_number})` : ''}.</p>
              <p className="text-xs mt-1">
                {typeof doc_fee.balance === 'number' ? `Balance due $${doc_fee.balance.toFixed(2)}. ` : ''}
                Collect the client's card before starting services.
                {!has_card_on_file ? ' No card on file yet.' : ''}
              </p>
            </div>
          </div>
        )
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-asap-blue">Client Information</h3>
          <div className="flex items-center gap-3">
            {!has_card_on_file && (isAdmin || canRequest) && (
              <button
                onClick={() => onAction({ type: 'add_card', deal_id, client_name, client_email })}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-asap-blue text-white text-xs font-semibold rounded hover:bg-blue-800"
              >
                <DollarSign size={13} /> Add Card on File
              </button>
            )}
            {has_card_on_file && (isAdmin || canRequest) && (
              <button
                onClick={() => onAction({ type: 'update_card', deal_id, client_name, client_email })}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-asap-blue border border-asap-blue text-xs font-semibold rounded hover:bg-blue-50"
              >
                <DollarSign size={13} /> Update Card
              </button>
            )}
            {(isAdmin || canRequest) && !(doc_fee && doc_fee.paid) && (
              <button
                onClick={() => onAction({ type: 'send_payment_form', deal_id, client_name, client_email, client_phone, amount: (doc_fee && typeof doc_fee.balance === 'number' && doc_fee.balance > 0) ? doc_fee.balance : parseFloat((initial_payment && initial_payment.initial_amount) || 0) })}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700"
              >
                <Send size={13} /> Send to Client
              </button>
            )}
            <a href={DEAL_URL(deal_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-asap-blue hover:underline">Open in Pipedrive <ExternalLink size={12} /></a>
          </div>
        </div>
        <dl className="text-sm">
          {[['Deal ID', deal_id], ['Name', client_name || 'N/A'], ['Email', client_email || 'N/A'], ['Phone', client_phone || 'N/A'], ['Card on file', cardOnFile]].map(([k, v]) => (
            <div key={k} className="flex py-2 border-b border-slate-50 last:border-b-0">
              <dt className="w-40 text-slate-500 font-medium">{k}</dt>
              <dd className="flex-1 text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-4 pb-3 border-b border-slate-100">Summary</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile label="Total Collected" value={fmtMoney(collected)} tone="success" sub="Successfully charged" />
          <SummaryTile label="Outstanding" value={fmtMoney(pending)} tone="warn" sub="Pending charges" />
          <SummaryTile label="Refunded" value={fmtMoney(refunded)} tone="muted" sub={refunded > 0 ? 'Returned to client' : 'No refunds yet'} />
          <SummaryTile label="Total Lifetime" value={fmtMoney(lifetime)} sub="Original contract value" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-4 pb-3 border-b border-slate-100">Initial Payment (Doc Fee)</h3>
        <DocFeeCard token={token} isAdmin={isAdmin} onAction={onAction} />
      </div>

      {other_invoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-base font-semibold text-asap-blue mb-1 pb-3 border-b border-slate-100">Other Invoices ({other_invoices.length})</h3>
          <p className="text-xs text-slate-400 mt-2 mb-3">Partial / final invoices in Zoho for this client. Shown here even before a card is on file or a payment is scheduled.</p>
          <div className="space-y-3">
            {other_invoices.map((inv) => {
              const paid = inv.paid;
              const days = !paid ? daysUntil(inv.due_date) : null;
              return (
                <div key={inv.invoice_id}
                  className={`border border-slate-200 border-l-[4px] rounded-lg p-4 ${paid ? 'border-l-green-500' : 'border-l-amber-500 bg-amber-50/40'}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-800">{inv.invoice_number ? `Invoice ${inv.invoice_number}` : 'Invoice'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {inv.due_date ? `Due ${fmtDate(inv.due_date)}` : (inv.date ? `Dated ${fmtDate(inv.date)}` : '')}
                        {!paid && days != null && days < 0 && <span className="text-red-600 font-semibold"> · {Math.abs(days)} days overdue</span>}
                        {!paid && days != null && days >= 0 && <span className="text-amber-700 font-semibold"> · due in {days} day{days === 1 ? '' : 's'}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                        {paid ? 'Paid' : (inv.status || 'Unpaid')}
                      </span>
                      <span className="text-xl font-bold text-asap-blue">{fmtMoney(inv.total)}</span>
                    </div>
                  </div>
                  {!paid && inv.balance != null && inv.balance !== inv.total && (
                    <p className="text-xs text-slate-500 mt-2">Balance due {fmtMoney(inv.balance)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-4 pb-3 border-b border-slate-100">Scheduled Payments ({sortedCharges.length})</h3>
        {sortedCharges.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-4">No scheduled payments for this deal.</p>
        ) : (
          <div className="space-y-3">
            {sortedCharges.map((c, i) => (
              <ScheduledChargeCard
                key={c.id || i}
                charge={c}
                label={chargeLabel(i, sortedCharges.length)}
                isAdmin={isAdmin}
                canRequest={canRequest}
                onAction={onAction}
                pendingApproval={pendingByCharge[c.id]}
              />
            ))}
          </div>
        )}
      </div>

      <ActivitiesSection activities={activities} />
      <NotesSection notes={notes} />
    </div>
  );
}

function BrowseView({ data, filter, onFilterChange, isAdmin, canRequest, onAction, pendingByCharge = {} }) {
  const term = (filter || '').toLowerCase().trim();
  const matches = (obj) => !term ||
    (obj.client_name || '').toLowerCase().includes(term) ||
    (obj.client_email || '').toLowerCase().includes(term) ||
    String(obj.pipedrive_deal_id || '').toLowerCase().includes(term);

  const tokens = (data.tokens || []).filter(matches);
  const charges = (data.charges || []).filter(matches);

  let collected = 0, pending = 0, refunded = 0;
  (data.tokens || []).forEach(t => {
    if (t.refunded_at) refunded += parseFloat(t.initial_amount || 0);
    else if (t.status === 'used' && t.transaction_id) collected += parseFloat(t.initial_amount || 0);
  });
  (data.charges || []).forEach(c => {
    const amt = parseFloat(c.amount || 0);
    if (c.refunded_at) refunded += amt;
    else if (c.status === 'paid') collected += amt;
    else if (['scheduled', 'failed', 'paused'].includes(c.status)) pending += amt;
  });

  const allItems = [];
  tokens.forEach(t => allItems.push({ type: 'token', item: t, sortDate: t.created_at || '1970-01-01' }));
  charges.forEach(c => allItems.push({ type: 'charge', item: c, sortDate: c.due_date || c.created_at || '1970-01-01' }));
  allItems.sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-asap-blue">All Invoices <span className="text-xs font-normal text-slate-500">(last {data.days_back || 90} days)</span></h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SummaryTile label="Total Collected" value={fmtMoney(collected)} tone="success" />
        <SummaryTile label="Outstanding" value={fmtMoney(pending)} tone="warn" />
        <SummaryTile label="Refunded" value={fmtMoney(refunded)} tone="muted" />
        <SummaryTile label="Total Records" value={(data.tokens || []).length + (data.charges || []).length} />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-500 mb-1">Filter by client name, email, or deal ID</label>
        <input
          type="text"
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
          placeholder="Start typing to filter..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {allItems.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">No invoices match your search.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Deal</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Due / Date</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((entry, idx) => {
                const i = entry.item;
                const isToken = entry.type === 'token';
                const isPaid = isToken ? (i.status === 'used' && i.transaction_id) : i.status === 'paid';
                const days = !isPaid && !i.refunded_at ? daysUntil(i.due_date) : null;
                const dueWarn = days != null && days < 0 ? 'text-red-600' : days != null && days <= 3 ? 'text-amber-600' : 'text-slate-600';
                const pendingReq = !isToken ? pendingByCharge[i.id] : null;
                const rowTint = pendingReq ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50';
                // Inline action availability mirrors the per-deal card rules.
                const canAdminAct = isAdmin && !i.refunded_at && !isToken;
                const canAmRequest = canRequest && !isAdmin && !isToken && !i.refunded_at && i.status !== 'paid';
                return (
                  <tr key={`${entry.type}-${i.id || idx}`} className={`border-b border-slate-50 ${rowTint}`}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{i.client_name || 'Unknown'}</p>
                      {i.client_email && <p className="text-[11px] text-slate-500">{i.client_email}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <a href={DEAL_URL(i.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="font-mono text-xs font-semibold text-asap-blue hover:underline">#{i.pipedrive_deal_id || '?'}</a>
                      {i.pipedrive_deal_id && (
                        <a href={`/invoices?deal=${i.pipedrive_deal_id}`}
                          className="block text-[10px] text-slate-500 hover:text-asap-blue hover:underline mt-0.5">
                          View invoices →
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isToken
                        ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">Doc Fee</span>
                        : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700">Pmt #{i.sequence_number || '?'}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney(isToken ? i.initial_amount : i.amount)}</td>
                    <td className={`px-3 py-2 text-xs ${dueWarn}`}>
                      {isToken
                        ? (i.used_at ? fmtDate(i.used_at) : fmtDate(i.created_at))
                        : fmtDate(i.due_date)}
                      {days != null && days < 0 && <span className="block text-[10px] font-semibold">{Math.abs(days)}d overdue</span>}
                      {days != null && days >= 0 && days <= 3 && <span className="block text-[10px] font-semibold">in {days}d</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusPill status={i.status} refunded={!!i.refunded_at} />
                        {pendingReq && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800" title={`${pendingReq.request_type === 'pause' ? 'Pause' : 'Date change'} requested by ${pendingReq.requested_by_name || pendingReq.requested_by_email}`}>
                            <Clock size={10} /> Pending request
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {(isAdmin || canRequest) && isToken && !(i.status === 'used' && i.transaction_id) && (
                        <button onClick={() => onAction({ type: 'send_payment_form', deal_id: i.pipedrive_deal_id, client_name: i.client_name, client_email: i.client_email, client_phone: i.client_phone, amount: (isToken ? i.initial_amount : i.amount) })}
                          className="inline-flex items-center gap-1 px-2 py-1 mr-1 text-[11px] font-semibold text-white bg-green-600 rounded hover:bg-green-700" title="Send payment form to client">
                          <Send size={11} /> Send
                        </button>
                      )}
                      {canAdminAct ? (
                        <div className="inline-flex gap-1">
                          {(i.status === 'scheduled' || i.status === 'failed' || i.status === 'paused') && (
                            <button onClick={() => onAction({ type: 'update_due_date', charge_id: i.id, current_due_date: i.due_date, amount: i.amount })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50" title="Edit due date">
                              <CalendarClock size={11} /> Date
                            </button>
                          )}
                          {(i.status === 'scheduled' || i.status === 'failed') && (
                            <button onClick={() => onAction({ type: 'pause_admin', charge_id: i.id, current_due_date: i.due_date, amount: i.amount })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-amber-600 rounded hover:bg-amber-700" title="Pause">
                              <PauseCircle size={11} /> Pause
                            </button>
                          )}
                          {i.status === 'paused' && (
                            <button onClick={() => onAction({ type: 'resume', charge_id: i.id, amount: i.amount })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-green-600 rounded hover:bg-green-700" title="Resume">
                              <PlayCircle size={11} /> Resume
                            </button>
                          )}
                        </div>
                      ) : canAmRequest ? (
                        pendingReq ? (
                          <span className="text-[10px] text-amber-700 italic">Awaiting approval</span>
                        ) : (
                          <div className="inline-flex gap-1">
                            <button onClick={() => onAction({ type: 'request_date_change', charge_id: i.id, current_due_date: i.due_date, amount: i.amount, label: `Pmt #${i.sequence_number || ''}` })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50" title="Request date change">
                              <CalendarClock size={11} /> Date
                            </button>
                            <button onClick={() => onAction({ type: 'request_pause', charge_id: i.id, current_due_date: i.due_date, amount: i.amount, label: `Pmt #${i.sequence_number || ''}` })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-700 bg-white border border-amber-500 rounded hover:bg-amber-50" title="Request pause">
                              <PauseCircle size={11} /> Pause
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Card modal (self-contained: loads Accept.js, tokenizes, saves card)
// ---------------------------------------------------------------------------
function AddCardModal({ info, onClose, onSaved, mode = 'add' }) {
  const isUpdate = mode === 'update';
  const [form, setForm] = useState({
    cardholderName: info.client_name || '',
    cardNumber: '', expiry: '', cvv: '', zip: ''
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAcceptJs().then(() => { if (alive) setReady(true); })
      .catch((e) => { if (alive) setNotice({ type: 'error', text: e.message }); });
    return () => { alive = false; };
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setNotice(null);
    const num = form.cardNumber.replace(/\s/g, '');
    const exp = form.expiry.replace(/\s/g, '');
    if (!form.cardholderName.trim()) return setNotice({ type: 'error', text: 'Cardholder name is required.' });
    if (num.length < 13) return setNotice({ type: 'error', text: 'Enter a valid card number.' });
    if (exp.length !== 4) return setNotice({ type: 'error', text: 'Enter expiry as MMYY (e.g. 0828).' });
    if (form.cvv.length < 3) return setNotice({ type: 'error', text: 'Enter the card security code.' });
    if (!form.zip.trim()) return setNotice({ type: 'error', text: 'Billing ZIP is required.' });

    setBusy(true);
    try {
      const opaqueData = await tokenizeCard({
        cardNumber: num,
        expMonth: exp.substring(0, 2),
        expYear: exp.substring(2, 4),
        cardCode: form.cvv,
        zip: form.zip,
        fullName: form.cardholderName
      });
      await callApi(isUpdate ? 'update_card_on_file' : 'collect_and_save_card', {
        deal_id: info.deal_id,
        opaqueData,
        cardholderName: form.cardholderName,
        billingAddress: { zip: form.zip, country: 'USA' }
      });
      setNotice({ type: 'success', text: isUpdate
        ? 'Card updated. Upcoming scheduled payments will use the new card.'
        : 'Card saved to file. Scheduled payments can now be charged to it.' });
      setTimeout(() => { onSaved && onSaved(); }, 1300);
    } catch (e) {
      setNotice({ type: 'error', text: e.message || 'Could not save the card.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-asap-blue mb-1">{isUpdate ? 'Update Card on File' : 'Add Card on File'}</h3>
        <p className="text-sm text-slate-600 mb-4">
          {info.client_name || 'Client'}{info.client_email ? ` · ${info.client_email}` : ''}
          <span className="block text-xs text-slate-500 mt-1">{isUpdate
            ? 'The new card replaces the current one for all upcoming scheduled payments. No charge is made now.'
            : 'The card is saved securely for future scheduled payments. No charge is made now.'}</span>
        </p>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Cardholder name</label>
          <input type="text" value={form.cardholderName} onChange={e => set('cardholderName', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Card number</label>
          <input type="text" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456"
            value={form.cardNumber} onChange={e => set('cardNumber', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Expiry (MMYY)</label>
            <input type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="0828" maxLength={4}
              value={form.expiry} onChange={e => set('expiry', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">CVV</label>
            <input type="text" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4}
              value={form.cvv} onChange={e => set('cvv', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Billing ZIP</label>
            <input type="text" inputMode="numeric" autoComplete="postal-code" placeholder="77094"
              value={form.zip} onChange={e => set('zip', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
          </div>
        </div>

        {notice && (
          <div className={`p-2 rounded text-sm mb-3 ${notice.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {notice.text}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={busy || !ready}
            className="px-4 py-2 text-sm font-semibold text-white rounded bg-asap-blue hover:bg-blue-800 disabled:opacity-60">
            {busy ? 'Saving...' : (ready ? (isUpdate ? 'Update Card' : 'Save Card') : 'Loading...')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Invoices() {
  const { currentUser } = useApp();

  const isRestrictedLeader = RESTRICTED_LEADER_IDS.includes(currentUser?.id);
  // Admin (in the Playbook UI sense): can take direct actions on invoices.
  // Mariana and Kim are restricted leaders even if they're "admin" elsewhere.
  const isAdmin = !!currentUser && (currentUser.role === 'admin' || currentUser.department === 'leadership') && !isRestrictedLeader;
  // AMs and Consultants (and restricted leaders) can REQUEST changes through approvals.
  const canRequest = !!currentUser && !isAdmin && (
    currentUser.department === 'account_managers' ||
    currentUser.department === 'credit_consultants' ||
    currentUser.role === 'account_manager' ||
    isRestrictedLeader
  );

  const initialDeal = (() => {
    try { return new URLSearchParams(window.location.search).get('deal') || ''; } catch { return ''; }
  })();
  const [dealInput, setDealInput] = useState(initialDeal);
  const [dealData, setDealData] = useState(null);
  const [browseData, setBrowseData] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState(initialDeal ? 'lookup' : 'browse');

  // Map of charge_id -> pending approval (so a charge that already has an open
  // request shows a badge and blocks a duplicate). Loaded alongside invoices.
  const [pendingByCharge, setPendingByCharge] = useState({});

  const loadPendingApprovals = async () => {
    try {
      const d = await callApi('list_pending_approvals');
      const arr = Array.isArray(d) ? d : (d.approvals || d.data || d.rows || []);
      const map = {};
      arr.forEach(a => {
        if ((a.status || 'pending') === 'pending' && a.charge_id != null) {
          // keep the first/most relevant pending request per charge
          if (!map[a.charge_id]) map[a.charge_id] = a;
        }
      });
      setPendingByCharge(map);
    } catch (e) {
      // non-fatal: if approvals can't load, charges just won't show the badge
      setPendingByCharge({});
    }
  };

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const openAction = (info) => {
    setModal(info);
    if (info.type === 'update_due_date') setForm({ new_due_date: '' });
    else if (info.type === 'split_charge') setForm({ partial_amount: '', remainder_date: '' });
    else if (info.type === 'pause_admin') setForm({ pause_until_date: '', pause_indefinite: false });
    else if (info.type === 'request_date_change') setForm({ new_due_date: '', reason: '' });
    else if (info.type === 'request_pause') setForm({ pause_until_date: '', pause_indefinite: false, reason: '' });
    else if (info.type === 'refund_initial' || info.type === 'refund_scheduled') setForm({ reason: '', passcode: '' });
    else if (info.type === 'charge_now') setForm({});
    else if (info.type === 'resume') setForm({});
    setNotice(null);
  };

  const submitAction = async () => {
    if (!modal) return;
    setBusy(true); setNotice(null);
    try {
      if (modal.type === 'update_due_date') {
        if (!form.new_due_date) throw new Error('Pick a new due date');
        await callApi('update_due_date', { charge_id: modal.charge_id, due_date: form.new_due_date });
        setNotice({ type: 'success', text: 'Due date updated.' });
      } else if (modal.type === 'pause_admin') {
        if (!form.pause_indefinite && !form.pause_until_date) throw new Error('Set a pause-until date or check Indefinite');
        // Admin direct pause via the request_pause handler which applies immediately for admins.
        await callApi('request_pause', {
          charge_id: modal.charge_id,
          pause_indefinite: form.pause_indefinite,
          pause_until_date: form.pause_indefinite ? null : form.pause_until_date,
          reason: 'Direct admin pause'
        });
        setNotice({ type: 'success', text: 'Charge paused.' });
      } else if (modal.type === 'resume') {
        await callApi('resume', { charge_id: modal.charge_id });
        setNotice({ type: 'success', text: 'Charge resumed.' });
      } else if (modal.type === 'charge_now') {
        await callApi('charge_now', { charge_id: modal.charge_id });
        setNotice({ type: 'success', text: 'Charge submitted.' });
      } else if (modal.type === 'refund_initial') {
        if (!form.reason || form.reason.trim().length < 3) throw new Error('Reason required (3+ chars)');
        if (!form.passcode) throw new Error('Manager passcode required');
        await callApi('refund_initial', { token_id: modal.token_id, reason: form.reason, passcode: form.passcode });
        setNotice({ type: 'success', text: 'Refund submitted.' });
      } else if (modal.type === 'refund_scheduled') {
        if (!form.reason || form.reason.trim().length < 3) throw new Error('Reason required (3+ chars)');
        if (!form.passcode) throw new Error('Manager passcode required');
        await callApi('refund_scheduled', { charge_id: modal.charge_id, reason: form.reason, passcode: form.passcode });
        setNotice({ type: 'success', text: 'Refund submitted.' });
      } else if (modal.type === 'request_date_change') {
        if (pendingByCharge[modal.charge_id]) throw new Error('This payment already has a pending request awaiting approval. Only one request at a time.');
        if (!form.new_due_date) throw new Error('Pick a new due date');
        if (!form.reason || form.reason.trim().length < 3) throw new Error('Reason required (3+ chars)');
        const r = await callApi('request_date_change', { charge_id: modal.charge_id, new_due_date: form.new_due_date, reason: form.reason });
        setNotice({ type: 'success', text: r.message || 'Request submitted for approval.' });
      } else if (modal.type === 'request_pause') {
        if (pendingByCharge[modal.charge_id]) throw new Error('This payment already has a pending request awaiting approval. Only one request at a time.');
        if (!form.pause_indefinite && !form.pause_until_date) throw new Error('Set a pause-until date or check Indefinite');
        if (!form.reason || form.reason.trim().length < 3) throw new Error('Reason required (3+ chars)');
        const r = await callApi('request_pause', {
          charge_id: modal.charge_id,
          pause_indefinite: form.pause_indefinite,
          pause_until_date: form.pause_indefinite ? null : form.pause_until_date,
          reason: form.reason
        });
        setNotice({ type: 'success', text: r.message || 'Pause request submitted for approval.' });
      } else if (modal.type === 'send_payment_form') {
        if (!modal.channel) throw new Error('Choose SMS, Email, or Both');
        if (modal.channel === 'email' && !modal.client_email) throw new Error('No email on file for this client');
        if (modal.channel === 'sms' && !modal.client_phone) throw new Error('No phone on file for this client');
        const r = await callApi('send_payment_form', { deal_id: modal.deal_id, client_name: modal.client_name, client_email: modal.client_email, client_phone: modal.client_phone, amount: modal.amount, channel: modal.channel });
        const sentVia = [r.sentSms && 'SMS', r.sentEmail && 'email'].filter(Boolean).join(' and ');
        setNotice({ type: 'success', text: `Payment form sent via ${sentVia || 'the selected channel'}.` });
      } else if (modal.type === 'split_charge') {
        const partial = parseFloat(form.partial_amount);
        const orig = parseFloat(modal.amount);
        if (!(partial > 0)) throw new Error('Enter a partial amount greater than 0');
        if (partial >= orig) throw new Error('Partial must be less than the charge amount');
        if (!form.remainder_date) throw new Error('Choose a date for the remainder');
        await callApi('split_charge', { charge_id: modal.charge_id, partial_amount: partial, remainder_date: form.remainder_date });
        setNotice({ type: 'success', text: 'Split into $' + partial.toFixed(2) + ' and $' + (orig - partial).toFixed(2) + '.' });
      }
      setTimeout(() => { setModal(null); loadPendingApprovals(); if (mode === 'browse') browse(); else lookup(dealInput); }, 1400);
    } catch (e) {
      setNotice({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const lookup = async (idOverride) => {
    const id = (idOverride ?? dealInput).trim();
    if (!id) { setErr('Enter a Pipedrive Deal ID.'); return; }
    setLoading(true); setErr(null); setBrowseData(null); setMode('lookup');
    try {
      const [data] = await Promise.all([callApi('get_deal', { deal_id: id }), loadPendingApprovals()]);
      setDealData(data);
    } catch (e) {
      setErr(e.message); setDealData(null);
    } finally { setLoading(false); }
  };

  const browse = async () => {
    setLoading(true); setErr(null); setDealData(null); setMode('browse');
    try {
      const [data] = await Promise.all([callApi('list_recent_invoices', { filters: { days_back: 90 } }), loadPendingApprovals()]);
      setBrowseData(data);
    } catch (e) {
      setErr(e.message); setBrowseData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (initialDeal) lookup(initialDeal);
    else browse(); // default to All Invoices on open, no click needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalTitles = {
    send_payment_form: 'Send Payment Form to Client',
    update_due_date: 'Edit Due Date',
    pause_admin: 'Pause Invoice',
    resume: 'Resume Invoice',
    charge_now: 'Charge Now',
    refund_initial: 'Refund Doc Fee',
    refund_scheduled: 'Refund Payment',
    request_date_change: 'Request date change',
    request_pause: 'Request pause',
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <FileText size={28} className="text-asap-blue" />
          Invoices
        </h1>
        <p className="text-slate-500 text-sm">
          {isAdmin
            ? 'Look up a client and take direct action on their doc fee and scheduled payments.'
            : canRequest
              ? 'Look up a client to view their invoices. Use Request date change or Request pause on any unpaid charge to send it to leadership for approval.'
              : 'Track doc fees and scheduled payments. Read-only.'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Pipedrive Deal ID</label>
            <input
              type="text"
              value={dealInput}
              onChange={e => setDealInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') lookup(); }}
              placeholder="e.g. 265795"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => lookup()} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-asap-blue text-white text-sm font-semibold rounded hover:bg-blue-800 disabled:opacity-60">
              <Search size={16} /> Look Up
            </button>
            <button onClick={browse} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-asap-blue border border-asap-blue text-sm font-semibold rounded hover:bg-blue-50 disabled:opacity-60">
              <FileText size={16} /> Show All Invoices
            </button>
          </div>
        </div>
        {err && (
          <div className="mt-3 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw size={20} className="inline animate-spin mr-2" />
          Loading...
        </div>
      )}

      {!loading && mode === 'lookup' && dealData && <DealView data={dealData} isAdmin={isAdmin} canRequest={canRequest} onAction={openAction} pendingByCharge={pendingByCharge} />}
      {!loading && mode === 'browse' && browseData && <BrowseView data={browseData} filter={filter} onFilterChange={setFilter} isAdmin={isAdmin} canRequest={canRequest} onAction={openAction} pendingByCharge={pendingByCharge} />}

      {!loading && !dealData && !browseData && !err && (
        <div className="text-center py-12 text-slate-400 text-sm italic">
          Look up a deal by ID or show all invoices from the last 90 days.
        </div>
      )}

      {modal && (modal.type === 'add_card' || modal.type === 'update_card') && (
        <AddCardModal
          info={modal}
          mode={modal.type === 'update_card' ? 'update' : 'add'}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); if (mode === 'browse') browse(); else lookup(dealInput); }}
        />
      )}

      {modal && modal.type !== 'add_card' && modal.type !== 'update_card' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && setModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-asap-blue mb-1">{modalTitles[modal.type] || modal.type}</h3>
            <p className="text-sm text-slate-600 mb-4">
              {modal.label ? `${modal.label} — ` : ''}{fmtMoney(modal.amount)}
              {modal.current_due_date && <span className="text-slate-500"> · current due {fmtDate(modal.current_due_date)}</span>}
              {(modal.type === 'request_date_change' || modal.type === 'request_pause') && <span className="block text-xs text-slate-500 mt-1">Leadership will review before any change is applied.</span>}
              {modal.type === 'charge_now' && <span className="block text-xs text-amber-700 mt-1">This will attempt to charge the card on file immediately.</span>}
              {(modal.type === 'refund_initial' || modal.type === 'refund_scheduled') && <span className="block text-xs text-amber-700 mt-1">This will refund {fmtMoney(modal.amount)} {modal.cardLast4 ? `to the card ending in ${String(modal.cardLast4).replace(/X+/, '')}` : ''}. Manager passcode required.</span>}
            </p>

            {(modal.type === 'update_due_date' || modal.type === 'request_date_change') && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">New due date</label>
                <input type="date" value={form.new_due_date || ''} onChange={e => setForm({ ...form, new_due_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            )}

            {modal.type === 'split_charge' && (
              <>
                <div className="mb-3 text-sm text-slate-600">
                  Original charge: <b>${(parseFloat(modal.amount) || 0).toFixed(2)}</b> due {fmtDate(modal.current_due_date)}.
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Pay now (partial amount)</label>
                  <input type="number" step="0.01" min="0.01" value={form.partial_amount || ''} onChange={e => setForm({ ...form, partial_amount: e.target.value })}
                    placeholder="e.g. 150.00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <p className="text-[11px] text-slate-500 mt-1">Charges on the original due date ({fmtDate(modal.current_due_date)}).</p>
                </div>
                <div className="mb-3 px-3 py-2 bg-slate-50 rounded text-sm">
                  Remainder: <b>${Math.max(0, (parseFloat(modal.amount) || 0) - (parseFloat(form.partial_amount) || 0)).toFixed(2)}</b>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Charge remainder on</label>
                  <input type="date" value={form.remainder_date || ''} onChange={e => setForm({ ...form, remainder_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                </div>
              </>
            )}

            {(modal.type === 'pause_admin' || modal.type === 'request_pause') && (
              <>
                <div className="mb-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={!!form.pause_indefinite} onChange={e => setForm({ ...form, pause_indefinite: e.target.checked })} />
                    Pause indefinitely
                  </label>
                </div>
                {!form.pause_indefinite && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Pause until</label>
                    <input type="date" value={form.pause_until_date || ''} onChange={e => setForm({ ...form, pause_until_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  </div>
                )}
              </>
            )}

            {modal.type === 'send_payment_form' && (
              <div className="mb-4 space-y-3">
                <p className="text-sm text-slate-600">Send the payment form link to <b>{modal.client_name}</b> for {fmtMoney(modal.amount)}.</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ id: 'sms', label: 'Text (SMS)', disabled: !modal.client_phone }, { id: 'email', label: 'Email', disabled: !modal.client_email }, { id: 'both', label: 'Both', disabled: !modal.client_phone || !modal.client_email }].map(opt => (
                    <button key={opt.id} type="button" disabled={opt.disabled} onClick={() => setModal(m => ({ ...m, channel: opt.id }))}
                      className={`px-3 py-2 rounded-md text-sm font-medium border transition ${modal.channel === opt.id ? 'bg-asap-blue text-white border-asap-blue' : opt.disabled ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-200 hover:border-asap-blue'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Phone: {modal.client_phone || <span className="text-slate-400">none on file</span>}</p>
                  <p>Email: {modal.client_email || <span className="text-slate-400">none on file (email disabled)</span>}</p>
                </div>
                <p className="text-[11px] text-slate-400">A secure payment link is generated and sent. The client taps it to open the form and pay.</p>
              </div>
            )}
            {(modal.type === 'refund_initial' || modal.type === 'refund_scheduled') && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Manager passcode</label>
                <input type="password" value={form.passcode || ''} onChange={e => setForm({ ...form, passcode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            )}

            {(modal.type === 'request_date_change' || modal.type === 'request_pause' || modal.type === 'refund_initial' || modal.type === 'refund_scheduled') && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Reason (required)</label>
                <textarea value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="Explain why so leadership / the audit trail has context."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            )}

            {notice && (
              <div className={`p-2 rounded text-sm mb-3 ${notice.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {notice.text}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={busy} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50">Cancel</button>
              <button onClick={submitAction} disabled={busy}
                className={`px-4 py-2 text-sm font-semibold text-white rounded disabled:opacity-60 ${
                  modal.type === 'charge_now' ? 'bg-green-600 hover:bg-green-700' :
                  (modal.type === 'refund_initial' || modal.type === 'refund_scheduled') ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-asap-blue hover:bg-blue-800'
                }`}>
                {busy ? 'Submitting...' : (
                  modal.type === 'charge_now' ? `Charge ${fmtMoney(modal.amount)}` :
                  (modal.type === 'refund_initial' || modal.type === 'refund_scheduled') ? `Refund ${fmtMoney(modal.amount)}` :
                  modal.type === 'send_payment_form' ? 'Send to Client' :
                  modal.type === 'resume' ? 'Resume' :
                  modal.type.startsWith('request_') ? 'Submit for approval' :
                  'Apply'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
