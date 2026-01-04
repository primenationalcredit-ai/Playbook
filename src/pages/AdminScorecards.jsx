import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Target, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  Eye,
  EyeOff,
  Archive,
  Star
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const METRIC_TYPES = [
  { id: 'number', name: 'Number', example: '15 clients' },
  { id: 'percentage', name: 'Percentage', example: '85%' },
  { id: 'currency', name: 'Currency', example: '$5,000' },
];

const DIRECTIONS = [
  { id: 'higher_better', name: 'Higher is Better', icon: TrendingUp, color: 'green' },
  { id: 'lower_better', name: 'Lower is Better', icon: TrendingDown, color: 'red' },
];

export default function AdminScorecards() {
  const { users, DEPARTMENTS, currentUser } = useApp();
  const [view, setView] = useState('metrics'); // metrics, thresholds, data
  const [metrics, setMetrics] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [entries, setEntries] = useState([]);
  const [focus, setFocus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [editingThreshold, setEditingThreshold] = useState(null);
  const [selectedMetricId, setSelectedMetricId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadMetrics(), loadThresholds(), loadFocus()]);
    setLoading(false);
  };

  const loadMetrics = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/scorecard_metrics?select=*&order=department,name`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setMetrics(await res.json() || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const loadThresholds = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/scorecard_thresholds?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setThresholds(await res.json() || []);
    } catch (error) {
      console.error('Error loading thresholds:', error);
    }
  };

  const loadFocus = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/scorecard_focus?select=*&is_focused=eq.true`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setFocus(await res.json() || []);
    } catch (error) {
      console.error('Error loading focus:', error);
    }
  };

  const saveMetric = async (metricData) => {
    try {
      if (editingMetric) {
        await fetch(`${SUPABASE_URL}/rest/v1/scorecard_metrics?id=eq.${editingMetric.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...metricData, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/scorecard_metrics`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(metricData)
        });
      }
      await loadMetrics();
      setShowMetricModal(false);
      setEditingMetric(null);
    } catch (error) {
      console.error('Error saving metric:', error);
    }
  };

  const deleteMetric = async (metricId) => {
    if (!confirm('Delete this metric? All associated data will be lost.')) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/scorecard_metrics?id=eq.${metricId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      await loadMetrics();
    } catch (error) {
      console.error('Error deleting metric:', error);
    }
  };

  const saveThreshold = async (thresholdData) => {
    try {
      if (editingThreshold) {
        await fetch(`${SUPABASE_URL}/rest/v1/scorecard_thresholds?id=eq.${editingThreshold.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...thresholdData, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/scorecard_thresholds`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...thresholdData, created_by: currentUser?.id })
        });
      }
      await loadThresholds();
      setShowThresholdModal(false);
      setEditingThreshold(null);
    } catch (error) {
      console.error('Error saving threshold:', error);
    }
  };

  const toggleFocus = async (metricId, isFocused) => {
    try {
      const existing = focus.find(f => f.metric_id === metricId);
      if (existing) {
        await fetch(`${SUPABASE_URL}/rest/v1/scorecard_focus?id=eq.${existing.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_focused: isFocused })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/scorecard_focus`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            metric_id: metricId, 
            is_focused: isFocused,
            created_by: currentUser?.id
          })
        });
      }
      await loadFocus();
    } catch (error) {
      console.error('Error toggling focus:', error);
    }
  };

  const getThresholdForMetric = (metricId) => {
    return thresholds.find(t => t.metric_id === metricId && t.applies_to === 'all');
  };

  const isFocused = (metricId) => {
    return focus.some(f => f.metric_id === metricId && f.is_focused);
  };

  const getDepartmentName = (id) => DEPARTMENTS?.find(d => d.id === id)?.name || id;

  // Group metrics by department
  const metricsByDept = metrics.reduce((acc, metric) => {
    if (!acc[metric.department]) acc[metric.department] = [];
    acc[metric.department].push(metric);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Score Cards</h1>
            <p className="text-slate-500 text-sm">Configure KPIs and thresholds</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('metrics')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'metrics' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <BarChart3 size={16} className="inline mr-1" /> Metrics
            </button>
            <button
              onClick={() => setView('thresholds')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'thresholds' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <Target size={16} className="inline mr-1" /> Thresholds
            </button>
          </div>
          <button
            onClick={() => { setEditingMetric(null); setShowMetricModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Plus size={18} /> New Metric
          </button>
        </div>
      </div>

      {/* Metrics View */}
      {view === 'metrics' && (
        <div className="space-y-6">
          {Object.entries(metricsByDept).map(([dept, deptMetrics]) => (
            <div key={dept} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div 
                className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedDept(expandedDept === dept ? null : dept)}
              >
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-slate-800">{getDepartmentName(dept)}</h2>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-xs">
                    {deptMetrics.length} metrics
                  </span>
                </div>
                {expandedDept === dept ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
              
              {expandedDept === dept && (
                <div className="divide-y divide-slate-100">
                  {deptMetrics.map(metric => {
                    const threshold = getThresholdForMetric(metric.id);
                    const focused = isFocused(metric.id);
                    const DirectionIcon = metric.direction === 'higher_better' ? TrendingUp : TrendingDown;
                    
                    return (
                      <div key={metric.id} className={`px-6 py-4 ${!metric.is_active && 'opacity-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              focused ? 'bg-emerald-100' : 'bg-slate-100'
                            }`}>
                              {focused ? (
                                <Star size={20} className="text-emerald-600 fill-emerald-600" />
                              ) : (
                                <Activity size={20} className="text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-slate-800">{metric.name}</h3>
                                <span className="text-xs text-slate-400 font-mono">{metric.key}</span>
                                <DirectionIcon size={14} className={metric.direction === 'higher_better' ? 'text-green-500' : 'text-red-500'} />
                              </div>
                              <p className="text-sm text-slate-500">{metric.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {/* Threshold Preview */}
                            {threshold && (
                              <div className="flex items-center gap-1 text-sm">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">≥{threshold.green_min}</span>
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">≥{threshold.yellow_min}</span>
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">&lt;{threshold.red_max}</span>
                              </div>
                            )}
                            
                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleFocus(metric.id, !focused)}
                                className={`p-2 rounded-lg ${focused ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                title={focused ? 'Remove from focus' : 'Add to focus'}
                              >
                                <Star size={16} className={focused ? 'fill-emerald-600' : ''} />
                              </button>
                              <button
                                onClick={() => { setSelectedMetricId(metric.id); setEditingThreshold(threshold); setShowThresholdModal(true); }}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                title="Set thresholds"
                              >
                                <Target size={16} />
                              </button>
                              <button
                                onClick={() => { setEditingMetric(metric); setShowMetricModal(true); }}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => deleteMetric(metric.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {metrics.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
              <Target size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Metrics Configured</h3>
              <p className="text-slate-500 mb-4">Create metrics to track your team's performance.</p>
              <button
                onClick={() => { setEditingMetric(null); setShowMetricModal(true); }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Create First Metric
              </button>
            </div>
          )}
        </div>
      )}

      {/* Thresholds View */}
      {view === 'thresholds' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700">Metric</th>
                <th className="text-left p-4 font-semibold text-slate-700">Department</th>
                <th className="text-center p-4 font-semibold text-slate-700">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Green</span>
                </th>
                <th className="text-center p-4 font-semibold text-slate-700">
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">Yellow</span>
                </th>
                <th className="text-center p-4 font-semibold text-slate-700">
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded">Red</span>
                </th>
                <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(metric => {
                const threshold = getThresholdForMetric(metric.id);
                return (
                  <tr key={metric.id} className="border-t border-slate-100">
                    <td className="p-4 font-medium text-slate-800">{metric.name}</td>
                    <td className="p-4 text-slate-600">{getDepartmentName(metric.department)}</td>
                    <td className="p-4 text-center">
                      {threshold ? `≥ ${threshold.green_min}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      {threshold ? `≥ ${threshold.yellow_min}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      {threshold ? `< ${threshold.red_max}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => { setSelectedMetricId(metric.id); setEditingThreshold(threshold); setShowThresholdModal(true); }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                      >
                        {threshold ? 'Edit' : 'Set'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Metric Modal */}
      {showMetricModal && (
        <MetricModal
          metric={editingMetric}
          departments={DEPARTMENTS}
          onClose={() => { setShowMetricModal(false); setEditingMetric(null); }}
          onSave={saveMetric}
        />
      )}

      {/* Threshold Modal */}
      {showThresholdModal && (
        <ThresholdModal
          threshold={editingThreshold}
          metric={metrics.find(m => m.id === selectedMetricId)}
          onClose={() => { setShowThresholdModal(false); setEditingThreshold(null); }}
          onSave={saveThreshold}
        />
      )}
    </div>
  );
}

// Metric Modal
function MetricModal({ metric, departments, onClose, onSave }) {
  const [name, setName] = useState(metric?.name || '');
  const [key, setKey] = useState(metric?.key || '');
  const [description, setDescription] = useState(metric?.description || '');
  const [department, setDepartment] = useState(metric?.department || 'credit_consultants');
  const [metricType, setMetricType] = useState(metric?.metric_type || 'number');
  const [direction, setDirection] = useState(metric?.direction || 'higher_better');
  const [unit, setUnit] = useState(metric?.unit || '');
  const [isActive, setIsActive] = useState(metric?.is_active ?? true);

  // Auto-generate key from name
  useEffect(() => {
    if (!metric && name) {
      setKey(name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    }
  }, [name, metric]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      key,
      description,
      department,
      metric_type: metricType,
      direction,
      unit,
      is_active: isActive
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">{metric ? 'Edit Metric' : 'New Metric'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Metric Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sold Clients"
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key (for Zapier) *</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., sold_clients"
              className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Use this key when sending data from Zapier</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={metricType}
                onChange={(e) => setMetricType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                {METRIC_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Direction</label>
            <div className="grid grid-cols-2 gap-3">
              {DIRECTIONS.map(d => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDirection(d.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      direction === d.id 
                        ? `border-${d.color}-500 bg-${d.color}-50` 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={18} className={direction === d.id ? `text-${d.color}-600` : 'text-slate-400'} />
                    <p className="font-medium text-sm mt-1">{d.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit (optional)</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g., clients, %, $"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="What does this metric measure?"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">Active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              {metric ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Threshold Modal
function ThresholdModal({ threshold, metric, onClose, onSave }) {
  const [greenMin, setGreenMin] = useState(threshold?.green_min || '');
  const [yellowMin, setYellowMin] = useState(threshold?.yellow_min || '');
  const [redMax, setRedMax] = useState(threshold?.red_max || '');
  const [periodType, setPeriodType] = useState(threshold?.period_type || 'monthly');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      metric_id: metric?.id,
      green_min: parseFloat(greenMin),
      yellow_min: parseFloat(yellowMin),
      red_max: parseFloat(redMax),
      period_type: periodType,
      applies_to: 'all'
    });
  };

  const isHigherBetter = metric?.direction === 'higher_better';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Set Thresholds</h2>
            <p className="text-sm text-slate-500">{metric?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              {isHigherBetter 
                ? 'Higher values are better. Set minimum thresholds.'
                : 'Lower values are better. Set maximum thresholds.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Period</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                <span className="w-3 h-3 bg-green-500 rounded-full" />
                Green (Excellent) {isHigherBetter ? '≥' : '≤'}
              </label>
              <input
                type="number"
                value={greenMin}
                onChange={(e) => setGreenMin(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg border-green-300 focus:ring-green-500"
                placeholder={isHigherBetter ? 'Minimum for green' : 'Maximum for green'}
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                <span className="w-3 h-3 bg-amber-500 rounded-full" />
                Yellow (Needs Improvement) {isHigherBetter ? '≥' : '≤'}
              </label>
              <input
                type="number"
                value={yellowMin}
                onChange={(e) => setYellowMin(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg border-amber-300 focus:ring-amber-500"
                placeholder={isHigherBetter ? 'Minimum for yellow' : 'Maximum for yellow'}
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                <span className="w-3 h-3 bg-red-500 rounded-full" />
                Red (Critical) {isHigherBetter ? '<' : '>'}
              </label>
              <input
                type="number"
                value={redMax}
                onChange={(e) => setRedMax(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg border-red-300 focus:ring-red-500"
                placeholder={isHigherBetter ? 'Below this is red' : 'Above this is red'}
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              Save Thresholds
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
