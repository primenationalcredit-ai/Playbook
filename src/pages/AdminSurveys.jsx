import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  ClipboardList, Star, TrendingUp, MessageSquare,
  ThumbsUp, ThumbsDown, Search, Download, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// The Round 2 ("2ND RD DONE") client survey — the live one that rates the Account Manager.
function AdminSurveys() {
  const [responses, setResponses] = useState([]);   // client_surveys, survey_type = round2_am
  const [sends, setSends] = useState([]);            // survey_sends (real sends, not the seed backlog)
  const [loading, setLoading] = useState(true);
  const [filterAM, setFilterAM] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadResponses(), loadSends()]);
    setLoading(false);
  };
  const loadResponses = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/client_surveys?survey_type=eq.round2_am&order=created_at.desc&select=*`, { headers: supaHeaders });
      if (res.ok) setResponses(await res.json());
    } catch (e) { console.error('responses', e); }
  };
  const loadSends = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/survey_sends?survey_type=eq.round2_am&source=neq.backlog_seed&order=sent_at.desc&select=*`, { headers: supaHeaders });
      if (res.ok) setSends(await res.json());
    } catch (e) { console.error('sends', e); }
  };

  const handleResend = async (sendId) => {
    setResendingId(sendId);
    try {
      await fetch('/.netlify/functions/resend-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ send_id: sendId }) });
      await loadSends();
    } catch (e) {}
    setResendingId(null);
  };

  const respTime = (r) => r.created_at || r.submitted_at;
  const inRange = (d) => {
    if (dateRange === 'all' || !d) return true;
    const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
    return (Date.now() - new Date(d).getTime()) <= days * 86400000;
  };

  // AM list for the filter
  const amNames = Array.from(new Set([
    ...responses.map(r => (r.am_name || '').trim()),
    ...sends.map(s => (s.am_name || '').trim()),
  ].filter(Boolean))).sort();

  // Filtered responses (the detail list)
  const filtered = responses.filter(r => {
    if (filterAM !== 'all' && (r.am_name || '').trim() !== filterAM) return false;
    if (!inRange(respTime(r))) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(r.client_name || '').toLowerCase().includes(q) && !(r.client_email || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats from the (filtered) responses
  const rated = filtered.filter(r => r.am_rating != null);
  const sat = filtered.filter(r => r.overall_satisfaction != null);
  const nps = filtered.filter(r => r.nps_score != null);
  const avg = (arr, key) => arr.length ? (arr.reduce((a, r) => a + Number(r[key] || 0), 0) / arr.length).toFixed(1) : 'N/A';
  const promoters = nps.filter(r => r.nps_score >= 9).length;
  const passives = nps.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length;
  const detractors = nps.filter(r => r.nps_score <= 6).length;
  const npsScore = nps.length ? Math.round(((promoters - detractors) / nps.length) * 100) : 'N/A';

  // Send/response status table (latest send per person + whether they responded)
  const respByPerson = {};
  responses.forEach(r => { const pid = String(r.pipedrive_person_id || ''); if (pid) respByPerson[pid] = r; });
  const latestSend = {};
  sends.forEach(s => { const pid = String(s.person_id); if (!latestSend[pid] || new Date(s.sent_at) > new Date(latestSend[pid].sent_at)) latestSend[pid] = s; });
  const sendRows = Object.values(latestSend)
    .filter(s => filterAM === 'all' || (s.am_name || '').trim() === filterAM)
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
  const isBad = (r) => r && ((r.am_rating != null && r.am_rating <= 6) || (r.overall_satisfaction != null && r.overall_satisfaction <= 6));
  const respondedCount = sendRows.filter(s => respByPerson[String(s.person_id)]).length;

  const exportCSV = () => {
    const head = ['Date', 'Client', 'Email', 'Account Manager', 'AM Rating (/10)', 'Overall (/10)', 'Work Explained Clearly', 'NPS', 'What Could Improve'];
    const rows = filtered.map(r => [
      respTime(r) ? format(new Date(respTime(r)), 'yyyy-MM-dd') : '',
      r.client_name, r.client_email, r.am_name,
      r.am_rating ?? '', r.overall_satisfaction ?? '',
      r.met_expectations === true ? 'Yes' : r.met_expectations === false ? 'No' : '',
      r.nps_score ?? '', (r.what_could_improve || '').replace(/,/g, ';'),
    ]);
    const csv = [head, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `round2-surveys-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const StatCard = ({ icon, label, value, color = 'text-slate-800' }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-sm text-slate-500">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );

  const ratingPill = (label, v) => (
    <span className={`text-xs px-2 py-0.5 rounded-full ${v == null ? 'bg-slate-100 text-slate-500' : v <= 6 ? 'bg-red-100 text-red-700' : v <= 8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
      {label} {v ?? '—'}/10
    </span>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Survey Results</h1>
          <p className="text-slate-500">Round 2 client satisfaction surveys, the AM rating sent when a client reaches "2ND RD DONE."</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium">
            <RefreshCw size={18} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={<ClipboardList size={18} className="text-blue-500" />} label="Responses" value={filtered.length} />
        <StatCard icon={<MessageSquare size={18} className="text-slate-500" />} label="Sent" value={sendRows.length} />
        <StatCard icon={<TrendingUp size={18} className="text-indigo-500" />} label="Response Rate" value={sendRows.length ? `${Math.round((respondedCount / sendRows.length) * 100)}%` : 'N/A'} color="text-indigo-600" />
        <StatCard icon={<Star size={18} className="text-amber-400" />} label="Avg AM Rating" value={`${avg(rated, 'am_rating')}/10`} color="text-amber-600" />
        <StatCard icon={<ThumbsUp size={18} className="text-green-500" />} label="Avg Overall" value={`${avg(sat, 'overall_satisfaction')}/10`} color="text-green-600" />
        <StatCard icon={<TrendingUp size={18} className="text-blue-500" />} label="NPS" value={npsScore} color="text-blue-600" />
      </div>

      {/* NPS breakdown */}
      {nps.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Net Promoter Score</h3>
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-center"><p className="text-4xl font-bold text-blue-600">{npsScore}</p><p className="text-sm text-slate-500">NPS</p></div>
            <div className="flex-1 flex gap-4">
              <div className="flex-1 bg-green-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-green-600">{promoters}</p><p className="text-xs text-green-700">Promoters (9-10)</p></div>
              <div className="flex-1 bg-amber-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-amber-600">{passives}</p><p className="text-xs text-amber-700">Passives (7-8)</p></div>
              <div className="flex-1 bg-red-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-red-600">{detractors}</p><p className="text-xs text-red-700">Detractors (0-6)</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search by client name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filterAM} onChange={(e) => setFilterAM(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="all">All Account Managers</option>
            {amNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Sent & response status + resend */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Sent &amp; Responses</h2>
            <p className="text-sm text-slate-500">Who the survey went to, who responded, and a resend for anyone still pending. {sendRows.length} sent · {respondedCount} responded.</p>
          </div>
          <MessageSquare size={20} className="text-blue-500" />
        </div>
        {sendRows.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">No surveys sent yet. Clients appear here as they reach "2ND RD DONE."</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-5 py-2 font-medium">Client</th>
                  <th className="px-5 py-2 font-medium">Account Manager</th>
                  <th className="px-5 py-2 font-medium">Sent</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sendRows.map((s) => {
                  const resp = respByPerson[String(s.person_id)];
                  const bad = isBad(resp);
                  return (
                    <tr key={s.id} className={bad ? 'bg-red-50' : ''}>
                      <td className="px-5 py-3 font-medium text-slate-800">{s.client_name || 'Client'}</td>
                      <td className="px-5 py-3 text-slate-600">{s.am_name || '—'}</td>
                      <td className="px-5 py-3 text-slate-500">{s.sent_at ? format(new Date(s.sent_at), 'MMM d') : ''}</td>
                      <td className="px-5 py-3">
                        {resp ? (
                          <span className={bad ? 'text-red-600 font-semibold' : 'text-green-600 font-medium'}>Responded · AM {resp.am_rating ?? '?'}/10 · Overall {resp.overall_satisfaction ?? '?'}/10</span>
                        ) : (
                          <span className="text-amber-600">Awaiting response</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!resp && (
                          <button onClick={() => handleResend(s.id)} disabled={resendingId === s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                            <RefreshCw size={14} className={resendingId === s.id ? 'animate-spin' : ''} /> {resendingId === s.id ? 'Sending' : 'Resend'}
                          </button>
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

      {/* Response detail list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-bold text-slate-800">Responses ({filtered.length})</h2></div>
        {loading ? (
          <div className="p-12 text-center text-slate-500"><RefreshCw size={32} className="mx-auto mb-4 animate-spin text-slate-300" /><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500"><ClipboardList size={48} className="mx-auto mb-4 text-slate-300" /><p className="font-medium">No responses yet</p><p className="text-sm">They show up here as clients complete the survey.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(r => {
              const bad = isBad(r);
              return (
                <div key={r.id} className="hover:bg-slate-50">
                  <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bad ? 'bg-red-100' : 'bg-green-100'}`}>
                      {bad ? <ThumbsDown size={20} className="text-red-600" /> : <ThumbsUp size={20} className="text-green-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 truncate">{r.client_name}</p>
                        <span className="text-xs text-slate-500">AM: {r.am_name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {ratingPill('AM', r.am_rating)}
                        {ratingPill('Overall', r.overall_satisfaction)}
                        {r.nps_score != null && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">NPS {r.nps_score}</span>}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500 hidden lg:block">{respTime(r) ? format(new Date(respTime(r)), 'MMM d, yyyy') : ''}</div>
                    {expanded === r.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </div>
                  {expanded === r.id && (
                    <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <h4 className="text-sm font-semibold text-slate-600 mb-3">Details</h4>
                          <div className="space-y-2 text-sm">
                            <p><span className="text-slate-500">Client:</span> {r.client_name}</p>
                            {r.client_email && <p><span className="text-slate-500">Email:</span> {r.client_email}</p>}
                            {r.client_phone && <p><span className="text-slate-500">Phone:</span> {r.client_phone}</p>}
                            <p><span className="text-slate-500">Account Manager:</span> {r.am_name || '—'}</p>
                            <p><span className="text-slate-500">AM Rating:</span> {r.am_rating ?? '—'}/10</p>
                            <p><span className="text-slate-500">Overall Satisfaction:</span> {r.overall_satisfaction ?? '—'}/10</p>
                            <p className="flex items-center gap-2"><span className="text-slate-500">Work explained clearly:</span> {r.met_expectations === true ? <ThumbsUp size={15} className="text-green-500" /> : r.met_expectations === false ? <ThumbsDown size={15} className="text-red-500" /> : '—'}</p>
                            {r.nps_score != null && <p><span className="text-slate-500">Would recommend (NPS):</span> {r.nps_score}/10</p>}
                            <p><span className="text-slate-500">Submitted:</span> {respTime(r) ? format(new Date(respTime(r)), 'PPp') : '—'}</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2"><MessageSquare size={16} /> What could improve</h4>
                          {r.what_could_improve ? <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{r.what_could_improve}</p> : <p className="text-sm text-slate-400 italic">No comment provided</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSurveys;
