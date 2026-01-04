import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
  DollarSign, TrendingUp, Users, FileText, 
  Calendar, ChevronLeft, ChevronRight, Award,
  ExternalLink, RefreshCw, Trophy, Zap,
  FileCheck, CreditCard, AlertCircle, ArrowUp, ArrowDown
} from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfYear, subYears, getDaysInMonth, getDate } from 'date-fns';

function ConsultantPayments() {
  const { currentUser } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Stats
  const [todayStats, setTodayStats] = useState({ sales: 0, docs: 0, partials: 0, finals: 0, count: 0 });
  const [mtdStats, setMtdStats] = useState({ sales: 0, docs: 0, docsAmount: 0, partials: 0, partialsAmount: 0, finals: 0, finalsAmount: 0, count: 0, projection: 0 });
  const [ytdStats, setYtdStats] = useState({ sales: 0, docs: 0, partials: 0, finals: 0, count: 0 });
  const [lastYearStats, setLastYearStats] = useState({ sales: 0, count: 0 });
  const [consultantData, setConsultantData] = useState([]);
  const [topPerformers, setTopPerformers] = useState({ topSeller: '', mostDocs: '' });

  const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y/edit';

  // Simple fetch helper - now includes same_day_doc_date
  const fetchSales = async (dateStart, dateEnd) => {
    const url = `${SUPABASE_URL}/rest/v1/sales?select=consultant,fee_paid,fee_type,date_paid,same_day_doc_date&date_paid=gte.${dateStart}&date_paid=lte.${dateEnd}`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  };

  // Get period based on day of month
  const getPeriod = (dateStr) => {
    const day = new Date(dateStr).getDate();
    if (day <= 10) return 'fs'; // Fast Start
    if (day <= 20) return 'fm'; // Fast Middle
    return 'ff'; // Fast Finish
  };

  // Process data into stats
  const processStats = (data) => {
    let sales = 0, docs = 0, docsAmount = 0, partials = 0, partialsAmount = 0, finals = 0, finalsAmount = 0;
    
    (data || []).forEach(row => {
      const amount = parseFloat(row.fee_paid) || 0;
      const feeType = (row.fee_type || '').toLowerCase();
      
      sales += amount;
      
      if (feeType.includes('doc')) {
        docs++;
        docsAmount += amount;
      } else if (feeType.includes('partial')) {
        partials++;
        partialsAmount += amount;
      } else if (feeType.includes('final')) {
        finals++;
        finalsAmount += amount;
      }
    });
    
    return { sales, docs, docsAmount, partials, partialsAmount, finals, finalsAmount, count: (data || []).length };
  };

  // Process consultant breakdown with FS/FM/FF and Same Day tracking
  const processConsultants = (mtdData, ytdData) => {
    const map = {};
    
    (mtdData || []).forEach(row => {
      const name = row.consultant || 'Unknown';
      if (!map[name]) {
        map[name] = {
          name,
          mtd: { 
            sales: 0, docs: 0, docsAmount: 0, partials: 0, partialsAmount: 0, finals: 0, finalsAmount: 0, count: 0, 
            fs: 0, fm: 0, ff: 0,
            sameDayFs: 0, sameDayFm: 0, sameDayFf: 0, sameDayTotal: 0
          },
          ytd: { sales: 0, docs: 0, docsAmount: 0, partials: 0, partialsAmount: 0, finals: 0, finalsAmount: 0, count: 0 },
        };
      }
      
      const amount = parseFloat(row.fee_paid) || 0;
      const feeType = (row.fee_type || '').toLowerCase();
      
      map[name].mtd.sales += amount;
      map[name].mtd.count++;
      
      if (feeType.includes('doc')) { 
        map[name].mtd.docs++; 
        map[name].mtd.docsAmount += amount;
        
        // Track FS/FM/FF for all doc fees
        const period = getPeriod(row.date_paid);
        map[name].mtd[period]++;
        
        // Track Same Day Doc Fees
        if (row.same_day_doc_date) {
          map[name].mtd.sameDayTotal++;
          const sameDayPeriod = 'sameDay' + period.charAt(0).toUpperCase() + period.charAt(1);
          map[name].mtd[sameDayPeriod]++;
        }
      }
      else if (feeType.includes('partial')) { map[name].mtd.partials++; map[name].mtd.partialsAmount += amount; }
      else if (feeType.includes('final')) { map[name].mtd.finals++; map[name].mtd.finalsAmount += amount; }
    });
    
    (ytdData || []).forEach(row => {
      const name = row.consultant || 'Unknown';
      if (!map[name]) {
        map[name] = {
          name,
          mtd: { 
            sales: 0, docs: 0, docsAmount: 0, partials: 0, partialsAmount: 0, finals: 0, finalsAmount: 0, count: 0, 
            fs: 0, fm: 0, ff: 0,
            sameDayFs: 0, sameDayFm: 0, sameDayFf: 0, sameDayTotal: 0
          },
          ytd: { sales: 0, docs: 0, docsAmount: 0, partials: 0, partialsAmount: 0, finals: 0, finalsAmount: 0, count: 0 },
        };
      }
      
      const amount = parseFloat(row.fee_paid) || 0;
      const feeType = (row.fee_type || '').toLowerCase();
      
      map[name].ytd.sales += amount;
      map[name].ytd.count++;
      
      if (feeType.includes('doc')) { map[name].ytd.docs++; map[name].ytd.docsAmount += amount; }
      else if (feeType.includes('partial')) { map[name].ytd.partials++; map[name].ytd.partialsAmount += amount; }
      else if (feeType.includes('final')) { map[name].ytd.finals++; map[name].ytd.finalsAmount += amount; }
    });
    
    return Object.values(map).sort((a, b) => b.mtd.sales - a.mtd.sales);
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

      // Fetch all data in parallel
      const [todayData, mtdData, ytdData, lastYearData] = await Promise.all([
        fetchSales(today, today),
        fetchSales(monthStart, monthEnd),
        fetchSales(yearStart, yearEnd),
        fetchSales(lastYearStart, lastYearEnd),
      ]);

      // Process today
      setTodayStats(processStats(todayData));

      // Process MTD with projection
      const mtd = processStats(mtdData);
      const dayOfMonth = getDate(new Date());
      const daysInMonth = getDaysInMonth(selectedMonth);
      const projection = dayOfMonth > 0 ? (mtd.sales / dayOfMonth) * daysInMonth : 0;
      setMtdStats({ ...mtd, projection });

      // Process YTD
      setYtdStats(processStats(ytdData));

      // Process last year
      setLastYearStats(processStats(lastYearData));

      // Process consultants
      const consultants = processConsultants(mtdData, ytdData);
      setConsultantData(consultants);

      if (consultants.length > 0) {
        setTopPerformers({
          topSeller: consultants[0].name,
          mostDocs: [...consultants].sort((a, b) => b.mtd.docs - a.mtd.docs)[0]?.name || '',
        });
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasAccess = currentUser?.department === 'credit_consultants' || 
                    currentUser?.department === 'account_managers' ||
                    currentUser?.department === 'leadership' ||
                    currentUser?.role === 'admin';

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          This page is only available to consultants, account managers, and leadership.
        </div>
      </div>
    );
  }

  const avatarColors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-cyan-500', 'bg-indigo-500'];

  // Doc Fee Race Bar Chart Component
  const DocFeeRaceChart = ({ data, title, usesameDayData = false }) => {
    const sortedByDocs = [...data].sort((a, b) => {
      if (usesameDayData) {
        return b.mtd.sameDayTotal - a.mtd.sameDayTotal;
      }
      return b.mtd.docs - a.mtd.docs;
    });
    
    const maxVal = Math.max(...data.flatMap(c => {
      if (usesameDayData) {
        return [c.mtd.sameDayFs, c.mtd.sameDayFm, c.mtd.sameDayFf];
      }
      return [c.mtd.fs, c.mtd.fm, c.mtd.ff];
    }), 1);
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3 text-center text-sm">{title}</h3>
        <div className="flex items-center justify-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded"></div> FS</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> FM</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded"></div> FF</div>
        </div>
        <div className="flex items-end justify-around gap-2 h-40 px-2">
          {sortedByDocs.slice(0, 4).map((c, idx) => {
            const firstName = c.name.split(' ')[0];
            const barHeight = 100;
            const fsVal = usesameDayData ? c.mtd.sameDayFs : c.mtd.fs;
            const fmVal = usesameDayData ? c.mtd.sameDayFm : c.mtd.fm;
            const ffVal = usesameDayData ? c.mtd.sameDayFf : c.mtd.ff;
            
            return (
              <div key={c.name} className="flex flex-col items-center flex-1">
                <div className="flex items-end gap-1 h-28">
                  {/* FS Bar */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-blue-600 mb-1">{fsVal}</span>
                    <div 
                      className="w-5 bg-blue-500 rounded-t transition-all"
                      style={{ height: `${Math.max((fsVal / Math.max(maxVal, 1)) * barHeight, 4)}px` }}
                    ></div>
                  </div>
                  {/* FM Bar */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-red-600 mb-1">{fmVal}</span>
                    <div 
                      className="w-5 bg-red-500 rounded-t transition-all"
                      style={{ height: `${Math.max((fmVal / Math.max(maxVal, 1)) * barHeight, 4)}px` }}
                    ></div>
                  </div>
                  {/* FF Bar */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-amber-600 mb-1">{ffVal}</span>
                    <div 
                      className="w-5 bg-amber-400 rounded-t transition-all"
                      style={{ height: `${Math.max((ffVal / Math.max(maxVal, 1)) * barHeight, 4)}px` }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2 text-center truncate w-full">{firstName}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Payment Dashboard</h1>
            <p className="text-slate-500 text-sm">
              {loading ? (
                'Loading...'
              ) : lastUpdated ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Live • Updated {format(lastUpdated, 'h:mm a')}
                </span>
              ) : 'Ready'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark">
            <ExternalLink className="w-4 h-4" />
            Open Sheet
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
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
        <button onClick={() => setSelectedMonth(new Date())} className="flex items-center gap-2 px-3 py-2 text-sm text-asap-blue hover:bg-asap-blue/5 rounded-lg">
          <Zap className="w-4 h-4" />
          Current Month
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
              <h3 className="text-emerald-100 text-sm font-medium mb-3">Today's Totals</h3>
              <p className="text-3xl font-bold mb-2">{formatCurrency(todayStats.sales)}</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><span className="block text-emerald-200">Docs</span><span className="font-bold">{todayStats.docs}</span></div>
                <div><span className="block text-emerald-200">Partials</span><span className="font-bold">{todayStats.partials}</span></div>
                <div><span className="block text-emerald-200">Finals</span><span className="font-bold">{todayStats.finals}</span></div>
                <div><span className="block text-emerald-200">Total</span><span className="font-bold">{todayStats.count}</span></div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-1">MTD Totals</h3>
              <p className="text-3xl font-bold text-slate-800 mb-1">{formatCurrency(mtdStats.sales)}</p>
              <p className="text-sm text-slate-500">Projection: <span className="font-semibold text-emerald-600">{formatCurrency(mtdStats.projection)}</span></p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-1">YTD Totals</h3>
              <p className="text-3xl font-bold text-slate-800 mb-1">{formatCurrency(ytdStats.sales)}</p>
              <div className="grid grid-cols-3 gap-1 text-xs text-slate-500">
                <div><span className="block">Docs</span><span className="font-bold text-slate-700">{ytdStats.docs}</span></div>
                <div><span className="block">Partials</span><span className="font-bold text-slate-700">{ytdStats.partials}</span></div>
                <div><span className="block">Finals</span><span className="font-bold text-slate-700">{ytdStats.finals}</span></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
              <h3 className="text-blue-100 text-sm font-medium mb-1">Last Year's {format(selectedMonth, 'MMM')}</h3>
              <p className="text-3xl font-bold mb-1">{formatCurrency(lastYearStats.sales)}</p>
              {mtdStats.sales > 0 && lastYearStats.sales > 0 && (
                <p className="text-sm flex items-center gap-1">
                  {mtdStats.sales >= lastYearStats.sales ? (
                    <><ArrowUp className="w-4 h-4 text-green-300" /><span className="text-green-300">+{formatCurrency(mtdStats.sales - lastYearStats.sales)}</span></>
                  ) : (
                    <><ArrowDown className="w-4 h-4 text-red-300" /><span className="text-red-300">-{formatCurrency(lastYearStats.sales - mtdStats.sales)}</span></>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Leaderboard + Doc Fee Race Charts - ABOVE THE FOLD */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* MTD Sales Leaderboard */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-yellow-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  MTD Sales Leaderboard
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {consultantData.slice(0, 10).map((c, index) => (
                  <div key={c.name} className={`p-3 flex items-center gap-2 ${index === 0 ? 'bg-amber-50' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      index === 0 ? 'bg-amber-400 text-amber-900' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate text-sm">{c.name}</p>
                    </div>
                    <p className="font-bold text-emerald-600 text-sm">{formatCurrency(c.mtd.sales)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Doc Fee Race Chart */}
            <DocFeeRaceChart data={consultantData} title="Doc Fee Race" usesameDayData={false} />

            {/* Same Day Doc Race Chart */}
            <DocFeeRaceChart data={consultantData} title="Same Day Doc Race" usesameDayData={true} />
          </div>

          {/* Fee Breakdown Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Doc Fees</p>
                  <p className="text-xl font-bold text-slate-800">{mtdStats.docs}</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(mtdStats.docsAmount)}</p>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Partials</p>
                  <p className="text-xl font-bold text-slate-800">{mtdStats.partials}</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-orange-600">{formatCurrency(mtdStats.partialsAmount)}</p>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Finals</p>
                  <p className="text-xl font-bold text-slate-800">{mtdStats.finals}</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-emerald-600">{formatCurrency(mtdStats.finalsAmount)}</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Transactions</p>
                  <p className="text-xl font-bold text-slate-800">{mtdStats.count}</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-purple-600">MTD Total</p>
            </div>
          </div>

          {/* Consultant Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-asap-blue" />
                Consultant Performance ({consultantData.length} consultants)
              </h3>
            </div>
            
            {consultantData.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No data for {format(selectedMonth, 'MMMM yyyy')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase"></th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Docs</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Docs $</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Partials</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Partial $</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Finals</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Finals $</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consultantData.slice(0, 25).map((c, index) => (
                      <React.Fragment key={c.name}>
                        <tr className={index % 2 === 0 ? 'bg-green-50' : 'bg-pink-50'}>
                          <td className="px-4 py-2" rowSpan={2}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 ${avatarColors[index % avatarColors.length]} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                                {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <p className="font-semibold text-slate-800">{c.name}</p>
                            </div>
                          </td>
                          <td className="text-center px-2 py-2"><span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">MTD</span></td>
                          <td className="text-center px-2 py-2 font-semibold">{c.mtd.docs}</td>
                          <td className="text-center px-2 py-2 text-slate-600">{formatCurrency(c.mtd.docsAmount)}</td>
                          <td className="text-center px-2 py-2 font-semibold">{c.mtd.partials}</td>
                          <td className="text-center px-2 py-2 text-slate-600">{formatCurrency(c.mtd.partialsAmount)}</td>
                          <td className="text-center px-2 py-2 font-semibold">{c.mtd.finals}</td>
                          <td className="text-center px-2 py-2 text-slate-600">{formatCurrency(c.mtd.finalsAmount)}</td>
                          <td className="text-right px-4 py-2 font-bold text-emerald-600">{formatCurrency(c.mtd.sales)}</td>
                        </tr>
                        <tr className={index % 2 === 0 ? 'bg-green-50/50' : 'bg-pink-50/50'}>
                          <td className="text-center px-2 py-2"><span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded">YTD</span></td>
                          <td className="text-center px-2 py-2 text-slate-500">{c.ytd.docs}</td>
                          <td className="text-center px-2 py-2 text-slate-500">{formatCurrency(c.ytd.docsAmount)}</td>
                          <td className="text-center px-2 py-2 text-slate-500">{c.ytd.partials}</td>
                          <td className="text-center px-2 py-2 text-slate-500">{formatCurrency(c.ytd.partialsAmount)}</td>
                          <td className="text-center px-2 py-2 text-slate-500">{c.ytd.finals}</td>
                          <td className="text-center px-2 py-2 text-slate-500">{formatCurrency(c.ytd.finalsAmount)}</td>
                          <td className="text-right px-4 py-2 font-semibold text-slate-600">{formatCurrency(c.ytd.sales)}</td>
                        </tr>
                      </React.Fragment>
                    ))}
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

export default ConsultantPayments;
