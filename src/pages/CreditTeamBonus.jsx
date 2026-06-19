import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, XCircle, Trophy, Save, Users, AlertTriangle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

const POOL = 300;
const fmt = (n) => '$' + Math.round(n || 0).toLocaleString();

// The five core operational metrics. All must pass for the team to earn the pool.
const METRICS = [
  { key: 'round3_cohort_rate', label: 'Round 3 Cohort Rate (120 Days)', unit: '%', standard: 20, cmp: 'gte',
    desc: 'Percentage of clients progressing into Round 3 within the 120-day window.' },
  { key: 'ontime_r1_rate', label: 'On-Time Starts (R1)', unit: '%', standard: 100, cmp: 'gte',
    desc: 'Round 1 files started within expected timing thresholds. Standard is 100%.' },
  { key: 'day4_delay_count', label: 'Day 4+ Delay Count', unit: '', standard: 0, cmp: 'eq',
    desc: 'Sends delayed beyond 3 business days. Standard is zero.', live: true },
  { key: 'fourth_round_rate', label: '4th Round Started %', unit: '%', standard: 25, cmp: 'gte',
    desc: 'Percentage of eligible clients progressing into a 4th round when appropriate.' },
  { key: 'round3_results_rate', label: 'Round 3 Results Rate', unit: '%', standard: 80, cmp: 'gte',
    desc: 'Effectiveness and consistency of results achieved during Round 3.' },
];

const standardText = (m) => (m.cmp === 'eq' ? `= ${m.standard}${m.unit}` : `\u2265 ${m.standard}${m.unit}`);

function passes(m, v) {
  if (v === null || v === undefined || v === '') return null; // not entered yet
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (m.cmp === 'gte') return n >= m.standard;
  if (m.cmp === 'eq') return n === m.standard;
  return false;
}

export default function CreditTeamBonus() {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [values, setValues] = useState({});      // saved metric values for the month
  const [draft, setDraft] = useState({});         // admin edit buffer
  const [members, setMembers] = useState([]);
  const [liveDay4, setLiveDay4] = useState(null); // current overdue count (reference)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const load = async (m) => {
    setLoading(true);
    try {
      const [rowRes, userRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/credit_team_bonus?month=eq.${m}&select=*`, { headers: supaHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.credit_team&select=id,name&order=name`, { headers: supaHeaders }),
      ]);
      const rows = rowRes.ok ? await rowRes.json() : [];
      const row = rows[0] || {};
      const v = {};
      METRICS.forEach((mt) => { v[mt.key] = row[mt.key] ?? null; });
      setValues(v);
      setDraft(v);
      setSavedAt(row.updated_at || null);
      setMembers(userRes.ok ? await userRes.json() : []);
    } catch (e) {
      setValues({}); setDraft({}); setMembers([]);
    }
    // Live reference for the Day 4+ row (current queue snapshot, not month-scoped)
    fetch('/.netlify/functions/credit-team-metrics')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setLiveDay4(d?.rawCounts?.overdueDeals ?? d?.metrics?.disputeTurnaround?.details?.overdue ?? null); })
      .catch(() => {});
    setLoading(false);
  };

  useEffect(() => { load(month); }, [month]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { month, updated_at: new Date().toISOString() };
      METRICS.forEach((mt) => { payload[mt.key] = draft[mt.key] === '' || draft[mt.key] === null || draft[mt.key] === undefined ? null : Number(draft[mt.key]); });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/credit_team_bonus`, {
        method: 'POST',
        headers: { ...supaHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload),
      });
      if (res.ok) await load(month);
    } catch (e) { /* no-op */ }
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading Credit Team bonus\u2026</div>;

  const results = METRICS.map((m) => ({ m, ok: passes(m, values[m.key]) }));
  const allEntered = results.every((r) => r.ok !== null);
  const allMet = allEntered && results.every((r) => r.ok === true);
  const memberCount = members.length || 3;
  const perMember = POOL / memberCount;
  const dirty = METRICS.some((mt) => String(draft[mt.key] ?? '') !== String(values[mt.key] ?? ''));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Credit Team Bonus</h2>
          <p className="text-sm text-slate-500">Elite Team Performance \u2014 ${POOL} pool, all five operational metrics must be met.</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {/* Eligibility banner */}
      <div className={`rounded-xl border p-5 ${allMet ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Trophy size={28} className={allMet ? 'text-green-600' : 'text-slate-300'} />
            <div>
              <div className="font-semibold text-slate-800">
                {allMet ? 'Bonus earned this month' : allEntered ? 'Not all metrics met \u2014 no bonus this month' : 'Awaiting metric entry'}
              </div>
              <div className="text-sm text-slate-500">
                {allMet
                  ? `${fmt(POOL)} pool \u00f7 ${memberCount} members = ${fmt(perMember)} each`
                  : `${results.filter((r) => r.ok === true).length} of ${METRICS.length} metrics met. All five are required.`}
              </div>
            </div>
          </div>
          <div className={`text-2xl font-bold ${allMet ? 'text-green-600' : 'text-slate-300'}`}>{fmt(allMet ? POOL : 0)}</div>
        </div>
      </div>

      {/* Metric scorecard */}
      <div className="bg-white rounded-xl border shadow-sm divide-y">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Core Operational Metrics</h3>
          {isAdmin && (
            <button onClick={save} disabled={saving || !dirty}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${dirty && !saving ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-100 text-slate-400'}`}>
              <Save size={15} /> {saving ? 'Saving\u2026' : 'Save month'}
            </button>
          )}
        </div>
        {results.map(({ m, ok }) => (
          <div key={m.key} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {ok === true && <CheckCircle size={18} className="text-green-500 shrink-0" />}
                {ok === false && <XCircle size={18} className="text-rose-500 shrink-0" />}
                {ok === null && <span className="w-[18px] h-[18px] rounded-full border-2 border-slate-200 shrink-0" />}
                <span className="font-medium text-slate-800">{m.label}</span>
                <span className="text-xs text-slate-400">Standard {standardText(m)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 ml-6">{m.desc}</p>
              {m.live && liveDay4 != null && (
                <p className="text-xs text-amber-600 mt-1 ml-6 flex items-center gap-1">
                  <AlertTriangle size={12} /> Live queue reference: {liveDay4} deal{liveDay4 === 1 ? '' : 's'} currently past 3 business days
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {isAdmin ? (
                <div className="flex items-center gap-1 justify-end">
                  <input type="number" value={draft[m.key] ?? ''} onChange={(e) => setDraft({ ...draft, [m.key]: e.target.value })}
                    className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm text-right" placeholder="\u2014" />
                  {m.unit && <span className="text-sm text-slate-400">{m.unit}</span>}
                </div>
              ) : (
                <span className="text-lg font-semibold text-slate-800">{values[m.key] ?? '\u2014'}{values[m.key] != null ? m.unit : ''}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Members + payout */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Users size={18} className="text-slate-500" />
          <h3 className="font-bold text-slate-800">Team Members</h3>
          <span className="text-sm text-slate-400">({memberCount})</span>
        </div>
        <div className="divide-y">
          {(members.length ? members : [{ id: 'placeholder', name: 'Credit Team members (set department = Credit Team in Admin Users)' }]).map((u) => (
            <div key={u.id} className="p-4 flex items-center justify-between">
              <span className="text-slate-700">{u.name}</span>
              <span className={`font-semibold ${allMet ? 'text-green-600' : 'text-slate-300'}`}>{fmt(allMet ? perMember : 0)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Payout is calculated at month-end and paid on the 15th of the following month. The team bonus is all-or-nothing:
        every one of the five metrics must meet its standard for the pool to be earned.
        {savedAt ? ` Last saved ${new Date(savedAt).toLocaleString()}.` : ''}
      </p>
    </div>
  );
}
