import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, RefreshCw, FileText, AlertTriangle, CheckCircle2, Clock, XCircle, DollarSign } from 'lucide-react';

const PIPEDRIVE_DOMAIN = 'asapcredit';
const DEAL_URL = (id) => `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/deal/${id}`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtMoney = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (s) => {
  if (!s) return '';
  const d = String(s).slice(0, 10).split('-');
  if (d.length !== 3) return s;
  return `${MONTHS[parseInt(d[1], 10) - 1]} ${parseInt(d[2], 10)}, ${d[0]}`;
};
const daysUntil = (s) => {
  if (!s) return null;
  const d = new Date(s);
  const today = new Date();
  d.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};

async function callApi(action, payload = {}) {
  const res = await fetch('/.netlify/functions/invoices-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

function DealView({ data }) {
  const { deal_id, client_name, client_email, client_phone, initial_payment, scheduled_charges = [], doc_fee, has_card_on_file } = data;
  const token = initial_payment;

  // Summary numbers
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

  const cardOnFile = token && token.card_last_4 ? `${token.card_type || 'Card'} ending in ${token.card_last_4}` : 'No card on file yet';

  return (
    <div className="space-y-5">
      {/* Doc fee banner */}
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

      {/* Client Info */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-asap-blue">Client Information</h3>
          <a href={DEAL_URL(deal_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-asap-blue hover:underline">Open in Pipedrive <ExternalLink size={12} /></a>
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

      {/* Summary tiles */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-4 pb-3 border-b border-slate-100">Summary</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile label="Total Collected" value={fmtMoney(collected)} tone="success" sub="Successfully charged" />
          <SummaryTile label="Outstanding" value={fmtMoney(pending)} tone="warn" sub="Pending charges" />
          <SummaryTile label="Refunded" value={fmtMoney(refunded)} tone="muted" sub={refunded > 0 ? 'Returned to client' : 'No refunds yet'} />
          <SummaryTile label="Total Lifetime" value={fmtMoney(lifetime)} sub="Original contract value" />
        </div>
      </div>

      {/* Initial Payment (Doc Fee) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-4 pb-3 border-b border-slate-100">Initial Payment (Doc Fee)</h3>
        {!token ? (
          <p className="text-sm text-slate-400 italic text-center py-4">No payment token found for this deal yet.</p>
        ) : (
          <PaymentCard
            isInitial
            amount={token.initial_amount}
            status={token.status}
            statusOverride={token.status === 'used' && token.transaction_id ? 'paid' : token.status}
            refundedAt={token.refunded_at}
            usedAt={token.used_at}
            transactionId={token.transaction_id}
            cardLast4={token.card_last_4}
            cardType={token.card_type}
            createdAt={token.created_at}
          />
        )}
      </div>

      {/* Scheduled Charges */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-base font-semibold text-asap-blue mb-4 pb-3 border-b border-slate-100">Scheduled Payments ({scheduled_charges.length})</h3>
        {scheduled_charges.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-4">No scheduled payments for this deal.</p>
        ) : (
          <div className="space-y-3">
            {scheduled_charges
              .slice()
              .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))
              .map((c, i, arr) => (
                <PaymentCard
                  key={c.id || i}
                  title={`Payment #${c.sequence_number || (i + 1)}${i === arr.length - 1 && arr.length > 1 ? ' (Final)' : ''}`}
                  amount={c.amount}
                  status={c.status}
                  refundedAt={c.refunded_at}
                  chargedAt={c.charged_at}
                  dueDate={c.due_date}
                  transactionId={c.transaction_id}
                  description={c.description}
                  pauseUntil={c.pause_until_date}
                  pauseIndefinite={c.pause_indefinite}
                  lastDeclineReason={c.last_decline_reason}
                  retryCount={c.retry_count}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentCard({ title, isInitial, amount, status, statusOverride, refundedAt, usedAt, chargedAt, dueDate, transactionId, cardLast4, cardType, description, createdAt, pauseUntil, pauseIndefinite, lastDeclineReason, retryCount }) {
  const effectiveStatus = statusOverride || status;
  const isPaid = effectiveStatus === 'paid' || effectiveStatus === 'used';
  const leftBorder =
    refundedAt ? 'border-l-slate-400 bg-slate-50 opacity-90' :
    isPaid     ? 'border-l-green-500' :
    effectiveStatus === 'scheduled' ? 'border-l-blue-500' :
    effectiveStatus === 'failed'    ? 'border-l-red-500 bg-red-50' :
    effectiveStatus === 'paused'    ? 'border-l-amber-500 bg-amber-50' :
                                       'border-l-slate-300';
  const days = !isPaid && !refundedAt ? daysUntil(dueDate) : null;
  let urgency = null;
  if (days != null) {
    if (days < 0) urgency = <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">{Math.abs(days)} days overdue</span>;
    else if (days <= 3) urgency = <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Due in {days} day{days === 1 ? '' : 's'}</span>;
    else urgency = <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">Due in {days} days</span>;
  }
  return (
    <div className={`border border-slate-200 border-l-[4px] ${leftBorder} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <p className="font-semibold text-slate-800">{title || 'Doc Fee'}</p>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {urgency}
          <StatusPill status={effectiveStatus} refunded={!!refundedAt} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <p className="text-2xl font-bold text-asap-blue">{fmtMoney(amount)}</p>
        <div className="text-xs text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1 min-w-[280px]">
          {dueDate && !isPaid && !refundedAt && (<><span className="text-slate-400">Due date</span><span className="font-semibold">{fmtDate(dueDate)}</span></>)}
          {chargedAt && (<><span className="text-slate-400">Charged</span><span className="font-semibold">{fmtDate(chargedAt)}</span></>)}
          {usedAt && (<><span className="text-slate-400">Paid</span><span className="font-semibold">{fmtDate(usedAt)}</span></>)}
          {refundedAt && (<><span className="text-slate-400">Refunded</span><span className="font-semibold">{fmtDate(refundedAt)}</span></>)}
          {transactionId && (<><span className="text-slate-400">Txn ID</span><span className="font-mono text-[11px] truncate" title={transactionId}>{transactionId}</span></>)}
          {(cardLast4 && isInitial) && (<><span className="text-slate-400">Card</span><span className="font-semibold">{cardType || 'Card'} ending {cardLast4}</span></>)}
          {createdAt && isInitial && !usedAt && (<><span className="text-slate-400">Created</span><span className="font-semibold">{fmtDate(createdAt)}</span></>)}
          {pauseUntil && !pauseIndefinite && (<><span className="text-slate-400">Paused until</span><span className="font-semibold">{fmtDate(pauseUntil)}</span></>)}
          {pauseIndefinite && (<><span className="text-slate-400">Paused</span><span className="font-semibold">Indefinitely</span></>)}
        </div>
      </div>
      {lastDeclineReason && (
        <div className="mt-3 p-2 rounded border border-red-200 bg-red-50 text-xs text-red-700">
          <span className="font-semibold">Last decline:</span> {lastDeclineReason}{retryCount ? ` · retry ${retryCount}` : ''}
        </div>
      )}
    </div>
  );
}

function BrowseView({ data, filter, onFilterChange }) {
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
              </tr>
            </thead>
            <tbody>
              {allItems.map((entry, idx) => {
                const i = entry.item;
                const isToken = entry.type === 'token';
                const isPaid = isToken ? (i.status === 'used' && i.transaction_id) : i.status === 'paid';
                const days = !isPaid && !i.refunded_at ? daysUntil(i.due_date) : null;
                const dueWarn = days != null && days < 0 ? 'text-red-600' : days != null && days <= 3 ? 'text-amber-600' : 'text-slate-600';
                return (
                  <tr key={`${entry.type}-${i.id || idx}`} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{i.client_name || 'Unknown'}</p>
                      {i.client_email && <p className="text-[11px] text-slate-500">{i.client_email}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <a href={DEAL_URL(i.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="font-mono text-xs font-semibold text-asap-blue hover:underline">#{i.pipedrive_deal_id || '?'}</a>
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
                    <td className="px-3 py-2"><StatusPill status={i.status} refunded={!!i.refunded_at} /></td>
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

export default function Invoices() {
  const [dealInput, setDealInput] = useState('');
  const [dealData, setDealData] = useState(null);
  const [browseData, setBrowseData] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState('lookup'); // 'lookup' | 'browse'

  const lookup = async () => {
    const id = dealInput.trim();
    if (!id) { setErr('Enter a Pipedrive Deal ID.'); return; }
    setLoading(true); setErr(null); setBrowseData(null); setMode('lookup');
    try {
      const data = await callApi('get_deal', { deal_id: id });
      setDealData(data);
    } catch (e) {
      setErr(e.message); setDealData(null);
    } finally { setLoading(false); }
  };

  const browse = async () => {
    setLoading(true); setErr(null); setDealData(null); setMode('browse');
    try {
      const data = await callApi('list_recent_invoices', { filters: { days_back: 90 } });
      setBrowseData(data);
    } catch (e) {
      setErr(e.message); setBrowseData(null);
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <FileText size={28} className="text-asap-blue" />
          Invoices
        </h1>
        <p className="text-slate-500 text-sm">
          Track doc fees and scheduled payments from the autobill processor. Read-only. Use the payment processor dashboard for actions like refunds, pauses, and date changes.
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
            <button onClick={lookup} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-asap-blue text-white text-sm font-semibold rounded hover:bg-blue-800 disabled:opacity-60">
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

      {!loading && mode === 'lookup' && dealData && <DealView data={dealData} />}
      {!loading && mode === 'browse' && browseData && <BrowseView data={browseData} filter={filter} onFilterChange={setFilter} />}

      {!loading && !dealData && !browseData && !err && (
        <div className="text-center py-12 text-slate-400 text-sm italic">
          Look up a deal by ID or show all invoices from the last 90 days.
        </div>
      )}
    </div>
  );
}
