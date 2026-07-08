import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, XCircle, Trophy, Save, Users, AlertTriangle, Zap, Info, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

const fmt = (n) => '$' + Math.round(n || 0).toLocaleString();

// Labels + descriptions keyed to what the metrics function returns.
const META = {
  round3_cohort: { label: 'Round 3 Cohort Rate (Stall Rate)', cmp: 'gte',
    how: 'We look at clients who started 120 to 210 days ago, old enough to be in Round 3 by now (each round runs about 45 days). Of that group, we count how many reached Round 3. That count divided by the group is the percentage. Everyone who did not reach Round 3 stalled, they stopped sending reports or stopped paying. Higher is better. The list below is the stalled clients.', listLabel: 'Stalled clients (in window, never reached Round 3)' },
  ontime_r1: { label: 'On-Time Starts (R1)', cmp: 'gte',
    how: 'Round 1 disputes must be submitted by the 5th business day. The submission list in Pipedrive should be empty by 5pm CST. If anything is still in it, Round 1s went out late. Target is 100% on time (nothing left in the list). The list below is anything still overdue.', listLabel: 'Round 1 deals still in the submission list' },
  day4_delay: { label: 'Day 4+ Delay Count', cmp: 'eq',
    how: 'After any round’s reports come in, the team has 4 business days to send the next round and clear the client out of Reports Received. This counts anyone sitting there longer than 4 business days. Target is zero, no backlog. The list below is each client past the window and how long they have waited.', listLabel: 'Clients past 4 business days in Reports Received' },
  fourth_round: { label: '4th Round Started %', cmp: 'lte',
    how: 'We look at clients who ended Round 3 in the last 90 days. Of that group, how many started a 4th round. That divided by the group is the percentage. We keep 4th rounds low, so this is a ceiling, 25% or under passes. Lower is better. The list below is the clients who started a 4th round.', listLabel: 'Clients who started a 4th round' },
  round3_results: { label: 'Round 3 Results Rate', cmp: 'gte',
    how: 'We look at the Round 3 result entries logged in the Master Dispute Tracking sheet, dated this month. Of those, how many had at least one item removed. That divided by the total is the percentage. Higher is better. The list below is this month’s Round 3 results, each marked removed or nothing removed.', listLabel: 'This month’s Round 3 results' },
};
const BUCKET_BADGE = {
  payment: ['Payment', 'bg-amber-50 text-amber-700 border-amber-200'],
  logins: ['Logins', 'bg-red-50 text-red-600 border-red-200'],
  round2_in_progress: ['In Rd 2', 'bg-sky-50 text-sky-700 border-sky-200'],
  other: ['Other', 'bg-slate-100 text-slate-500 border-slate-200'],
};
const ORDER = ['round3_cohort', 'ontime_r1', 'day4_delay', 'fourth_round', 'round3_results'];
const stdText = (m) => {
  const c = META[m.key]?.cmp; const s = `${m.standard}${m.unit}`;
  return c === 'eq' ? `= ${s}` : c === 'lte' ? `≤ ${s}` : `≥ ${s}`;
};
const DEAL_URL = (id) => `https://asapcreditrepairusa.pipedrive.com/deal/${id}`;

export default function CreditTeamBonus() {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resultsDraft, setResultsDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);

  const load = async (mo) => {
    setLoading(true);
    try {
      const res = await fetch(`/.netlify/functions/credit-team-bonus-metrics?month=${mo}`);
      const d = res.ok ? await res.json() : null;
      setData(d);
      setResultsDraft(d?.metrics?.round3_results?.value ?? '');
    } catch (e) { setData(null); }
    setLoading(false);
  };

  useEffect(() => { load(month); }, [month]);

  const saveResults = async () => {
    setSaving(true);
    try {
      const val = resultsDraft === '' || resultsDraft == null ? null : Number(resultsDraft);
      await fetch(`${SUPABASE_URL}/rest/v1/credit_team_bonus`, {
        method: 'POST',
        headers: { ...supaHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ month, round3_results_rate: val, updated_at: new Date().toISOString() }),
      });
      await load(month);
    } catch (e) { /* no-op */ }
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading Credit Team bonus…</div>;
  if (!data || data.error) return <div className="p-6 text-center text-rose-500">Could not load metrics{data?.error ? `: ${data.error}` : ''}.</div>;

  const metrics = ORDER.map((key) => ({ key, ...data.metrics[key] }));
  const allMet = data.allMet;
  const memberCount = data.members?.length || 3;
  const perMember = data.perMember || 100;
  const metCount = metrics.filter((m) => m.met).length;
  const resultsDirty = String(resultsDraft ?? '') !== String(data.metrics.round3_results.value ?? '');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Credit Team Bonus</h2>
          <p className="text-sm text-slate-500">Elite Team Performance — ${data.pool} pool, all five operational metrics must be met.</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {data.warming && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          First-time pipeline scan is running in the background. The Round 3 Cohort and 4th Round numbers will populate in a minute, refresh the page shortly.
        </div>
      )}

      {/* Eligibility banner */}
      <div className={`rounded-xl border p-5 ${allMet ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Trophy size={28} className={allMet ? 'text-green-600' : 'text-slate-300'} />
            <div>
              <div className="font-semibold text-slate-800">
                {allMet ? 'Bonus earned this month' : `Not yet — ${metCount} of 5 metrics met`}
              </div>
              <div className="text-sm text-slate-500">
                {allMet
                  ? `${fmt(data.pool)} pool ÷ ${memberCount} members = ${fmt(perMember)} each`
                  : 'All five metrics are required for the team to earn the pool.'}
              </div>
            </div>
          </div>
          <div className={`text-2xl font-bold ${allMet ? 'text-green-600' : 'text-slate-300'}`}>{fmt(allMet ? data.pool : 0)}</div>
        </div>
      </div>

      {/* Metric scorecard */}
      <div className="bg-white rounded-xl border shadow-sm divide-y">
        <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Core Operational Metrics</h3></div>
        {metrics.map((m) => {
          const meta = META[m.key];
          const entered = m.value != null;
          const isOpen = open === m.key;
          const clients = (m.detail && m.detail.clients) || [];
          return (
            <div key={m.key}>
              <div className="p-4 flex items-start justify-between gap-4">
                <button type="button" onClick={() => setOpen(isOpen ? null : m.key)} className="min-w-0 text-left flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isOpen ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                    {m.met && <CheckCircle size={18} className="text-green-500 shrink-0" />}
                    {!m.met && entered && <XCircle size={18} className="text-rose-500 shrink-0" />}
                    {!entered && <span className="w-[18px] h-[18px] rounded-full border-2 border-slate-200 shrink-0" />}
                    <span className="font-medium text-slate-800">{meta.label}</span>
                    <span className="text-xs text-slate-400">Standard {stdText(m)}</span>
                    {m.source === 'auto'
                      ? <span className="text-[10px] uppercase tracking-wide bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Zap size={10} /> Auto</span>
                      : <span className="text-[10px] uppercase tracking-wide bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Manual</span>}
                  </div>
                  {m.detail && (
                    <p className="text-xs text-slate-400 mt-1 ml-6">
                      {m.key === 'round3_cohort' && `${m.detail.reachedR3} of ${m.detail.cohort} reached Round 3 · ${m.detail.stalled} stalled${m.detail.buckets ? ` (${m.detail.buckets.payment || 0} payment · ${m.detail.buckets.logins || 0} logins · ${m.detail.buckets.round2_in_progress || 0} in Rd 2 · ${m.detail.buckets.other || 0} other)` : ' (started 120 to 210 days ago)'}${m.detail.excludedPayment ? ` · ${m.detail.excludedPayment} excluded: payment hold at Rd 1` : ''}`}
                      {m.key === 'fourth_round' && `${m.detail.startedR4} of ${m.detail.endedR3In90d} clients who ended Round 3 in the last 90 days started a 4th round`}
                      {m.key === 'day4_delay' && `${m.detail.overdue} deal${m.detail.overdue === 1 ? '' : 's'} past 4 business days in Reports Received (queue of ${m.detail.queue})`}
                      {m.key === 'ontime_r1' && `${m.detail.dueOrLate} Round 1 deal${m.detail.dueOrLate === 1 ? '' : 's'} still in the submission filter`}
                      {m.key === 'round3_results' && m.detail.completed != null && `${m.detail.gotResults} of ${m.detail.completed} Round 3 results had items removed`}
                    </p>
                  )}
                  <span className="text-xs text-blue-600 mt-1 ml-6 inline-flex items-center gap-1">
                    <Info size={12} /> {isOpen ? 'Hide details' : 'How it’s calculated · view clients'}
                  </span>
                </button>
                <div className="shrink-0 text-right">
                  {m.source === 'manual' && isAdmin ? (
                    <div className="flex items-center gap-1 justify-end">
                      <input type="number" value={resultsDraft ?? ''} onChange={(e) => setResultsDraft(e.target.value)}
                        className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm text-right" placeholder="—" />
                      <span className="text-sm text-slate-400">%</span>
                      <button onClick={saveResults} disabled={saving || !resultsDirty}
                        className={`ml-1 p-1.5 rounded-lg ${resultsDirty && !saving ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-100 text-slate-400'}`} title="Save">
                        <Save size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-lg font-semibold text-slate-800">{entered ? `${m.value}${m.unit}` : '—'}</span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 ml-6 space-y-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed">
                    <div className="font-semibold text-slate-700 mb-1">How it’s calculated</div>
                    {meta.how}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600 mb-1">{meta.listLabel} ({clients.length})</div>
                    {clients.length === 0 ? (
                      <div className="text-xs text-slate-400">
                        {m.key === 'ontime_r1' ? 'All Round 1s on time — nothing in the list.'
                          : m.key === 'day4_delay' ? 'No delays — the queue is clear.'
                          : m.key === 'round3_results' ? 'No Round 3 results logged for this month yet.'
                          : 'No clients in this list.'}
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-lg divide-y max-h-72 overflow-auto">
                        {clients.map((c, i) => (
                          <div key={i} className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs">
                            {c.bucket && BUCKET_BADGE[c.bucket] && (
                              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${BUCKET_BADGE[c.bucket][1]}`}>{BUCKET_BADGE[c.bucket][0]}</span>
                            )}
                            {c.dealId ? (
                              <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 min-w-0">
                                <span className="truncate">{c.name}</span><ExternalLink size={11} className="shrink-0" />
                              </a>
                            ) : (
                              <span className="text-slate-700 truncate">{c.name}</span>
                            )}
                            {m.key === 'day4_delay' && <span className="text-slate-400 shrink-0">{c.days} bus. days</span>}
                            {m.key === 'round3_results' && (
                              <span className={`shrink-0 ${c.removed ? 'text-green-600' : 'text-rose-500'}`}>{c.removed ? 'items removed' : 'nothing removed'}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Members + payout */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Users size={18} className="text-slate-500" />
          <h3 className="font-bold text-slate-800">Team Members</h3>
          <span className="text-sm text-slate-400">({memberCount})</span>
        </div>
        <div className="divide-y">
          {(data.members?.length ? data.members : [{ id: 'placeholder', name: 'Set department = Credit Team in Admin Users to list members' }]).map((u) => (
            <div key={u.id} className="p-4 flex items-center justify-between">
              <span className="text-slate-700">{u.name}</span>
              <span className={`font-semibold ${allMet ? 'text-green-600' : 'text-slate-300'}`}>{fmt(allMet ? perMember : 0)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 flex items-start gap-1">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        Auto metrics read live from Pipedrive round dates and the Reports Received queue. Round 3 Results is manual until a results source is wired. Team bonus is all-or-nothing and paid on the 15th of the following month.
      </p>
    </div>
  );
}
