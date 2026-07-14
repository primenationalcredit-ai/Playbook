import React, { useState } from 'react';
import { Search, Send, ExternalLink, FileText, RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PIPEDRIVE_DOMAIN = 'asapcredit';
const DEAL_URL = (id) => `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/deal/${id}`;
const fmtMoney = (n) => (n == null || n === '') ? '—' : `$${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Same authenticated proxy pattern the Invoices page uses, pointed at agreements-api.
async function callAgreementsApi(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  const res = await fetch('/.netlify/functions/agreements-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function StatusPill({ status }) {
  const map = {
    signed:   'bg-green-100 text-green-700',
    pending:  'bg-amber-100 text-amber-700',
    sent:     'bg-blue-100 text-blue-700',
    expired:  'bg-slate-100 text-slate-500',
    cancelled:'bg-slate-100 text-slate-500',
    voided:   'bg-slate-100 text-slate-500',
  };
  const cls = map[String(status || '').toLowerCase()] || 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{status || 'unknown'}</span>;
}

export default function Agreements() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendModal, setResendModal] = useState(null); // { dealId, clientName }
  const [resendBusy, setResendBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [editModal, setEditModal] = useState(null);   // the agreement row being edited
  const [editForm, setEditForm] = useState({});
  const [editResend, setEditResend] = useState(true);
  const [editBusy, setEditBusy] = useState(false);
  const openEdit = (a) => {
    setEditForm({
      client_name: a.client_name || '',
      client_email: a.client_email || '',
      client_phone: a.client_phone || '',
      client_address: a.client_address || '',
      payment_type: a.payment_type_text || '',
      partial_amount: a.partial_amount || '',
      partial_date: a.partial_date || '',
      final_amount: a.final_amount || '',
      final_date: a.final_date || ''
    });
    setEditResend(true);
    setEditModal(a);
  };
  const doEditSave = async () => {
    if (!editModal) return;
    setEditBusy(true);
    setError('');
    try {
      const mustResend = String(editModal.status || '').toLowerCase() === 'signed';
      const d = await callAgreementsApi('edit_resend', {
        deal_id: editModal.pipedrive_deal_id,
        edits: editForm,
        resend: mustResend || editResend
      });
      const warn = (d.warnings && d.warnings.length) ? ' \u26A0 ' + d.warnings.join(' ') : '';
      setToast((d.message || 'Agreement updated.') + warn);
      setEditModal(null);
      await runSearch();
      setTimeout(() => setToast(''), 9000);
    } catch (e) {
      setError(e.message || 'Edit failed');
    } finally {
      setEditBusy(false);
    }
  };

  const runSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await callAgreementsApi('search', { query, status, type, from_date: fromDate, to_date: toDate });
      setResults(d.agreements || []);
    } catch (e) {
      setError(e.message || 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const doResend = async () => {
    if (!resendModal) return;
    setResendBusy(true);
    setError('');
    try {
      await callAgreementsApi('resend', { deal_id: resendModal.dealId });
      setToast(`New signing link sent for ${resendModal.clientName || 'the client'}.`);
      setResendModal(null);
      // Refresh so the new agreement/status shows.
      await runSearch();
      setTimeout(() => setToast(''), 6000);
    } catch (e) {
      setError(e.message || 'Resend failed');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-asap-blue flex items-center gap-2"><FileText size={20} /> Agreements</h2>
        <p className="text-sm text-slate-500 mt-1">Search agreements, view the signed PDF, and resend a signing link.</p>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search by name, email, phone, or deal ID</label>
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                placeholder="Start typing, then Search…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue">
                <option value="">Any</option>
                <option value="pending">Pending</option>
                <option value="signed">Signed</option>
                <option value="sent">Sent</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
              <input type="text" value={type} onChange={e => setType(e.target.value)} placeholder="e.g. PIF, PARTIAL" className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Created from</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Created to</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
          </div>
          <button onClick={runSearch} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-asap-blue text-white text-sm font-semibold rounded hover:bg-blue-800 disabled:opacity-50">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />} Search
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
          <CheckCircle2 size={15} /> {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-asap-blue">Results <span className="text-xs font-normal text-slate-500">({results.length})</span></h3>
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">No agreements match your search. Try a broader term.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                    <th className="text-left px-3 py-2">Client</th>
                    <th className="text-left px-3 py-2">Deal</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Sent / Signed</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-800">{a.client_name || 'Unknown'}</p>
                        {a.client_email && <p className="text-[11px] text-slate-500">{a.client_email}</p>}
                      </td>
                      <td className="px-3 py-2">
                        {a.pipedrive_deal_id
                          ? <a href={DEAL_URL(a.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="font-mono text-xs font-semibold text-asap-blue hover:underline">#{a.pipedrive_deal_id}</a>
                          : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-700">{a.variant_label || a.agreement_type || '—'}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney(a.total_amount)}</td>
                      <td className="px-3 py-2"><StatusPill status={a.status} /></td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {a.signed_at ? <span className="text-green-700">Signed {fmtDate(a.signed_at)}</span>
                          : a.link_sent_at ? <span>Sent {fmtDate(a.link_sent_at)}</span>
                          : <span className="text-slate-400">Not sent</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1">
                          {a.pdf_supabase_url && (
                            <a href={a.pdf_supabase_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50" title="View signed PDF">
                              <ExternalLink size={11} /> PDF
                            </a>
                          )}
                          {a.pipedrive_deal_id && (
                            <button onClick={() => openEdit(a)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100" title="Edit client details or payment terms (also updates Pipedrive)">
                              <Pencil size={11} /> Edit
                            </button>
                          )}
                          {a.pipedrive_deal_id && (
                            <button onClick={() => setResendModal({ dealId: a.pipedrive_deal_id, clientName: a.client_name })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-green-600 rounded hover:bg-green-700" title="Void current agreement and send a new signing link">
                              <Send size={11} /> Resend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-12 text-slate-400">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Search to find agreements.</p>
        </div>
      )}

      {/* Edit agreement modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !editBusy && setEditModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-asap-blue flex items-center gap-2"><Pencil size={18} /> Edit agreement</h3>
            <p className="text-xs text-slate-500 mt-1">Deal #{editModal.pipedrive_deal_id} - contact changes also update the Pipedrive person, so future documents come out right.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Client name</label>
                <input type="text" value={editForm.client_name || ''} onChange={e => setEditForm({ ...editForm, client_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <input type="text" value={editForm.client_email || ''} onChange={e => setEditForm({ ...editForm, client_email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                <input type="text" value={editForm.client_phone || ''} onChange={e => setEditForm({ ...editForm, client_phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Address (street, city, state zip)</label>
                <input type="text" value={editForm.client_address || ''} onChange={e => setEditForm({ ...editForm, client_address: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Payment type</label>
                <select value={editForm.payment_type || ''} onChange={e => setEditForm({ ...editForm, payment_type: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue">
                  <option value="FULL">FULL</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="PIF">PIF</option>
                </select>
              </div>
              <div></div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Partial amount</label>
                <input type="text" value={editForm.partial_amount || ''} onChange={e => setEditForm({ ...editForm, partial_amount: e.target.value })} placeholder="e.g. 275.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Partial date</label>
                <input type="date" value={editForm.partial_date || ''} onChange={e => setEditForm({ ...editForm, partial_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Final amount</label>
                <input type="text" value={editForm.final_amount || ''} onChange={e => setEditForm({ ...editForm, final_amount: e.target.value })} placeholder="e.g. 275.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Final date</label>
                <input type="date" value={editForm.final_date || ''} onChange={e => setEditForm({ ...editForm, final_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            </div>
            {String(editModal.status || '').toLowerCase() === 'signed' ? (
              <div className="mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> This agreement is SIGNED. Saving will void it and send the client a corrected agreement to re-sign - signed documents are never edited silently.
              </div>
            ) : (
              <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={editResend} onChange={e => setEditResend(e.target.checked)} />
                Resend corrected agreement to the client now (voids the current one, new signing link)
              </label>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditModal(null)} disabled={editBusy} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50">Cancel</button>
              <button onClick={doEditSave} disabled={editBusy} className="inline-flex items-center gap-2 px-4 py-2 bg-asap-blue text-white text-sm font-semibold rounded hover:bg-blue-800 disabled:opacity-50">
                {editBusy ? <RefreshCw size={15} className="animate-spin" /> : <Pencil size={15} />} Save changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Resend confirm modal */}
      {resendModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !resendBusy && setResendModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-asap-blue flex items-center gap-2"><Send size={18} /> Resend agreement</h3>
            <p className="text-sm text-slate-600 mt-3">
              This voids the current agreement for <b>{resendModal.clientName || 'this client'}</b> and issues a fresh one with the same terms. The client gets a new signing link and must re-sign.
            </p>
            <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> The previous signing link stops working once you resend.
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setResendModal(null)} disabled={resendBusy} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50">Cancel</button>
              <button onClick={doResend} disabled={resendBusy} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:opacity-50">
                {resendBusy ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />} Resend signing link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
