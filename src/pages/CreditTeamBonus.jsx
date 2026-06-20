import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, XCircle, Trophy, Save, Users, AlertTriangle, Zap } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

const fmt = (n) => '$' + Math.round(n || 0).toLocaleString();

// Labels + descriptions keyed to what the metrics function returns.
const META = {
  round3_cohort: { label: 'Round 3 Cohort Rate (Stall Rate)', desc: 'Of clients who started 120 to 210 days ago (old enough to be in Round 3), the share that actually reached Round 3. The rest stalled.', cmp: 'gte' },
  ontime_r1: { label: 'On-Time Starts (R1)', desc: 'Round 1 disputes must be submitted by the 5th business day. The submission filter should be empty by 5pm CST. Standard is 100% (none left).', cmp: 'gte' },
  day4_delay: { label: 'Day 4+ Delay Count', desc: 'After each round (1, 2, or 3), the team has 4 business days to send the next round and clear the deal out of Reports Received. Counts deals past that window.', cmp: 'eq' },
  fourth_round: { label: '4th Round Started %', desc: 'Of clients who completed Round 3, the share that started a 4th round.', cmp: 'gte' },
  round3_results: { label: 'Round 3 Results Rate', desc: 'Of clients who completed Round 3, the share that achieved results. Manual entry until a source is wired.', cmp: 'gte' },
};
const ORDER = ['round3_cohort', 'ontime_r1', 'day4_delay', 'fourth_round', 'round3_results'];
const stdText = (m) => (META[m.key]?.cmp === 'eq' ? `= ${m.standard}${m.unit}` : `\u2265 ${m.standard}${m.unit}`);

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

  if (loading) return <div className="p-6 text-center text-slate-500">Loading Credit Team bonus\u2026</div>;
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
          <p className="text-sm text-slate-500">Elite Team Performance \u2014 ${data.pool} pool, all five operational metrics must be met.</p>
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
                {allMet ? 'Bonus earned this month' : `Not yet \u2014 ${metCount} of 5 metrics met`}
              </div>
              <div className="text-sm text-slate-500">
                {allMet
                  ? `${fmt(data.pool)} pool \u00f7 ${memberCount} members = ${fmt(perMember)} each`
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
          return (
            <div key={m.key} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {m.met && <CheckCircle size={18} className="text-green-500 shrink-0" />}
                  {!m.met && entered && <XCircle size={18} className="text-rose-500 shrink-0" />}
                  {!entered && <span className="w-[18px] h-[18px] rounded-full border-2 border-slate-200 shrink-0" />}
                  <span className="font-medium text-slate-800">{meta.label}</span>
                  <span className="text-xs text-slate-400">Standard {stdText(m)}</span>
                  {m.source === 'auto'
                    ? <span className="text-[10px] uppercase tracking-wide bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Zap size={10} /> Auto</span>
                    : <span className="text-[10px] uppercase tracking-wide bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Manual</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1 ml-6">{meta.desc}</p>
                {m.source === 'auto' && m.detail && (
                  <p className="text-xs text-slate-400 mt-1 ml-6">
                    {m.key === 'round3_cohort' && `${m.detail.reachedR3} of ${m.detail.cohort} reached Round 3 · ${m.detail.stalled} stalled (started 120 to 210 days ago)`}
                    {m.key === 'fourth_round' && `${m.detail.startedR4} of ${m.detail.eligible} R3-complete clients started a 4th round`}
                    {m.key === 'day4_delay' && `${m.detail.overdue} deal${m.detail.overdue === 1 ? '' : 's'} past 4 business days in Reports Received (queue of ${m.detail.queue})`}
                    {m.key === 'ontime_r1' && `${m.detail.dueOrLate} Round 1 deal${m.detail.dueOrLate === 1 ? '' : 's'} still in the submission filter`}
                    {m.key === 'round3_results' && m.detail.completed != null && `${m.detail.gotResults} of ${m.detail.completed} Round 3 completions had items removed`}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {m.source === 'manual' && isAdmin ? (
                  <div className="flex items-center gap-1 justify-end">
                    <input type="number" value={resultsDraft ?? ''} onChange={(e) => setResultsDraft(e.target.value)}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm text-right" placeholder="\u2014" />
                    <span className="text-sm text-slate-400">%</span>
                    <button onClick={saveResults} disabled={saving || !resultsDirty}
                      className={`ml-1 p-1.5 rounded-lg ${resultsDirty && !saving ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-100 text-slate-400'}`} title="Save">
                      <Save size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="text-lg font-semibold text-slate-800">{entered ? `${m.value}${m.unit}` : '\u2014'}</span>
                )}
              </div>
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
