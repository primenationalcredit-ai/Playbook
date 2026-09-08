import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, ExternalLink, Mail, MessageSquare } from 'lucide-react';

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusPill({ status }) {
  const ok = status === 'sent';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? 'Sent' : 'Failed'}
    </span>
  );
}

function MethodBadge({ method }) {
  if (method === 'both') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
        <Mail size={12} /><MessageSquare size={12} /> Both
      </span>
    );
  }
  if (method === 'email') return <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Mail size={12} /> Email</span>;
  if (method === 'text') return <span className="inline-flex items-center gap-1 text-xs text-slate-600"><MessageSquare size={12} /> Text</span>;
  return <span className="text-xs text-slate-400">—</span>;
}

export default function ReviewLinkLog() {
  const { supabaseFetch } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await supabaseFetch('review_link_log', 'select=*&order=sent_at.desc&limit=1000');
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setError('Could not load the log.');
      }
      setLoading(false);
    })();
  }, [supabaseFetch]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (dateFrom && (!r.sent_at || r.sent_at.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!r.sent_at || r.sent_at.slice(0, 10) > dateTo)) return false;
      if (!needle) return true;
      const hay = [r.sent_by_name, r.sent_by_email, r.location_name, r.client_name, r.pipedrive_deal_id]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, dateFrom, dateTo]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2">Review Link Log</h1>
        <p className="text-slate-500">A complete record of every review link sent — who sent it, which location, and to which client.</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee, location, client, or deal ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue" />
        </div>
        {(q || dateFrom || dateTo) && (
          <button onClick={() => { setQ(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline">
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {rows.length} sends</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400 text-sm">
          {rows.length === 0 ? 'No review links sent yet.' : 'No sends match these filters.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Sent By</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDateTime(r.sent_at)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.sent_by_name || r.sent_by_email || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.location_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.client_name || '—'}</td>
                  <td className="px-4 py-3">
                    {r.pipedrive_deal_id ? (
                      
                       <a
href={`https://asapcreditrepair.pipedrive.com/deal/${r.pipedrive_deal_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-asap-blue hover:underline"
                      >
                        {r.pipedrive_deal_id} <ExternalLink size={12} />
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3"><MethodBadge method={r.delivery_method} /></td>
                  <td className="px-4 py-3"><StatusPill status={r.overall_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
