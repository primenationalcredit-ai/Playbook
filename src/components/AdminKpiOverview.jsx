import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, FileText, DollarSign, Users, Headphones,
  TrendingUp, RefreshCw, ChevronRight, ArrowRight
} from 'lucide-react';

// Department KPI definitions — mirrors the Scorecards page so numbers stay consistent.
const DEPARTMENTS = [
  {
    key: 'consultants', name: 'Consultants', Icon: DollarSign, accent: 'text-orange-600', bar: 'bg-orange-500',
    metrics: [
      { key: 'leadConversion', name: 'Lead Conversion', target: 45, unit: '%', dir: 'higher' },
      { key: 'onboardingSpeed', name: 'Onboarding Speed', target: 90, unit: '%', dir: 'higher' },
      { key: 'consultationTime', name: 'Consultation Response', target: 99, unit: '%', dir: 'higher' },
      { key: 'followUpCompletion', name: 'Overdue Follow-ups', target: 0, unit: '', dir: 'lower' },
      { key: 'clientRetention', name: 'Client Retention (50d)', target: 85, unit: '%', dir: 'higher' },
      { key: 'revenueGenerated', name: 'Revenue Generated', target: 50000, unit: '$', dir: 'higher' },
      { key: 'refundRate', name: 'Refund Rate', target: 5, unit: '%', dir: 'lower' },
    ],
  },
  {
    key: 'customer_support', name: 'Customer Support', Icon: Headphones, accent: 'text-cyan-600', bar: 'bg-cyan-500',
    metrics: [
      { key: 'reportAcquisition', name: 'Reports Collected', target: 47, unit: '', dir: 'higher' },
      { key: 'rptsToQtdConversion', name: 'Reports → Quoted', target: 50, unit: '%', dir: 'higher' },
      { key: 'qtdToDocConversion', name: 'Quoted → Docs', target: 40, unit: '%', dir: 'higher' },
      { key: 'reviewGeneration', name: 'Reviews Collected', target: 10, unit: '', dir: 'higher' },
    ],
  },
  {
    key: 'account_managers', name: 'Account Managers', Icon: Users, accent: 'text-emerald-600', bar: 'bg-emerald-500',
    metrics: [
      { key: 'cmsRetention', name: 'CMS Retention', target: 85, unit: '%', dir: 'higher' },
      { key: 'upsellCrossSell', name: 'Additional Rounds', target: 15, unit: '%', dir: 'higher' },
      { key: 'securedCards', name: 'Secured Cards', target: 20, unit: '', dir: 'higher' },
      { key: 'reviewGeneration', name: 'Reviews Collected', target: 10, unit: '', dir: 'higher' },
    ],
  },
  {
    key: 'credit_team', name: 'Credit Team', Icon: FileText, accent: 'text-indigo-600', bar: 'bg-indigo-500',
    metrics: [
      { key: 'disputeTurnaround', name: 'Dispute Turnaround', target: 3, unit: 'days', dir: 'lower' },
      { key: 'clientResults', name: 'Client Results', target: 60, unit: '%', dir: 'higher' },
    ],
  },
];

const FUNNEL_STAGES = [
  { label: 'New Leads', match: ['new lead', 'lead'] },
  { label: 'Reports', match: ['report'] },
  { label: 'Quoted', match: ['quote'] },
  { label: 'Sold', match: ['sold'] },
  { label: 'CRS', match: ['crs', 'credit repair started', 'enrolled'] },
];

function fmtVal(v, unit) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (unit === '$') return '$' + Number(v).toLocaleString();
  if (unit === '%') return Math.round(v) + '%';
  if (unit === 'days') return v + 'd';
  if (unit === 'min') return v + 'm';
  return Math.round(v).toLocaleString();
}

function meetsTarget(v, target, dir) {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return dir === 'lower' ? v <= target : v >= target;
}

export default function AdminKpiOverview() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState({}); // { deptKey: { metricKey: value } }
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setData({});
    setFunnel(null);

    // Consultants
    fetch(`/.netlify/functions/consultant-metrics?days=${period}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.departmentMetrics) {
          const dm = d.departmentMetrics;
          setData(prev => ({ ...prev, consultants: Object.fromEntries(
            Object.entries(dm).map(([k, v]) => [k, v?.value])
          )}));
        }
      }).catch(() => {});

    // Account Managers
    fetch(`/.netlify/functions/account-manager-metrics?days=${period}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.departmentMetrics) {
          const dm = d.departmentMetrics;
          setData(prev => ({ ...prev, account_managers: Object.fromEntries(
            Object.entries(dm).map(([k, v]) => [k, v?.value])
          )}));
        }
      }).catch(() => {});

    // Customer Support
    fetch(`/.netlify/functions/customer-support-metrics?days=${period}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.departmentMetrics) {
          const dm = d.departmentMetrics;
          setData(prev => ({ ...prev, customer_support: Object.fromEntries(
            Object.entries(dm).map(([k, v]) => [k, (v && typeof v === 'object') ? (v.value ?? v.rate) : v])
          )}));
        }
      }).catch(() => {});

    // Credit Team (two sources)
    Promise.all([
      fetch(`/.netlify/functions/google-sheets-sync?days=${period}`).then(r => r.json()).catch(() => ({})),
      fetch(`/.netlify/functions/credit-team-metrics`).then(r => r.json()).catch(() => ({})),
    ]).then(([sheets, pd]) => {
      const ct = {};
      if (pd?.metrics?.disputeTurnaround) ct.disputeTurnaround = pd.metrics.disputeTurnaround.value;
      if (sheets?.metrics?.summary?.favorableRate != null) ct.clientResults = sheets.metrics.summary.favorableRate;
      setData(prev => ({ ...prev, credit_team: ct }));
    }).catch(() => {});

    // Funnel (current pipeline snapshot)
    fetch(`/.netlify/functions/pipeline-metrics`)
      .then(r => r.json())
      .then(d => {
        const buckets = FUNNEL_STAGES.map(s => ({ label: s.label, count: 0 }));
        const pipelines = Array.isArray(d?.pipelines) ? d.pipelines
          : (d && typeof d === 'object' ? Object.values(d).filter(x => x && Array.isArray(x.stages)) : []);
        pipelines.forEach(p => {
          (p.stages || []).forEach(st => {
            const nm = String(st.name || '').toLowerCase();
            FUNNEL_STAGES.forEach((fs, i) => {
              if (fs.match.some(m => nm.includes(m))) buckets[i].count += (st.count || 0);
            });
          });
        });
        setFunnel(buckets);
      }).catch(() => setFunnel(null))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const maxFunnel = funnel ? Math.max(1, ...funnel.map(b => b.count)) : 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 mb-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-asap-blue" />
          <h2 className="text-lg font-bold text-slate-800">Company KPIs</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {[7, 30, 90].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium ${period === p ? 'bg-asap-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {p}d
              </button>
            ))}
          </div>
          <button onClick={loadAll} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Lead-flow funnel */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Lead Flow</h3>
          <span className="text-xs text-slate-400">Current pipeline snapshot</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(funnel || FUNNEL_STAGES.map(s => ({ label: s.label, count: null }))).map((b, i) => (
            <div key={b.label} className="relative rounded-xl border border-slate-200 p-3 bg-slate-50">
              <div className="text-xs text-slate-500 mb-1">{b.label}</div>
              <div className="text-xl font-bold text-slate-800">{b.count === null ? (loading ? '…' : '—') : b.count.toLocaleString()}</div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-asap-blue rounded-full" style={{ width: b.count ? `${Math.round((b.count / maxFunnel) * 100)}%` : '0%' }} />
              </div>
              {i < FUNNEL_STAGES.length - 1 && (
                <ArrowRight className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 z-10" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Department KPI cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DEPARTMENTS.map(dept => {
          const dvals = data[dept.key] || {};
          const hasAny = Object.keys(dvals).length > 0;
          return (
            <div key={dept.key} className="rounded-xl border border-slate-200 p-4">
              <button onClick={() => navigate('/scorecards')}
                className="w-full flex items-center justify-between mb-3 group">
                <div className="flex items-center gap-2">
                  <dept.Icon className={`w-4 h-4 ${dept.accent}`} />
                  <span className="font-semibold text-slate-800">{dept.name}</span>
                </div>
                <span className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-asap-blue">
                  Details <ChevronRight size={14} />
                </span>
              </button>
              <div className="space-y-2">
                {dept.metrics.map(m => {
                  const v = dvals[m.key];
                  const ok = meetsTarget(v, m.target, m.dir);
                  return (
                    <div key={m.key} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {(!hasAny && loading) ? '…' : fmtVal(v, m.unit)}
                        </span>
                        <span className="text-xs text-slate-400">/ {fmtVal(m.target, m.unit)}</span>
                        <span className={`w-2 h-2 rounded-full ${ok === null ? 'bg-slate-200' : ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Pulls live from the same sources as Scorecards. A grey dot means that metric isn't reporting live data yet.
      </p>
    </div>
  );
}
