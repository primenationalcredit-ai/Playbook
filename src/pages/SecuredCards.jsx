import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CreditCard, TrendingUp, Users, Trophy,
  Calendar, ChevronLeft, ChevronRight,
  RefreshCw, Award, Target, CheckCircle,
  XCircle, Clock, ArrowUp, ArrowDown
} from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfYear, subYears, getDaysInMonth, getDate } from 'date-fns';

function SecuredCards() {
  const { currentUser } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Stats
  const [todayStats, setTodayStats] = useState({ applied: 0, approved: 0, approvedTwo: 0, declined: 0 });
  const [mtdStats, setMtdStats] = useState({ applied: 0, approved: 0, approvedTwo: 0, declined: 0, total: 0 });
  const [ytdStats, setYtdStats] = useState({ applied: 0, approved: 0, approvedTwo: 0, declined: 0, total: 0 });
  const [lastYearStats, setLastYearStats] = useState({ approved: 0, total: 0 });
  const [managerData, setManagerData] = useState([]);

  const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

  const fetchCards = async (dateStart, dateEnd) => {
    const url = `${SUPABASE_URL}/rest/v1/secured_cards?select=*&updated_at=gte.${dateStart}&updated_at=lte.${dateEnd}T23:59:59`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  };

  const processStats = (data) => {
    let applied = 0, approved = 0, approvedTwo = 0, declined = 0;
    
    (data || []).forEach(row => {
      const status = (row.scc_status || '').toLowerCase();
      
      if (status.includes('applied')) applied++;
      if (status.includes('approved') && status.includes('2')) approvedTwo++;
      else if (status.includes('approved')) approved++;
      if (status.includes('declined') || status.includes('not eligible')) declined++;
    });
    
    return { applied, approved, approvedTwo, declined, total: (data || []).length };
  };

  const processManagers = (mtdData, ytdData) => {
    const map = {};
    
    // Process MTD
    (mtdData || []).forEach(row => {
      const name = row.account_manager || 'Unknown';
      if (!map[name]) {
        map[name] = {
          name,
          mtd: { applied: 0, approved: 0, approvedTwo: 0, declined: 0, total: 0 },
          ytd: { applied: 0, approved: 0, approvedTwo: 0, declined: 0, total: 0 },
        };
      }
      
      const status = (row.scc_status || '').toLowerCase();
      map[name].mtd.total++;
      
      if (status.includes('applied')) map[name].mtd.applied++;
      if (status.includes('approved') && status.includes('2')) map[name].mtd.approvedTwo++;
      else if (status.includes('approved')) map[name].mtd.approved++;
      if (status.includes('declined') || status.includes('not eligible')) map[name].mtd.declined++;
    });
    
    // Process YTD
    (ytdData || []).forEach(row => {
      const name = row.account_manager || 'Unknown';
      if (!map[name]) {
        map[name] = {
          name,
          mtd: { applied: 0, approved: 0, approvedTwo: 0, declined: 0, total: 0 },
          ytd: { applied: 0, approved: 0, approvedTwo: 0, declined: 0, total: 0 },
        };
      }
      
      const status = (row.scc_status || '').toLowerCase();
      map[name].ytd.total++;
      
      if (status.includes('applied')) map[name].ytd.applied++;
      if (status.includes('approved') && status.includes('2')) map[name].ytd.approvedTwo++;
      else if (status.includes('approved')) map[name].ytd.approved++;
      if (status.includes('declined') || status.includes('not eligible')) map[name].ytd.declined++;
    });
    
    // Calculate totals for sorting
    return Object.values(map)
      .map(m => ({
        ...m,
        mtdApprovalTotal: m.mtd.approved + m.mtd.approvedTwo,
        ytdApprovalTotal: m.ytd.approved + m.ytd.approvedTwo,
      }))
      .sort((a, b) => b.mtdApprovalTotal - a.mtdApprovalTotal);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      const yearStart = format(startOfYear(selectedMonth), 'yyyy-MM-dd');
      const yearEnd = format(new Date(selectedMonth.getFullYear(), 11, 31), 'yyyy-MM-dd');
      
      const lastYearMonth = subYears(selectedMonth, 1);
      const lastYearStart = format(startOfMonth(lastYearMonth), 'yyyy-MM-dd');
      const lastYearEnd = format(endOfMonth(lastYearMonth), 'yyyy-MM-dd');

      const [todayData, mtdData, ytdData, lastYearData] = await Promise.all([
        fetchCards(today, today),
        fetchCards(monthStart, monthEnd),
        fetchCards(yearStart, yearEnd),
        fetchCards(lastYearStart, lastYearEnd),
      ]);

      setTodayStats(processStats(todayData));
      setMtdStats(processStats(mtdData));
      setYtdStats(processStats(ytdData));
      setLastYearStats(processStats(lastYearData));
      setManagerData(processManagers(mtdData, ytdData));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load data. Make sure the secured_cards table exists.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const hasAccess = currentUser?.department === 'account_managers' ||
                    currentUser?.department === 'leadership' ||
                    currentUser?.role === 'admin';

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          This page is only available to account managers and leadership.
        </div>
      </div>
    );
  }

  const avatarColors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-cyan-500', 'bg-indigo-500'];

  const mtdTotalApprovals = mtdStats.approved + mtdStats.approvedTwo;
  const lastYearTotalApprovals = lastYearStats.approved + lastYearStats.approvedTwo;
  const conversionRate = mtdStats.applied > 0 ? Math.round((mtdTotalApprovals / mtdStats.applied) * 100) : 0;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Secured Credit Cards</h1>
            <p className="text-slate-500 text-sm">
              {loading ? 'Loading...' : lastUpdated ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Live • Updated {format(lastUpdated, 'h:mm a')}
                </span>
              ) : 'Ready'}
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-2 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg min-w-[180px] justify-center shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold">{format(selectedMonth, 'MMMM yyyy')}</span>
          </div>
          <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="p-2 hover:bg-slate-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button onClick={() => setSelectedMonth(new Date())} className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
          Current Month
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* MTD Approvals */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-emerald-100 text-sm font-medium">MTD Approvals</h3>
                <CheckCircle className="w-5 h-5 text-emerald-200" />
              </div>
              <p className="text-3xl font-bold mb-1">{mtdTotalApprovals}</p>
              <div className="flex items-center gap-4 text-xs text-emerald-100">
                <span>1 Card: {mtdStats.approved}</span>
                <span>2 Cards: {mtdStats.approvedTwo}</span>
              </div>
            </div>

            {/* Applications */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 text-sm font-medium">MTD Applications</h3>
                <Target className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-slate-800 mb-1">{mtdStats.applied}</p>
              <p className="text-sm text-slate-500">
                Conversion: <span className="font-semibold text-green-600">{conversionRate}%</span>
              </p>
            </div>

            {/* Declined */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 text-sm font-medium">Declined</h3>
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-3xl font-bold text-slate-800 mb-1">{mtdStats.declined}</p>
              <p className="text-sm text-slate-500">This month</p>
            </div>

            {/* YoY Comparison */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 text-sm font-medium">vs Last Year</h3>
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-slate-800">{mtdTotalApprovals}</p>
                <span className="text-slate-400">vs</span>
                <p className="text-xl text-slate-400">{lastYearTotalApprovals}</p>
              </div>
              {mtdTotalApprovals >= lastYearTotalApprovals ? (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />
                  {lastYearTotalApprovals > 0 ? `+${Math.round(((mtdTotalApprovals - lastYearTotalApprovals) / lastYearTotalApprovals) * 100)}%` : 'New'}
                </p>
              ) : (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <ArrowDown className="w-3 h-3" />
                  {Math.round(((lastYearTotalApprovals - mtdTotalApprovals) / lastYearTotalApprovals) * 100)}%
                </p>
              )}
            </div>
          </div>

          {/* YTD Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800 rounded-xl p-4 text-white text-center">
              <p className="text-slate-400 text-xs mb-1">YTD Approvals</p>
              <p className="text-2xl font-bold">{ytdStats.approved + ytdStats.approvedTwo}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-white text-center">
              <p className="text-slate-400 text-xs mb-1">YTD Applications</p>
              <p className="text-2xl font-bold">{ytdStats.applied}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-white text-center">
              <p className="text-slate-400 text-xs mb-1">YTD 2-Card Approvals</p>
              <p className="text-2xl font-bold">{ytdStats.approvedTwo}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-white text-center">
              <p className="text-slate-400 text-xs mb-1">YTD Conversion</p>
              <p className="text-2xl font-bold">
                {ytdStats.applied > 0 ? Math.round(((ytdStats.approved + ytdStats.approvedTwo) / ytdStats.applied) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Account Manager Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Account Manager Leaderboard
              </h3>
            </div>
            
            {managerData.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No secured card data yet</p>
                <p className="text-sm">Data will appear when Pipedrive sends updates</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Account Manager</th>
                      <th className="px-4 py-3 text-center">MTD Approvals</th>
                      <th className="px-4 py-3 text-center">MTD 2-Cards</th>
                      <th className="px-4 py-3 text-center">MTD Applied</th>
                      <th className="px-4 py-3 text-center">Conversion</th>
                      <th className="px-4 py-3 text-center">YTD Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {managerData.map((manager, idx) => {
                      const conversion = manager.mtd.applied > 0 
                        ? Math.round((manager.mtdApprovalTotal / manager.mtd.applied) * 100) 
                        : 0;
                      
                      return (
                        <tr key={manager.name} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            {idx === 0 ? (
                              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-amber-600" />
                              </div>
                            ) : (
                              <span className="text-slate-500 font-medium pl-2">{idx + 1}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 ${avatarColors[idx % avatarColors.length]} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                                {manager.name.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-800">{manager.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-lg font-bold text-green-600">{manager.mtdApprovalTotal}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-blue-600 font-medium">{manager.mtd.approvedTwo}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {manager.mtd.applied}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-medium ${conversion >= 70 ? 'text-green-600' : conversion >= 50 ? 'text-amber-600' : 'text-slate-600'}`}>
                              {conversion}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-slate-800 font-semibold">{manager.ytdApprovalTotal}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default SecuredCards;
