import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users, TrendingUp, TrendingDown, ArrowRight, RefreshCw,
  ChevronDown, ChevronUp, Award, Clock, DollarSign, BarChart3,
  UserCheck, UserX, AlertTriangle, Zap
} from 'lucide-react';

export default function ClientPipeline() {
  const { currentUser } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPipeline, setExpandedPipeline] = useState(null);
  const [viewMode, setViewMode] = useState('pipeline'); // pipeline, consultant

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/.netlify/functions/pipeline-metrics');
      if (!res.ok) throw new Error('Failed to load pipeline data');
      setData(await res.json());
    } catch (err) {
      setError(err.message);
      console.error('Pipeline load error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const formatCurrency = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Loading pipeline data from Pipedrive...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="font-medium text-red-800">Failed to load pipeline data</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Retry
        </button>
      </div>
    </div>
  );

  if (!data) return null;

  const totalDeals = data.summary.totalOpen || 0;
  const totalValue = data.pipelines.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const conversionRate = data.summary.totalWon > 0 && (data.summary.totalWon + data.summary.totalLost) > 0
    ? Math.round((data.summary.totalWon / (data.summary.totalWon + data.summary.totalLost)) * 100)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Client Pipeline</h1>
            <p className="text-slate-500 text-sm">Live data from Pipedrive • Updated {new Date(data.updatedAt).toLocaleTimeString()}</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm font-medium">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-indigo-500" />
            <span className="text-sm text-slate-500">Active Deals</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalDeals}</p>
          <p className="text-xs text-slate-400 mt-1">Across all pipelines</p>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-green-500" />
            <span className="text-sm text-slate-500">Pipeline Value</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-slate-400 mt-1">Total open deal value</p>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck size={18} className="text-emerald-500" />
            <span className="text-sm text-slate-500">Won This Month</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{data.summary.totalWon}</p>
          <p className="text-xs text-slate-400 mt-1">{conversionRate}% win rate</p>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UserX size={18} className="text-red-400" />
            <span className="text-sm text-slate-500">Lost This Month</span>
          </div>
          <p className="text-3xl font-bold text-red-500">{data.summary.totalLost}</p>
          <p className="text-xs text-slate-400 mt-1">{100 - conversionRate}% loss rate</p>
        </div>
      </div>

      {/* Pipeline Flow Visual */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4">Pipeline Flow</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {data.pipelines.map((pipeline, idx) => (
            <React.Fragment key={pipeline.id}>
              <div
                className="flex-1 min-w-[160px] cursor-pointer group"
                onClick={() => setExpandedPipeline(expandedPipeline === pipeline.id ? null : pipeline.id)}
              >
                <div
                  className="rounded-xl p-4 transition-all group-hover:shadow-md group-hover:scale-[1.02]"
                  style={{ backgroundColor: pipeline.color + '15', borderLeft: `4px solid ${pipeline.color}` }}
                >
                  <p className="text-sm font-semibold" style={{ color: pipeline.color }}>{pipeline.name}</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{pipeline.openCount}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> {pipeline.avgAge}d avg</span>
                    {pipeline.totalValue > 0 && (
                      <span className="flex items-center gap-1"><DollarSign size={12} /> {formatCurrency(pipeline.totalValue)}</span>
                    )}
                  </div>
                </div>
              </div>
              {idx < data.pipelines.length - 1 && (
                <ArrowRight size={20} className="text-slate-300 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setViewMode('pipeline')} className={`px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'pipeline' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          By Pipeline
        </button>
        <button onClick={() => setViewMode('consultant')} className={`px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'consultant' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          By Consultant
        </button>
      </div>

      {/* Pipeline Detail */}
      {viewMode === 'pipeline' && (
        <div className="space-y-4">
          {data.pipelines.map(pipeline => {
            const isExpanded = expandedPipeline === pipeline.id;
            return (
              <div key={pipeline.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedPipeline(isExpanded ? null : pipeline.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-10 rounded-full" style={{ backgroundColor: pipeline.color }} />
                    <div>
                      <p className="font-semibold text-slate-800">{pipeline.name}</p>
                      <p className="text-sm text-slate-500">{pipeline.openCount} active deals • {pipeline.avgAge} days avg age</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {pipeline.totalValue > 0 && (
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(pipeline.totalValue)}</span>
                    )}
                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t">
                    {/* Stages */}
                    {pipeline.stages.length > 0 && (
                      <div className="p-4">
                        <p className="text-sm font-medium text-slate-500 mb-3">Stages</p>
                        <div className="space-y-2">
                          {pipeline.stages.map(stage => {
                            const pct = pipeline.openCount > 0 ? Math.round((stage.count / pipeline.openCount) * 100) : 0;
                            return (
                              <div key={stage.name} className="flex items-center gap-3">
                                <div className="w-32 text-sm text-slate-700 font-medium truncate">{stage.name}</div>
                                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full flex items-center justify-end pr-2"
                                    style={{ width: Math.max(pct, 5) + '%', backgroundColor: pipeline.color }}
                                  >
                                    {pct >= 15 && <span className="text-white text-xs font-bold">{stage.count}</span>}
                                  </div>
                                </div>
                                <div className="w-16 text-right text-sm">
                                  <span className="font-semibold">{stage.count}</span>
                                  <span className="text-slate-400 ml-1">({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* By Consultant in this pipeline */}
                    {Object.keys(pipeline.byConsultant).length > 0 && (
                      <div className="p-4 border-t bg-slate-50">
                        <p className="text-sm font-medium text-slate-500 mb-3">By Consultant</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.entries(pipeline.byConsultant)
                            .sort((a, b) => b[1] - a[1])
                            .map(([name, count]) => (
                              <div key={name} className="bg-white rounded-lg p-3 border">
                                <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                                <p className="text-2xl font-bold mt-1" style={{ color: pipeline.color }}>{count}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Consultant View */}
      {viewMode === 'consultant' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-bold text-slate-800">Deals by Consultant</h3>
            <p className="text-sm text-slate-500">Open deal distribution across all pipelines</p>
          </div>
          <div className="divide-y">
            {Object.entries(data.byConsultant)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([name, info]) => (
                <div key={name} className="p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-indigo-600">{name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{name}</p>
                        <p className="text-sm text-slate-500">{info.total} total open deals</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{info.total}</p>
                  </div>
                  <div className="flex gap-2 ml-12">
                    {Object.entries(info.pipelines).map(([pName, count]) => {
                      const pipeline = data.pipelines.find(p => p.name === pName);
                      return (
                        <span
                          key={pName}
                          className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: (pipeline?.color || '#6366F1') + '20', color: pipeline?.color || '#6366F1' }}
                        >
                          {pName}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
