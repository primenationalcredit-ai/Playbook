import React, { useState, useEffect, useCallback } from 'react';
import AllPayments from './AllPayments';
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
  const [tab, setTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Stats
  const [todayStats, setTodayStats] = useState({ sales: 0, docs: 0, partials: 0, finals: 0, count: 0 });
  const [todayConsultants, setTodayConsultants] = useState([]); // Today's earnings by consultant
  const [mtdStats, setMtdStats] = useState({ sales: 0, docs: 0, docsAmount: 0, partials: 0, partialsAmount: 0, finals: 0, finalsAmount: 0, paidInFull: 0, refunds: 0, refundsAmount: 0, negativeItems: 0, negativeItemsClients: 0, count: 0, projection: 0 });
  const [ytdStats, setYtdStats] = useState({ sales: 0, docs: 0, partials: 0, finals: 0, count: 0 });
  const [lastYearStats, setLastYearStats] = useState({ sales: 0, count: 0 });
  const [lastYearTodayStats, setLastYearTodayStats] = useState({ sales: 0, count: 0 }); // Same day last year
  const [lastYearMtdStats, setLastYearMtdStats] = useState({ sales: 0, count: 0 }); // MTD up to this point last year
  const [consultantData, setConsultantData] = useState([]);
  const [topPerformers, setTopPerformers] = useState({ topSeller: '', mostDocs: '' });
  const [syncing, setSyncing] = useState(false);

  const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y/edit';

  // Fetch from live Google Sheets API (single call for multiple months)
  const fetchLiveData = async (monthsList) => {
    const response = await fetch(`/.netlify/functions/payments-live?months=${monthsList.join(',')}`); // Zoho-synced consultant_payments (was Google Sheet paysheet-live)
    if (!response.ok) throw new Error('Failed to fetch sales data');
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to load');
    return data.months || {};
  };

  // Helper to determine fee type - uses CODE column (column I), not fee_type
  const getFeeCategory = (row) => {
    const code = (row.code || '').toString().toLowerCase().trim();
    const feeType = (row.fee_type || '').toString().toLowerCase().trim();
    
    // Primary: use Code column
    if (code.includes('doc')) return 'doc';
    if (code.includes('par')) return 'partial';
    if (code.includes('fin')) return 'final';
    if (code.includes('ar') || code.includes('round')) return 'rounds';
    
    // Fallback: use Fee Type column
    if (feeType === 'doc fee' || feeType.includes('doc')) return 'doc';
    if (feeType.includes('partial')) return 'partial';
    if (feeType.includes('final')) return 'final';
    
    return 'other';
  };

  // Get period based on day of month (parse directly to avoid timezone issues)
  const getPeriod = (dateStr) => {
    if (!dateStr) return 'fs';
    const day = parseInt(dateStr.split('-')[2]) || 1;
    if (day <= 10) return 'fs';
    if (day <= 20) return 'fm';
    return 'ff';
  };

  // Process data into stats
  const processStats = (data) => {
    let sales = 0, docs = 0, docsAmount = 0, partials = 0, partialsAmount = 0, finals = 0, finalsAmount = 0, rounds = 0, roundsAmount = 0, count = 0;
    let paidInFull = 0, refunds = 0, refundsAmount = 0, negativeItems = 0, negativeItemsClients = 0;

    (data || []).forEach(row => {
      const amount = parseFloat(row.fee_paid) || 0;
      const category = getFeeCategory(row);

      sales += amount;

      if (category === 'doc') {
        docs++;
        docsAmount += amount;
      } else if (category === 'partial') {
        partials++;
        partialsAmount += amount;
      } else if (category === 'final') {
        finals++;
        finalsAmount += amount;
      } else if (category === 'rounds') {
        rounds++;
        roundsAmount += amount;
      }
      count++;

      // Paid in Full: this payment covers the client's full program price (fee >= total_price),
      // or the code/fee_type flags a paid-in-full. total_price is per-row from the paysheet.
      const tp = parseFloat(row.total_price) || 0;
      const code = (row.code || '').toString().toLowerCase();
      const feeType = (row.fee_type || '').toString().toLowerCase();
      const flaggedPIF = code.includes('pif') || code.includes('paid in full') || feeType.includes('paid in full');
      if (flaggedPIF || (tp > 0 && amount >= tp)) paidInFull++;

      // Refunds: paysheet has a free-text refund field; treat any non-empty, non-"no" value as a refund.
      const refundVal = (row.refund || '').toString().trim().toLowerCase();
      if (refundVal && refundVal !== 'no' && refundVal !== 'n' && refundVal !== '0' && refundVal !== 'none') {
        refunds++;
        const refAmt = parseFloat(refundVal.replace(/[^0-9.]/g, ''));
        if (!isNaN(refAmt)) refundsAmount += refAmt;
      }

      // Negative items worked on the client's report (sum + how many clients had any).
      const neg = parseInt(row.negative_items) || 0;
      if (neg > 0) { negativeItems += neg; negativeItemsClients++; }
    });

    return {
      sales, docs, docsAmount, partials, partialsAmount, finals, finalsAmount, rounds, roundsAmount,
      paidInFull, refunds, refundsAmount, negativeItems, negativeItemsClients,
      count: (data || []).length
    };
  };

  // Process today's data by consultant
  const processTodayConsultants = (todayData) => {
    const map = {};
    
    (todayData || []).forEach(row => {
      const name = row.consultant || 'Unknown';
      if (!map[name]) {
        map[name] = { name, sales: 0, count: 0 };
      }
      map[name].sales += parseFloat(row.fee_paid) || 0;
      map[name].count++;
    });
    
    return Object.values(map).sort((a, b) => b.sales - a.sales);
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
      const category = getFeeCategory(row);
      
      map[name].mtd.sales += amount;
      map[name].mtd.count++;
      
      if (category === 'doc') { 
        map[name].mtd.docs++; 
        map[name].mtd.docsAmount += amount;
        
        // Track FS/FM/FF for all doc fees
        const period = getPeriod(row.date_paid);
        map[name].mtd[period]++;
        
        // Track Same Day Doc Fees
        if (row.same_day_doc_date) {
          map[name].mtd.sameDayTotal++;
          const sameDayPeriod = 'sameDay' + period.charAt(0).toUpperCase() + period.slice(1);
          map[name].mtd[sameDayPeriod]++;
        }
      }
      else if (category === 'partial') { map[name].mtd.partials++; map[name].mtd.partialsAmount += amount; }
      else if (category === 'final') { map[name].mtd.finals++; map[name].mtd.finalsAmount += amount; }
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
      const category = getFeeCategory(row);
      
      map[name].ytd.sales += amount;
      map[name].ytd.count++;
      
      if (category === 'doc') { map[name].ytd.docs++; map[name].ytd.docsAmount += amount; }
      else if (category === 'partial') { map[name].ytd.partials++; map[name].ytd.partialsAmount += amount; }
      else if (category === 'final') { map[name].ytd.finals++; map[name].ytd.finalsAmount += amount; }
    });
    
    return Object.values(map).sort((a, b) => b.mtd.sales - a.mtd.sales);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const today = new Date();
      const todayFormatted = format(today, 'yyyy-MM-dd');
      const dayOfMonth = getDate(today);
      
      // Build list of all months needed
      const currentMonth = format(startOfMonth(selectedMonth), 'yyyy-MM');
      const yearStart = selectedMonth.getFullYear();
      const monthNum = selectedMonth.getMonth(); // 0-based
      
      // All months from Jan to selected month (for YTD)
      const ytdMonths = [];
      for (let m = 0; m <= monthNum; m++) {
        ytdMonths.push(`${yearStart}-${String(m + 1).padStart(2, '0')}`);
      }
      
      // Last year same month
      const lastYearMonth = format(startOfMonth(subYears(selectedMonth, 1)), 'yyyy-MM');
      
      // Combine all unique months into one call
      const allMonths = [...new Set([...ytdMonths, lastYearMonth])];
      
      // Single API call for ALL data
      const monthsData = await fetchLiveData(allMonths);

      // Everyone with access to this page sees the WHOLE team's payments (admin and consultant
      // views are identical). No per-user scoping.
      const scopeRows = (rows) => rows || [];

      // Extract current month data
      const mtdData = scopeRows(monthsData[currentMonth]?.rows || []);
      
      // Filter today's data from MTD
      const todayData = mtdData.filter(r => r.date_paid === todayFormatted);
      
      // Combine all YTD months
      const ytdData = scopeRows(ytdMonths.flatMap(m => monthsData[m]?.rows || []));
      
      // Last year data
      const lastYearData = scopeRows(monthsData[lastYearMonth]?.rows || []);
      
      // Filter same day last year
      const sameDayLastYear = format(subYears(today, 1), 'yyyy-MM-dd');
      const lastYearTodayData = lastYearData.filter(r => r.date_paid === sameDayLastYear);
      
      // Filter last year MTD (up to same day of month)
      const lastYearMtdData = lastYearData.filter(r => {
        const day = parseInt(r.date_paid.split('-')[2]) || 0;
        return day <= dayOfMonth;
      });

      // Process today
      setTodayStats(processStats(todayData));
      setTodayConsultants(processTodayConsultants(todayData));

      // Process MTD with projection
      const mtd = processStats(mtdData);
      const daysInMonth = getDaysInMonth(selectedMonth);
      const projection = dayOfMonth > 0 ? (mtd.sales / dayOfMonth) * daysInMonth : 0;
      setMtdStats({ ...mtd, projection });

      // Process YTD
      setYtdStats(processStats(ytdData));

      // Process last year (full month)
      setLastYearStats(processStats(lastYearData));
      
      // Process same day last year
      setLastYearTodayStats(processStats(lastYearTodayData));
      
      // Process MTD last year up to same point
      setLastYearMtdStats(processStats(lastYearMtdData));

      // Process consultants
      let consultants = processConsultants(mtdData, ytdData);
      // ROSTER FILTER (Joe 8/7): payment rows carry every name Zoho has ever
      // seen (departed consultants, variants) - the ticket showed 13 rows for a
      // 4-person team. Keep only names matching CURRENT consultant-department
      // users in Playbook, so the table mirrors the real roster and adjusts
      // itself on hires/departures. Fail-open: if the roster can't load, show all.
      try {
        const ur = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.credit_consultants&select=name,pipedrive_name`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
        const roster = await ur.json();
        if (Array.isArray(roster) && roster.length) {
          const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
          const rosterNames = roster.flatMap(u => [norm(u.name), norm(u.pipedrive_name)]).filter(Boolean);
          const onRoster = (n) => { const nn = norm(n); return rosterNames.some(r => r === nn || r.includes(nn) || nn.includes(r)); };
          consultants = consultants.filter(c => onRoster(c.name));
        }
      } catch (e) { console.error('roster filter failed - showing all names:', e); }
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

  // Sync from Google Sheets and reload data
  // Sync from Google Sheets - called by Sync Sheet button or auto-refresh
  const syncFromSheet = async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      // Use mode=sync for incremental (only adds new rows, no delete)
      // Manual "Sync Sheet" button uses mode=full for full refresh
      const mode = silent ? 'sync' : 'full';
      const response = await fetch(`/.netlify/functions/sales-api-sync?mode=${mode}`);
      const result = await response.json();
      if (!silent) console.log('Sync result:', result);
      await loadData();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  // Auto-refresh removed - Zapier webhook pushes directly to database
  // User can click Refresh button to reload data manually

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
                    currentUser?.role === 'account_manager' ||
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
            <AuthnetTicker />
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
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={() => syncFromSheet()}
            disabled={loading || syncing}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            title="Force sync from Google Sheets"
          >
            {syncing ? 'Syncing...' : 'Sync Sheet'}
          </button>
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark">
            <ExternalLink className="w-4 h-4" />
            Open Sheet
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 mb-6">
        <button onClick={() => setTab('dashboard')} className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === 'dashboard' ? 'border-asap-blue text-asap-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Dashboard</button>
        <button onClick={() => setTab('all')} className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === 'all' ? 'border-asap-blue text-asap-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>All Payments</button>
      </div>

      {tab === 'all' && <AllPayments embedded />}

      {tab === 'dashboard' && (<>
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
          {/* Year-over-Year Comparison - Compact */}
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Today vs Last Year */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2 border border-slate-200">
              <span className="text-xs text-slate-500">Today vs LY:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(todayStats.sales)}</span>
              <span className="text-slate-400">vs</span>
              <span className="text-slate-500">{formatCurrency(lastYearTodayStats.sales)}</span>
              {todayStats.sales >= lastYearTodayStats.sales ? (
                <span className="flex items-center gap-0.5 text-green-600 text-sm font-medium">
                  <ArrowUp className="w-3 h-3" />
                  {lastYearTodayStats.sales > 0 
                    ? `${Math.round(((todayStats.sales - lastYearTodayStats.sales) / lastYearTodayStats.sales) * 100)}%`
                    : '∞'}
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-red-600 text-sm font-medium">
                  <ArrowDown className="w-3 h-3" />
                  {lastYearTodayStats.sales > 0 
                    ? `${Math.round(((lastYearTodayStats.sales - todayStats.sales) / lastYearTodayStats.sales) * 100)}%`
                    : '0%'}
                </span>
              )}
            </div>

            {/* MTD vs Last Year */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2 border border-slate-200">
              <span className="text-xs text-slate-500">MTD vs LY:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(mtdStats.sales)}</span>
              <span className="text-slate-400">vs</span>
              <span className="text-slate-500">{formatCurrency(lastYearMtdStats.sales)}</span>
              {mtdStats.sales >= lastYearMtdStats.sales ? (
                <span className="flex items-center gap-0.5 text-green-600 text-sm font-medium">
                  <ArrowUp className="w-3 h-3" />
                  {lastYearMtdStats.sales > 0 
                    ? `${Math.round(((mtdStats.sales - lastYearMtdStats.sales) / lastYearMtdStats.sales) * 100)}%`
                    : '∞'}
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-red-600 text-sm font-medium">
                  <ArrowDown className="w-3 h-3" />
                  {lastYearMtdStats.sales > 0 
                    ? `${Math.round(((lastYearMtdStats.sales - mtdStats.sales) / lastYearMtdStats.sales) * 100)}%`
                    : '0%'}
                </span>
              )}
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Today's Totals - Red if < $4000, Green if >= $4000 */}
            <div className={`rounded-xl p-5 shadow-lg ${
              todayStats.sales >= 4000 
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' 
                : 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
            }`}>
              <h3 className={`text-sm font-medium mb-3 ${todayStats.sales >= 4000 ? 'text-emerald-100' : 'text-red-100'}`}>Today's Totals</h3>
              <p className="text-3xl font-bold mb-2">{formatCurrency(todayStats.sales)}</p>
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div><span className={`block ${todayStats.sales >= 4000 ? 'text-emerald-200' : 'text-red-200'}`}>Docs</span><span className="font-bold">{todayStats.docs}</span></div>
                <div><span className={`block ${todayStats.sales >= 4000 ? 'text-emerald-200' : 'text-red-200'}`}>Partials</span><span className="font-bold">{todayStats.partials}</span></div>
                <div><span className={`block ${todayStats.sales >= 4000 ? 'text-emerald-200' : 'text-red-200'}`}>Finals</span><span className="font-bold">{todayStats.finals}</span></div>
                <div><span className={`block ${todayStats.sales >= 4000 ? 'text-emerald-200' : 'text-red-200'}`}>AR</span><span className="font-bold">{todayStats.rounds || 0}</span></div>
                <div><span className={`block ${todayStats.sales >= 4000 ? 'text-emerald-200' : 'text-red-200'}`}>Total</span><span className="font-bold">{todayStats.count || (todayStats.docs + todayStats.partials + todayStats.finals)}</span></div>
              </div>
            </div>

            {/* MTD Breakdown with Projection */}
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-5 text-white shadow-lg">
              <h3 className="text-blue-100 text-sm font-medium mb-1">MTD Breakdown</h3>
              <p className="text-3xl font-bold mb-1">{formatCurrency(mtdStats.sales)}</p>
              <p className="text-sm text-blue-100 mb-2">Projection: <span className="font-semibold text-white">{formatCurrency(mtdStats.projection)}</span></p>
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div><span className="block text-blue-200">Docs</span><span className="font-bold">{mtdStats.docs}</span></div>
                <div><span className="block text-blue-200">Partials</span><span className="font-bold">{mtdStats.partials}</span></div>
                <div><span className="block text-blue-200">Finals</span><span className="font-bold">{mtdStats.finals}</span></div>
                <div><span className="block text-blue-200">Add Rd</span><span className="font-bold">{mtdStats.rounds || 0}</span></div>
                <div><span className="block text-blue-200">Total</span><span className="font-bold">{mtdStats.docs + mtdStats.partials + mtdStats.finals + (mtdStats.rounds || 0)}</span></div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-1">YTD Totals</h3>
              <p className="text-3xl font-bold text-slate-800 mb-1">{formatCurrency(ytdStats.sales)}</p>
              <div className="grid grid-cols-4 gap-1 text-xs text-slate-500">
                <div><span className="block">Docs</span><span className="font-bold text-slate-700">{ytdStats.docs}</span></div>
                <div><span className="block">Partials</span><span className="font-bold text-slate-700">{ytdStats.partials}</span></div>
                <div><span className="block">Finals</span><span className="font-bold text-slate-700">{ytdStats.finals}</span></div>
                <div><span className="block">Add Rd</span><span className="font-bold text-slate-700">{ytdStats.rounds || 0}</span></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
              <h3 className="text-purple-100 text-sm font-medium mb-1">Last Year's {format(selectedMonth, 'MMM')}</h3>
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

          {/* Today's Earnings + MTD Sales Leaderboard - ABOVE THE FOLD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Today's Earnings */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-green-500" />
                  Today's Earnings
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {todayConsultants.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">No sales today yet</div>
                ) : (
                  todayConsultants.map((c, index) => (
                    <div key={c.name} className={`p-2.5 flex items-center gap-2 ${index === 0 ? 'bg-green-50' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        index === 0 ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate text-sm">{c.name}</p>
                      </div>
                      <p className="font-bold text-green-600 text-sm">{formatCurrency(c.sales)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* MTD Sales Leaderboard */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-yellow-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  MTD Sales Leaderboard
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {consultantData.slice(0, 10).map((c, index) => (
                  <div key={c.name} className={`p-2.5 flex items-center gap-2 ${index === 0 ? 'bg-amber-50' : ''}`}>
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
          </div>

          {/* Fee Breakdown Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Add Rd Sales</p>
                  <p className="text-xl font-bold text-slate-800">{mtdStats.rounds || 0}</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-blue-600">{formatCurrency(mtdStats.roundsAmount || 0)}</p>
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
      </>)}
    </div>
  );
}

function AuthnetTicker() {
  // Live balance check: what Authorize.net processed today vs what the payment
  // system recorded. Green = balanced to the penny. Red = the difference and
  // which side is missing it. Card money only (Zelle/checks live in Zoho).
  const [d, setD] = React.useState(null);
  React.useEffect(() => {
    const load = () => fetch('/.netlify/functions/authnet-proxy').then((r) => r.json()).then(setD).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  if (!d) return null;
  if (d.error) return <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold bg-amber-50 text-amber-700">Auth.net balance check unavailable: {d.error}</div>;
  const fmt = (n) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const base = `Auth.net today: ${fmt(d.authnet?.total)} (${d.authnet?.count}${d.authnet?.refunds ? `, ${d.authnet.refunds} refund${d.authnet.refunds > 1 ? 's' : ''}` : ''})  |  App: ${fmt(d.app?.total)} (${d.app?.count})`;
  if (d.match) return <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700">{'✅'} {base} {'—'} balanced</div>;
  return <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700">{'⚠️'} {base} {'—'} {fmt(Math.abs(d.difference || 0))} {(d.difference || 0) > 0 ? 'processed at Auth.net that the system has not recorded' : 'recorded in the system but not seen at Auth.net'}{d.authnet?.errors?.length ? ` (${d.authnet.errors.join('; ')})` : ''}</div>;
}
export default ConsultantPayments;
