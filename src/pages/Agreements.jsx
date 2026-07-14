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
      guarantee: a.has_guarantee === false ? 'NO GUARANTEE' : 'GUARANTEE',
      partial_amount: a.partial_amount || '',
      partial_date: a.partial_date || '',
      final_amount: a.final_amount || '',
      final_date: a.final_date || ''
    });
    setEditResend(true);
    setEditModal(a);
  };
  const [reviewOpen, setReviewOpen] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const numv = (v) => (v == null || v === '' ? 0 : parseFloat(v) || 0);
  const editDiffs = () => {
    if (!editModal) return [];
    const fields = [
      ['Client name', 'client_name', editModal.client_name],
      ['Email', 'client_email', editModal.client_email],
      ['Phone', 'client_phone', editModal.client_phone],
      ['Address', 'client_address', editModal.client_address],
      ['Payment type', 'payment_type', editModal.payment_type_text],
      ['Guarantee', 'guarantee', editModal.has_guarantee === false ? 'NO GUARANTEE' : 'GUARANTEE'],
      ['Partial amount', 'partial_amount', editModal.partial_amount],
      ['Partial date', 'partial_date', editModal.partial_date],
      ['Final amount', 'final_amount', editModal.final_amount],
      ['Final date', 'final_date', editModal.final_date]
    ];
    return fields
      .map(([label, key, oldVal]) => ({ label, key, oldVal: oldVal == null ? '' : String(oldVal), newVal: editForm[key] == null ? '' : String(editForm[key]) }))
      .filter((d) => d.oldVal !== d.newVal && !(d.oldVal === '' && d.newVal === ''));
  };
  const totalsChanged = () => {
    if (!editModal) return false;
    return Math.abs((numv(editModal.partial_amount) + numv(editModal.final_amount)) - (numv(editForm.partial_amount) + numv(editForm.final_amount))) > 0.009;
  };
  const typeChanged = () => editModal && editForm.payment_type && String(editForm.payment_type) !== String(editModal.payment_type_text || '');
  const guaranteeChanged = () => editModal && editForm.guarantee && editForm.guarantee !== (editModal.has_guarantee === false ? 'NO GUARANTEE' : 'GUARANTEE');
  const openReview = () => {
    setError('');
    // 45-day rule: the final payment can never sit more than 45 days out.
    if (editForm.final_date) {
      const max = new Date(); max.setDate(max.getDate() + 45);
      if (new Date(editForm.final_date + 'T00:00:00') > max) {
        setError('The final payment date cannot be more than 45 days from today (latest allowed: ' + max.toISOString().slice(0, 10) + ').');
        return;
      }
    }
    if (editDiffs().length === 0) { setError('No changes to save.'); return; }
    setApprovalChecked(false);
    setReviewOpen(true);
  };
  const doEditSave = async () => {
    if (!editModal) return;
    setEditBusy(true);
    setError('');
    try {
      const mustResend = String(editModal.status || '').toLowerCase() === 'signed' || typeChanged() || guaranteeChanged();
      const d = await callAgreementsApi('edit_resend', {
        deal_id: editModal.pipedrive_deal_id,
        edits: editForm,
        resend: mustResend || editResend
      });
      const warn = (d.warnings && d.warnings.length) ? ' \u26A0 ' + d.warnings.join(' ') : '';
      setToast((d.message || 'Agreement updated.') + warn);
      setReviewOpen(false);
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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
                <select value={editForm.payment_type || ''} onChange={e => { const v = e.target.value; setEditForm(v === 'PARTIAL' ? { ...editForm, payment_type: v } : { ...editForm, payment_type: v, partial_amount: '', partial_date: '' }); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue">
                  <option value="FULL">FULL</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="PIF">PIF</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Guarantee</label>
                <select value={editForm.guarantee || 'GUARANTEE'} onChange={e => setEditForm({ ...editForm, guarantee: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue">
                  <option value="GUARANTEE">Guarantee</option>
                  <option value="NO GUARANTEE">No Guarantee</option>
                </select>
              </div>
              {(editForm.payment_type || '') === 'PARTIAL' && (<>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Partial amount</label>
                <input type="text" value={editForm.partial_amount || ''} onChange={e => setEditForm({ ...editForm, partial_amount: e.target.value })} placeholder="e.g. 275.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Partial date</label>
                <input type="date" value={editForm.partial_date || ''} onChange={e => setEditForm({ ...editForm, partial_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              </>)}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Final amount</label>
                <input type="text" value={editForm.final_amount || ''} onChange={e => setEditForm({ ...editForm, final_amount: e.target.value })} placeholder="e.g. 275.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Final date</label>
                <input type="date" value={editForm.final_date || ''} onChange={e => setEditForm({ ...editForm, final_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            </div>
            <div className={`mt-4 flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-semibold ${totalsChanged() ? 'bg-red-50 border-red-300 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <span>Total payments (incl. ${['1583', '1895'].includes(String(editModal.agreement_type)) ? '0' : '149'} doc fee)</span>
              <span>
                ${((['1583', '1895'].includes(String(editModal.agreement_type)) ? 0 : 149) + numv(editForm.partial_amount) + numv(editForm.final_amount)).toFixed(2)}
                {totalsChanged() && <span className="ml-2 font-normal">was ${((['1583', '1895'].includes(String(editModal.agreement_type)) ? 0 : 149) + numv(editModal.partial_amount) + numv(editModal.final_amount)).toFixed(2)} - price change, management approval required</span>}
              </span>
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
            {error && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                <AlertTriangle size={13} /> {error}
              </div>
            )}
            {reviewOpen && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Review your changes before saving</h4>
                <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                  <thead className="bg-slate-50"><tr>
                    <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Field</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Current</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-slate-500">New</th>
                  </tr></thead>
                  <tbody>
                    {editDiffs().map((d) => (
                      <tr key={d.key} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 font-medium text-slate-700">{d.label}</td>
                        <td className="px-2 py-1.5 text-slate-500">{d.oldVal || '-'}</td>
                        <td className="px-2 py-1.5 font-semibold text-slate-900">{d.newVal || '-'}</td>
                      </tr>
                    ))}
                    {totalsChanged() && (
                      <tr className="border-t-2 border-amber-300 bg-amber-50">
                        <td className="px-2 py-1.5 font-bold text-amber-900">TOTAL (partial + final)</td>
                        <td className="px-2 py-1.5 font-bold text-amber-900">${(numv(editModal.partial_amount) + numv(editModal.final_amount)).toFixed(2)}</td>
                        <td className="px-2 py-1.5 font-bold text-amber-900">${(numv(editForm.partial_amount) + numv(editForm.final_amount)).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(typeChanged() || guaranteeChanged()) && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    {typeChanged() ? 'Payment type' : 'The guarantee'} is changing - the corrected agreement will be RESENT for a new signature (required for a structural change).
                  </div>
                )}
                {totalsChanged() && (
                  <label className="mt-3 flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    <input type="checkbox" checked={approvalChecked} onChange={e => setApprovalChecked(e.target.checked)} className="mt-0.5" />
                    <span><b>Price change:</b> I have management approval to change this client's total. Leadership will be notified by email.</span>
                  </label>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => (reviewOpen ? setReviewOpen(false) : setEditModal(null))} disabled={editBusy} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50">{reviewOpen ? 'Back to edit' : 'Cancel'}</button>
              {reviewOpen ? (
                <button onClick={doEditSave} disabled={editBusy || (totalsChanged() && !approvalChecked)} className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white text-base font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow">
                  {editBusy ? <RefreshCw size={17} className="animate-spin" /> : <Send size={17} />}
                  {(String(editModal.status || '').toLowerCase() === 'signed' || typeChanged() || guaranteeChanged() || editResend) ? 'Save and Send to Client' : 'Save Only (no send)'}
                </button>
              ) : (
                <button onClick={openReview} disabled={editBusy} className="inline-flex items-center gap-2 px-4 py-2 bg-asap-blue text-white text-sm font-semibold rounded hover:bg-blue-800 disabled:opacity-50">
                  <Pencil size={15} /> Review changes
                </button>
              )}
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
