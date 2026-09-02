import React, { useState, useEffect } from 'react';
import { Search, Send, ExternalLink, RefreshCw, FileText, AlertTriangle, CheckCircle2, Clock, XCircle, DollarSign, CalendarClock, PauseCircle, PlayCircle, Zap, Undo2, ChevronDown, ChevronUp, AlarmClock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

const PIPEDRIVE_DOMAIN = 'asapcreditrepair';
// Split-charge feature flag. Flip to true only after the full lifecycle test passes.
const SPLIT_ENABLED = true;
const DEAL_URL = (id) => `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/deal/${id}`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const RESTRICTED_LEADER_IDS = [
  'f7b8bc3a-74e6-46c2-a378-d19d204d7133', // Mariana Navarro
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
const ACCEPT_JS_URL = 'https://js.authorize.net/v1/Accept.js';
// MERCHANT ROUTING 9/2 (Joe, Eric hit E00116 saving Jacob Chapman's card): this page
// tokenized every card with the PRIMARY merchant's key. Authorize.net rejects a token
// minted on one merchant when it is used against the other, so any client on the AMEX
// account failed. pay.html already switches on card type; this now does the same.
const AUTH_NET_API_LOGIN_ID = '28Rt3gAu5';
const AMEX_API_LOGIN_ID = '9NRft592';
const AMEX_CLIENT_KEY = '4df7Q6M7X7pyqfN4hsWjBGSMTLb5Wt7d7hn8nT7DCFHBHu3qxa5uCsAeVsSqz5Rm';
function cardIsAmex(num) { const n = String(num || '').replace(/[^0-9]/g, ''); return n.indexOf('34') === 0 || n.indexOf('37') === 0; }
const AUTH_NET_CLIENT_KEY = '23Cz947fH6EdMnj59seGRJjJTw93Fe78GDgEZQ4wFeBQULM7pgwRvNMDUWhQLR62';

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

// We do not accept Discover. Detect by card-number prefix before tokenizing.
function isDiscoverCard(num) {
  if (/^6011/.test(num) || /^65/.test(num) || /^64[4-9]/.test(num)) return true;
  const six = parseInt(num.substring(0, 6), 10);
  return six >= 622126 && six <= 622925;
}
// Tokenize a card via Accept.js -> resolves opaqueData {dataDescriptor, dataValue}.
function tokenizeCard({ cardNumber, expMonth, expYear, cardCode, zip, fullName }) {
  return new Promise((resolve, reject) => {
    const secureData = {
      authData: cardIsAmex(cardNumber) ? { clientKey: AMEX_CLIENT_KEY, apiLoginID: AMEX_API_LOGIN_ID } : { clientKey: AUTH_NET_CLIENT_KEY, apiLoginID: AUTH_NET_API_LOGIN_ID },
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

async function zellePaidFlow(chargeId, amount, reload) {
  const conf = window.prompt(`Mark this $${amount} payment as PAID via Zelle.\n\nEnter the Zelle confirmation number:`);
  if (conf === null) return;
  if (!conf.trim()) { window.alert('Confirmation number is required.'); return; }
  if (!window.confirm(`Confirm: the client paid $${amount} via Zelle (confirmation ${conf.trim()}).\n\nThis records the payment in Zoho, marks the charge paid, and notes the deal.`)) return;
  try {
    const res = await callApi('mark_paid_external', { charge_id: chargeId, reference: conf.trim(), method: 'zelle' });
    window.alert(res && res.message ? res.message : 'Marked paid.');
    if (typeof reload === 'function') reload();
  } catch (e) { window.alert('Failed: ' + (e.message || e)); }
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
      {isPaid && !refunded && (
        <div className="pt-3 border-t border-slate-100">
          <RequestRefundButton
            amount={token.initial_amount}
            payload={{ pipedrive_deal_id: token.pipedrive_deal_id, client_name: token.client_name, client_email: token.client_email, amount: token.initial_amount, refund_type: 'initial', token_id: token.id }}
          />
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
                <>
                <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                  <Zap size={12} /> Charge Now
                </button>
                <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                  title="Correct the billing address on file without touching the card itself"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                  <FileText size={12} /> Fix Address
                </button>
                <button onClick={() => onAction({ type: 'discount', charge_id: c.id, amount: c.amount, deal_id })}
                  title="Apply a leadership discount to this invoice"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-400 rounded hover:bg-amber-50">
                  <DollarSign size={12} /> Discount
                </button>
              </>
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
              {SPLIT_ENABLED && (
              <button onClick={() => onAction({ type: 'split_charge', charge_id: c.id, amount: c.amount, current_due_date: c.due_date })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded hover:bg-purple-700">
                <Undo2 size={12} /> Split payment
              </button>
              )}
              <button onClick={() => onAction({ type: 'pause_admin', charge_id: c.id, current_due_date: c.due_date, amount: c.amount })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700">
                <PauseCircle size={12} /> Pause
              </button>
              <button onClick={() => onAction({ type: 'zelle_paid', charge_id: c.id, amount: c.amount })}
                title="Client paid this outside the card system (Zelle). Enter the confirmation number to record it in Zoho and mark the charge paid."
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700">
                <CheckCircle2 size={12} /> Zelle Paid
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
            <RequestRefundButton
              amount={c.amount}
              payload={{ pipedrive_deal_id: c.pipedrive_deal_id, client_name: c.client_name, client_email: c.client_email, amount: c.amount, refund_type: 'scheduled', charge_id: c.id }}
            />
          )}
        </div>
      )}

      {!isAdmin && canRequest && !refunded && isPaid && (
        <div className="pt-3 border-t border-slate-100">
          <RequestRefundButton
            amount={c.amount}
            payload={{ pipedrive_deal_id: c.pipedrive_deal_id, client_name: c.client_name, client_email: c.client_email, amount: c.amount, refund_type: 'scheduled', charge_id: c.id }}
          />
        </div>
      )}

      {/* Non-admin (AM / Consultant) request buttons - only on charges that aren't paid/refunded */}
      {!isAdmin && canRequest && !refunded && !isPaid && (
        pendingApproval ? (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 inline-flex items-center gap-1">
              <Clock size={12} /> A {pendingApproval.request_type === 'pause' ? 'pause' : pendingApproval.request_type === 'split' ? 'split payment' : 'date change'} request is already pending leadership approval. No new request can be made until it's decided.
            </p>
          </div>
        ) : (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            {(isScheduled || isFailed) && (c.customer_profile_id ? (
              <>
              <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                <Zap size={12} /> Charge Now
              </button>
              <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                title="Correct the billing address on file without touching the card itself"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <FileText size={12} /> Fix Address
              </button>
              <button onClick={() => onAction({ type: 'discount', charge_id: c.id, amount: c.amount, deal_id })}
                title="Apply a leadership discount to this invoice"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-400 rounded hover:bg-amber-50">
                <DollarSign size={12} /> Discount
              </button>
              </>
            ) : (
              <button onClick={() => onAction({ type: 'add_card', deal_id, client_name, client_email })}
                title="No card on file yet. Add a card before charging."
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <DollarSign size={12} /> Add card to charge
              </button>
            ))}
            {SPLIT_ENABLED && (
            <button onClick={() => onAction({ type: 'request_split', charge_id: c.id, current_due_date: c.due_date, amount: c.amount, label })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
              <Undo2 size={12} /> Request split
            </button>
            )}
            <button onClick={() => onAction({ type: 'request_date_change', charge_id: c.id, current_due_date: c.due_date, amount: c.amount, label })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
              <CalendarClock size={12} /> Request date change
            </button>
            <button onClick={() => onAction({ type: 'request_pause', charge_id: c.id, current_due_date: c.due_date, amount: c.amount, label })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-500 rounded hover:bg-amber-50">
              <PauseCircle size={12} /> Request pause
            </button>
            <button onClick={() => onAction({ type: 'zelle_paid', charge_id: c.id, amount: c.amount })}
              title="Client paid this via Zelle. Enter the confirmation number to record it in Zoho and mark the charge paid."
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700">
              <CheckCircle2 size={12} /> Zelle Paid
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

function DealView({ data, isAdmin, canRequest, onAction, pendingByCharge = {}, qualifiedDoc }) {
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

      {qualifiedDoc && (
        qualifiedDoc.qualified ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-xs text-green-800">
            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
            <span className="font-semibold">Qualified Doc</span>
            {qualifiedDoc.month && <span className="text-green-600">(counts in {qualifiedDoc.month})</span>}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span className="font-semibold">Not a Qualified Doc</span>
            {qualifiedDoc.reason && <span className="text-amber-700">— {qualifiedDoc.reason}</span>}
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
                <th className="text-left px-3 py-2">Consultant</th>
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
                    <td className="px-3 py-2 text-xs text-slate-600">{i.consultant_name || '\u2014'}</td>
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
    cardNumber: '', expiry: '', cvv: '', zip: '', address: '', city: '', state: ''
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
    if (!form.address.trim()) return setNotice({ type: 'error', text: 'Billing street address is required.' });
    if (isDiscoverCard(num)) return setNotice({ type: 'error', text: 'We do not accept Discover cards, unfortunately. Please use a Visa, Mastercard, or American Express.' });

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
      // SEND MERCHANT 9/2: tell the backend which Authorize.net account this token was
      // minted on, so it can attach the card to a profile on the SAME account. Jacob
      // Chapman's profile is on AMEX and his new card is a Mastercard - without this the
      // backend adds a primary-minted token to an AMEX profile and Authorize.net rejects it.
      await callApi(isUpdate ? 'update_card_on_file' : 'collect_and_save_card', {
        merchant_id: cardIsAmex(num) ? 'amex' : 'primary',
        deal_id: info.deal_id,
        opaqueData,
        cardholderName: form.cardholderName,
        billingAddress: { address: form.address, city: form.city, state: form.state, zip: form.zip, country: 'USA' }
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

        <div className="mb-3">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Billing street address</label>
          <input type="text" autoComplete="street-address" placeholder="123 Main St"
            value={form.address} onChange={e => set('address', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">City</label>
            <input type="text" autoComplete="address-level2" placeholder="Houston"
              value={form.city} onChange={e => set('city', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">State</label>
            <input type="text" autoComplete="address-level1" placeholder="TX" maxLength={2}
              value={form.state} onChange={e => set('state', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-3">We do not accept Discover cards, unfortunately.</p>
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

function NeedsAttentionBanner({ na }) {
  const [open, setOpen] = useState(null);
  const cats = [
    { key: 'sold_without_card_capture', list: 'sold_without_card_capture_list', label: 'sold without card capture' },
    { key: 'paid_no_agreement', list: 'paid_no_agreement_list', label: 'paid without agreement' },
    { key: 'agreement_no_billing', list: 'agreement_no_billing_list', label: 'agreement but no billing' },
    { key: 'links_missing_invoice_recent', list: 'links_missing_invoice_recent_list', label: 'new links missing invoice' }
  ].filter(c => (na[c.key] || 0) > 0);
  if (!cats.length) return null;
  const openCat = cats.find(c => c.key === open) || null;
  const rows = openCat ? (na[openCat.list] || []) : [];
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-medium space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>{'\u26a0'} Needs attention {'\u00b7'} click a category for the client list:</span>
        {cats.map(c => (
          <button key={c.key} type="button" onClick={() => setOpen(open === c.key ? null : c.key)}
            className={`px-2 py-0.5 rounded-full border ${open === c.key ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-amber-300 hover:bg-amber-100'}`}>
            {na[c.key]} {c.label}
          </button>
        ))}
      </div>
      {openCat && (
        <div className="bg-white rounded border border-amber-200 p-2 max-h-56 overflow-y-auto">
          {rows.length === 0 && <div className="text-slate-400">List not loaded - hit the refresh arrow above.</div>}
          {rows.map(r => (
            <a key={r.deal} href={`https://asapcreditrepair.pipedrive.com/deal/${r.deal}`} target="_blank" rel="noreferrer"
              className="block py-0.5 text-asap-blue hover:underline">
              {r.client || 'Unknown client'} {'\u00b7'} deal {r.deal}
            </a>
          ))}
          {(na[openCat.key] || 0) > rows.length && rows.length > 0 && <div className="text-slate-400 pt-1">Showing first {rows.length} of {na[openCat.key]}.</div>}
        </div>
      )}
    </div>
  );
}

// ===== Billing Overview (autobill ops dashboard) =====
function MetricCard({ label, count, amount, tone }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-700'
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{fmtMoney(amount)}</p>
      <p className="text-xs mt-0.5 opacity-70">{count} payment{count === 1 ? '' : 's'}</p>
    </div>
  );
}

function BillingRow({ r, showDecline, isAdmin = false }) {
  const noCard = !r.customer_profile_id;
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 truncate">{r.client_name || 'Unknown'}</span>
          <span className="font-bold text-slate-900">{fmtMoney(r.amount)}</span>
          {noCard && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">NO CARD</span>}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Due {fmtDate(r.due_date)}
          {r.client_phone ? ` · ${r.client_phone}` : ''}
          {showDecline && r.decline_reason ? <span className="text-red-600 font-medium"> · {r.decline_reason}{r.decline_code ? ` (${r.decline_code})` : ''}</span> : null}
          {showDecline && r.next_retry_date ? ` · retries ${fmtDate(r.next_retry_date)}` : (showDecline ? ' · no more retries' : '')}
        </p>
      </div>
      {r.pipedrive_deal_id && (
        <a href={`?deal=${r.pipedrive_deal_id}`} className="shrink-0 text-emerald-700 hover:underline inline-flex items-center gap-1 text-xs font-semibold">
          Client page
        </a>
      )}
      {r.pipedrive_deal_id && (
        <a href={DEAL_URL(r.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="shrink-0 text-asap-blue hover:underline inline-flex items-center gap-1 text-xs font-semibold">
          Deal <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function BillingList({ title, icon, rows, emptyText, showDecline = false, defaultOpen = false, isAdmin = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}{title}
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{rows.length}</span>
        </span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {rows.length === 0
            ? <p className="text-xs text-slate-400 italic">{emptyText}</p>
            : rows.map(r => (
                <div key={r.id}>
                  <BillingRow r={r} showDecline={showDecline} isAdmin={isAdmin} />
                  {showDecline && <DeclineOutreachBar r={r} isAdmin={isAdmin} />}
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

// Astrid 7/30: outreach tracking under each declined card - attempts badge,
// deal owner, Log attempt button (server: log_outreach -> app_cache counter).
function DeclineOutreachBar({ r, isAdmin = false }) {
  const [attempts, setAttempts] = useState(r.outreach_attempts || 0);
  const [busy, setBusy] = useState(false);
  // Joe 7/31: charge the client straight from the declined card, and show how
  // many card attempts have happened (auto retries + manual tries here).
  const [charging, setCharging] = useState(false);
  const [chargeTries, setChargeTries] = useState(r.charge_attempts != null ? r.charge_attempts : (r.retry_count || 0));
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
  };
  const [fixing, setFixing] = useState(false);
  const fixAddress = async () => {
    if (fixing) return;
    const address = window.prompt(`Street address for ${r.client_name || 'this client'}:`);
    if (address === null) return;
    const city = window.prompt('City:');
    if (city === null) return;
    const state = window.prompt('State (2-letter):');
    if (state === null) return;
    const zip = window.prompt('Zip code:');
    if (zip === null) return;
    if (!address && !zip) { alert('Enter at least a street address or zip.'); return; }
    setFixing(true);
    try {
      await callApi('update_billing_address', {
        deal_id: r.pipedrive_deal_id,
        billingAddress: { address, city, state, zip },
        cardholderName: r.client_name
      });
      alert('Billing address updated. Card was not touched - the next retry will use the corrected address.');
    } catch (e) {
      alert('Could not update address: ' + (e.message || e));
    }
    setFixing(false);
  };
  const [discounting, setDiscounting] = useState(false);
  const applyDiscount = async () => {
    if (discounting) return;
    const pctStr = window.prompt(`Discount percentage off $${Number(r.amount).toFixed(2)} for ${r.client_name || 'this client'}:`, '10');
    if (pctStr === null) return;
    const pct = parseFloat(pctStr);
    if (!(pct > 0) || pct >= 100) { alert('Enter a percentage between 0 and 100.'); return; }
    const reason = window.prompt('Reason (optional):') || '';
    if (!window.confirm(`Apply a ${pct}% discount? This will reduce what's owed (or refund the difference if already paid).`)) return;
    setDiscounting(true);
    try {
      const res = await callApi('apply_discount', { charge_id: r.id, percent: pct, reason });
      alert(`Discount applied. New amount: $${Number(res.new_amount).toFixed(2)}` + (res.was_paid ? ' (refunded the difference).' : ' (invoice reduced, nothing charged yet).'));
    } catch (e) {
      alert('Could not apply discount: ' + (e.message || e));
    }
    setDiscounting(false);
  };
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
  return (<>
    <div className="flex items-center justify-between gap-2 mt-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        {r.outreach_last_at && (
          <span className="text-[11px] text-slate-400">last {new Date(r.outreach_last_at).toLocaleDateString()} by {(r.outreach_last_by || '').split('@')[0]}</span>
        )}
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600" title="Card charge attempts (auto retries + manual)">
          card tries: {chargeTries}
        </span>
        {outcome && (
          <span className={`text-[11px] font-semibold ${outcome.ok ? 'text-green-700' : 'text-red-600'}`}>{outcome.text}</span>
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
        <button onClick={chargeNow} disabled={charging}
          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
          {charging ? 'Charging...' : 'Charge card'}
        </button>
        <button onClick={fixAddress} disabled={fixing || charging}
          title="Correct the billing address on file without touching the card itself"
          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-asap-blue text-asap-blue hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap">
          {fixing ? 'Saving...' : 'Fix Address'}
        </button>
        {isAdmin && (
          <button onClick={applyDiscount} disabled={discounting}
            title="Apply a leadership discount to this invoice"
            className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-50 whitespace-nowrap">
            {discounting ? 'Applying...' : 'Discount'}
          </button>
        )}
      </div>
    </div>
    {Array.isArray(r.charge_log) && r.charge_log.length > 0 && (
      <details className="mt-1 px-2">
        <summary className="text-[11px] text-slate-500 cursor-pointer select-none">charge history ({r.charge_log.length})</summary>
        <ul className="mt-1 space-y-0.5">
          {r.charge_log.slice().reverse().map((h, i) => (
            <li key={i} className={`text-[11px] ${h.result === 'collected' ? 'text-green-700' : 'text-red-600'}`}>
              {new Date(h.at).toLocaleString()} - {h.result === 'collected' ? `collected $${Number(h.amount).toFixed(2)}` : `declined${h.reason ? ': ' + h.reason : ''}`} - {(h.by || '').split('@')[0]}
            </li>
          ))}
        </ul>
      </details>
    )}
  </>);
}
function BillingOverview({ isAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [window_, setWindow_] = useState('month');
  const [range, setRange] = useState(7); // upcoming view: 7 / 14 / 30 / 'all'

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const d = await callApi('billing_overview');
      setData(d);
    } catch (e) { setErr(e.message || 'Failed to load billing overview'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading && !data) return <div className="text-sm text-slate-400 p-4">Loading billing overview…</div>;
  if (err) return <div className="text-sm text-red-600 p-4">Billing overview failed: {err} <button onClick={load} className="underline font-semibold">Retry</button></div>;
  if (!data) return null;

  const m = (data.metrics || {})[window_] || {};
  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-asap-blue flex items-center gap-2"><Zap size={16} /> Billing Overview</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
            {['week','month','year'].map(w => (
              <button key={w} onClick={() => setWindow_(w)}
                className={`px-3 py-1.5 capitalize ${window_ === w ? 'bg-asap-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {w}
              </button>
            ))}
          </div>
          <button onClick={load} title="Refresh" className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <NeedsAttentionBanner na={data.needs_attention || {}} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Succeeded" tone="green" count={m.succeeded?.count || 0} amount={m.succeeded?.amount || 0} />
        <MetricCard label="Declined (open)" tone="red" count={m.declined?.count || 0} amount={m.declined?.amount || 0} />
        <MetricCard label="Recovered" tone="blue" count={m.recovered?.count || 0} amount={m.recovered?.amount || 0} />
      </div>
      <BillingList title="Due Today" icon={<AlarmClock size={15} className="text-amber-600" />} rows={data.due_today || []} emptyText="Nothing bills today." defaultOpen={true} isAdmin={isAdmin} />
      {data.outstanding && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800">
              Outstanding autobill: {data.outstanding.count} charges {'\u00b7'} ${Number(data.outstanding.total).toLocaleString()}
              <span className="ml-2 text-xs font-normal text-slate-500">({data.outstanding.scheduled} scheduled, {data.outstanding.failed} in retry)</span>
            </span>
            <span className="flex gap-1">
              {[7, 14, 30, 'all'].map(r => (
                <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-xs font-semibold ${range === r ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{r === 'all' ? 'All' : `${r}d`}</button>
              ))}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(data.outstanding.by_day || []).filter(d => { if (range === 'all') return true; const lim = new Date(Date.now() + range * 86400000).toISOString().slice(0, 10); return d.date <= lim; }).map(d => {
              const today = new Date().toISOString().slice(0, 10);
              const past = d.date < today;
              return (
                <div key={d.date} title={past ? 'Failed charges awaiting retry from this date' : `${d.count} charges scheduled`} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center ${past ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="text-[10px] text-slate-500">{past ? 'retry ' : ''}{d.date.slice(5)}</div>
                  <div className="text-sm font-bold text-slate-800">{d.count}</div>
                  <div className="text-[10px] text-slate-600">${Number(d.total).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <BillingList title={range === 'all' ? 'Upcoming (all scheduled)' : `Upcoming (${range} days)`} icon={<CalendarClock size={15} className="text-sky-600" />} rows={(() => { const all = data.upcoming_all || data.upcoming_7_days || []; if (range === 'all') return all; const lim = new Date(Date.now() + range * 86400000).toISOString().slice(0, 10); return all.filter(r => (r.due_date || '') <= lim); })()} emptyText="Nothing scheduled in this window." isAdmin={isAdmin} />
      <BillingList title="Declined — needs outreach" icon={<XCircle size={15} className="text-red-600" />} rows={data.declined_open || []} emptyText="No open declines. 🎉" showDecline={true} defaultOpen={true} isAdmin={isAdmin} />
    </div>
  );
}
// ===== End Billing Overview =====
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
  const [qualifiedDoc, setQualifiedDoc] = useState(null);
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
    if (info.type === 'zelle_paid') { zellePaidFlow(info.charge_id, info.amount, () => window.location.reload()); return; }
    setModal(info);
    if (info.type === 'update_due_date') setForm({ new_due_date: '' });
    else if (info.type === 'request_split') setForm({ partial_amount: '', first_date: '', remainder_date: '', reason: '' });
    else if (info.type === 'split_charge') setForm({ partial_amount: '', first_date: new Date().toISOString().slice(0, 10), remainder_date: '' });
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
        const r = await callApi('charge_now', { charge_id: modal.charge_id });
        const txn = r.transaction_id || r.transactionId || (r.charge && r.charge.transaction_id) || null;
        const amt = modal.amount ? ' $' + Number(modal.amount).toFixed(2) : '';
        setNotice({ type: 'success', text: 'Payment collected' + amt + (txn ? ' - txn ' + txn : '') + '. Refresh the page to see it move to Paid.' });
      } else if (modal.type === 'fix_address') {
        if (!form.zip && !form.address) throw new Error('Enter at least a street address or zip');
        await callApi('update_billing_address', { deal_id: modal.deal_id, billingAddress: { address: form.address, city: form.city, state: form.state, zip: form.zip }, cardholderName: modal.client_name });
        setNotice({ type: 'success', text: 'Billing address updated. The card itself was not changed - the next scheduled retry will use the corrected address.' });
      } else if (modal.type === 'discount') {
        const pct = parseFloat(form.percent);
        if (!(pct > 0) || pct >= 100) throw new Error('Enter a percentage between 0 and 100');
        const r = await callApi('apply_discount', { charge_id: modal.charge_id, percent: pct, reason: form.reason });
        setNotice({ type: 'success', text: `${pct}% discount applied. New amount: $${Number(r.new_amount).toFixed(2)}` + (r.was_paid ? ' (refunded the difference)' : ' (invoice reduced, nothing charged yet)') });
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
        if (!form.first_date) throw new Error('Choose a date for the first payment');
        if (!form.remainder_date) throw new Error('Choose a date for the remainder');
        if (form.remainder_date < form.first_date) throw new Error('Remainder date must be on or after the first payment date');
        // Date limits LIFTED (Joe 7/23): any dates may be submitted - approval is the gate.
        const origDue = String(modal.current_due_date || '').slice(0, 10);
        if (origDue && form.remainder_date.slice(0, 7) !== origDue.slice(0, 7) && !form.month_ack) throw new Error('This split crosses a month boundary, which affects qualified-doc and bonus timing. Check the acknowledgment box to confirm this has been reviewed.');
        const r = await callApi('split_charge', { charge_id: modal.charge_id, partial_amount: partial, first_date: form.first_date, remainder_date: form.remainder_date });
        const warnTxt = (r.warnings && r.warnings.length) ? ' \u26A0 ' + r.warnings.join(' ') : '';
        setNotice({ type: 'success', text: (r.message || ('Split into $' + partial.toFixed(2) + ' and $' + (orig - partial).toFixed(2) + '.')) + warnTxt });
      } else if (modal.type === 'request_split') {
        const partial = parseFloat(form.partial_amount);
        const orig = parseFloat(modal.amount);
        if (!(partial > 0)) throw new Error('Enter a partial amount greater than 0');
        if (partial >= orig) throw new Error('Partial must be less than the charge amount');
        if (!form.first_date) throw new Error('Choose a date for the first payment');
        if (!form.remainder_date) throw new Error('Choose a date for the remainder');
        if (form.remainder_date < form.first_date) throw new Error('Remainder date must be on or after the first payment date');
        // Date limits LIFTED (Joe 7/23): any dates may be submitted - approval is the gate.
        const rOrigDue = String(modal.current_due_date || '').slice(0, 10);
        if (rOrigDue && form.remainder_date.slice(0, 7) !== rOrigDue.slice(0, 7) && !form.month_ack) throw new Error('This split crosses a month boundary, which affects qualified-doc and bonus timing. Check the acknowledgment box.');
        if (!form.reason || form.reason.trim().length < 3) throw new Error('Add a short reason for the split request');
        const r = await callApi('request_split', { charge_id: modal.charge_id, partial_amount: partial, first_date: form.first_date, remainder_date: form.remainder_date, reason: form.reason.trim() });
        setNotice({ type: 'success', text: r.message || 'Split request submitted for leadership approval.' });
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
      callApi('check_qualified_doc', { deal_id: id }).then(setQualifiedDoc).catch(() => setQualifiedDoc(null));
    } catch (e) {
      setErr(e.message); setDealData(null);
    } finally { setLoading(false); }
  };

  const browse = async () => {
    setLoading(true); setErr(null); setDealData(null); setQualifiedDoc(null); setMode('browse');
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
    request_split: 'Request a payment split',
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
      <BillingOverview isAdmin={isAdmin} />


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

      {!loading && mode === 'lookup' && dealData && <DealView data={dealData} isAdmin={isAdmin} canRequest={canRequest} onAction={openAction} pendingByCharge={pendingByCharge} qualifiedDoc={qualifiedDoc} />}
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

            {modal.type === 'fix_address' && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-slate-500 -mt-2 mb-2">Corrects the billing address the card issuer checks (AVS). The card number and expiration are never touched.</p>
                <input placeholder="Street address" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                <div className="flex gap-2">
                  <input placeholder="City" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <input placeholder="State" maxLength={2} value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })}
                    className="w-16 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <input placeholder="Zip" value={form.zip || ''} onChange={e => setForm({ ...form, zip: e.target.value })}
                    className="w-24 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                </div>
              </div>
            )}
            {modal.type === 'discount' && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-slate-500 -mt-2 mb-2">Leadership only. Works on unpaid invoices (reduces what's owed) and paid invoices (refunds the difference).</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="99" placeholder="10" defaultValue={10} value={form.percent ?? 10} onChange={e => setForm({ ...form, percent: e.target.value })}
                    className="w-20 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <span className="text-sm text-slate-600">% off {modal.amount ? '$' + Number(modal.amount).toFixed(2) : 'this invoice'}</span>
                </div>
                <input placeholder="Reason (optional)" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            )}
            {(modal.type === 'update_due_date' || modal.type === 'request_date_change') && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">New due date</label>
                <input type="date" value={form.new_due_date || ''} onChange={e => setForm({ ...form, new_due_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            )}

            {(modal.type === 'split_charge' || modal.type === 'request_split') && (
              <>
                <div className="mb-3 text-sm text-slate-600">
                  Original charge: <b>${(parseFloat(modal.amount) || 0).toFixed(2)}</b> due {fmtDate(modal.current_due_date)}.
                </div>
                <div className="mb-3 p-3 border border-slate-200 rounded-lg">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Payment 1 - what they're paying now</p>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label>
                  <input type="number" step="0.01" min="0.01" value={form.partial_amount || ''} onChange={e => setForm({ ...form, partial_amount: e.target.value })}
                    placeholder="e.g. 150.00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue mb-2" />
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Payment date</label>
                  <input type="date" value={form.first_date || ''} onChange={e => setForm({ ...form, first_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <p className="text-[11px] text-slate-500 mt-1">{form.first_date === new Date().toISOString().slice(0, 10) ? 'Today: the card is charged as soon as you save.' : 'Charges automatically on this date.'}</p>
                </div>
                <div className="mb-4 p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Payment 2 - remaining balance</p>
                  <div className="text-lg font-bold text-slate-800 mb-2">${Math.max(0, (parseFloat(modal.amount) || 0) - (parseFloat(form.partial_amount) || 0)).toFixed(2)}</div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">2nd payment date</label>
                  <input type="date" value={form.remainder_date || ''} onChange={e => setForm({ ...form, remainder_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  {modal.type === 'request_split' && (
                    <div className="mt-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Reason for the split (required)</label>
                      <textarea value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2}
                        placeholder="Why does this client need a split?"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 mt-2">Any dates can be submitted with a reason - leadership approval is the gate. Splits past the original due date or across months affect qualified-doc / bonus timing.</p>
                  {(() => {
                    const origDue = String(modal.current_due_date || '').slice(0, 10);
                    const monthCross = origDue && form.remainder_date && form.remainder_date.slice(0, 7) !== origDue.slice(0, 7);
                    if (!monthCross) return null;
                    return (
                      <label className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-50 border border-amber-300 text-xs text-amber-800">
                        <input type="checkbox" checked={!!form.month_ack} onChange={e => setForm({ ...form, month_ack: e.target.checked })} className="mt-0.5" />
                        <span>This split crosses a month boundary and affects qualified-doc / bonus timing (Doc Fee Accelerator rules). I confirm this split has been reviewed.</span>
                      </label>
                    );
                  })()}
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
                  (modal.type === 'request_split' ? 'Submit for approval' : 'Apply')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function RequestRefundButton({ amount, payload }) {
  const { currentUser } = useApp();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const reason = window.prompt('Reason for this refund request (required):');
    if (!reason || !reason.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/.netlify/functions/refund-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', ...payload, reason: reason.trim(), requested_by: currentUser?.email || null, requested_by_name: currentUser?.name || null })
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'Request failed');
      window.alert('Refund request #' + d.request_id + ' submitted for leadership approval.' + (d.rounds_started ? ' Client has started rounds - a signed release will be required before payment.' : ''));
    } catch (e) { window.alert('Could not submit request: ' + e.message); }
    setBusy(false);
  };
  return (
    <button type="button" onClick={submit} disabled={busy}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50">
      <Undo2 size={12} /> {busy ? 'Submitting...' : `Request Refund ${fmtMoney(amount)}`}
    </button>
  );
}