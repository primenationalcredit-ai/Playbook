import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
  DollarSign, TrendingUp, Calendar, ChevronLeft, ChevronRight,
  Trophy, Award, Zap, AlertCircle, RefreshCw, Users, Target,
  ArrowUp, ArrowDown, FileText, CreditCard
} from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfYear, getDaysInMonth, getDate } from 'date-fns';

function Paysheet() {
  const { currentUser, users } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payData, setPayData] = useState(null);
  const [allConsultantsData, setAllConsultantsData] = useState([]);
  const [lastMonthChargebacks, setLastMonthChargebacks] = useState(0);

  const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';
  const isConsultant = currentUser?.department === 'credit_consultants';

  // Draw amounts
  const DRAW_US = 4000;
  const DRAW_VA = 1700;

  // Commission rates - match by user name (from dropdown), not sales name
  const getCommissionRate = (userName) => {
    const user = users?.find(u => u.name === userName);
    return user?.is_va ? 0.10 : 0.14;
  };

  const isVAConsultant = (userName) => {
    const user = users?.find(u => u.name === userName);
    return user?.is_va || false;
  };

  const getDrawAmount = (userName) => {
    return isVAConsultant(userName) ? DRAW_VA : DRAW_US;
  };

  // Bonus amounts
  const BONUSES = {
    FS: 225,
    FM: 225,
    FF: 225,
    TODAY_FS: 100,
    TODAY_FM: 100,
    TODAY_FF: 100,
    CONSULTANT_OF_MONTH: 500
  };

  // Fetch sales data
  const fetchSales = async (dateStart, dateEnd) => {
    const url = `${SUPABASE_URL}/rest/v1/sales?select=consultant,fee_paid,fee_type,date_paid,same_day_doc_date,bonus_commission,refund&date_paid=gte.${dateStart}&date_paid=lte.${dateEnd}`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  };

  // Helper: Find matching sales consultant name from user name
  const findMatchingSalesName = (userName, allConsultants) => {
    if (!userName) return null;
    const userNameLower = userName.toLowerCase();
    const userFirstName = userName.split(' ')[0].toLowerCase();
    
    // First try exact match
    let match = allConsultants.find(c => c.name.toLowerCase() === userNameLower);
    if (match) return match.name;
    
    // Try first name match
    match = allConsultants.find(c => c.name.toLowerCase() === userFirstName);
    if (match) return match.name;
    
    // Try if sales name contains user first name
    match = allConsultants.find(c => c.name.toLowerCase().includes(userFirstName));
    if (match) return match.name;
    
    // Try if user name contains sales name
    match = allConsultants.find(c => userNameLower.includes(c.name.toLowerCase()));
    if (match) return match.name;
    
    // Try first name of sales data
    match = allConsultants.find(c => {
      const salesFirstName = c.name.split(' ')[0].toLowerCase();
      return salesFirstName === userFirstName;
    });
    if (match) return match.name;
    
    return null;
  };

  // Get period based on day of month
  const getPeriod = (dateStr) => {
    const day = new Date(dateStr).getDate();
    if (day <= 10) return 'fs';
    if (day <= 20) return 'fm';
    return 'ff';
  };

  // Process all consultant data for competition calculations
  const processAllConsultants = (data) => {
    const map = {};
    
    (data || []).forEach(row => {
      const name = row.consultant || 'Unknown';
      if (!map[name]) {
        map[name] = {
          name,
          sales: 0,
          docs: 0,
          fs: 0, fm: 0, ff: 0,
          sameDayFs: 0, sameDayFm: 0, sameDayFf: 0,
          bonusCommission: 0,
          count: 0
        };
      }
      
      const amount = parseFloat(row.fee_paid) || 0;
      const feeType = (row.fee_type || '').toLowerCase();
      
      map[name].sales += amount;
      map[name].count++;
      map[name].bonusCommission += parseFloat(row.bonus_commission) || 0;
      
      if (feeType.includes('doc')) {
        map[name].docs++;
        const period = getPeriod(row.date_paid);
        map[name][period]++;
        
        if (row.same_day_doc_date) {
          const sameDayPeriod = 'sameDay' + period.charAt(0).toUpperCase() + period.slice(1);
          map[name][sameDayPeriod]++;
        }
      }
    });
    
    return Object.values(map).sort((a, b) => b.sales - a.sales);
  };

  // Calculate winners for each competition
  const calculateWinners = (consultantsData) => {
    const findWinners = (field) => {
      const max = Math.max(...consultantsData.map(c => c[field]));
      if (max === 0) return { winners: [], max: 0 };
      return {
        winners: consultantsData.filter(c => c[field] === max).map(c => c.name),
        max
      };
    };

    return {
      fs: findWinners('fs'),
      fm: findWinners('fm'),
      ff: findWinners('ff'),
      todayFs: findWinners('sameDayFs'),
      todayFm: findWinners('sameDayFm'),
      todayFf: findWinners('sameDayFf'),
      consultantOfMonth: findWinners('sales')
    };
  };

  // Calculate individual consultant pay
  // salesName = name from sales data, userName = name from users dropdown
  const calculatePay = (salesName, userName, consultantsData, winners, lastMonthRefunds) => {
    const consultant = consultantsData.find(c => c.name === salesName);
    if (!consultant) return null;

    // Use userName for commission rate and VA status
    const commissionRate = getCommissionRate(userName);
    const isVA = isVAConsultant(userName);
    const drawAmount = getDrawAmount(userName);
    
    // Base commission
    const baseCommission = consultant.sales * commissionRate;
    
    // Extra 7% bonus (not for VA)
    const extra7Percent = isVA ? 0 : consultant.bonusCommission;

    // Calculate bonuses - track if in lead (potential) vs not
    const calculateBonus = (winnerData, bonusAmount, salesName) => {
      const inLead = winnerData.winners.includes(salesName);
      const amount = inLead ? bonusAmount / winnerData.winners.length : 0;
      return { amount, inLead, tiedWith: winnerData.winners.length };
    };

    const fsBonus = calculateBonus(winners.fs, BONUSES.FS, salesName);
    const fmBonus = calculateBonus(winners.fm, BONUSES.FM, salesName);
    const ffBonus = calculateBonus(winners.ff, BONUSES.FF, salesName);
    const todayFsBonus = calculateBonus(winners.todayFs, BONUSES.TODAY_FS, salesName);
    const todayFmBonus = calculateBonus(winners.todayFm, BONUSES.TODAY_FM, salesName);
    const todayFfBonus = calculateBonus(winners.todayFf, BONUSES.TODAY_FF, salesName);
    const comBonus = calculateBonus(winners.consultantOfMonth, BONUSES.CONSULTANT_OF_MONTH, salesName);

    const totalPotentialBonuses = fsBonus.amount + fmBonus.amount + ffBonus.amount + 
                                   todayFsBonus.amount + todayFmBonus.amount + todayFfBonus.amount + 
                                   comBonus.amount + extra7Percent;
    
    // Deductions (chargebacks from last month)
    const chargebacks = lastMonthRefunds;
    
    const grandTotal = baseCommission + totalPotentialBonuses - chargebacks;
    
    // Calculate check on 15th (commission minus draw, min $0)
    const checkOn15th = Math.max(0, grandTotal - drawAmount);

    return {
      salesName,
      userName,
      isVA,
      commissionRate,
      drawAmount,
      sales: consultant.sales,
      baseCommission,
      extra7Percent,
      fs: consultant.fs,
      fm: consultant.fm,
      ff: consultant.ff,
      fsBonus,
      fmBonus,
      ffBonus,
      sameDayFs: consultant.sameDayFs,
      sameDayFm: consultant.sameDayFm,
      sameDayFf: consultant.sameDayFf,
      todayFsBonus,
      todayFmBonus,
      todayFfBonus,
      comBonus,
      totalPotentialBonuses,
      chargebacks,
      grandTotal,
      checkOn15th,
      transactions: consultant.count
    };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      // Get last month for chargebacks
      const lastMonth = subMonths(selectedMonth, 1);
      const lastMonthStart = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      const lastMonthEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd');

      // Fetch current month and last month data
      const [currentData, lastMonthData] = await Promise.all([
        fetchSales(monthStart, monthEnd),
        fetchSales(lastMonthStart, lastMonthEnd)
      ]);

      // Process all consultants
      const allConsultants = processAllConsultants(currentData);
      setAllConsultantsData(allConsultants);

      // Calculate winners
      const winners = calculateWinners(allConsultants);

      // Find matching sales name for selected user
      const targetUserName = selectedConsultant || currentUser?.name;
      const targetSalesName = findMatchingSalesName(targetUserName, allConsultants);
      
      // Calculate last month chargebacks for selected consultant
      const lastMonthConsultantData = (lastMonthData || []).filter(row => {
        if (!targetSalesName) return false;
        return row.consultant === targetSalesName;
      });
      const chargebacks = lastMonthConsultantData.reduce(
        (sum, row) => sum + (parseFloat(row.refund) || 0), 0
      );
      setLastMonthChargebacks(chargebacks);

      // Calculate pay for selected/current consultant
      if (targetSalesName) {
        const pay = calculatePay(targetSalesName, targetUserName, allConsultants, winners, chargebacks);
        setPayData(pay);
      } else if (targetUserName) {
        // No matching sales data found
        setPayData(null);
        console.log('No matching sales data for:', targetUserName);
      }

    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedConsultant, currentUser, users]);

  useEffect(() => {
    if (currentUser) {
      if (!selectedConsultant && isConsultant) {
        setSelectedConsultant(currentUser.name);
      }
      loadData();
    }
  }, [loadData, currentUser]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatPercent = (rate) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  // Check if a bonus period has ended (for showing "Won" vs "Leading")
  const getPeriodStatus = (period) => {
    const today = new Date();
    const currentDay = today.getDate();
    const isCurrentMonth = selectedMonth.getMonth() === today.getMonth() && 
                           selectedMonth.getFullYear() === today.getFullYear();
    const isPastMonth = selectedMonth < new Date(today.getFullYear(), today.getMonth(), 1);
    
    if (isPastMonth) {
      // All periods ended for past months
      return 'ended';
    }
    
    if (!isCurrentMonth) {
      // Future month - nothing decided yet
      return 'future';
    }
    
    // Current month - check which periods have ended
    switch (period) {
      case 'fs':
      case 'todayFs':
        return currentDay > 10 ? 'ended' : 'active';
      case 'fm':
      case 'todayFm':
        return currentDay > 20 ? 'ended' : (currentDay > 10 ? 'active' : 'future');
      case 'ff':
      case 'todayFf':
      case 'com':
        // FF and Consultant of Month end at end of month
        return 'active'; // Only ended when month is over (handled by isPastMonth)
      default:
        return 'active';
    }
  };

  // Get bonus status label
  const getBonusLabel = (bonus, period) => {
    if (!bonus.inLead) return null;
    const status = getPeriodStatus(period);
    if (status === 'ended') {
      return <p className="text-xs text-amber-600 font-semibold">🏆 Won!</p>;
    }
    return <p className="text-xs text-green-500">★ Leading</p>;
  };

  // Get list of consultants for admin dropdown
  const consultantList = users?.filter(u => u.department === 'credit_consultants') || [];

  if (!isAdmin && !isConsultant) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          This page is only available to consultants and leadership.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Your Commission Summary</h1>
            <p className="text-slate-500 text-sm">
              {payData?.salesName || 'Select a consultant'}
              {payData?.isVA && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">VA - 10%</span>}
              {payData && !payData.isVA && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">US - 14%</span>}
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls Row */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        {/* Admin: Consultant Selector */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            <select
              value={selectedConsultant || ''}
              onChange={(e) => setSelectedConsultant(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg bg-white shadow-sm"
            >
              <option value="">Select Consultant</option>
              {consultantList.map(c => (
                <option key={c.id} value={c.name}>{c.name} {c.is_va ? '(VA)' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Month Navigation */}
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading commission data...</p>
          </div>
        </div>
      ) : payData ? (
        <>
          {/* MTD Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-blue-600 text-sm font-medium">MTD Sales</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(payData.sales)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-blue-600 text-sm font-medium">MTD Commission</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(payData.baseCommission)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-blue-600 text-sm font-medium">Monthly Pace</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(payData.grandTotal * (getDaysInMonth(selectedMonth) / Math.max(getDate(new Date()), 1)))}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-600 text-sm font-medium">Draw ({payData.isVA ? 'VA' : 'US'})</p>
              <p className="text-2xl font-bold text-amber-800">{formatCurrency(payData.drawAmount)}</p>
            </div>
          </div>

          {/* Current Month Commissions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-center text-slate-800 mb-4">Current Month Commissions</h2>
            <h3 className="text-lg font-semibold text-slate-700 mb-4">{format(selectedMonth, 'MMMM')}</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Personal Commission */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-slate-600 mb-3 text-center">Personal Commission</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Sales Gross</span>
                    <span className="font-semibold">{formatCurrency(payData.sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">% Earned</span>
                    <span className="font-semibold">{formatPercent(payData.commissionRate)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-slate-700 font-medium">Total Personal Commission</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(payData.baseCommission)}</span>
                  </div>
                </div>
              </div>

              {/* Total Bonuses */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-slate-600 mb-3 text-center">Bonuses</h4>
                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">FS</p>
                    <p className={`font-semibold ${payData.fsBonus.inLead ? 'text-blue-600' : 'text-slate-400'}`}>
                      {payData.fsBonus.inLead ? formatCurrency(payData.fsBonus.amount) : '$0.00'}
                    </p>
                    {getBonusLabel(payData.fsBonus, 'fs')}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">FM</p>
                    <p className={`font-semibold ${payData.fmBonus.inLead ? 'text-blue-600' : 'text-slate-400'}`}>
                      {payData.fmBonus.inLead ? formatCurrency(payData.fmBonus.amount) : '$0.00'}
                    </p>
                    {getBonusLabel(payData.fmBonus, 'fm')}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">FF</p>
                    <p className={`font-semibold ${payData.ffBonus.inLead ? 'text-blue-600' : 'text-slate-400'}`}>
                      {payData.ffBonus.inLead ? formatCurrency(payData.ffBonus.amount) : '$0.00'}
                    </p>
                    {getBonusLabel(payData.ffBonus, 'ff')}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Today FS</p>
                    <p className={`font-semibold ${payData.todayFsBonus.inLead ? 'text-purple-600' : 'text-slate-400'}`}>
                      {payData.todayFsBonus.inLead ? formatCurrency(payData.todayFsBonus.amount) : '$0.00'}
                    </p>
                    {getBonusLabel(payData.todayFsBonus, 'todayFs')}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Today FM</p>
                    <p className={`font-semibold ${payData.todayFmBonus.inLead ? 'text-purple-600' : 'text-slate-400'}`}>
                      {payData.todayFmBonus.inLead ? formatCurrency(payData.todayFmBonus.amount) : '$0.00'}
                    </p>
                    {getBonusLabel(payData.todayFmBonus, 'todayFm')}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Today FF</p>
                    <p className={`font-semibold ${payData.todayFfBonus.inLead ? 'text-purple-600' : 'text-slate-400'}`}>
                      {payData.todayFfBonus.inLead ? formatCurrency(payData.todayFfBonus.amount) : '$0.00'}
                    </p>
                    {getBonusLabel(payData.todayFfBonus, 'todayFf')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Consultant of Month</p>
                    <p className={`font-semibold ${payData.comBonus.inLead ? 'text-amber-600' : 'text-slate-400'}`}>
                      {payData.comBonus.inLead ? formatCurrency(payData.comBonus.amount) : '$0.00'}
                    </p>
                    {getBonusLabel(payData.comBonus, 'com')}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Extra 7% Bonus</p>
                    <p className="font-semibold text-green-600">{formatCurrency(payData.extra7Percent)}</p>
                  </div>
                </div>
                <div className="border-t mt-3 pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-700 font-medium">
                      {getPeriodStatus('com') === 'ended' ? 'Total Bonuses' : 'Total Potential Bonuses'}
                    </span>
                    <span className="font-bold text-emerald-600">{formatCurrency(payData.totalPotentialBonuses)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions & Total */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-slate-600 mb-3 text-center">(-) Deductions</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chargebacks / Deductions</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(payData.chargebacks)}</span>
                  </div>
                </div>
                <div className="border-t mt-4 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 font-medium">
                      {getPeriodStatus('com') === 'ended' ? 'Grand Total' : 'Grand Total (Potential)'}
                    </span>
                    <span className="font-bold text-slate-800">{formatCurrency(payData.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Less: Draw</span>
                    <span className="font-semibold text-orange-600">-{formatCurrency(payData.drawAmount)}</span>
                  </div>
                  <div className="flex justify-between bg-green-100 rounded-lg p-3">
                    <span className="text-green-800 font-semibold">
                      {getPeriodStatus('com') === 'ended' ? 'Commission Check' : 'Check on 15th (Est.)'}
                    </span>
                    <span className="font-bold text-green-800 text-lg">{formatCurrency(payData.checkOn15th)}</span>
                  </div>
                  {payData.checkOn15th === 0 && payData.grandTotal < payData.drawAmount && (
                    <p className="text-xs text-orange-600 text-center">
                      Still owe: {formatCurrency(payData.drawAmount - payData.grandTotal)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Doc Fee Race Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Doc Fee Race (Your Stats)
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{payData.fs}</p>
                  <p className="text-xs text-slate-500">Fast Start</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{payData.fm}</p>
                  <p className="text-xs text-slate-500">Fast Middle</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{payData.ff}</p>
                  <p className="text-xs text-slate-500">Fast Finish</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-500" />
                Same Day Doc Race (Your Stats)
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{payData.sameDayFs}</p>
                  <p className="text-xs text-slate-500">Today FS</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{payData.sameDayFm}</p>
                  <p className="text-xs text-slate-500">Today FM</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{payData.sameDayFf}</p>
                  <p className="text-xs text-slate-500">Today FF</p>
                </div>
              </div>
            </div>
          </div>

          {/* Competition Leaderboard (Admin Only) */}
          {isAdmin && allConsultantsData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Competition Standings
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2">Consultant</th>
                      <th className="text-center px-3 py-2">Sales</th>
                      <th className="text-center px-3 py-2">FS</th>
                      <th className="text-center px-3 py-2">FM</th>
                      <th className="text-center px-3 py-2">FF</th>
                      <th className="text-center px-3 py-2">Today FS</th>
                      <th className="text-center px-3 py-2">Today FM</th>
                      <th className="text-center px-3 py-2">Today FF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allConsultantsData.map((c, idx) => (
                      <tr key={c.name} className={c.name === selectedConsultant ? 'bg-emerald-50' : ''}>
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="text-center px-3 py-2">{formatCurrency(c.sales)}</td>
                        <td className="text-center px-3 py-2">{c.fs}</td>
                        <td className="text-center px-3 py-2">{c.fm}</td>
                        <td className="text-center px-3 py-2">{c.ff}</td>
                        <td className="text-center px-3 py-2">{c.sameDayFs}</td>
                        <td className="text-center px-3 py-2">{c.sameDayFm}</td>
                        <td className="text-center px-3 py-2">{c.sameDayFf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Select a consultant to view their commission summary</p>
        </div>
      )}
    </div>
  );
}

export default Paysheet;
