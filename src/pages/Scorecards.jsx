import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Activity,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  Star,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Eye
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, subDays, isWithinInterval } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

export default function Scorecards() {
  const { currentUser, users, DEPARTMENTS } = useApp();
  const [metrics, setMetrics] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [entries, setEntries] = useState([]);
  const [focus, setFocus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('my'); // my, team, all
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedMetric, setExpandedMetric] = useState(null);

  const isLeadership = currentUser?.department === 'leadership' || currentUser?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load metrics
      const metricsRes = await fetch(`${SUPABASE_URL}/rest/v1/scorecard_metrics?is_active=eq.true&select=*&order=department,name`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const metricsData = await metricsRes.json();
      setMetrics(metricsData || []);

      // Load thresholds
      const thresholdsRes = await fetch(`${SUPABASE_URL}/rest/v1/scorecard_thresholds?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      setThresholds(await thresholdsRes.json() || []);

      // Load focus
      const focusRes = await fetch(`${SUPABASE_URL}/rest/v1/scorecard_focus?is_focused=eq.true&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      setFocus(await focusRes.json() || []);

      // Load entries for current month and previous month (for trend)
      const startDate = format(startOfMonth(subMonths(selectedMonth, 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      const entriesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/scorecard_entries?entry_date=gte.${startDate}&entry_date=lte.${endDate}&select=*`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      setEntries(await entriesRes.json() || []);

    } catch (error) {
      console.error('Error loading scorecard data:', error);
    }
    setLoading(false);
  };

  const getThreshold = (metricId) => {
    return thresholds.find(t => t.metric_id === metricId && t.applies_to === 'all');
  };

  const isFocused = (metricId) => {
    return focus.some(f => f.metric_id === metricId);
  };

  const getMonthlyTotal = (userId, metricId, month = selectedMonth) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    
    return entries
      .filter(e => 
        e.user_id === userId && 
        e.metric_id === metricId &&
        isWithinInterval(parseISO(e.entry_date), { start, end })
      )
      .reduce((sum, e) => sum + parseFloat(e.value), 0);
  };

  const getDailyEntries = (userId, metricId) => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    
    return entries
      .filter(e => 
        e.user_id === userId && 
        e.metric_id === metricId &&
        isWithinInterval(parseISO(e.entry_date), { start, end })
      )
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  };

  const getTrend = (userId, metricId) => {
    const currentTotal = getMonthlyTotal(userId, metricId, selectedMonth);
    const prevTotal = getMonthlyTotal(userId, metricId, subMonths(selectedMonth, 1));
    
    if (prevTotal === 0) return { direction: 'neutral', percent: 0 };
    
    const change = ((currentTotal - prevTotal) / prevTotal) * 100;
    return {
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'neutral',
      percent: Math.abs(Math.round(change))
    };
  };

  const getStatus = (value, threshold, direction) => {
    if (!threshold) return 'neutral';
    
    if (direction === 'higher_better') {
      if (value >= threshold.green_min) return 'green';
      if (value >= threshold.yellow_min) return 'yellow';
      return 'red';
    } else {
      // Lower is better
      if (value <= threshold.green_min) return 'green';
      if (value <= threshold.yellow_min) return 'yellow';
      return 'red';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-amber-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-slate-300';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'green': return 'bg-green-50 border-green-200';
      case 'yellow': return 'bg-amber-50 border-amber-200';
      case 'red': return 'bg-red-50 border-red-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getDepartmentName = (id) => DEPARTMENTS?.find(d => d.id === id)?.name || id;

  // Get metrics for current user's department (or all if leadership)
  const myMetrics = metrics.filter(m => m.department === currentUser?.department);
  const focusedMetrics = myMetrics.filter(m => isFocused(m.id));
  const nonFocusedMetrics = myMetrics.filter(m => !isFocused(m.id));

  // Get team members in same department
  const teamMembers = users?.filter(u => u.department === currentUser?.department && u.id !== currentUser?.id) || [];

  // For leadership - get all departments
  const allDepartments = [...new Set(metrics.map(m => m.department))];

  const viewUser = selectedUser || currentUser;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

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
            <p className="text-slate-500 text-sm">Track your performance metrics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-2">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
              className="border-0 focus:ring-0 text-sm"
            />
          </div>

          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => { setViewMode('my'); setSelectedUser(null); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'my' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              My Scores
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'team' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <Users size={14} className="inline mr-1" /> Team
            </button>
            {isLeadership && (
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
                }`}
              >
                <Eye size={14} className="inline mr-1" /> All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* My Scores View */}
      {viewMode === 'my' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {['green', 'yellow', 'red', 'neutral'].map(status => {
              const count = myMetrics.filter(m => {
                const value = getMonthlyTotal(currentUser?.id, m.id);
                const threshold = getThreshold(m.id);
                return getStatus(value, threshold, m.direction) === status;
              }).length;
              
              const labels = { green: 'On Track', yellow: 'Needs Work', red: 'Critical', neutral: 'No Data' };
              const icons = { green: CheckCircle, yellow: AlertTriangle, red: AlertTriangle, neutral: Minus };
              const Icon = icons[status];
              
              return (
                <div key={status} className={`rounded-xl p-4 border ${getStatusBg(status)}`}>
                  <div className="flex items-center justify-between">
                    <Icon size={20} className={`text-${status === 'neutral' ? 'slate' : status}-600`} />
                    <span className="text-2xl font-bold text-slate-800">{count}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{labels[status]}</p>
                </div>
              );
            })}
          </div>

          {/* Focused Metrics */}
          {focusedMetrics.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Star size={18} className="text-emerald-600 fill-emerald-600" />
                <h2 className="font-semibold text-slate-800">Current Focus</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {focusedMetrics.map(metric => (
                  <MetricCard 
                    key={metric.id}
                    metric={metric}
                    userId={currentUser?.id}
                    value={getMonthlyTotal(currentUser?.id, metric.id)}
                    threshold={getThreshold(metric.id)}
                    trend={getTrend(currentUser?.id, metric.id)}
                    dailyData={getDailyEntries(currentUser?.id, metric.id)}
                    expanded={expandedMetric === metric.id}
                    onToggle={() => setExpandedMetric(expandedMetric === metric.id ? null : metric.id)}
                    focused
                  />
                ))}
              </div>
            </div>
          )}

          {/* Non-Focused Metrics */}
          {nonFocusedMetrics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-slate-400" />
                <h2 className="font-semibold text-slate-800">Other Metrics</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {nonFocusedMetrics.map(metric => (
                  <MetricCard 
                    key={metric.id}
                    metric={metric}
                    userId={currentUser?.id}
                    value={getMonthlyTotal(currentUser?.id, metric.id)}
                    threshold={getThreshold(metric.id)}
                    trend={getTrend(currentUser?.id, metric.id)}
                    dailyData={getDailyEntries(currentUser?.id, metric.id)}
                    expanded={expandedMetric === metric.id}
                    onToggle={() => setExpandedMetric(expandedMetric === metric.id ? null : metric.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {myMetrics.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border">
              <Target size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Metrics for Your Department</h3>
              <p className="text-slate-500">Score cards haven't been set up for {getDepartmentName(currentUser?.department)} yet.</p>
            </div>
          )}
        </>
      )}

      {/* Team View */}
      {viewMode === 'team' && (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-700 sticky left-0 bg-slate-50">Team Member</th>
                  {myMetrics.map(m => (
                    <th key={m.id} className="text-center p-4 font-semibold text-slate-700 min-w-[100px]">
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Current user first */}
                <TeamRow 
                  user={currentUser} 
                  metrics={myMetrics}
                  getMonthlyTotal={(metricId) => getMonthlyTotal(currentUser?.id, metricId)}
                  getThreshold={getThreshold}
                  getStatus={getStatus}
                  getStatusColor={getStatusColor}
                  isCurrentUser
                />
                {teamMembers.map(member => (
                  <TeamRow 
                    key={member.id}
                    user={member} 
                    metrics={myMetrics}
                    getMonthlyTotal={(metricId) => getMonthlyTotal(member.id, metricId)}
                    getThreshold={getThreshold}
                    getStatus={getStatus}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Departments View (Leadership) */}
      {viewMode === 'all' && isLeadership && (
        <div className="space-y-6">
          {allDepartments.map(dept => {
            const deptMetrics = metrics.filter(m => m.department === dept);
            const deptUsers = users?.filter(u => u.department === dept) || [];
            
            return (
              <div key={dept} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b">
                  <h2 className="font-semibold text-slate-800">{getDepartmentName(dept)}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="text-left p-4 font-medium text-slate-600 sticky left-0 bg-slate-50/50">Employee</th>
                        {deptMetrics.map(m => (
                          <th key={m.id} className="text-center p-3 font-medium text-slate-600 min-w-[90px] text-sm">
                            {m.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deptUsers.map(user => (
                        <TeamRow 
                          key={user.id}
                          user={user} 
                          metrics={deptMetrics}
                          getMonthlyTotal={(metricId) => getMonthlyTotal(user.id, metricId)}
                          getThreshold={getThreshold}
                          getStatus={getStatus}
                          getStatusColor={getStatusColor}
                        />
                      ))}
                      {deptUsers.length === 0 && (
                        <tr>
                          <td colSpan={deptMetrics.length + 1} className="p-4 text-center text-slate-500">
                            No employees in this department
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({ metric, userId, value, threshold, trend, dailyData, expanded, onToggle, focused }) {
  const status = threshold ? (
    metric.direction === 'higher_better'
      ? value >= threshold.green_min ? 'green' : value >= threshold.yellow_min ? 'yellow' : 'red'
      : value <= threshold.green_min ? 'green' : value <= threshold.yellow_min ? 'yellow' : 'red'
  ) : 'neutral';

  const statusColors = {
    green: 'border-green-200 bg-green-50',
    yellow: 'border-amber-200 bg-amber-50',
    red: 'border-red-200 bg-red-50',
    neutral: 'border-slate-200 bg-white'
  };

  const statusTextColors = {
    green: 'text-green-700',
    yellow: 'text-amber-700',
    red: 'text-red-700',
    neutral: 'text-slate-700'
  };

  const maxValue = Math.max(...dailyData.map(d => parseFloat(d.value)), 1);

  return (
    <div className={`rounded-xl border-2 transition-all ${statusColors[status]} ${focused ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-medium text-slate-800">{metric.name}</h3>
            <p className="text-xs text-slate-500">{metric.description}</p>
          </div>
          {focused && <Star size={16} className="text-emerald-600 fill-emerald-600" />}
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-3xl font-bold ${statusTextColors[status]}`}>
              {metric.metric_type === 'currency' && '$'}
              {value.toLocaleString()}
              {metric.metric_type === 'percentage' && '%'}
            </p>
            {threshold && (
              <p className="text-xs text-slate-500 mt-1">
                Target: {threshold.green_min}{metric.unit ? ` ${metric.unit}` : ''}
              </p>
            )}
          </div>
          
          {/* Trend */}
          {trend.direction !== 'neutral' && (
            <div className={`flex items-center gap-1 text-sm ${
              trend.direction === 'up' 
                ? metric.direction === 'higher_better' ? 'text-green-600' : 'text-red-600'
                : metric.direction === 'higher_better' ? 'text-red-600' : 'text-green-600'
            }`}>
              {trend.direction === 'up' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {trend.percent}%
            </div>
          )}
        </div>

        {/* Mini Sparkline */}
        {dailyData.length > 0 && (
          <div className="flex items-end gap-0.5 h-8 mt-3">
            {dailyData.slice(-14).map((d, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm ${status === 'green' ? 'bg-green-400' : status === 'yellow' ? 'bg-amber-400' : status === 'red' ? 'bg-red-400' : 'bg-slate-300'}`}
                style={{ height: `${(parseFloat(d.value) / maxValue) * 100}%`, minHeight: '4px' }}
                title={`${format(parseISO(d.entry_date), 'MMM d')}: ${d.value}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="border-t border-slate-200 p-4 bg-white/50">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Daily Breakdown</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {dailyData.length > 0 ? (
              dailyData.map((entry, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">{format(parseISO(entry.entry_date), 'MMM d, yyyy')}</span>
                  <span className="font-medium">{entry.value}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No data for this month</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Team Row Component
function TeamRow({ user, metrics, getMonthlyTotal, getThreshold, getStatus, getStatusColor, isCurrentUser }) {
  return (
    <tr className={`border-t ${isCurrentUser ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
      <td className={`p-4 sticky left-0 ${isCurrentUser ? 'bg-blue-50' : 'bg-white'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-asap-navy rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm">{user?.name}</p>
            {isCurrentUser && <span className="text-xs text-blue-600">You</span>}
          </div>
        </div>
      </td>
      {metrics.map(m => {
        const value = getMonthlyTotal(m.id);
        const threshold = getThreshold(m.id);
        const status = getStatus(value, threshold, m.direction);
        
        return (
          <td key={m.id} className="p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
              <span className="font-medium text-slate-800">{value}</span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
