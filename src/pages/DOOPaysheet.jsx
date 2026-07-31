import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, Target, Award, AlertTriangle, 
  Calendar, ChevronDown, ChevronUp, Info, Shield, Scissors,
  CheckCircle, XCircle, Clock, RefreshCw, ExternalLink
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { categorizeTransaction } from '../lib/transactionCategorization';

// Same API as Financial Dashboard
const PLAID_API = 'https://asap-financial-dashboard-backend-production.up.railway.app/api/plaid';

// Historical revenue data for growth comparison
const HISTORICAL_REVENUE = {
  2024: {
    1: 61240, 2: 75045, 3: 87142, 4: 82763, 5: 64671, 6: 56979,
    7: 65322, 8: 88139, 9: 71499, 10: 73052, 11: 62845, 12: 55619
  },
  2025: {
    1: 69243, 2: 79509, 3: 106953, 4: 107942, 5: 103091, 6: 102519,
    7: 99422, 8: 93242, 9: 87951, 10: 97402, 11: 77044, 12: 85952
  }
};

// === STORED FOR FUTURE REFERENCE ===
// Previous bonus structure (paused per Joe & Astrid agreement March 2026):
// GROWTH_TIERS: 30-49% = $250, 50-74% = $500, 75%+ = $750
// PROFIT_TIERS: $1-5K = $150, $5K-10K = $300, $10K-20K = $600, $20K+ = $1,000
// Expense Reduction Bonus: 50% of annual savings (one-time, after 90 days)
// Monthly Bonus Cap: 25% of Net Profit
// ===================================

// Current structure: 3% of Net Profit on profitable months only (excludes affiliate revenue)

export default function DOOPaysheet() {
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showHistorical, setShowHistorical] = useState(false);
  const [showBonusBreakdown, setShowBonusBreakdown] = useState(true);
  const [showProtectionInfo, setShowProtectionInfo] = useState(false);
  const [suspensionStatus] = useState({ active: false, reason: null });
  const [error, setError] = useState(null);
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [allTransactions, setAllTransactions] = useState(null); // Cache all transactions

  const currentMonth = selectedMonth.getMonth() + 1;
  const currentYear = selectedMonth.getFullYear();

  // Load transactions once, then filter by month
  useEffect(() => {
    if (allTransactions === null) {
      loadAllTransactions();
    } else {
      processMonthData();
    }
  }, [selectedMonth, allTransactions]);

  const loadAllTransactions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check localStorage cache first (valid for 5 minutes)
      const cached = localStorage.getItem('plaidTransactionsCache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - timestamp < fiveMinutes) {
          setAllTransactions(data.transactions || []);
          setPlaidConnected(true);
          return;
        }
      }

      // Check Plaid connection status
      const accountsRes = await fetch(`${PLAID_API}/accounts`);
      const accountsData = await accountsRes.json();
      
      if (!accountsData.plaidEnabled || !accountsData.accounts?.length) {
        setPlaidConnected(false);
        setFinancialData(null);
        setLoading(false);
        return;
      }
      
      setPlaidConnected(true);
      
      // Fetch all transactions from Plaid
      const txRes = await fetch(`${PLAID_API}/transactions`);
      const txData = await txRes.json();
      const transactions = txData.transactions || [];
      
      // Cache in localStorage
      localStorage.setItem('plaidTransactionsCache', JSON.stringify({
        data: txData,
        timestamp: Date.now()
      }));
      
      setAllTransactions(transactions);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError(err.message);
      setFinancialData(null);
      setLoading(false);
    }
  };

  const processMonthData = () => {
    if (!allTransactions) return;
    
    setLoading(true);
    
    // Filter transactions for selected month
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    const monthTransactions = allTransactions.filter(t => {
      const txDate = parseISO(t.date);
      return isWithinInterval(txDate, { start: monthStart, end: monthEnd });
    });
    
    // Categorize and calculate P&L
    let totalRevenue = 0;
    let affiliateRevenue = 0;
    let cogs = 0;
    let operatingExpenses = 0;
    
    // Load learned categories from localStorage (same as Financial Dashboard)
    const learnedCategories = JSON.parse(localStorage.getItem('learnedCategories') || '{}');
    
    monthTransactions.forEach(t => {
      const categorized = categorizeTransaction(t, learnedCategories);
      // The lib returns transactionType; the old .type reads below were dead
      // code, which silently counted card-payment transfers as expenses.
      const txType = categorized.transactionType || categorized.type;
      const amount = Math.abs(t.amount);
      
      // Income (negative amounts in Plaid = money coming in)
      if (t.amount < 0) {
        if (categorized.category?.toLowerCase().includes('affiliate') || 
            categorized.category?.toLowerCase().includes('idiq') ||
            categorized.category?.toLowerCase().includes('smartcredit')) {
          affiliateRevenue += amount;
        }
        totalRevenue += amount;
      } 
      // Expenses (positive amounts in Plaid = money going out)
      else if (t.amount > 0) {
        // Skip transfers
        if (txType === 'transfer' || txType === 'owner_excluded') return; // owner costs never touch Astrid's P&L (Joe 7/31)
        
        if (txType === 'cogs') {
          cogs += amount;
        } else {
          operatingExpenses += amount;
        }
      }
    });
    
    const coreRevenue = totalRevenue - affiliateRevenue;
    const grossProfit = coreRevenue - cogs;  // DOO P&L uses Core Revenue, not Total
    const netProfit = grossProfit - operatingExpenses;
    
    setFinancialData({
      totalRevenue,
      affiliateRevenue,
      coreRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit,
      transactionCount: monthTransactions.length
    });
    
    setLoading(false);
  };

  const forceRefresh = async () => {
    localStorage.removeItem('plaidTransactionsCache');
    setAllTransactions(null);
  };

  // Calculate bonuses based on compensation agreement
  const calculations = useMemo(() => {
    const priorYearRevenue = HISTORICAL_REVENUE[currentYear - 1]?.[currentMonth] || 0;

    if (!financialData) {
      return {
        totalRevenue: 0, affiliateRevenue: 0, coreRevenue: 0, totalExpenses: 0, netProfit: 0,
        isProfitable: false, priorYearRevenue, yoyGrowth: 0, yoyGrowthPercent: '0.0',
        profitShare: 0, totalBonus: 0,
        isSuspended: false, finalBonus: 0, baseSalary: 6000, totalCompensation: 6000
      };
    }

    const { totalRevenue, affiliateRevenue, coreRevenue, operatingExpenses, netProfit } = financialData;
    
    // CRITICAL: Per compensation agreement - NO bonuses if Net Profit <= 0
    const isProfitable = netProfit > 0;
    
    // YoY Growth (for reference display only - not used in bonus calc)
    const yoyGrowth = priorYearRevenue > 0 ? (coreRevenue - priorYearRevenue) / priorYearRevenue : 0;

    // Simple structure: 3% of Net Profit on profitable months
    let profitShare = 0;
    
    if (isProfitable) {
      profitShare = netProfit * 0.03;
    }

    const totalBonus = Math.round(profitShare * 100) / 100;
    
    const isSuspended = suspensionStatus?.active || false;
    const finalBonus = isSuspended ? 0 : Math.max(0, totalBonus);

    return {
      totalRevenue, affiliateRevenue, coreRevenue, totalExpenses: operatingExpenses, netProfit,
      isProfitable, priorYearRevenue, yoyGrowth,
      yoyGrowthPercent: (yoyGrowth * 100).toFixed(1),
      profitShare: Math.round(profitShare * 100) / 100,
      totalBonus,
      isSuspended, suspensionReason: suspensionStatus?.reason,
      finalBonus,
      baseSalary: 6000,
      totalCompensation: 6000 + Math.round(finalBonus * 100) / 100
    };
  }, [financialData, currentMonth, currentYear, suspensionStatus]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const navigateMonth = (direction) => {
    setSelectedMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + direction); return d; });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded-xl"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">DOO Compensation Dashboard</h1>
            <p className="text-indigo-200">Astrid – Director of Operations</p>
            <div className="flex items-center gap-4 mt-2">
              <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-white/20 rounded">
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <span className="font-semibold text-lg">{monthNames[currentMonth]} {currentYear}</span>
              <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-white/20 rounded">
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">Total Compensation</p>
            <p className="text-4xl font-bold">{formatCurrency(calculations.totalCompensation)}</p>
            <p className="text-indigo-200 text-sm">Base: $6,000 + Bonus: {formatCurrency(calculations.finalBonus)}</p>
          </div>
        </div>
      </div>

      {/* Plaid Not Connected */}
      {!plaidConnected && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
            <div>
              <h3 className="font-bold text-amber-800">Bank Accounts Not Connected</h3>
              <p className="text-amber-700 mt-1">
                Connect your bank accounts in the Financial Dashboard to see live P&L data for compensation calculations.
              </p>
              <a href="/financial" className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
                <ExternalLink className="w-4 h-4" />
                Go to Financial Dashboard
              </a>
            </div>
          </div>
        </div>
      )}

      {/* NOT PROFITABLE WARNING */}
      {plaidConnected && financialData && !calculations.isProfitable && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-red-800">Company Not Profitable This Month</h3>
              <p className="text-red-700 mt-1">
                Net Profit: <span className="font-bold">{formatCurrency(calculations.netProfit)}</span>
              </p>
              <p className="text-red-600 mt-2">
                Per the compensation agreement, <strong>the 3% profit share bonus is $0</strong> when the company 
                is not profitable. Base salary of $6,000 continues unchanged.
              </p>
              <div className="mt-4 p-3 bg-white rounded-lg border border-red-200">
                <p className="text-sm text-red-800 font-medium">Section 2 of Compensation Agreement:</p>
                <p className="text-sm text-red-700 italic mt-1">
                  "No bonuses are paid in months where Net Profit is $0 or negative."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {plaidConnected && financialData && (
        <>
          <div className="flex justify-end">
            <button 
              onClick={forceRefresh}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <DollarSign className="w-4 h-4" />
                Core Service Revenue
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(calculations.coreRevenue)}</p>
              <p className="text-xs text-gray-400">Excludes {formatCurrency(calculations.affiliateRevenue)} affiliate</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Target className="w-4 h-4" />
                Net Profit (DOO P&L)
              </div>
              <p className={`text-2xl font-bold mt-1 ${calculations.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calculations.netProfit)}
              </p>
              <p className={`text-xs ${calculations.isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                {calculations.isProfitable ? 'Bonus eligible ✓' : 'Not eligible for bonus'}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <TrendingUp className="w-4 h-4" />
                YoY Growth
              </div>
              <p className={`text-2xl font-bold mt-1 ${parseFloat(calculations.yoyGrowthPercent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {calculations.yoyGrowthPercent}%
              </p>
              <p className="text-xs text-gray-400">vs {monthNames[currentMonth]} {currentYear - 1}: {formatCurrency(calculations.priorYearRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Award className="w-4 h-4" />
                Profit Share (3%)
              </div>
              <p className={`text-2xl font-bold mt-1 ${calculations.finalBonus > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {formatCurrency(calculations.finalBonus)}
              </p>
              {!calculations.isProfitable && (
                <p className="text-xs text-red-500">$0 - not profitable</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bonus Calculation Breakdown */}
      {plaidConnected && financialData && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <button onClick={() => setShowBonusBreakdown(!showBonusBreakdown)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50">
            <h2 className="text-lg font-semibold">Compensation Breakdown</h2>
            {showBonusBreakdown ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showBonusBreakdown && (
            <div className="px-6 pb-6 space-y-4">
              {/* Profitability Gate */}
              <div className={`flex items-center justify-between py-3 border-b ${!calculations.isProfitable ? 'bg-red-50 -mx-6 px-6' : ''}`}>
                <div>
                  <p className="font-medium">Profitability Requirement</p>
                  <p className={`text-sm ${calculations.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                    Net Profit: {formatCurrency(calculations.netProfit)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {calculations.isProfitable ? (
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-5 h-5" /> Passed</span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600"><XCircle className="w-5 h-5" /> Not Met</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div><p className="font-medium">Profit Share (3%)</p><p className="text-sm text-gray-500">{calculations.isProfitable ? `3% × ${formatCurrency(calculations.netProfit)} Net Profit` : 'Requires profitability'}</p></div>
                <p className={`text-lg font-semibold ${calculations.profitShare > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatCurrency(calculations.profitShare)}</p>
              </div>
              <div className="flex items-center justify-between py-3 bg-gray-50 -mx-6 px-6 mt-4">
                <p className="font-bold text-lg">Total Monthly Bonus</p>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${calculations.isSuspended ? 'text-red-500 line-through' : calculations.finalBonus > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatCurrency(calculations.totalBonus)}</p>
                  {calculations.isSuspended && <p className="text-red-500 font-semibold">$0 (Suspended)</p>}
                  {!calculations.isProfitable && !calculations.isSuspended && <p className="text-red-500 text-sm">No bonus - company not profitable</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historical Performance */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <button onClick={() => setShowHistorical(!showHistorical)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50">
          <h2 className="text-lg font-semibold">Historical YoY Growth (Reference)</h2>
          {showHistorical ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {showHistorical && (
          <div className="px-6 pb-6">
            <p className="text-sm text-gray-500 mb-4">Core Service Revenue comparison: 2024 vs 2025.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 pr-4">Month</th><th className="text-right py-2 px-4">2024</th><th className="text-right py-2 px-4">2025</th><th className="text-right py-2 px-4">Growth</th></tr></thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
                    const rev2024 = HISTORICAL_REVENUE[2024][month];
                    const rev2025 = HISTORICAL_REVENUE[2025][month];
                    const growth = (rev2025 - rev2024) / rev2024;
                    return (
                      <tr key={month} className="border-b">
                        <td className="py-2 pr-4 font-medium">{monthNames[month]}</td>
                        <td className="text-right py-2 px-4 text-gray-500">{formatCurrency(rev2024)}</td>
                        <td className="text-right py-2 px-4">{formatCurrency(rev2025)}</td>
                        <td className={`text-right py-2 px-4 font-medium ${growth >= 0.30 ? 'text-green-600' : 'text-gray-500'}`}>{(growth * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="bg-gray-100 font-semibold"><td className="py-2 pr-4">Total</td><td className="text-right py-2 px-4">$844K</td><td className="text-right py-2 px-4">$1.11M</td><td className="text-right py-2 px-4 text-green-600">31%</td></tr></tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Business Protection */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <button onClick={() => setShowProtectionInfo(!showProtectionInfo)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50">
          <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-gray-400" /><h2 className="text-lg font-semibold">Business Setback Protection</h2></div>
          {showProtectionInfo ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {showProtectionInfo && (
          <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-red-700 mb-2">Suspension Triggers</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />Any lawsuit filed against company</li>
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />Regulatory investigation or compliance action</li>
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />Revenue drops below 50% of 6-month average</li>
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />Cash reserves below 60 days expenses</li>
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />Cease & desist or demand letter</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-green-700 mb-2">During Suspension</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />Base salary ($6,000/mo) continues unchanged</li>
                <li className="flex items-start gap-2"><Clock className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />Bonus calculations paused (not accruing)</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />Bonuses resume when condition resolved</li>
              </ul>
              <p className="text-xs text-gray-400 mt-4">This protection exists because ASAP operates in a litigious industry.</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">About This Dashboard</p>
            <p className="mt-1">This dashboard pulls live data from the same Plaid connection as the Financial Dashboard. Core Service Revenue excludes affiliate revenue (IDIQ, SmartCredit). Bonus is 3% of Net Profit on profitable months only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
