import React, { useState, useEffect, useCallback, useMemo } from 'react';
import IMPORTED_TRANSACTIONS_2025 from '../data/importedTransactions2025';
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
  Eye,
  ArrowRight,
  ArrowDown,
  Minus,
  X,
  BarChart3,
  TrendingUp as TrendUp,
  Clock,
  Users,
  Package,
  Briefcase,
  Receipt,
  CreditCard as CardIcon,
  Banknote,
  Calculator,
  Link,
  Unlink,
  Loader2,
  Flag,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Scissors,
  DollarSign as NegotiateIcon,
  AlertCircle,
  CheckCheck,
  Trash2,
  BookOpen
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, isWithinInterval, startOfYear, subYears } from 'date-fns';

const QUICKBOOKS_API = 'https://asap-financial-dashboard-backend-production.up.railway.app/api/quickbooks';
const PLAID_API = 'https://asap-financial-dashboard-backend-production.up.railway.app/api/plaid';
const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

export default function FinancialDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Settings
  const [dooPercentage, setDooPercentage] = useState(3);
  const [showSettings, setShowSettings] = useState(false);
  
  // Time period selection
  const [timePeriod, setTimePeriod] = useState('1M'); // 1M, 3M, 6M, 9M, YTD, 1Y, 2Y
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // View mode
  const [activeTab, setActiveTab] = useState('pnl'); // pnl, expenses, subscriptions, uncategorized
  
  // Drill-down state
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [drillDownModal, setDrillDownModal] = useState(null);
  
  // Plaid state
  const [plaidEnabled, setPlaidEnabled] = useState(false);
  const [plaidAccounts, setPlaidAccounts] = useState([]);
  const [plaidTransactions, setPlaidTransactions] = useState([]);
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [plaidLinkReady, setPlaidLinkReady] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  
  // Expense review state
  const [flaggedExpenses, setFlaggedExpenses] = useState(() => {
    const saved = localStorage.getItem('flaggedExpenses');
    return saved ? JSON.parse(saved) : {};
  });
  const [showExpenseInsights, setShowExpenseInsights] = useState(true);

  // Load Plaid Link script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.async = true;
    script.onload = () => setPlaidLinkReady(true);
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    checkConnectionAndLoadData();
    checkPlaidStatus();
  }, []);

  const checkPlaidStatus = async () => {
    try {
      const res = await fetch(`${PLAID_API}/accounts`);
      const data = await res.json();
      setPlaidEnabled(data.plaidEnabled || false);
      setPlaidAccounts(data.accounts || []);
    } catch (err) {
      console.log('Plaid status check failed:', err);
    }
  };

  // Force sync all transactions from Plaid (full history from Jan 2025)
  const handleForceSync = async () => {
    setPlaidLoading(true);
    try {
      // Trigger backend sync
      const syncRes = await fetch(`${PLAID_API}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: '2025-01-01' })
      });
      const syncData = await syncRes.json();
      console.log('Plaid sync result:', syncData);
      
      // Reload transactions
      await loadPlaidTransactions();
      alert(`Sync complete! ${plaidTransactions.length} transactions loaded from Jan 2025.`);
    } catch (err) {
      console.error('Sync failed:', err);
      alert('Sync failed: ' + err.message);
    }
    setPlaidLoading(false);
  };

  const loadPlaidTransactions = async () => {
    if (plaidAccounts.length === 0) return;
    
    try {
      // Always pull from Jan 1, 2025 to ensure full tax year coverage
      const res = await fetch(`${PLAID_API}/transactions?start_date=2025-01-01&end_date=${format(new Date(), 'yyyy-MM-dd')}`);
      const data = await res.json();
      const txns = data.transactions || [];
      console.log(`Plaid transactions loaded: ${txns.length} from Jan 2025 to now`);
      setPlaidTransactions(txns);
    } catch (err) {
      console.log('Failed to load Plaid transactions:', err);
    }
  };

  useEffect(() => {
    if (plaidAccounts.length > 0) {
      loadPlaidTransactions();
    }
  }, [plaidAccounts]);

  const handleConnectBank = async () => {
    if (!plaidLinkReady) {
      alert('Plaid Link is still loading. Please try again in a moment.');
      return;
    }
    
    setPlaidLoading(true);
    
    try {
      // Get link token from backend
      const res = await fetch(`${PLAID_API}/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
        setPlaidLoading(false);
        return;
      }
      
      if (!data.link_token) {
        alert('Failed to get link token from server');
        setPlaidLoading(false);
        return;
      }
      
      // Open Plaid Link
      const handler = window.Plaid.create({
        token: data.link_token,
        onSuccess: async (public_token, metadata) => {
          console.log('Plaid Link success:', metadata);
          
          // Exchange public token for access token
          try {
            const exchangeRes = await fetch(`${PLAID_API}/exchange-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                public_token: public_token,
                institution: metadata.institution
              })
            });
            
            const exchangeData = await exchangeRes.json();
            
            if (exchangeData.error) {
              alert('Error connecting bank: ' + exchangeData.error);
            } else {
              alert(`Successfully connected ${metadata.institution.name}!`);
              await checkPlaidStatus();
              await loadPlaidTransactions();
            }
          } catch (err) {
            console.error('Token exchange error:', err);
            alert('Error finalizing bank connection: ' + err.message);
          }
          
          setPlaidLoading(false);
        },
        onExit: (err, metadata) => {
          console.log('Plaid Link exit:', err, metadata);
          setPlaidLoading(false);
          if (err) {
            console.error('Plaid Link error:', err);
          }
        },
        onEvent: (eventName, metadata) => {
          console.log('Plaid Link event:', eventName, metadata);
        }
      });
      
      handler.open();
      
    } catch (err) {
      console.error('Connect bank error:', err);
      alert('Error connecting bank: ' + err.message);
      setPlaidLoading(false);
    }
  };

  const handleDisconnectBank = async (accountId) => {
    if (!confirm('Are you sure you want to disconnect this bank account?')) return;
    
    try {
      await fetch(`${PLAID_API}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId })
      });
      await checkPlaidStatus();
    } catch (err) {
      alert('Error disconnecting: ' + err.message);
    }
  };

  const handleToggleAccount = async (institutionId, accountId, exclude) => {
    try {
      const res = await fetch(`${PLAID_API}/toggle-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          institution_id: institutionId, 
          account_id: accountId, 
          exclude 
        })
      });
      const data = await res.json();
      if (data.success) {
        await checkPlaidStatus();
      } else {
        alert('Error: ' + (data.error || 'Failed to toggle account'));
      }
    } catch (err) {
      alert('Error toggling account: ' + err.message);
    }
  };

  // Expense flagging functions
  const flagExpense = (transactionId, flagType, note = '') => {
    const newFlags = {
      ...flaggedExpenses,
      [transactionId]: {
        type: flagType,
        note,
        flaggedAt: new Date().toISOString(),
        flaggedBy: 'Admin'
      }
    };
    setFlaggedExpenses(newFlags);
    localStorage.setItem('flaggedExpenses', JSON.stringify(newFlags));
  };

  const unflagExpense = (transactionId) => {
    const newFlags = { ...flaggedExpenses };
    delete newFlags[transactionId];
    setFlaggedExpenses(newFlags);
    localStorage.setItem('flaggedExpenses', JSON.stringify(newFlags));
  };

  const getFlaggedCount = (type) => {
    return Object.values(flaggedExpenses).filter(f => f.type === type).length;
  };

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

  // Get date range based on time period
  const getDateRange = () => {
    const now = new Date();
    let start, end;
    
    switch (timePeriod) {
      case '1M':
        start = startOfMonth(selectedMonth);
        end = endOfMonth(selectedMonth);
        break;
      case '3M':
        start = startOfMonth(subMonths(now, 2));
        end = endOfMonth(now);
        break;
      case '6M':
        start = startOfMonth(subMonths(now, 5));
        end = endOfMonth(now);
        break;
      case '9M':
        start = startOfMonth(subMonths(now, 8));
        end = endOfMonth(now);
        break;
      case 'YTD':
        start = startOfYear(now);
        end = endOfMonth(now);
        break;
      case '1Y':
        start = startOfMonth(subYears(now, 1));
        end = endOfMonth(now);
        break;
      case '2Y':
        start = startOfMonth(subYears(now, 2));
        end = endOfMonth(now);
        break;
      case 'TAX2025':
        start = new Date(2025, 0, 1); // Jan 1, 2025
        end = new Date(2025, 11, 31); // Dec 31, 2025
        break;
      default:
        start = startOfMonth(selectedMonth);
        end = endOfMonth(selectedMonth);
    }
    
    return { start, end };
  };

  // ===========================================
  // SMART CATEGORIZATION RULES (95%+ CONFIDENCE ONLY)
  // ===========================================
  
  // Load user's learned categorizations from localStorage
  const [learnedCategories, setLearnedCategories] = useState(() => {
    const saved = localStorage.getItem('learnedCategories');
    return saved ? JSON.parse(saved) : {};
  });

  const saveLearnedCategory = (pattern, category, transactionType) => {
    const normalizedPattern = pattern.toLowerCase().trim();
    const newLearned = {
      ...learnedCategories,
      [normalizedPattern]: { category, transactionType, learnedAt: new Date().toISOString() }
    };
    setLearnedCategories(newLearned);
    localStorage.setItem('learnedCategories', JSON.stringify(newLearned));
  };

  // ========== HIGH CONFIDENCE RULES (95%+) ==========
  
  // TRANSFERS - Credit card payments, bank transfers (EXCLUDE from P&L)
  const TRANSFER_PATTERNS = [
    'payment thank you',
    'online payment - thank you', 
    'online payment thank you',
    'chase credit crd epay',
    'american express ach pmt',
    'amex epay',
    'credit crd autopay',
    'autopay payment',
    'bank transfer',
    'internal transfer',
  ];

  // PAYROLL - Employee/contractor payments
  const PAYROLL_PATTERNS = [
    'paychex',
    'wise inc',
    'wise us inc', 
    'trnwise',
    'xoom debit',
    'remitly inc',
    'remittance',
    'gusto',
    'adp payroll',
  ];

  // AFFILIATE PAYOUTS
  const AFFILIATE_PATTERNS = [
    'affiliate payout',
    'affiliate payment',
  ];

  // MERCHANT PROCESSING FEES (COGS - direct cost)
  const MERCHANT_FEE_PATTERNS = [
    'ems merch disc',
    'signapay',
    'pci fees',
    'ems dly fees',
    'merchant disc',
    'processing fee',
  ];

  // SPECIFIC VENDOR MAPPINGS (99% confidence)
  const VENDOR_RULES = {
    // Software/SaaS - exact matches
    'godaddy': { category: 'Domain & Email Services', type: 'expense', confidence: 0.99 },
    'go daddy': { category: 'Domain & Email Services', type: 'expense', confidence: 0.99 },
    'instantly': { category: 'Sales Software', type: 'expense', confidence: 0.99 },
    'smartlead': { category: 'Email Marketing Software', type: 'expense', confidence: 0.99 },
    'twilio': { category: 'Communication Services', type: 'expense', confidence: 0.99 },
    'sendgrid': { category: 'Email Services', type: 'expense', confidence: 0.99 },
    'zapier': { category: 'Automation Services', type: 'expense', confidence: 0.99 },
    'zoho': { category: 'Invoicing Software', type: 'expense', confidence: 0.99 },
    'insightful': { category: 'Employee Monitoring', type: 'expense', confidence: 0.99 },
    'pipedrive': { category: 'CRM Software', type: 'expense', confidence: 0.99 },
    'cognito': { category: 'Web Forms', type: 'expense', confidence: 0.99 },
    'railway': { category: 'Cloud Hosting', type: 'expense', confidence: 0.99 },
    'netlify': { category: 'Cloud Hosting', type: 'expense', confidence: 0.99 },
    
    // Utilities - exact matches
    'readyrefresh': { category: 'Water Service', type: 'expense', confidence: 0.99 },
    'ringcentral': { category: 'Phone Service', type: 'expense', confidence: 0.99 },
    
    // Advertising - exact matches
    'facebk': { category: 'Advertising - Facebook', type: 'expense', confidence: 0.99 },
    'facebook': { category: 'Advertising - Facebook', type: 'expense', confidence: 0.99 },
    
    // COGS items
    'identityiq': { category: 'Credit Reports', type: 'cogs', confidence: 0.99 },
    'smart credit': { category: 'Credit Reports', type: 'cogs', confidence: 0.99 },
  };

  // Main categorization function - CONSERVATIVE
  const categorizeTransaction = (txn) => {
    const desc = (txn.description || '').toLowerCase();
    const merchant = (txn.merchant_name || '').toLowerCase();
    const combined = `${desc} ${merchant}`;
    const amount = txn.amount;
    
    // 1. FIRST: Check user's learned categories (100% confidence)
    for (const [pattern, learned] of Object.entries(learnedCategories)) {
      if (combined.includes(pattern)) {
        return {
          category: learned.category,
          transactionType: learned.transactionType,
          confidence: 1.0,
          source: 'learned'
        };
      }
    }
    
    // 2. TRANSFERS (exclude from P&L entirely)
    for (const pattern of TRANSFER_PATTERNS) {
      if (combined.includes(pattern)) {
        return { 
          category: 'Transfer/Payment', 
          transactionType: 'transfer',
          confidence: 0.98,
          source: 'rule'
        };
      }
    }
    
    // 3. PAYROLL
    for (const pattern of PAYROLL_PATTERNS) {
      if (combined.includes(pattern)) {
        return {
          category: 'Payroll',
          transactionType: 'expense',
          confidence: 0.97,
          source: 'rule'
        };
      }
    }
    
    // 4. AFFILIATE INCOME (IdentityIQ, SmartCredit commissions - incoming payments)
    // Must check BEFORE vendor rules since 'identityiq' vendor rule would misclassify as COGS
    if (amount < 0) { // Negative = money coming in (Plaid convention)
      if (combined.includes('idiqgrp') || combined.includes('idiq') || 
          combined.includes('identity iq') || combined.includes('identityiq') ||
          combined.includes('smart credit') || combined.includes('smartcredit')) {
        return {
          category: 'Affiliate Commission',
          transactionType: 'income',
          confidence: 0.99,
          source: 'rule'
        };
      }
    }
    
    // 5. AFFILIATE PAYOUTS (outgoing payments to affiliates)
    if (combined.includes('affiliate') || 
        (combined.includes('wf direct pay') && (combined.includes('affiliate') || combined.includes('payout')))) {
      return {
        category: 'Affiliate Payouts',
        transactionType: 'expense',
        confidence: 0.98,
        source: 'rule'
      };
    }
    
    // 5. MERCHANT PROCESSING FEES (COGS)
    for (const pattern of MERCHANT_FEE_PATTERNS) {
      if (combined.includes(pattern)) {
        return {
          category: 'Merchant Processing Fees',
          transactionType: 'cogs',
          confidence: 0.97,
          source: 'rule'
        };
      }
    }
    
    // 6. SPECIFIC VENDOR MATCHES
    for (const [vendor, rule] of Object.entries(VENDOR_RULES)) {
      if (combined.includes(vendor)) {
        return {
          category: rule.category,
          transactionType: rule.type,
          confidence: rule.confidence,
          source: 'vendor'
        };
      }
    }
    
    // 7. EVERYTHING ELSE → NEEDS REVIEW (low confidence)
    // This is the conservative approach - if we're not 95%+ sure, flag it
    return {
      category: 'Needs Review',
      transactionType: amount > 0 ? 'expense' : 'income',
      confidence: 0.0, // Will be caught by needsReview filter
      source: 'unknown'
    };
  };

  // Merge imported historical data with Plaid data (deduplicate overlaps)
  const mergedTransactions = useMemo(() => {
    const imported = IMPORTED_TRANSACTIONS_2025 || [];
    const plaid = plaidTransactions || [];
    if (plaid.length === 0) return imported;
    if (imported.length === 0) return plaid;
    const plaidDates = plaid.map(t => t.date).sort();
    const plaidEarliest = plaidDates[0];
    const importedBeforePlaid = imported.filter(t => t.date < plaidEarliest);
    const merged = [...importedBeforePlaid, ...plaid];
    merged.sort((a, b) => a.date.localeCompare(b.date));
    console.log('Merged: ' + importedBeforePlaid.length + ' imported + ' + plaid.length + ' Plaid = ' + merged.length);
    return merged;
  }, [plaidTransactions]);

  // Filter transactions by date range - USE MERGED IMPORTED + PLAID DATA
  const getFilteredTransactions = () => {
    const { start, end } = getDateRange();
    let allTransactions = mergedTransactions;
    if (allTransactions.length === 0 && data?.transactions) {
      allTransactions = data.transactions;
    }
    
    return allTransactions.filter(t => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start, end });
    });
  };

  const filteredTransactions = getFilteredTransactions();

  // Categorize all transactions
  const categorizedTransactions = useMemo(() => {
    return filteredTransactions.map(txn => {
      const cat = categorizeTransaction(txn);
      return {
        ...txn,
        smartCategory: cat.category,
        smartType: cat.transactionType,
        confidence: cat.confidence,
        categorySource: cat.source,
        needsReview: cat.confidence < 0.95
      };
    });
  }, [filteredTransactions, learnedCategories]);

  // Calculate P&L from CATEGORIZED transactions
  const calculatePnL = () => {
    // EXCLUDE transfers from P&L (credit card payments, etc.)
    const nonTransferTxns = categorizedTransactions.filter(t => t.smartType !== 'transfer');
    
    // Revenue (money coming IN) - negative amounts in Plaid
    const revenueTransactions = nonTransferTxns.filter(t => 
      t.smartType === 'income' || (t.amount < 0 && t.smartType !== 'expense' && t.smartType !== 'cogs')
    );
    const totalRevenue = revenueTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Group revenue by category
    const revenueByCategory = revenueTransactions.reduce((acc, t) => {
      const cat = t.smartCategory || 'Other Income';
      if (!acc[cat]) acc[cat] = { total: 0, transactions: [] };
      acc[cat].total += Math.abs(t.amount);
      acc[cat].transactions.push(t);
      return acc;
    }, {});

    // COGS - Cost of Goods Sold (direct costs)
    const cogsTransactions = nonTransferTxns.filter(t => t.smartType === 'cogs');
    const totalCOGS = cogsTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Group COGS by category
    const cogsByCategory = cogsTransactions.reduce((acc, t) => {
      const cat = t.smartCategory || 'Other Direct Costs';
      if (!acc[cat]) acc[cat] = { total: 0, transactions: [] };
      acc[cat].total += Math.abs(t.amount);
      acc[cat].transactions.push(t);
      return acc;
    }, {});

    // Gross Profit
    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Operating Expenses (everything that's expense but not COGS or transfer)
    const operatingTransactions = nonTransferTxns.filter(t => 
      t.smartType === 'expense' || (t.amount > 0 && t.smartType !== 'cogs' && t.smartType !== 'transfer' && t.confidence >= 0.95)
    );
    const totalOperating = operatingTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Group operating expenses by category
    const operatingByCategory = operatingTransactions.reduce((acc, t) => {
      const cat = t.smartCategory || 'Other Expenses';
      if (!acc[cat]) acc[cat] = { total: 0, transactions: [] };
      acc[cat].total += Math.abs(t.amount);
      acc[cat].transactions.push(t);
      return acc;
    }, {});

    // Net Profit
    const netProfit = grossProfit - totalOperating;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // DOO Share
    const dooShare = netProfit > 0 ? netProfit * (dooPercentage / 100) : 0;

    // Subscriptions (recurring software/services)
    const subscriptionKeywords = ['subscription', 'monthly', 'recurring', 'saas', 'software', 'annual'];
    const subscriptionCategories = ['CRM Software', 'Email Marketing', 'Sales Software', 'Cloud Hosting', 
      'Cloud Services', 'Automation Services', 'Communication Services', 'Domain & Email', 
      'Invoicing Software', 'Employee Monitoring', 'Web Forms', 'Phone Service'];
    
    const subscriptions = operatingTransactions.filter(t => {
      const desc = (t.description || t.merchant_name || '').toLowerCase();
      return subscriptionKeywords.some(kw => desc.includes(kw)) ||
             subscriptionCategories.includes(t.smartCategory);
    });
    const subscriptionTotal = subscriptions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Needs Review (confidence < 95%)
    const needsReview = categorizedTransactions.filter(t => t.confidence < 0.95 && t.smartType !== 'transfer');
    const needsReviewTotal = needsReview.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Transfers (excluded from P&L but trackable)
    const transfers = categorizedTransactions.filter(t => t.smartType === 'transfer');
    const transfersTotal = transfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      revenue: {
        total: totalRevenue,
        byCategory: revenueByCategory,
        transactions: revenueTransactions
      },
      cogs: {
        total: totalCOGS,
        byCategory: cogsByCategory,
        transactions: cogsTransactions
      },
      grossProfit,
      grossMargin,
      operating: {
        total: totalOperating,
        byCategory: operatingByCategory,
        transactions: operatingTransactions
      },
      netProfit,
      netMargin,
      dooShare,
      subscriptions: {
        total: subscriptionTotal,
        transactions: subscriptions
      },
      uncategorized: {
        total: needsReviewTotal,
        transactions: needsReview
      },
      transfers: {
        total: transfersTotal,
        transactions: transfers
      }
    };
  };

  const pnl = calculatePnL();

  // Diagnostic: check date range of loaded transactions
  const txnDateRange = useMemo(() => {
    if (mergedTransactions.length === 0) return null;
    const dates = mergedTransactions.map(t => t.date).sort();
    const monthCounts = {};
    mergedTransactions.forEach(t => {
      const month = t.date?.substring(0, 7); // YYYY-MM
      if (month) monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    return {
      earliest: dates[0],
      latest: dates[dates.length - 1],
      total: mergedTransactions.length,
      inCurrentRange: filteredTransactions.length,
      monthCounts
    };
  }, [mergedTransactions, filteredTransactions]);

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

  const getTimePeriodLabel = () => {
    const { start, end } = getDateRange();
    if (timePeriod === '1M') {
      return format(selectedMonth, 'MMMM yyyy');
    }
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  };

  // Drill-down Modal Component
  const DrillDownModal = ({ type, title, data, onClose }) => {
    const [expandedCat, setExpandedCat] = useState(null);
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{title}</h2>
              <p className="text-sm text-slate-500">{getTimePeriodLabel()}</p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(data.total)}</p>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {Object.keys(data.byCategory || {}).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(data.byCategory)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([category, catData]) => {
                    const pct = data.total > 0 ? (catData.total / data.total * 100) : 0;
                    const isExpanded = expandedCat === category;
                    
                    return (
                      <div key={category} className="border rounded-lg overflow-hidden">
                        <div 
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                          onClick={() => setExpandedCat(isExpanded ? null : category)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-slate-800">{category}</p>
                                <p className="text-sm text-slate-500">{catData.transactions.length} transactions</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold text-slate-800">{formatCurrency(catData.total)}</p>
                              <p className="text-xs text-slate-500">{pct.toFixed(1)}% of total</p>
                            </div>
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="bg-slate-50 border-t p-3 max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-slate-500">
                                  <th className="pb-2">Date</th>
                                  <th className="pb-2">Description</th>
                                  <th className="pb-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {catData.transactions
                                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                                  .map((t, i) => (
                                    <tr key={i} className="border-t border-slate-200">
                                      <td className="py-2 text-slate-600">{format(parseISO(t.date), 'MMM d')}</td>
                                      <td className="py-2 text-slate-700">{t.description || 'No description'}</td>
                                      <td className="py-2 text-right font-medium">{formatCurrencyDetailed(Math.abs(t.amount))}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Receipt size={48} className="mx-auto mb-4 text-slate-300" />
                <p>No transactions in this category</p>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t bg-slate-50">
            <p className="text-xs text-slate-500">
              <Info size={14} className="inline mr-1" />
              Click any category to see individual transactions. Data from QuickBooks.
            </p>
          </div>
        </div>
      </div>
    );
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

  if (!isConnected && plaidAccounts.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <DollarSign size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Connect Your Accounts</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Connect your bank accounts directly to see real-time transactions, P&L statements, and expense tracking.
          </p>
          
          {/* Plaid - Primary Option */}
          <div className="mb-6">
            <button
              onClick={handleConnectBank}
              disabled={!plaidEnabled || plaidLoading}
              className={`px-6 py-3 rounded-xl font-medium inline-flex items-center gap-2 ${
                plaidEnabled && !plaidLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {plaidLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Connect Bank Account
                </>
              )}
            </button>
            <p className="text-sm text-slate-400 mt-2">
              Connect Chase, Amex, and other banks directly
            </p>
          </div>
          
          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="text-slate-400 text-sm">or</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>
          
          {/* QuickBooks - Secondary Option */}
          <button
            onClick={handleConnect}
            className="px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium inline-flex items-center gap-2"
          >
            <Building size={18} /> Connect QuickBooks (Optional)
          </button>
          <p className="text-sm text-slate-400 mt-2">
            Import existing categorized transactions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Drill-down Modal */}
      {drillDownModal && (
        <DrillDownModal
          type={drillDownModal.type}
          title={drillDownModal.title}
          data={drillDownModal.data}
          onClose={() => setDrillDownModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
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
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Period Selector */}
          <div className="flex items-center bg-white border rounded-lg p-1">
            {['1M', '3M', '6M', '9M', 'YTD', '1Y', '2Y'].map(period => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  timePeriod === period 
                    ? 'bg-green-600 text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {period}
              </button>
            ))}
            <button
              onClick={() => setTimePeriod('TAX2025')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                timePeriod === 'TAX2025' 
                  ? 'bg-orange-600 text-white' 
                  : 'text-orange-600 hover:bg-orange-50 border border-orange-200'
              }`}
            >
              📋 2025 Tax Year
            </button>
          </div>
          
          {/* Month selector (only for 1M view) */}
          {timePeriod === '1M' && (
            <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
              <button 
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-3 py-1 font-medium text-slate-800 min-w-[100px] text-center text-sm">
                {format(selectedMonth, 'MMM yyyy')}
              </div>
              <button 
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded"
                disabled={selectedMonth >= new Date()}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          
          {plaidAccounts.length > 0 && (
            <button
              onClick={handleForceSync}
              disabled={plaidLoading}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              title="Sync all transactions from Jan 2025"
            >
              {plaidLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Sync All
            </button>
          )}
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleConnectBank}
            disabled={plaidLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            {plaidLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CreditCard size={16} />
            )}
            + Add Account
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Connected Accounts Panel */}
      {plaidAccounts.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <CreditCard size={18} className="text-blue-600" />
              Connected Accounts
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAccountManager(!showAccountManager)}
                className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1"
              >
                <Settings size={14} />
                Manage Accounts
              </button>
              <button
                onClick={handleConnectBank}
                disabled={plaidLoading}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
              >
                {plaidLoading ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                + Add Bank or Card
              </button>
            </div>
          </div>
          
          {/* Summary View */}
          {!showAccountManager && (
            <div className="flex flex-wrap gap-2">
              {plaidAccounts.map(acc => {
                const activeAccounts = acc.accounts?.filter(a => !a.excluded) || [];
                return (
                  <div key={acc.id} className="bg-white border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="font-medium text-slate-700">{acc.institution_name}</span>
                    <span className="text-slate-400 text-sm">
                      ({activeAccounts.length} of {acc.accounts?.length || 0} active)
                    </span>
                    <button 
                      onClick={() => handleDisconnectBank(acc.id)}
                      className="ml-1 text-slate-400 hover:text-red-500"
                      title="Disconnect all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Detailed Account Manager */}
          {showAccountManager && (
            <div className="space-y-4">
              {plaidAccounts.map(institution => (
                <div key={institution.id} className="bg-white rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building size={16} className="text-blue-600" />
                      <span className="font-medium text-slate-800">{institution.institution_name}</span>
                    </div>
                    <button 
                      onClick={() => handleDisconnectBank(institution.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Unlink size={12} />
                      Disconnect All
                    </button>
                  </div>
                  <div className="space-y-1">
                    {institution.accounts?.map(account => (
                      <div 
                        key={account.id} 
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          account.excluded ? 'bg-slate-100' : 'bg-green-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {account.excluded ? (
                            <div className="w-5 h-5 rounded border-2 border-slate-300 bg-white" />
                          ) : (
                            <CheckCircle size={18} className="text-green-600" />
                          )}
                          <div>
                            <span className={`font-medium ${account.excluded ? 'text-slate-400' : 'text-slate-700'}`}>
                              {account.name}
                            </span>
                            <span className="text-slate-400 text-sm ml-2">
                              •••{account.mask} • {account.subtype}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleAccount(institution.id, account.id, !account.excluded)}
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            account.excluded 
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {account.excluded ? 'Include' : 'Exclude'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                Excluded accounts won't appear in transaction sync or reports. Click "Include" to add them back.
              </p>
            </div>
          )}
          
          {!showAccountManager && (
            <p className="text-xs text-slate-500 mt-3">
              Transactions from connected accounts appear in the "Bank Feed" tab. Click "Manage Accounts" to exclude specific accounts.
            </p>
          )}
        </div>
      )}

      {/* Warning Banner for QB-only mode */}
      {!plaidAccounts.length && data && data.debug && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 mb-1">QuickBooks Bank Feed Transactions Not Included</h3>
              <p className="text-amber-700 text-sm mb-2">
                The totals below only include <strong>posted transactions</strong>. Any transactions sitting in "For Review" 
                in QuickBooks bank feeds (Chase, Amex, etc.) are NOT accessible via the QuickBooks API.
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="bg-white px-3 py-2 rounded-lg border border-amber-200">
                  <span className="text-amber-600">Posted Transactions:</span>
                  <span className="font-semibold text-amber-800 ml-2">{(data.debug.purchase_count || 0) + (data.debug.deposit_count || 0)} total</span>
                </div>
                <div className="bg-white px-3 py-2 rounded-lg border border-amber-200">
                  <span className="text-amber-600">Needs Categorization:</span>
                  <span className="font-semibold text-amber-800 ml-2">{data.debug.needs_review_count || 0} transactions</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-xs text-amber-600 mb-2">
                  <strong>To get accurate daily P&L:</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs">
                    <span className="w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                    Accept transactions in QB bank feeds
                  </span>
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs">
                    <span className="w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                    Or wait for Plaid integration (coming soon)
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                const banner = document.getElementById('qb-warning-banner');
                if (banner) banner.style.display = 'none';
              }}
              className="text-amber-400 hover:text-amber-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h3 className="font-medium text-slate-800 mb-4">Settings</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* DOO Bonus Settings */}
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
              <p className="text-xs text-slate-500 mt-1">Astrid's % of net profit</p>
            </div>
            
            {/* Bank Connection (Plaid) */}
            <div className="border-l pl-6">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} className="text-blue-600" />
                <label className="block text-sm font-medium text-slate-700">Direct Bank Connection</label>
                {plaidEnabled && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ready</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Connect your Chase, Amex, and other bank accounts directly for real-time transaction data.
                This bypasses QuickBooks bank feeds.
              </p>
              {plaidAccounts.length > 0 ? (
                <div className="space-y-2">
                  {plaidAccounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-600" />
                        <span className="font-medium">{acc.institution_name}</span>
                        <span className="text-slate-400">({acc.accounts?.length || 0} accounts)</span>
                      </div>
                      <button 
                        onClick={() => handleDisconnectBank(acc.id)}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                      >
                        <Unlink size={12} />
                        Disconnect
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleConnectBank}
                    disabled={plaidLoading}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {plaidLoading ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                    <span>+ Connect another bank</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectBank}
                  disabled={!plaidEnabled || plaidLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                    plaidEnabled && !plaidLoading
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {plaidLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Building size={16} />
                      {plaidEnabled ? 'Connect Bank Account' : 'Plaid Not Configured'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time Period Label */}
      <div className="mb-6 flex items-center gap-2">
        <Calendar size={16} className="text-slate-400" />
        <span className="text-slate-600 font-medium">{getTimePeriodLabel()}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit overflow-x-auto">
        {[
          { id: 'pnl', label: 'P&L Statement', icon: BarChart3 },
          { id: 'expenses', label: 'All Expenses', icon: List },
          { id: 'flagged', label: 'Flagged', icon: Flag, count: Object.keys(flaggedExpenses).length, color: 'red' },
          { id: 'subscriptions', label: 'Subscriptions', icon: Repeat, count: pnl.subscriptions.transactions.length },
          { id: 'uncategorized', label: 'Needs Review', icon: FileQuestion, count: pnl.uncategorized.transactions.length },
          ...((plaidAccounts.length > 0 || mergedTransactions.length > 0) ? [{ id: 'bankfeed', label: 'Bank Feed', icon: CreditCard, count: mergedTransactions.length }] : []),
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  tab.color === 'red' ? 'bg-red-200 text-red-800' :
                  tab.id === 'uncategorized' ? 'bg-amber-200 text-amber-800' : 'bg-slate-200'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* P&L Statement Tab */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {/* Transaction Data Coverage Info */}
          {txnDateRange && (
            <div className={`rounded-2xl border p-4 ${txnDateRange.inCurrentRange === 0 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className={txnDateRange.inCurrentRange === 0 ? 'text-amber-600 mt-0.5' : 'text-blue-600 mt-0.5'} />
                <div className="flex-1">
                  <h3 className={`font-semibold ${txnDateRange.inCurrentRange === 0 ? 'text-amber-800' : 'text-blue-800'}`}>
                    {txnDateRange.inCurrentRange === 0 
                      ? 'No transactions found for this period' 
                      : `${txnDateRange.inCurrentRange} transactions in this period`}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {txnDateRange.total} total transactions loaded • Date range: {txnDateRange.earliest} to {txnDateRange.latest}
                  </p>
                  {txnDateRange.inCurrentRange === 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-amber-700 font-medium">Months with data:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(txnDateRange.monthCounts).sort(([a],[b]) => a.localeCompare(b)).map(([month, count]) => (
                          <span key={month} className="text-xs bg-white border border-amber-200 rounded px-2 py-0.5">
                            {month}: {count}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-amber-600 mt-2">
                        💡 Try clicking <strong>2025 Tax Year</strong> above, or navigate to a month that has data. 
                        If older months are missing, the backend may need to fetch more historical data.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Visual P&L Waterfall */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Profit & Loss Statement</h2>
              <p className="text-sm text-slate-500">Click any row to see the breakdown</p>
            </div>
            
            <div className="divide-y">
              {/* REVENUE */}
              <div 
                className="p-4 hover:bg-green-50 cursor-pointer transition-colors"
                onClick={() => setDrillDownModal({ 
                  type: 'revenue', 
                  title: 'Revenue Breakdown',
                  data: pnl.revenue 
                })}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Revenue</p>
                      <p className="text-sm text-slate-500">Total income from sales & services</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(pnl.revenue.total)}</p>
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* MINUS COGS */}
              <div 
                className="p-4 hover:bg-red-50 cursor-pointer transition-colors bg-slate-50"
                onClick={() => setDrillDownModal({ 
                  type: 'cogs', 
                  title: 'Cost of Goods Sold (COGS)',
                  data: pnl.cogs 
                })}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Minus size={20} className="text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Cost of Goods Sold (COGS)</p>
                      <p className="text-sm text-slate-500">Direct costs: credit reports, processing fees, etc.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-red-600">-{formatCurrency(pnl.cogs.total)}</p>
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* EQUALS GROSS PROFIT */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calculator size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-lg">= Gross Profit</p>
                      <p className="text-sm text-slate-500">
                        Revenue minus direct costs • 
                        <span className={`font-semibold ml-1 ${pnl.grossMargin >= 50 ? 'text-green-600' : pnl.grossMargin >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                          {pnl.grossMargin.toFixed(1)}% margin
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className={`text-3xl font-bold ${pnl.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(pnl.grossProfit)}
                  </p>
                </div>
              </div>

              {/* MINUS OPERATING EXPENSES */}
              <div 
                className="p-4 hover:bg-orange-50 cursor-pointer transition-colors"
                onClick={() => setDrillDownModal({ 
                  type: 'operating', 
                  title: 'Operating Expenses',
                  data: pnl.operating 
                })}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Minus size={20} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Operating Expenses</p>
                      <p className="text-sm text-slate-500">Payroll, software, marketing, rent, etc.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-orange-600">-{formatCurrency(pnl.operating.total)}</p>
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                </div>
                
                {/* Quick preview of top categories */}
                <div className="mt-3 ml-13 flex flex-wrap gap-2">
                  {Object.entries(pnl.operating.byCategory)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 4)
                    .map(([cat, data]) => (
                      <span key={cat} className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                        {cat}: {formatCurrency(data.total)}
                      </span>
                    ))}
                  {Object.keys(pnl.operating.byCategory).length > 4 && (
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-500">
                      +{Object.keys(pnl.operating.byCategory).length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* EQUALS NET PROFIT */}
              <div className={`p-6 ${pnl.netProfit >= 0 ? 'bg-gradient-to-r from-green-100 to-emerald-100' : 'bg-gradient-to-r from-red-100 to-rose-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pnl.netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                      <Wallet size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-xl">= Net Profit</p>
                      <p className="text-sm text-slate-600">
                        What's left after all expenses • 
                        <span className={`font-semibold ml-1 ${pnl.netMargin >= 15 ? 'text-green-600' : pnl.netMargin >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                          {pnl.netMargin.toFixed(1)}% margin
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className={`text-4xl font-bold ${pnl.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(pnl.netProfit)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: DOO Bonus + Alerts */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* DOO Profit Bonus Card */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={24} />
                <h3 className="text-lg font-bold">Astrid's Profit Bonus</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-purple-200 text-sm mb-1">Current Period</p>
                  <p className="text-3xl font-bold">{formatCurrency(pnl.dooShare)}</p>
                  <p className="text-purple-200 text-xs mt-1">{dooPercentage}% of net profit</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-purple-200 text-sm mb-1">If Expenses ↓ 10%</p>
                  <p className="text-3xl font-bold text-green-300">
                    {formatCurrency((pnl.revenue.total - pnl.cogs.total - pnl.operating.total * 0.9) * (dooPercentage / 100))}
                  </p>
                  <p className="text-green-200 text-xs mt-1">Potential increase</p>
                </div>
              </div>
              
              <div className="p-3 bg-white/10 rounded-lg text-sm flex items-start gap-2">
                <Lightbulb size={16} className="shrink-0 mt-0.5" />
                <p>Every {formatCurrency(1000)} in expenses reduced = {formatCurrency(1000 * (dooPercentage / 100))} more bonus</p>
              </div>
            </div>

            {/* Alerts & Actions */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500" />
                Action Items
              </h3>
              
              <div className="space-y-3">
                {pnl.uncategorized.transactions.length > 0 && (
                  <div 
                    className="p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => setActiveTab('uncategorized')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-amber-800">{pnl.uncategorized.transactions.length} Uncategorized</p>
                        <p className="text-sm text-amber-600">{formatCurrency(pnl.uncategorized.total)} needs review in QuickBooks</p>
                      </div>
                      <ChevronRight size={18} className="text-amber-600" />
                    </div>
                  </div>
                )}
                
                {pnl.subscriptions.total > pnl.operating.total * 0.25 && (
                  <div 
                    className="p-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => setActiveTab('subscriptions')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-blue-800">Review Subscriptions</p>
                        <p className="text-sm text-blue-600">{formatCurrency(pnl.subscriptions.total)} in recurring charges</p>
                      </div>
                      <ChevronRight size={18} className="text-blue-600" />
                    </div>
                  </div>
                )}

                {pnl.netMargin < 10 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="font-semibold text-red-800">Low Profit Margin</p>
                    <p className="text-sm text-red-600">At {pnl.netMargin.toFixed(1)}%, look for ways to reduce expenses</p>
                  </div>
                )}

                {pnl.uncategorized.transactions.length === 0 && pnl.netMargin >= 10 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-600" />
                    <p className="font-semibold text-green-800">Looking good! Books are clean.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-xs text-slate-500 mb-1">Avg Daily Revenue</p>
              <p className="text-xl font-bold text-slate-800">
                {formatCurrency(pnl.revenue.total / (timePeriod === '1M' ? 30 : timePeriod === '3M' ? 90 : timePeriod === '6M' ? 180 : 365))}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-xs text-slate-500 mb-1">Avg Daily Expenses</p>
              <p className="text-xl font-bold text-slate-800">
                {formatCurrency((pnl.cogs.total + pnl.operating.total) / (timePeriod === '1M' ? 30 : timePeriod === '3M' ? 90 : timePeriod === '6M' ? 180 : 365))}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-xs text-slate-500 mb-1">Total Transactions</p>
              <p className="text-xl font-bold text-slate-800">{filteredTransactions.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-xs text-slate-500 mb-1">Expense Categories</p>
              <p className="text-xl font-bold text-slate-800">
                {Object.keys(pnl.operating.byCategory).length + Object.keys(pnl.cogs.byCategory).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-2xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">All Expenses</h3>
              <p className="text-sm text-slate-500">{getTimePeriodLabel()}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(pnl.cogs.total + pnl.operating.total)}</p>
              </div>
            </div>
          </div>

          {/* Expense Insights Panel */}
          {showExpenseInsights && filteredTransactions.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Lightbulb size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">💡 Expense Review Tips</h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• <strong>Flag expenses</strong> you want to review, cancel, or negotiate</li>
                      <li>• Look for <strong>recurring charges</strong> that aren't being used</li>
                      <li>• Check if any services can be <strong>downgraded or bundled</strong></li>
                      <li>• Every dollar saved goes directly to <strong>Net Profit</strong> (and your bonus!)</li>
                    </ul>
                  </div>
                </div>
                <button 
                  onClick={() => setShowExpenseInsights(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
          
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {/* Combine COGS and Operating */}
            {Object.entries({ ...pnl.cogs.byCategory, ...pnl.operating.byCategory })
              .sort((a, b) => b[1].total - a[1].total)
              .map(([category, catData]) => {
                const totalExpenses = pnl.cogs.total + pnl.operating.total;
                const pct = totalExpenses > 0 ? (catData.total / totalExpenses * 100) : 0;
                const isExpanded = expandedCategory === category;
                const isCOGS = Object.keys(pnl.cogs.byCategory).includes(category);
                
                return (
                  <div key={category} className="p-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-800">{category}</p>
                            {isCOGS && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">COGS</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">{catData.transactions.length} transactions • {pct.toFixed(1)}%</p>
                        </div>
                      </div>
                      <p className="font-semibold text-slate-800">{formatCurrency(catData.total)}</p>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 ml-8 space-y-2 max-h-96 overflow-y-auto">
                        {catData.transactions
                          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                          .map((t, i) => {
                            const txnId = t.id || `${t.date}-${t.description}-${t.amount}`;
                            const flag = flaggedExpenses[txnId];
                            
                            return (
                              <div 
                                key={i} 
                                className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                                  flag?.type === 'cancel' ? 'bg-red-50 border border-red-200' :
                                  flag?.type === 'negotiate' ? 'bg-amber-50 border border-amber-200' :
                                  flag?.type === 'review' ? 'bg-blue-50 border border-blue-200' :
                                  flag?.type === 'approved' ? 'bg-green-50 border border-green-200' :
                                  'bg-slate-50'
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-slate-700">{t.merchant_name || t.description || 'No description'}</p>
                                    {flag && (
                                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                        flag.type === 'cancel' ? 'bg-red-200 text-red-800' :
                                        flag.type === 'negotiate' ? 'bg-amber-200 text-amber-800' :
                                        flag.type === 'review' ? 'bg-blue-200 text-blue-800' :
                                        'bg-green-200 text-green-800'
                                      }`}>
                                        {flag.type === 'cancel' ? '🚫 Cancel' :
                                         flag.type === 'negotiate' ? '💬 Negotiate' :
                                         flag.type === 'review' ? '👀 Review' :
                                         '✓ Approved'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400">{format(parseISO(t.date), 'MMM d, yyyy')} • {t.institution || 'Bank'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-800">{formatCurrencyDetailed(Math.abs(t.amount))}</span>
                                  
                                  {/* Flag dropdown */}
                                  <div className="relative group">
                                    <button className="p-1.5 rounded hover:bg-slate-200">
                                      <Flag size={14} className={flag ? 'text-red-500' : 'text-slate-400'} />
                                    </button>
                                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 hidden group-hover:block z-10 w-36">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); flagExpense(txnId, 'review'); }}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
                                      >
                                        <Eye size={14} className="text-blue-500" /> Review
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); flagExpense(txnId, 'negotiate'); }}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
                                      >
                                        <MessageSquare size={14} className="text-amber-500" /> Negotiate
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); flagExpense(txnId, 'cancel'); }}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
                                      >
                                        <Scissors size={14} className="text-red-500" /> Cancel
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); flagExpense(txnId, 'approved'); }}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
                                      >
                                        <CheckCircle size={14} className="text-green-500" /> Approved
                                      </button>
                                      {flag && (
                                        <>
                                          <div className="border-t my-1"></div>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); unflagExpense(txnId); }}
                                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 flex items-center gap-2 text-slate-500"
                                          >
                                            <X size={14} /> Clear Flag
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            
            {Object.keys(pnl.cogs.byCategory).length === 0 && Object.keys(pnl.operating.byCategory).length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No expenses found for this period
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flagged Expenses Tab */}
      {activeTab === 'flagged' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Eye size={18} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-800">To Review</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{getFlaggedCount('review')}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={18} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-800">To Negotiate</span>
              </div>
              <p className="text-2xl font-bold text-amber-900">{getFlaggedCount('negotiate')}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Scissors size={18} className="text-red-600" />
                <span className="text-sm font-medium text-red-800">To Cancel</span>
              </div>
              <p className="text-2xl font-bold text-red-900">{getFlaggedCount('cancel')}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={18} className="text-green-600" />
                <span className="text-sm font-medium text-green-800">Approved</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{getFlaggedCount('approved')}</p>
            </div>
          </div>

          {/* Flagged Items List */}
          <div className="bg-white rounded-2xl border shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-bold text-slate-800">Flagged Expenses</h3>
              <p className="text-sm text-slate-500">Items you've marked for review, negotiation, or cancellation</p>
            </div>

            {Object.keys(flaggedExpenses).length > 0 ? (
              <div className="divide-y">
                {Object.entries(flaggedExpenses)
                  .sort((a, b) => {
                    const order = { cancel: 0, negotiate: 1, review: 2, approved: 3 };
                    return order[a[1].type] - order[b[1].type];
                  })
                  .map(([txnId, flag]) => {
                    // Find the transaction in our data
                    const txn = filteredTransactions.find(t => 
                      t.id === txnId || `${t.date}-${t.description}-${t.amount}` === txnId
                    );
                    
                    return (
                      <div 
                        key={txnId}
                        className={`p-4 flex items-center justify-between ${
                          flag.type === 'cancel' ? 'bg-red-50' :
                          flag.type === 'negotiate' ? 'bg-amber-50' :
                          flag.type === 'review' ? 'bg-blue-50' :
                          'bg-green-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            flag.type === 'cancel' ? 'bg-red-200' :
                            flag.type === 'negotiate' ? 'bg-amber-200' :
                            flag.type === 'review' ? 'bg-blue-200' :
                            'bg-green-200'
                          }`}>
                            {flag.type === 'cancel' && <Scissors size={18} className="text-red-700" />}
                            {flag.type === 'negotiate' && <MessageSquare size={18} className="text-amber-700" />}
                            {flag.type === 'review' && <Eye size={18} className="text-blue-700" />}
                            {flag.type === 'approved' && <CheckCircle size={18} className="text-green-700" />}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">
                              {txn?.merchant_name || txn?.description || txnId.split('-')[1] || 'Unknown'}
                            </p>
                            <p className="text-sm text-slate-500">
                              {txn ? format(parseISO(txn.date), 'MMM d, yyyy') : 'Unknown date'} • 
                              Flagged {format(parseISO(flag.flaggedAt), 'MMM d')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-800">
                            {txn ? formatCurrencyDetailed(Math.abs(txn.amount)) : '—'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            flag.type === 'cancel' ? 'bg-red-200 text-red-800' :
                            flag.type === 'negotiate' ? 'bg-amber-200 text-amber-800' :
                            flag.type === 'review' ? 'bg-blue-200 text-blue-800' :
                            'bg-green-200 text-green-800'
                          }`}>
                            {flag.type === 'cancel' ? '🚫 Cancel' :
                             flag.type === 'negotiate' ? '💬 Negotiate' :
                             flag.type === 'review' ? '👀 Review' :
                             '✓ Approved'}
                          </span>
                          <button
                            onClick={() => unflagExpense(txnId)}
                            className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-slate-600"
                            title="Remove flag"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Flag size={48} className="mx-auto mb-4 text-slate-300" />
                <p className="font-medium text-slate-800 mb-2">No flagged expenses</p>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  Go to the "All Expenses" tab and hover over any expense to flag it for review, negotiation, or cancellation.
                </p>
              </div>
            )}
          </div>

          {/* Educational Tips */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <BookOpen size={20} className="text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">💰 How This Affects Your Bonus</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Your DOO bonus is based on Net Profit. Every expense you cut or reduce goes 
                  directly to the bottom line. Here's the math:
                </p>
                <div className="bg-white rounded-lg p-3 text-sm">
                  <p className="text-slate-700">
                    <strong>Example:</strong> If you cancel a $100/month subscription:
                  </p>
                  <p className="text-slate-600 mt-1">
                    • Annual savings: <span className="text-green-600 font-semibold">$1,200</span>
                  </p>
                  <p className="text-slate-600">
                    • Your 3% share: <span className="text-green-600 font-semibold">$36/year extra</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Recurring Subscriptions</h3>
              <p className="text-sm text-slate-500">Software, SaaS, and recurring charges</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(pnl.subscriptions.total)}</p>
              <p className="text-sm text-slate-500">this period</p>
            </div>
          </div>
          
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {pnl.subscriptions.transactions.length > 0 ? (
              pnl.subscriptions.transactions
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .map((t, i) => (
                  <div key={i} className="p-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Repeat size={18} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{t.description || 'Subscription'}</p>
                          <p className="text-sm text-slate-500">{format(parseISO(t.date), 'MMM d, yyyy')} • {t.category || 'Uncategorized'}</p>
                        </div>
                      </div>
                      <p className="font-semibold text-slate-800">{formatCurrencyDetailed(Math.abs(t.amount))}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-13">
                      {flaggedExpenses[t.transaction_id || t.id] ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            flaggedExpenses[t.transaction_id || t.id].type === 'cancel' ? 'bg-red-100 text-red-800' :
                            flaggedExpenses[t.transaction_id || t.id].type === 'cancelled' ? 'bg-gray-100 text-gray-800 line-through' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {flaggedExpenses[t.transaction_id || t.id].type === 'cancel' ? '🚫 Need to Cancel' :
                             flaggedExpenses[t.transaction_id || t.id].type === 'cancelled' ? '✅ Cancelled' :
                             '💬 Need to Negotiate'}
                          </span>
                          <button onClick={() => unflagExpense(t.transaction_id || t.id)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => flagExpense(t.transaction_id || t.id, 'cancel')} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200">🚫 Cancel</button>
                          <button onClick={() => flagExpense(t.transaction_id || t.id, 'cancelled')} className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100 border border-gray-200">✅ Done</button>
                          <button onClick={() => flagExpense(t.transaction_id || t.id, 'negotiate')} className="px-2 py-1 text-xs bg-amber-50 text-amber-600 rounded hover:bg-amber-100 border border-amber-200">💬 Negotiate</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Repeat size={32} className="mx-auto mb-2 text-slate-300" />
                <p>No subscriptions detected</p>
              </div>
            )}
          </div>
          
          {pnl.subscriptions.transactions.length > 0 && (
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

      {/* Uncategorized Tab */}
      {activeTab === 'uncategorized' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700 mb-1">Needs Review</p>
              <p className="text-2xl font-bold text-amber-800">{pnl.uncategorized.transactions.length}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-700 mb-1">AI Confidence &lt;95%</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(pnl.uncategorized.total)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-700 mb-1">Rules Learned</p>
              <p className="text-2xl font-bold text-green-800">{Object.keys(learnedCategories).length}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Lightbulb size={20} className="text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">🧠 Teach the AI</h4>
                <p className="text-sm text-slate-600">
                  Select a category for each transaction below. The AI will <strong>remember</strong> your choices 
                  and automatically categorize similar transactions in the future!
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-bold text-slate-800">Transactions Needing Review</h3>
              <p className="text-sm text-slate-500">AI couldn't categorize these with 95%+ confidence</p>
            </div>
            
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {pnl.uncategorized.transactions.length > 0 ? (
                pnl.uncategorized.transactions
                  .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                  .map((t, i) => {
                    const txnId = t.id || `${t.date}-${t.description}-${t.amount}`;
                    
                    return (
                      <div key={i} className="p-4 hover:bg-slate-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                              <FileQuestion size={18} className="text-amber-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{t.merchant_name || t.description || 'No description'}</p>
                              <p className="text-sm text-slate-500">
                                {format(parseISO(t.date), 'MMM d, yyyy')} • {t.institution || 'Unknown source'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${t.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {t.amount > 0 ? '-' : '+'}{formatCurrencyDetailed(Math.abs(t.amount))}
                            </p>
                            <p className="text-xs text-slate-400">
                              {t.confidence !== undefined ? `${Math.round(t.confidence * 100)}% confident` : 'Unknown'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Category Selection */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {t.amount > 0 ? (
                            // Expense categories
                            <>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Payroll', 'expense');
                                }}
                                className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200"
                              >
                                💼 Payroll
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Office Supplies', 'expense');
                                }}
                                className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm hover:bg-green-200"
                              >
                                📦 Office Supplies
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Software/SaaS', 'expense');
                                }}
                                className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-sm hover:bg-purple-200"
                              >
                                💻 Software
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Advertising', 'expense');
                                }}
                                className="px-3 py-1.5 bg-pink-100 text-pink-800 rounded-lg text-sm hover:bg-pink-200"
                              >
                                📢 Advertising
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Credit Reports', 'cogs');
                                }}
                                className="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-sm hover:bg-red-200"
                              >
                                📊 Credit Reports (COGS)
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Merchant Fees', 'cogs');
                                }}
                                className="px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg text-sm hover:bg-orange-200"
                              >
                                💳 Merchant Fees (COGS)
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Client Refund', 'expense');
                                }}
                                className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200"
                              >
                                ↩️ Client Refund
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Transfer', 'transfer');
                                }}
                                className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-lg text-sm hover:bg-slate-200"
                              >
                                🔄 Transfer (exclude)
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  const cat = prompt('Enter custom category name:');
                                  if (cat) saveLearnedCategory(pattern, cat, 'expense');
                                }}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                              >
                                ✏️ Custom...
                              </button>
                            </>
                          ) : (
                            // Income categories
                            <>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Client Payment', 'income');
                                }}
                                className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm hover:bg-green-200"
                              >
                                💰 Client Payment
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Affiliate Commission', 'income');
                                }}
                                className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200"
                              >
                                🤝 Affiliate Commission
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  saveLearnedCategory(pattern, 'Transfer', 'transfer');
                                }}
                                className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-lg text-sm hover:bg-slate-200"
                              >
                                🔄 Transfer (exclude)
                              </button>
                              <button 
                                onClick={() => {
                                  const pattern = (t.merchant_name || t.description || '').split(' ').slice(0, 2).join(' ');
                                  const cat = prompt('Enter custom category name:');
                                  if (cat) saveLearnedCategory(pattern, cat, 'income');
                                }}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                              >
                                ✏️ Custom...
                              </button>
                            </>
                          )}
                        </div>
                        
                        {/* Expense Action Flags */}
                        {t.amount > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100">
                            <span className="text-xs text-slate-400 self-center mr-1">Flag:</span>
                            {flaggedExpenses[t.transaction_id || t.id] ? (
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                  flaggedExpenses[t.transaction_id || t.id].type === 'cancel' ? 'bg-red-100 text-red-800' :
                                  flaggedExpenses[t.transaction_id || t.id].type === 'cancelled' ? 'bg-gray-100 text-gray-800 line-through' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {flaggedExpenses[t.transaction_id || t.id].type === 'cancel' ? '🚫 Need to Cancel' :
                                   flaggedExpenses[t.transaction_id || t.id].type === 'cancelled' ? '✅ Cancelled' :
                                   '💬 Need to Negotiate'}
                                </span>
                                <button onClick={() => unflagExpense(t.transaction_id || t.id)} className="text-xs text-slate-400 hover:text-red-500">✕ Remove</button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => flagExpense(t.transaction_id || t.id, 'cancel')} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm hover:bg-red-100 border border-red-200">🚫 Need to Cancel</button>
                                <button onClick={() => flagExpense(t.transaction_id || t.id, 'cancelled')} className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm hover:bg-gray-100 border border-gray-200">✅ Cancelled</button>
                                <button onClick={() => flagExpense(t.transaction_id || t.id, 'negotiate')} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm hover:bg-amber-100 border border-amber-200">💬 Need to Negotiate</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="p-8 text-center">
                  <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                  <p className="font-medium text-slate-800">All transactions categorized!</p>
                  <p className="text-slate-500">The AI has 95%+ confidence on everything.</p>
                </div>
              )}
            </div>
          </div>

          {/* Learned Rules Panel */}
          {Object.keys(learnedCategories).length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">🧠 AI Learned Rules</h3>
                  <p className="text-sm text-slate-500">The AI will automatically apply these categories</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Clear all learned rules? This cannot be undone.')) {
                      setLearnedCategories({});
                      localStorage.removeItem('learnedCategories');
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear All
                </button>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {Object.entries(learnedCategories).map(([pattern, rule]) => (
                  <div key={pattern} className="flex items-center justify-between bg-slate-50 rounded-lg p-2 text-sm">
                    <div className="truncate">
                      <span className="font-medium text-slate-700">{pattern}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="text-blue-600">{rule.category}</span>
                    </div>
                    <button
                      onClick={() => {
                        const newLearned = { ...learnedCategories };
                        delete newLearned[pattern];
                        setLearnedCategories(newLearned);
                        localStorage.setItem('learnedCategories', JSON.stringify(newLearned));
                      }}
                      className="ml-2 text-slate-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bank Feed Tab (Plaid Transactions) */}
      {activeTab === 'bankfeed' && plaidAccounts.length > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Bank Feed (Real-Time)</h3>
              <p className="text-sm text-slate-500">Transactions from connected bank accounts via Plaid</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadPlaidTransactions}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Sync
              </button>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{mergedTransactions.length}</p>
                <p className="text-sm text-slate-500">transactions</p>
              </div>
            </div>
          </div>
          
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {mergedTransactions.length > 0 ? (
              mergedTransactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((t, i) => (
                  <div key={t.id || i} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        t.type === 'expense' ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        {t.type === 'expense' ? (
                          <TrendingDown size={18} className="text-red-600" />
                        ) : (
                          <TrendingUp size={18} className="text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{t.merchant_name || t.description || 'Transaction'}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>{format(parseISO(t.date), 'MMM d, yyyy')}</span>
                          <span className="text-slate-300">•</span>
                          <span>{t.institution || 'Bank'}</span>
                          {t.category && t.category !== 'Uncategorized' && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{t.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-lg ${
                        t.type === 'expense' || t.amount > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {t.type === 'expense' || t.amount > 0 ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                      </p>
                      {t.pending && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Pending</span>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="p-8 text-center">
                <CreditCard size={48} className="mx-auto mb-4 text-slate-300" />
                <p className="font-medium text-slate-800">No transactions yet</p>
                <p className="text-slate-500">Click "Sync" to fetch latest transactions from your connected banks.</p>
              </div>
            )}
          </div>
          
          {mergedTransactions.length > 0 && (
            <div className="p-4 bg-green-50 border-t border-green-200">
              <div className="flex items-start gap-2">
                <Zap size={18} className="text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">Real-time bank data</p>
                  <p>These transactions come directly from your bank. They'll be categorized by AI and can be pushed to QuickBooks.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
