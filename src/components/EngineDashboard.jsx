// src/components/EngineDashboard.jsx
// The affiliate engine's mission control: live status, Up Next queue, KPI
// cards with date/channel filters, searchable send feed with exact bodies.
import React, { useState, useEffect } from 'react';

const fmtDT = (d) => new Date(d).toLocaleString();

export default function EngineDashboard() {
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('today');
  const [channel, setChannel] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetch('/.netlify/functions/affiliate-engine-status').then(r => r.json()).catch(e => ({ error: e.message })),
        fetch('/.netlify/functions/affiliate-activity?limit=500').then(r => r.json()).catch(e => ({ error: e.message }))
      ]);
      setStatus(s); setActivity(a);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const packet = (t) => { try { const p = JSON.parse(t.detail); return (p && typeof p === 'object') ? p : {}; } catch (e) { return {}; } };
  const dayCT = (x) => new Date(x).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const match = (t) => {
    if (channel !== 'all' && t.channel !== channel) return false;
    if (q && !(`${t.org_name || ''} ${t.contact_name || ''} ${t.subject || ''}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (range === 'all') return true;
    if (range === 'today') return dayCT(t.created_at) === dayCT(Date.now());
    if (range === 'yesterday') return dayCT(t.created_at) === dayCT(Date.now() - 86400000);
    const days = range === '7d' ? 7 : 30;
    return (Date.now() - new Date(t.created_at).getTime()) <= days * 86400000;
  };
  const rows = ((activity && activity.rows) || []).filter(match);
  const emails = rows.filter(t => t.channel === 'email');
  const opened = emails.filter(t => t.status === 'opened' || t.status === 'clicked').length;
  const clicked = emails.filter(t => t.status === 'clicked').length;
  const bounced = emails.filter(t => t.status === 'bounced').length;
  const pct = (n, d) => d ? `${Math.round((n / d) * 100)}%` : '\u2014';
  const Chip = ({ id, label, cur, set }) => (
    <button onClick={() => set(id)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cur === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{label}</button>
  );

  return (
    <div className="space-y-3 mb-6">
      {/* Status bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        {!status ? <p className="text-xs text-slate-400">Checking engine{'\u2026'}</p>
         : status.error ? <p className="text-xs text-red-600">Engine status error: {status.error}</p>
         : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${status.enabled ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                {status.enabled ? 'Engine RUNNING' : 'Engine PAUSED'}
              </span>
              <span className="text-slate-600">Today: <b>{status.today.emails}</b> emails {'\u00b7'} <b>{status.today.sms}</b> SMS {'\u00b7'} <b>{status.today.calls}</b> call tasks</span>
              <span className="text-slate-500 text-xs">Last send: {status.lastTouch ? `${status.lastTouch.channel} ${fmtDT(status.lastTouch.created_at)}` : 'never'}</span>
              <span className="text-slate-400 text-xs">Runs weekdays {'\u00b7'} SMS 9am{'\u2013'}6pm CT</span>
              <button onClick={load} disabled={loading} className="ml-auto text-xs text-blue-600 hover:underline disabled:opacity-50">{loading ? 'Refreshing\u2026' : 'Refresh'}</button>
            </div>
            <details>
              <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Up next ({status.upNextCount || 0} queued for the next run)</summary>
              {(status.upNext || []).length === 0 ? <p className="text-xs text-slate-400 mt-1">Nothing due right now.</p> : (
                <div className="mt-1 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {status.upNext.map((u, i) => (
                    <div key={i} className="py-1.5 text-xs flex items-start gap-2">
                      <span className="font-medium text-slate-800 flex-shrink-0">{u.org}</span>
                      <span className="text-slate-500">{u.plan}</span>
                    </div>
                  ))}
                </div>
              )}
            </details>
          </div>
        )}
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All']].map(([id, l]) => <Chip key={id} id={id} label={l} cur={range} set={setRange} />)}
        <span className="mx-1 text-slate-300">|</span>
        {[['all', 'All'], ['email', 'Emails'], ['sms', 'SMS'], ['call', 'Calls']].map(([id, l]) => <Chip key={'c' + id} id={id} label={l} cur={channel} set={setChannel} />)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / subject\u2026"
          className="ml-auto text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 w-52" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {[['Touches', rows.length], ['Emails', emails.length], ['SMS', rows.filter(t => t.channel === 'sms').length], ['Call tasks', rows.filter(t => t.channel === 'call').length], ['Opened', `${opened} (${pct(opened, emails.length)})`], ['Clicked', `${clicked} (${pct(clicked, emails.length)})`], ['Bounced', bounced]].map(([l, v]) => (
          <div key={l} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{v}</p>
            <p className="text-[11px] text-slate-400">{l}</p>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {!activity ? <p className="p-4 text-sm text-slate-400 text-center">Loading{'\u2026'}</p>
         : rows.length === 0 ? <p className="p-4 text-sm text-slate-400 text-center">No sends match these filters.</p>
         : rows.map(t => (
          <div key={t.id} className="p-3 flex items-start gap-3 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${t.channel === 'email' ? 'bg-blue-100 text-blue-700' : t.channel === 'sms' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{t.channel}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800 truncate">{t.org_name}{t.contact_name ? ` \u00b7 ${t.contact_name}` : ''}</p>
              <p className="text-xs text-slate-500 truncate">{t.segment} step {t.step_number}{t.subject ? ` \u00b7 ${t.subject}` : ''}{packet(t).ai ? ' \u00b7 AI personalized' : ''}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-500">{fmtDT(t.created_at)}</p>
              <p className={`text-[11px] font-semibold ${['sent', 'task_created', 'opened', 'clicked'].includes(t.status) ? 'text-green-600' : 'text-red-600'}`}>{t.status}</p>
            </div>
            {packet(t).body && <button onClick={() => setView(t)} className="text-xs text-indigo-600 hover:underline flex-shrink-0">View</button>}
          </div>
        ))}
      </div>

      {/* View modal */}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setView(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{view.channel === 'sms' ? 'SMS sent' : (view.subject || 'Email sent')}</div>
                <div className="text-xs text-slate-400">{view.org_name} {'\u00b7'} {fmtDT(view.created_at)} {'\u00b7'} step {view.step_number} {'\u00b7'} {view.status}</div>
              </div>
              <button onClick={() => setView(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">{'\u00D7'}</button>
            </div>
            <div className="overflow-y-auto p-5 text-sm text-slate-700 whitespace-pre-wrap">{packet(view).body}</div>
          </div>
        </div>
      )}
    </div>
  );
}
