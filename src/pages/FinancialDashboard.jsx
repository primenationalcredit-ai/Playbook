import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  PieChart,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Target,
  Calendar,
  CreditCard,
  Wallet,
  Building,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Settings,
  Zap,
  Lightbulb,
  Search,
  HelpCircle,
  List,
  LayoutGrid,
  FileQuestion,
  Repeat,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, isWithinInterval } from 'date-fns';

const QUICKBOOKS_API = 'https://asap-financial-dashboard-backend-production-b444.up.railway.app/api/quickbooks';

export default function FinancialDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Settings
  const [dooPercentage, setDooPercentage] = useState(3); // Lower default
  const [showSettings, setShowSettings] = useState(false);
  
  // Navigation
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview'); // overview, expenses, subscriptions, uncategorized
  
  // Drill-down
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    checkConnectionAndLoadData();
  }, []);

  const checkConnectionAndLoadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch(`${QUICKBOOKS_API}/status`);
      const statusData = await statusRes.json();
      
      if (statusData.connected) {
        setIsConnected(true);
        const dataRes = await fetch(`${QUICKBOOKS_API}/data`);
        if (dataRes.ok) {
          const financialData = await dataRes.json();
          if (!financialData.error) {
            setData(financialData);
            setLastUpdated(new Date());
          }
        }
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Error loading financial data:', err);
      setError('Unable to connect to QuickBooks.');
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetch(`${QUICKBOOKS_API}/refresh`, { method: 'POST' });
      await checkConnectionAndLoadData();
    } catch (err) {
      setError('Failed to refresh data');
    }
    setLoading(false);
  };

  const handleConnect = () => {
    window.open(`${QUICKBOOKS_API}/auth`, '_blank');
  };

  // Filter transactions by selected month
  const getMonthTransactions = () => {
    if (!data?.transactions) return [];
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return data.transactions.filter(t => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start, end });
    });
  };

  const monthTransactions = getMonthTransactions();
  
  // Get monthly summary from P&L data (more accurate) or calculate from transactions
  const getMonthlyTotals = () => {
    const monthName = format(selectedMonth, 'MMM');
    const monthYear = format(selectedMonth, 'yyyy');
    
    // Try to find this month in the P&L monthly data
    const plMonth = data?.monthlyData?.find(m => {
      // Match month name (e.g., "Dec") 
      return m.month === monthName;
    });
    
    if (plMonth && plMonth.revenue !== undefined) {
      return {
        income: plMonth.revenue || 0,
        expenses: plMonth.expenses || 0,
        profit: plMonth.profit || (plMonth.revenue - plMonth.expenses)
      };
    }
    
    // Fall back to calculating from transactions
    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      income,
      expenses,
      profit: income - expenses
    };
  };

  const monthlyTotals = getMonthlyTotals();
  const monthIncome = monthlyTotals.income;
  const monthExpenses = monthlyTotals.expenses;
  const monthProfit = monthlyTotals.profit;
  const profitMargin = monthIncome > 0 ? ((monthProfit / monthIncome) * 100) : 0;
  const dooShare = monthProfit > 0 ? (monthProfit * (dooPercentage / 100)) : 0;

  // Group expenses by category for selected month
  const expensesByCategory = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const cat = t.category || 'Uncategorized';
      if (!acc[cat]) acc[cat] = { total: 0, transactions: [] };
      acc[cat].total += Math.abs(t.amount);
      acc[cat].transactions.push(t);
      return acc;
    }, {});

  // Identify subscriptions (recurring charges)
  const subscriptions = monthTransactions
    .filter(t => {
      const desc = (t.description || '').toLowerCase();
      return t.type === 'expense' && (
        desc.includes('subscription') ||
        desc.includes('monthly') ||
        desc.includes('recurring') ||
        desc.includes('saas') ||
        desc.includes('software') ||
        t.category?.toLowerCase().includes('software')
      );
    });

  const subscriptionTotal = subscriptions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Uncategorized transactions
  const uncategorized = monthTransactions.filter(t => 
    !t.category || t.category === 'Uncategorized' || t.category === 'Other'
  );
  const uncategorizedTotal = uncategorized.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatCurrencyDetailed = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto text-green-600 mb-4" size={32} />
          <p className="text-slate-600">Loading financial data from QuickBooks...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Building size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Connect to QuickBooks</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Connect your QuickBooks Online account to see live financial data.
          </p>
          <button
            onClick={handleConnect}
            className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium inline-flex items-center gap-2"
          >
            <ExternalLink size={18} /> Connect QuickBooks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Financial Dashboard</h1>
            <p className="text-slate-500 text-sm">
              {lastUpdated && `Updated: ${format(lastUpdated, 'MMM d, h:mm a')}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Month Selector */}
          <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
            <button 
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              className="p-2 hover:bg-slate-100 rounded"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 py-1 font-medium text-slate-800 min-w-[120px] text-center">
              {format(selectedMonth, 'MMMM yyyy')}
            </div>
            <button 
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              className="p-2 hover:bg-slate-100 rounded"
              disabled={selectedMonth >= new Date()}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h3 className="font-medium text-slate-800 mb-4">Settings</h3>
          <div className="flex gap-6">
            <div>
              <label className="block text-sm text-slate-600 mb-1">DOO Profit Bonus %</label>
              <input
                type="number"
                value={dooPercentage}
                onChange={(e) => setDooPercentage(parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-2 border rounded-lg"
                min="0"
                max="100"
                step="0.5"
              />
              <p className="text-xs text-slate-500 mt-1">% of profit as bonus</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <TrendingUp size={18} />
            <span className="text-xs text-slate-500">Sales/Revenue</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(monthIncome)}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <TrendingDown size={18} />
            <span className="text-xs text-slate-500">Expenses</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(monthExpenses)}</p>
        </div>
        
        <div className={`rounded-xl p-4 border shadow-sm ${monthProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={18} className={monthProfit >= 0 ? 'text-green-600' : 'text-red-600'} />
            <span className="text-xs text-slate-500">Net Profit</span>
          </div>
          <p className={`text-2xl font-bold ${monthProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrency(monthProfit)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Target size={18} className="text-blue-600" />
            <span className="text-xs text-slate-500">Profit Margin</span>
          </div>
          <p className={`text-2xl font-bold ${profitMargin >= 15 ? 'text-green-600' : profitMargin >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
            {profitMargin.toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} className="text-purple-600" />
            <span className="text-xs text-slate-500">DOO Bonus ({dooPercentage}%)</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{formatCurrency(dooShare)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutGrid },
          { id: 'expenses', label: 'Expenses', icon: List },
          { id: 'subscriptions', label: 'Subscriptions', icon: Repeat, count: subscriptions.length },
          { id: 'uncategorized', label: 'Uncategorized', icon: FileQuestion, count: uncategorized.length },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === tab.id ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-slate-200' : 'bg-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Expense Categories */}
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <PieChart size={20} className="text-blue-600" />
              Top Expense Categories
            </h3>
            
            {Object.keys(expensesByCategory).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(expensesByCategory)
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 6)
                  .map(([category, data]) => {
                    const pct = monthExpenses > 0 ? (data.total / monthExpenses * 100) : 0;
                    const isExpanded = expandedCategory === category;
                    
                    return (
                      <div key={category} className="border rounded-lg overflow-hidden">
                        <div 
                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                          onClick={() => setExpandedCategory(isExpanded ? null : category)}
                        >
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-slate-700">{category}</span>
                              <span className="text-slate-600">{formatCurrency(data.total)}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="ml-3 flex items-center gap-2">
                            <span className="text-xs text-slate-500">{pct.toFixed(0)}%</span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="bg-slate-50 border-t p-3 max-h-48 overflow-y-auto">
                            <p className="text-xs text-slate-500 mb-2">{data.transactions.length} transactions</p>
                            {data.transactions.slice(0, 10).map((t, i) => (
                              <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                                <div>
                                  <p className="text-slate-700">{t.description || 'No description'}</p>
                                  <p className="text-xs text-slate-400">{format(parseISO(t.date), 'MMM d')}</p>
                                </div>
                                <span className="text-slate-600">{formatCurrencyDetailed(Math.abs(t.amount))}</span>
                              </div>
                            ))}
                            {data.transactions.length > 10 && (
                              <p className="text-xs text-slate-500 mt-2">+{data.transactions.length - 10} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No expense data for this month</p>
            )}
          </div>

          {/* Quick Stats & Alerts */}
          <div className="space-y-6">
            {/* Alerts */}
            <div className="bg-white rounded-xl p-6 border shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500" />
                Attention Needed
              </h3>
              
              <div className="space-y-3">
                {uncategorized.length > 0 && (
                  <div 
                    className="p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100"
                    onClick={() => setActiveTab('uncategorized')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-amber-800">{uncategorized.length} Uncategorized Transactions</p>
                        <p className="text-sm text-amber-600">{formatCurrency(uncategorizedTotal)} needs categorization</p>
                      </div>
                      <ChevronRight size={18} className="text-amber-600" />
                    </div>
                  </div>
                )}
                
                {profitMargin < 10 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-medium text-red-800">Low Profit Margin</p>
                    <p className="text-sm text-red-600">At {profitMargin.toFixed(1)}%, consider reducing expenses</p>
                  </div>
                )}

                {subscriptionTotal > monthExpenses * 0.3 && (
                  <div 
                    className="p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100"
                    onClick={() => setActiveTab('subscriptions')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-blue-800">High Subscription Costs</p>
                        <p className="text-sm text-blue-600">{formatCurrency(subscriptionTotal)} in recurring charges</p>
                      </div>
                      <ChevronRight size={18} className="text-blue-600" />
                    </div>
                  </div>
                )}

                {uncategorized.length === 0 && profitMargin >= 10 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={18} className="text-green-600" />
                      <p className="font-medium text-green-800">Books look good!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DOO Incentive */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap size={20} />
                DOO Profit Bonus
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-purple-200 text-xs">This Month</p>
                  <p className="text-2xl font-bold">{formatCurrency(dooShare)}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-purple-200 text-xs">If Expenses ↓10%</p>
                  <p className="text-2xl font-bold text-green-300">
                    {formatCurrency((monthIncome - monthExpenses * 0.9) * (dooPercentage / 100))}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-white/10 rounded-lg text-sm">
                <Lightbulb size={16} className="inline mr-2" />
                Every {formatCurrency(100)} saved = {formatCurrency(100 * (dooPercentage / 100))} more bonus
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">All Expenses - {format(selectedMonth, 'MMMM yyyy')}</h3>
            <p className="text-slate-600">Total: {formatCurrency(monthExpenses)}</p>
          </div>
          
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {Object.entries(expensesByCategory)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([category, data]) => (
                <div key={category} className="p-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedCategory === category ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      <div>
                        <p className="font-medium text-slate-800">{category}</p>
                        <p className="text-sm text-slate-500">{data.transactions.length} transactions</p>
                      </div>
                    </div>
                    <p className="font-semibold text-slate-800">{formatCurrency(data.total)}</p>
                  </div>
                  
                  {expandedCategory === category && (
                    <div className="mt-4 ml-8 space-y-2">
                      {data.transactions
                        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                        .map((t, i) => (
                          <div key={i} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg">
                            <div>
                              <p className="text-slate-700">{t.description || 'No description'}</p>
                              <p className="text-xs text-slate-400">{format(parseISO(t.date), 'MMM d, yyyy')}</p>
                            </div>
                            <span className="font-medium text-slate-800">{formatCurrencyDetailed(Math.abs(t.amount))}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            
            {Object.keys(expensesByCategory).length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No expenses found for this month
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Recurring Subscriptions</h3>
              <p className="text-sm text-slate-500">Software, SaaS, and recurring charges</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(subscriptionTotal)}</p>
              <p className="text-sm text-slate-500">/month</p>
            </div>
          </div>
          
          <div className="divide-y">
            {subscriptions.length > 0 ? (
              subscriptions
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .map((t, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Repeat size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{t.description || 'Subscription'}</p>
                        <p className="text-sm text-slate-500">{format(parseISO(t.date), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-800">{formatCurrencyDetailed(Math.abs(t.amount))}</p>
                      <button className="text-xs text-blue-600 hover:underline">Review</button>
                    </div>
                  </div>
                ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Repeat size={32} className="mx-auto mb-2 text-slate-300" />
                <p>No subscriptions detected this month</p>
                <p className="text-sm">Subscriptions are identified by keywords like "monthly", "subscription", "software"</p>
              </div>
            )}
          </div>
          
          {subscriptions.length > 0 && (
            <div className="p-4 bg-amber-50 border-t border-amber-200">
              <div className="flex items-start gap-2">
                <Lightbulb size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Review each subscription:</p>
                  <ul className="mt-1 space-y-1">
                    <li>• Is it being used regularly?</li>
                    <li>• Can it be downgraded to a cheaper plan?</li>
                    <li>• Is there a cheaper alternative?</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'uncategorized' && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Uncategorized Transactions</h3>
              <p className="text-sm text-slate-500">These need to be categorized in QuickBooks</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(uncategorizedTotal)}</p>
              <p className="text-sm text-slate-500">{uncategorized.length} items</p>
            </div>
          </div>
          
          <div className="divide-y">
            {uncategorized.length > 0 ? (
              uncategorized
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .map((t, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <FileQuestion size={18} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{t.description || 'No description'}</p>
                        <p className="text-sm text-slate-500">{format(parseISO(t.date), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${t.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                        {t.type === 'expense' ? '-' : '+'}{formatCurrencyDetailed(Math.abs(t.amount))}
                      </p>
                      <p className="text-xs text-slate-500">{t.type}</p>
                    </div>
                  </div>
                ))
            ) : (
              <div className="p-8 text-center">
                <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                <p className="font-medium text-slate-800">All transactions categorized!</p>
                <p className="text-slate-500">Great job keeping the books clean.</p>
              </div>
            )}
          </div>
          
          {uncategorized.length > 0 && (
            <div className="p-4 bg-blue-50 border-t border-blue-200">
              <div className="flex items-start gap-2">
                <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">To categorize these:</p>
                  <ol className="mt-1 space-y-1 list-decimal list-inside">
                    <li>Log into QuickBooks Online</li>
                    <li>Go to Transactions → Bank Transactions</li>
                    <li>Find each transaction and assign a category</li>
                    <li>Click "Refresh" here to update</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
