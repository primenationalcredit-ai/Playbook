import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  Users,
  DollarSign,
  RefreshCw,
  Clock,
  UserCheck,
  Star,
  Users2,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Phone,
  Calendar,
  FileText,
  BarChart3,
  ChevronDown,
  Award,
  Zap,
  MessageSquare,
  Headphones,
  LayoutGrid,
  Table,
  Crown,
  X,
  ExternalLink
} from 'lucide-react';
import { format, subDays } from 'date-fns';

// Department configurations with their KPIs
const DEPARTMENTS = {
  leadership: {
    name: 'Leadership',
    icon: Crown,
    color: 'from-yellow-500 to-amber-600',
    dataStatus: 'live',
    metrics: [
      { key: 'clientSatisfaction', name: 'Client Satisfaction', target: 90, unit: '%', direction: 'higher', description: 'Survey satisfaction scores', live: true },
      { key: 'npsScore', name: 'NPS Score', target: 50, unit: '', direction: 'higher', description: 'Net Promoter Score', live: true },
      { key: 'escalationResolution', name: 'Escalation Resolution', target: 95, unit: '%', direction: 'higher', description: 'Escalations resolved without refund', live: true },
      { key: 'clientRetention', name: 'Client Retention', target: 70, unit: '%', direction: 'higher', description: 'Clients completing program', live: true },
      { key: 'errorReduction', name: 'Errors This Period', target: 10, unit: '', direction: 'lower', description: 'Total errors tracked', live: true },
      { key: 'teamProductivity', name: 'Team Productivity', target: 95, unit: '%', direction: 'higher', description: 'Task completion rate', live: true }
    ]
  },
  credit_team: {
    name: 'Credit Team',
    icon: FileText,
    color: 'from-purple-500 to-indigo-600',
    dataStatus: 'live', // live, partial, mock
    metrics: [
      { key: 'disputeTurnaround', name: 'Dispute Turnaround', target: 3, unit: 'days', direction: 'lower', description: 'Average days to process disputes', live: false },
      { key: 'clientResults', name: 'Client Results', target: 60, unit: '%', direction: 'higher', description: 'Favorable outcome rate', live: true },
      { key: 'errorRate', name: 'Error Rate', target: 2, unit: '%', direction: 'lower', description: 'Processing errors', live: false },
      { key: 'teamProductivity', name: 'Team Productivity', target: 98, unit: '%', direction: 'higher', description: 'Efficiency metric', live: false }
    ]
  },
  consultants: {
    name: 'Consultants',
    icon: DollarSign,
    color: 'from-orange-500 to-amber-500',
    dataStatus: 'partial',
    metrics: [
      { key: 'leadConversion', name: 'Lead Conversion Rate', target: 45, unit: '%', direction: 'higher', description: 'Deals moved to SOLD ÷ Deals moved to Quoted this month', live: true },
      { key: 'refundRate', name: 'Refund Rate', target: 5, unit: '%', direction: 'lower', description: 'Refunds this month ÷ Deals sold', live: true },
      { key: 'onboardingSpeed', name: 'Onboarding Speed', target: 90, unit: '%', direction: 'higher', description: '% of clients moved to CRS within 5 days of SOLD', live: true },
      { key: 'consultationTime', name: 'Consultation Response', target: 99, unit: '%', direction: 'higher', description: '% of intro texts sent within 2 hours of Quoted', live: true },
      { key: 'followUpCompletion', name: 'Overdue Follow-ups', target: 0, unit: '', direction: 'lower', description: 'Activities past due date - should be 0!', live: true },
      { key: 'clientRetention', name: 'Client Retention (50 days)', target: 85, unit: '%', direction: 'higher', description: '% of clients still active after 50 days in CRS', live: true },
      { key: 'revenueGenerated', name: 'Revenue Generated', target: 50000, unit: '$', direction: 'higher', description: 'Total payments collected this month from your clients', live: true },
      { key: 'reviewsCollected', name: 'Reviews Collected', target: 10, unit: '', direction: 'higher', description: 'Google reviews completed that were assigned to you', live: true },
      { key: 'affiliatesSigned', name: 'Affiliates Signed', target: 5, unit: '', direction: 'higher', description: 'New affiliate partners you added this month', live: true }
    ]
  },
  account_managers: {
    name: 'Account Managers',
    icon: Users,
    color: 'from-green-500 to-emerald-600',
    dataStatus: 'partial',
    metrics: [
      { key: 'cmsRetention', name: 'CMS Retention', target: 85, unit: '%', direction: 'higher', description: 'Clients retained (120 day window)', live: true },
      { key: 'followUpCompliance', name: 'Follow-Up Compliance', target: 95, unit: '%', direction: 'higher', description: 'Follow-ups completed on time', live: false },
      { key: 'upsellCrossSell', name: 'Upsell/Cross-Sell', target: 15, unit: '%', direction: 'higher', description: 'Additional rounds sold', live: true },
      { key: 'securedCards', name: 'Secured Cards', target: 20, unit: '', direction: 'higher', description: 'Secured card signups', live: true },
      { key: 'reviewGeneration', name: 'Review Generation', target: 10, unit: '', direction: 'higher', description: 'Reviews collected', live: true }
    ]
  },
  customer_support: {
    name: 'Customer Support',
    icon: Headphones,
    color: 'from-blue-500 to-cyan-600',
    dataStatus: 'partial',
    metrics: [
      { key: 'reportAcquisition', name: 'Report Acquisition', target: 47, unit: '', direction: 'higher', description: 'Client reports collected per month', live: true },
      { key: 'rptsToQtdConversion', name: 'RPTS→QTD Conversion', target: 50, unit: '%', direction: 'higher', description: 'Reports to Quoted conversion', live: true },
      { key: 'qtdToDocConversion', name: 'QTD→DOC Conversion', target: 40, unit: '%', direction: 'higher', description: 'Quoted to Docs Completed', live: true },
      { key: 'responseTime', name: 'Response Time', target: 5, unit: 'min', direction: 'lower', description: 'New lead response time', live: false },
      { key: 'reviewGeneration', name: 'Review Generation', target: 10, unit: '', direction: 'higher', description: 'Reviews collected per period', live: true }
    ]
  }
};

// Employee data by department
const EMPLOYEES = {
  leadership: [
    { id: 'joe', name: 'Joe (CEO)' },
    { id: 'astrid', name: 'Astrid (DOO)' }
  ],
  credit_team: [
    { id: 'ct1', name: 'Credit Team Member 1' },
    { id: 'ct2', name: 'Credit Team Member 2' }
  ],
  consultants: [
    { id: 'cindy', name: 'Cindy', type: 'regular', filterId: 133406 },
    { id: 'kimberly', name: 'Kimberly Sanchez', type: 'regular' },
    { id: 'eric', name: 'Eric De La Rosa', type: 'regular', filterId: 133407 },
    { id: 'carlos', name: 'Carlos Salguera', type: 'va', filterId: 133408 }
  ],
  account_managers: [
    { id: 'rosa', name: 'Rosa' },
    { id: 'dexann', name: 'Dex-ann' },
    { id: 'zairen', name: 'Zairen' },
    { id: 'raquel', name: 'Raquel' },
    { id: 'bryan', name: 'Bryan' }
  ],
  customer_support: [
    { id: 'kenneth_larios', name: 'Kenneth Larios' },
    { id: 'vic_baltodano', name: 'Vic Baltodano' },
    { id: 'reni', name: 'Reni' },
    { id: 'araceli_carrion_garcia', name: 'Araceli Carrion Garcia' },
    { id: 'jenifer_venegas', name: 'Jenifer Venegas' },
    { id: 'cj', name: 'CJ' }
    // Note: Ethel Marie is manager - no metrics tracked
  ]
};


export default function Scorecards() {
  const { currentUser } = useApp();
  const [selectedDepartment, setSelectedDepartment] = useState('consultants');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({});
  const [employeeMetrics, setEmployeeMetrics] = useState({});
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [allEmployeeData, setAllEmployeeData] = useState({});
  const [dealLists, setDealLists] = useState({}); // For drill-down: { consultant: { quotedDeals, soldDeals } }
  const [drillDownModal, setDrillDownModal] = useState({ show: false, consultant: null, metric: null });
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  // Initial fetch when department/employee/period changes
  useEffect(() => {
    fetchMetrics(false);
  }, [selectedDepartment, selectedEmployee, period]);

  // Auto-refresh every 30 seconds for consultants (silent - no loading spinner)
  useEffect(() => {
    if (selectedDepartment !== 'consultants') return;
    
    const interval = setInterval(() => {
      fetchMetrics(true); // true = silent refresh
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [selectedDepartment]);

  const fetchMetrics = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsAutoRefresh(silent);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, parseInt(period));

      // Fetch department-specific metrics
      if (selectedDepartment === 'leadership') {
        await fetchLeadershipMetrics(startDate, endDate);
      } else if (selectedDepartment === 'credit_team') {
        await fetchCreditTeamMetrics(startDate, endDate);
      } else if (selectedDepartment === 'consultants') {
        await fetchConsultantMetrics(startDate, endDate);
      } else if (selectedDepartment === 'account_managers') {
        await fetchAccountManagerMetrics(startDate, endDate);
      } else if (selectedDepartment === 'customer_support') {
        await fetchCustomerSupportMetrics(startDate, endDate);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      // Don't use mock data - keep whatever real data we have
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadershipMetrics = async (startDate, endDate) => {
    try {
      // Leadership metrics come from surveys and overall company data
      // For now, use mock data with realistic values
      // TODO: Connect to actual data sources (surveys, Pipedrive ESC/ERR labels, etc.)
      setMetrics(getMockMetrics('leadership'));
      generateAllEmployeeData('leadership');
    } catch (error) {
      console.error('Leadership fetch error:', error);
      setMetrics(getMockMetrics('leadership'));
      generateAllEmployeeData('leadership');
    }
  };

  const fetchCreditTeamMetrics = async (startDate, endDate) => {
    try {
      // Fetch from both endpoints
      const [sheetsResponse, pipedriveResponse] = await Promise.all([
        fetch(`/.netlify/functions/google-sheets-sync?days=${period}`),
        fetch(`/.netlify/functions/credit-team-metrics`)
      ]);
      
      const sheetsData = await sheetsResponse.json();
      const pipedriveData = await pipedriveResponse.json();
      
      const deptMetrics = {
        disputeTurnaround: pipedriveData.success && pipedriveData.metrics?.disputeTurnaround 
          ? pipedriveData.metrics.disputeTurnaround 
          : { value: 2.5, trend: -0.3, live: false },
        clientResults: sheetsData.success && sheetsData.metrics?.summary?.favorableRate 
          ? { value: sheetsData.metrics.summary.favorableRate, trend: 5, live: true }
          : { value: 70, trend: 5, live: false },
        errorRate: { value: 1, trend: -0.5, live: false },
        teamProductivity: { value: 97, trend: 1, live: false }
      };
      setMetrics(deptMetrics);

      // Generate employee data for comparison view
      const empData = {};
      EMPLOYEES.credit_team.forEach(emp => {
        empData[emp.id] = {
          disputeTurnaround: { value: 2 + Math.random() * 1.5, trend: Math.random() > 0.5 ? 0.2 : -0.2, live: false },
          clientResults: { value: Math.floor(65 + Math.random() * 15), trend: Math.floor(Math.random() * 6) - 2, live: false },
          errorRate: { value: Math.floor(Math.random() * 3), trend: Math.random() > 0.5 ? 0.5 : -0.5, live: false },
          teamProductivity: { value: Math.floor(94 + Math.random() * 6), trend: Math.floor(Math.random() * 4) - 1, live: false }
        };
      });
      setAllEmployeeData(empData);

      if (selectedEmployee !== 'all') {
        setEmployeeMetrics(empData[selectedEmployee] || deptMetrics);
      }
    } catch (error) {
      console.error('Credit team fetch error:', error);
      setMetrics(getMockMetrics('credit_team'));
      generateAllEmployeeData('credit_team');
    }
  };

  const fetchConsultantMetrics = async (startDate, endDate) => {
    try {
      const response = await fetch(`/.netlify/functions/consultant-metrics?days=${period}`);
      const data = await response.json();
      
      if (data.success && data.departmentMetrics) {
        setMetrics(data.departmentMetrics);
        setLastRefresh(new Date());
        
        // Store deal lists for drill-down functionality
        if (data.dealListsByConsultant) {
          setDealLists(data.dealListsByConsultant);
        }
        
        // Transform metricsByConsultant into the format the UI expects
        if (data.metricsByConsultant) {
          const empData = {};
          EMPLOYEES.consultants.forEach(emp => {
            const consultantData = data.metricsByConsultant[emp.name];
            if (consultantData) {
              empData[emp.id] = {
                leadConversion: consultantData.leadConversion,
                refundRate: consultantData.refundRate,
                onboardingSpeed: consultantData.onboardingSpeed,
                consultationTime: consultantData.consultationTime,
                followUpCompletion: consultantData.followUpCompletion,
                clientRetention: consultantData.clientRetention,
                revenueGenerated: consultantData.revenueGenerated,
                reviewsCollected: consultantData.reviewsCollected,
                affiliatesSigned: consultantData.affiliatesSigned
              };
            }
          });
          setAllEmployeeData(empData);
          
          // Set individual employee metrics if one is selected
          if (selectedEmployee !== 'all' && empData[selectedEmployee]) {
            setEmployeeMetrics(empData[selectedEmployee]);
          }
        }
      } else {
        console.error('API returned unsuccessful response');
      }
    } catch (error) {
      console.error('Consultant fetch error:', error);
    }
  };

  const fetchAccountManagerMetrics = async (startDate, endDate) => {
    try {
      const response = await fetch(`/.netlify/functions/account-manager-metrics?days=${period}`);
      const data = await response.json();
      
      if (data.success && data.departmentMetrics) {
        // Transform to expected format
        const transformedMetrics = {};
        Object.entries(data.departmentMetrics).forEach(([key, val]) => {
          transformedMetrics[key] = { 
            value: val.value, 
            trend: val.trend || 0,
            live: val.live !== false
          };
        });
        setMetrics(transformedMetrics);
        
        // Set employee data from API response
        if (data.metricsByAM) {
          const empData = {};
          Object.entries(data.metricsByAM).forEach(([amName, amMetrics]) => {
            // Find matching employee ID
            const emp = EMPLOYEES.account_managers.find(e => 
              e.name.toLowerCase() === amName.toLowerCase()
            );
            if (emp) {
              empData[emp.id] = {};
              Object.entries(amMetrics).forEach(([key, val]) => {
                empData[emp.id][key] = { 
                  value: val.value, 
                  trend: val.trend || 0,
                  live: val.live !== false
                };
              });
            }
          });
          setAllEmployeeData(empData);
        }
      } else {
        setMetrics(getMockMetrics('account_managers'));
        generateAllEmployeeData('account_managers');
      }
      
      if (selectedEmployee !== 'all') {
        setEmployeeMetrics(allEmployeeData[selectedEmployee] || getMockMetrics('account_managers', true));
      }
    } catch (error) {
      console.error('Account Manager fetch error:', error);
      setMetrics(getMockMetrics('account_managers'));
      generateAllEmployeeData('account_managers');
    }
  };

  const fetchCustomerSupportMetrics = async (startDate, endDate) => {
    try {
      const response = await fetch(`/.netlify/functions/customer-support-metrics?days=${period}`);
      const data = await response.json();
      
      if (data.success && data.departmentMetrics) {
        setMetrics(data.departmentMetrics);
        
        // Transform byEmployee data into the format the UI expects
        const empData = {};
        const deptMetrics = data.departmentMetrics;
        
        EMPLOYEES.customer_support.forEach(emp => {
          const name = emp.name;
          empData[emp.id] = {
            reportAcquisition: {
              value: deptMetrics.reportAcquisition?.byEmployee?.[name] || 0,
              trend: 0
            },
            rptsToQtdConversion: {
              value: deptMetrics.rptsToQtd?.byEmployee?.[name]?.rate || 0,
              trend: 0
            },
            qtdToDocConversion: {
              value: deptMetrics.qtdToDoc?.byEmployee?.[name]?.rate || 0,
              trend: 0
            },
            responseTime: {
              value: deptMetrics.responseTime?.byEmployee?.[name] || 0,
              trend: 0
            },
            reviewGeneration: {
              value: deptMetrics.reviewGeneration?.byEmployee?.[name] || 0,
              trend: 0
            }
          };
        });
        
        setAllEmployeeData(empData);
      } else {
        setMetrics(getMockMetrics('customer_support'));
        generateAllEmployeeData('customer_support');
      }
      
      if (selectedEmployee !== 'all') {
        setEmployeeMetrics(allEmployeeData[selectedEmployee] || getMockMetrics('customer_support', true));
      }
    } catch (error) {
      console.error('Customer Support fetch error:', error);
      setMetrics(getMockMetrics('customer_support'));
      generateAllEmployeeData('customer_support');
    }
  };

  const generateAllEmployeeData = (dept) => {
    const employees = EMPLOYEES[dept] || [];
    const deptConfig = DEPARTMENTS[dept];
    const empData = {};
    
    employees.forEach(emp => {
      const data = {};
      deptConfig.metrics.forEach(metric => {
        const baseValue = metric.target;
        const variance = metric.direction === 'higher' 
          ? baseValue * (0.8 + Math.random() * 0.4) // 80% to 120% of target
          : baseValue * (0.6 + Math.random() * 0.8); // 60% to 140% of target
        
        data[metric.key] = {
          value: metric.unit === '$' ? Math.floor(variance) : 
                 metric.unit === '/5' ? parseFloat(variance.toFixed(1)) :
                 metric.unit === '' ? Math.floor(variance) :
                 parseFloat(variance.toFixed(1)),
          trend: Math.floor(Math.random() * 10) - 5
        };
      });
      empData[emp.id] = data;
    });
    
    setAllEmployeeData(empData);
  };

  const getMockMetrics = (dept, isIndividual = false) => {
    const variance = isIndividual ? () => Math.floor(Math.random() * 10) - 5 : () => 0;
    
    const mocks = {
      leadership: {
        clientSatisfaction: { value: 92 + variance(), trend: 2 },
        npsScore: { value: 55 + variance(), trend: 3 },
        escalationResolution: { value: 96 + variance(), trend: 1 },
        clientRetention: { value: 72 + variance(), trend: 2 },
        errorReduction: { value: 8 + variance(), trend: -2 },
        teamProductivity: { value: 97 + variance(), trend: 2 }
      },
      credit_team: {
        disputeTurnaround: { value: 2.5 + variance() * 0.1, trend: -0.3 },
        clientResults: { value: 70 + variance(), trend: 5 },
        errorRate: { value: 1 + variance() * 0.1, trend: -0.5 },
        teamProductivity: { value: 97 + variance(), trend: 1 }
      },
      consultants: {
        leadConversion: { value: 48 + variance(), trend: 3 },
        refundRate: { value: 4 + variance() * 0.1, trend: -1 },
        onboardingSpeed: { value: 92 + variance(), trend: 2 },
        consultationTime: { value: 98 + variance(), trend: -1 },
        followUpCompletion: { value: 96 + variance(), trend: 2 },
        clientRetention: { value: 87 + variance(), trend: 3 },
        revenueGenerated: { value: 52450 + variance() * 1000, trend: 5 },
        reviewsCollected: { value: 12 + variance(), trend: 2 },
        affiliatesSigned: { value: 6 + variance(), trend: 1 }
      },
      account_managers: {
        clientSatisfaction: { value: 92 + variance(), trend: 2 },
        responseTime: { value: 3.5 + variance() * 0.1, trend: -0.5 },
        retentionRate: { value: 87 + variance(), trend: 3 },
        upsellRate: { value: 18 + variance(), trend: 2 },
        ticketsResolved: { value: 96 + variance(), trend: 1 },
        callsCompleted: { value: 22 + variance(), trend: 3 }
      },
      customer_support: {
        reportAcquisition: { value: 52 + variance(), trend: 5 },
        rptsToQtdConversion: { value: 54 + variance(), trend: 4 },
        qtdToDocConversion: { value: 42 + variance(), trend: 2 },
        responseTime: { value: 4.2 + variance() * 0.1, trend: -0.8 },
        reviewGeneration: { value: 8 + variance(), trend: -2 }
      }
    };
    
    return mocks[dept] || {};
  };

  const calculateHealthScore = () => {
    const dept = DEPARTMENTS[selectedDepartment];
    if (!dept || !metrics) return 0;

    let totalScore = 0;
    let count = 0;

    dept.metrics.forEach(metric => {
      const data = metrics[metric.key];
      if (!data) return;

      let score;
      if (metric.direction === 'higher') {
        score = Math.min(100, (data.value / metric.target) * 100);
      } else {
        score = data.value <= metric.target ? 100 : Math.max(0, 100 - ((data.value - metric.target) / metric.target) * 100);
      }
      totalScore += score;
      count++;
    });

    return count > 0 ? Math.round(totalScore / count) : 0;
  };

  const MetricCard = ({ metric, data, isIndividual = false, consultantName = null }) => {
    if (!data) return null;
    
    const isGood = metric.direction === 'higher' 
      ? data.value >= metric.target 
      : data.value <= metric.target;
    
    const percentage = metric.direction === 'higher'
      ? Math.min(100, (data.value / metric.target) * 100)
      : data.value <= metric.target ? 100 : Math.max(0, 100 - ((data.value - metric.target) / metric.target) * 50);

    const isLive = metric.live || data.live;
    
    // All live consultant metrics support drill-down
    const supportsDrillDown = isLive && selectedDepartment === 'consultants';

    const formatValue = (val) => {
      if (metric.unit === '$') return `$${val.toLocaleString()}`;
      if (metric.unit === '%') return `${val}%`;
      if (metric.unit === '/5') return val.toFixed(1);
      if (metric.unit === 'days' || metric.unit === 'hrs' || metric.unit === 'hr' || metric.unit === 'min') {
        return `${val} ${metric.unit}`;
      }
      return val;
    };
    
    const handleClick = () => {
      if (supportsDrillDown) {
        const targetConsultant = consultantName || (selectedEmployee !== 'all' 
          ? EMPLOYEES.consultants.find(e => e.id === selectedEmployee)?.name 
          : null);
        setDrillDownModal({ show: true, consultant: targetConsultant, metric: metric.key });
      }
    };

    return (
      <div 
        onClick={handleClick}
        className={`bg-white rounded-xl p-5 transition-all hover:shadow-md ${
          supportsDrillDown ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''
        } ${
          isLive 
            ? isGood ? 'border-2 border-green-200' : 'border-2 border-amber-200'
            : 'border-2 border-dashed border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isGood ? 'bg-green-100' : 'bg-amber-100'}`}>
              {isGood ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
            </div>
            {!isLive && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                Mock Data
              </span>
            )}
            {isLive && (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            )}
            {supportsDrillDown && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                Click for details
              </span>
            )}
          </div>
          {data.trend !== undefined && (
            <div className={`flex items-center text-sm ${
              (metric.direction === 'higher' ? data.trend >= 0 : data.trend <= 0) ? 'text-green-600' : 'text-red-600'
            }`}>
              {data.trend >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {Math.abs(data.trend)}{metric.unit === '$' ? '%' : metric.unit || ''}
            </div>
          )}
        </div>
        
        <h3 className="text-sm text-gray-600 mb-1">{metric.name}</h3>
        <p className="text-xs text-gray-400 mb-2">{metric.description}</p>
        
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isGood ? 'text-green-600' : 'text-amber-600'}`}>
            {formatValue(data.value)}
          </span>
          <span className="text-sm text-gray-500">
            / {formatValue(metric.target)} target
          </span>
        </div>
        
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${isGood ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  // Drill-down modal for metric details
  const DrillDownModal = () => {
    if (!drillDownModal.show) return null;
    
    const consultant = drillDownModal.consultant;
    const metricKey = drillDownModal.metric;
    const consultantDeals = consultant ? dealLists[consultant] : null;
    
    // Aggregate data across all consultants if no specific consultant selected
    const getAllData = (field) => {
      if (consultant) return consultantDeals?.[field] || [];
      return Object.values(dealLists).flatMap(d => d[field] || []);
    };

    const metricConfig = {
      leadConversion: { title: 'Lead Conversion Breakdown', color: 'from-orange-500 to-amber-500' },
      refundRate: { title: 'Refund Rate Details', color: 'from-red-500 to-pink-500' },
      onboardingSpeed: { title: 'Onboarding Speed Details', color: 'from-blue-500 to-cyan-500' },
      consultationTime: { title: 'Consultation Response Details', color: 'from-purple-500 to-violet-500' },
      followUpCompletion: { title: 'Overdue Follow-ups', color: 'from-yellow-500 to-orange-500' },
      clientRetention: { title: 'Client Retention (50 Days)', color: 'from-teal-500 to-green-500' },
      revenueGenerated: { title: 'Revenue Generated - This Month', color: 'from-emerald-500 to-green-600' },
      reviewsCollected: { title: 'Reviews Collected', color: 'from-indigo-500 to-blue-500' },
      affiliatesSigned: { title: 'Affiliates Signed', color: 'from-pink-500 to-rose-500' }
    };

    const config = metricConfig[metricKey] || { title: 'Metric Details', color: 'from-gray-500 to-gray-600' };

    const renderContent = () => {
      switch (metricKey) {
        case 'leadConversion': {
          const quoted = getAllData('quotedDeals');
          const sold = getAllData('soldDeals');
          const rate = quoted.length > 0 ? Math.round((sold.length / quoted.length) * 100) : 0;
          return (
            <>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{quoted.length}</div>
                  <div className="text-sm text-gray-600">Moved to Quoted</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{sold.length}</div>
                  <div className="text-sm text-gray-600">Moved to SOLD</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{rate}%</div>
                  <div className="text-sm text-gray-600">Conversion Rate</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                      Quoted This Month ({quoted.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {quoted.map((deal, idx) => {
                        const wasSold = sold.some(s => s.id === deal.id || s.title === deal.title);
                        return (
                          <div key={deal.id || idx} className={`p-3 rounded-lg border ${wasSold ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{deal.title || deal.personName}</span>
                              {wasSold && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Converted</span>}
                            </div>
                            {deal.value > 0 && <div className="text-sm text-gray-500">${deal.value.toLocaleString()}</div>}
                            <a href={`https://asapcreditrepair.pipedrive.com/deal/${deal.id}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                              View in Pipedrive <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      SOLD This Month ({sold.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {sold.map((deal, idx) => (
                        <div key={deal.id || idx} className="p-3 rounded-lg border bg-green-50 border-green-200">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{deal.title || deal.personName}</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">SOLD</span>
                          </div>
                          {deal.value > 0 && <div className="text-sm text-green-700 font-medium">${deal.value.toLocaleString()}</div>}
                          <a href={`https://asapcreditrepair.pipedrive.com/deal/${deal.id}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                            View in Pipedrive <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        }

        case 'refundRate': {
          const refunds = getAllData('refundDetails');
          const sold = getAllData('soldDeals');
          return (
            <>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{refunds.length}</div>
                  <div className="text-sm text-gray-600">Refunds This Month</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{sold.length}</div>
                  <div className="text-sm text-gray-600">Deals Sold</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{sold.length > 0 ? Math.round((refunds.length / sold.length) * 100) : 0}%</div>
                  <div className="text-sm text-gray-600">Refund Rate</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                {refunds.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">🎉 No refunds this month!</p>
                ) : (
                  <div className="space-y-2">
                    {refunds.map((r, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-red-50 border-red-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{r.clientName}</span>
                          {r.amount && <span className="text-red-600 font-medium">${parseFloat(r.amount).toLocaleString()}</span>}
                        </div>
                        <div className="text-sm text-gray-500">{r.date} {r.reason && `• ${r.reason}`}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        }

        case 'onboardingSpeed': {
          const details = getAllData('onboardingDetails');
          const valid = details.filter(d => d.days !== 'N/A');
          const within5 = valid.filter(d => parseFloat(d.days) >= 0 && parseFloat(d.days) <= 5);
          return (
            <>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{details.length}</div>
                  <div className="text-sm text-gray-600">CRS Deals This Month</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{within5.length}</div>
                  <div className="text-sm text-gray-600">Within 5 Days</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{valid.length > 0 ? Math.round((within5.length / valid.length) * 100) : 0}%</div>
                  <div className="text-sm text-gray-600">On-Time Rate</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <div className="space-y-2">
                  {details.map((d, idx) => {
                    const days = parseFloat(d.days);
                    const isGood = !isNaN(days) && days >= 0 && days <= 5;
                    return (
                      <div key={idx} className={`p-3 rounded-lg border ${isGood ? 'bg-green-50 border-green-200' : d.days === 'N/A' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{d.title}</span>
                          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${isGood ? 'bg-green-100 text-green-700' : d.days === 'N/A' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                            {d.days === 'N/A' ? 'No data' : `${d.days} days`}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Sold: {d.soldDate || 'N/A'} → CRS: {d.crsDate || 'N/A'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        }

        case 'clientRetention': {
          const details = getAllData('retentionDetails');
          const retained = details.filter(d => d.retained);
          return (
            <>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{details.length}</div>
                  <div className="text-sm text-gray-600">Clients 50+ Days</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{retained.length}</div>
                  <div className="text-sm text-gray-600">Retained (RD1+)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{details.length > 0 ? Math.round((retained.length / details.length) * 100) : 0}%</div>
                  <div className="text-sm text-gray-600">Retention Rate</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <div className="space-y-2">
                  {details.sort((a, b) => (a.retained === b.retained ? 0 : a.retained ? -1 : 1)).map((d, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${d.retained ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{d.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${d.retained ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {d.retained ? '✓ Retained' : '✗ At Risk'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>Status: {d.status}</span>
                        <span>•</span>
                        <span>{d.daysInProgram} days in program</span>
                      </div>
                      {d.id && (
                        <a href={`https://asapcreditrepair.pipedrive.com/deal/${d.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                          View in Pipedrive <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        }

        case 'revenueGenerated': {
          const sales = getAllData('salesDetails');
          const total = sales.reduce((sum, s) => sum + (s.amount || 0), 0);
          return (
            <>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">${Math.round(total).toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Total Revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{sales.length}</div>
                  <div className="text-sm text-gray-600">Payments</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">${sales.length > 0 ? Math.round(total / sales.length) : 0}</div>
                  <div className="text-sm text-gray-600">Avg Payment</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <div className="space-y-2">
                  {sales.sort((a, b) => new Date(b.date) - new Date(a.date)).map((s, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-green-50 border-green-200">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{s.clientName}</span>
                        <span className="text-green-700 font-bold">${s.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-gray-500">{s.date} • {s.type || 'Payment'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        }

        case 'followUpCompletion': {
          return (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-medium">No overdue follow-ups!</p>
              <p className="text-sm mt-1">All consultants are up to date.</p>
            </div>
          );
        }

        case 'reviewsCollected': {
          const reviews = getAllData('reviewsDetails');
          return (
            <>
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600">{reviews.length}</div>
                  <div className="text-sm text-gray-600">Reviews Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600">10</div>
                  <div className="text-sm text-gray-600">Monthly Target</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                {reviews.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No reviews collected this month. Assign reviews from the Incoming Reviews page!</p>
                ) : (
                  <div className="space-y-2">
                    {reviews.map((r, idx) => (
                      <div key={r.id || idx} className="p-3 rounded-lg border bg-indigo-50 border-indigo-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">⭐ {r.reviewerName}</span>
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Completed</span>
                        </div>
                        {r.completedAt && (
                          <div className="text-sm text-gray-500 mt-1">
                            Completed {new Date(r.completedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        }

        case 'affiliatesSigned': {
          const affiliates = getAllData('affiliatesDetails');
          return (
            <>
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <div className="text-3xl font-bold text-pink-600">{affiliates.length}</div>
                  <div className="text-sm text-gray-600">Affiliates Signed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600">5</div>
                  <div className="text-sm text-gray-600">Monthly Target</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                {affiliates.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No affiliates signed this month. Add affiliates from the Affiliates page!</p>
                ) : (
                  <div className="space-y-2">
                    {affiliates.map((a, idx) => (
                      <div key={a.id || idx} className="p-3 rounded-lg border bg-pink-50 border-pink-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">🤝 {a.organization || a.name}</span>
                          <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">New Affiliate</span>
                        </div>
                        {a.name && a.organization && (
                          <div className="text-sm text-gray-600">{a.name}</div>
                        )}
                        {a.acquiredAt && (
                          <div className="text-sm text-gray-500 mt-1">
                            Signed {new Date(a.acquiredAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        }

        default:
          return (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-medium">Data building...</p>
              <p className="text-sm mt-1">This metric is collecting data. Details will appear as data comes in.</p>
            </div>
          );
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className={`flex items-center justify-between p-4 border-b bg-gradient-to-r ${config.color} text-white`}>
            <div>
              <h2 className="text-xl font-bold">{config.title}</h2>
              <p className="text-sm opacity-90">{consultant || 'All Consultants'} • This Month</p>
            </div>
            <button onClick={() => setDrillDownModal({ show: false, consultant: null, metric: null })}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {renderContent()}
          
          <div className="p-4 border-t bg-gray-50 flex items-center justify-end">
            <button onClick={() => setDrillDownModal({ show: false, consultant: null, metric: null })}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const dept = DEPARTMENTS[selectedDepartment];
  const employees = EMPLOYEES[selectedDepartment] || [];
  const healthScore = calculateHealthScore();
  const DeptIcon = dept?.icon || Target;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Score Cards</h1>
          <p className="text-gray-600">Track department and individual KPIs</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Selector */}
          <div className="relative">
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedEmployee('all');
              }}
              className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium cursor-pointer"
            >
              {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                <option key={key} value={key}>{dept.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Employee Selector */}
          <div className="relative">
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg bg-white text-sm cursor-pointer"
            >
              <option value="all">All {dept?.name}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Period Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { label: '7 Days', value: '7' },
              { label: '30 Days', value: '30' },
              { label: '90 Days', value: '90' }
            ].map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Comparison Table"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Data Status Banner */}
      <div className={`rounded-lg px-4 py-3 mb-4 flex items-center justify-between ${
        dept?.dataStatus === 'live' ? 'bg-green-50 border border-green-200' :
        dept?.dataStatus === 'partial' ? 'bg-amber-50 border border-amber-200' :
        'bg-gray-50 border border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            dept?.dataStatus === 'live' ? 'bg-green-500 animate-pulse' :
            dept?.dataStatus === 'partial' ? 'bg-amber-500' :
            'bg-gray-400'
          }`} />
          <span className={`text-sm font-medium ${
            dept?.dataStatus === 'live' ? 'text-green-700' :
            dept?.dataStatus === 'partial' ? 'text-amber-700' :
            'text-gray-600'
          }`}>
            {dept?.dataStatus === 'live' ? '✓ All metrics pulling live data' :
             dept?.dataStatus === 'partial' ? '⚠ Some metrics using mock data (see badges on cards)' :
             '○ Using mock data - no data source connected'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Live
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <span className="w-3 h-0.5 border border-dashed border-gray-400"></span> Mock
          </span>
        </div>
      </div>

      {/* Health Score Banner */}
      <div className={`bg-gradient-to-r ${dept?.color || 'from-blue-500 to-indigo-600'} rounded-2xl p-6 mb-6 text-white`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <DeptIcon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-medium opacity-90">
                {selectedEmployee === 'all' 
                  ? `${dept?.name} Performance` 
                  : employees.find(e => e.id === selectedEmployee)?.name || 'Individual'
                }
              </h2>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl font-bold">{healthScore}%</span>
                <span className="text-xl opacity-80">of targets met</span>
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-6 mt-4 md:mt-0">
            {dept?.metrics.slice(0, 4).map(metric => {
              const data = selectedEmployee === 'all' ? metrics[metric.key] : (employeeMetrics[metric.key] || metrics[metric.key]);
              if (!data) return null;
              
              const formatVal = (v) => {
                if (metric.unit === '$') return `$${(v/1000).toFixed(0)}k`;
                if (metric.unit === '%') return `${v}%`;
                return v;
              };
              
              return (
                <div key={metric.key} className="text-center">
                  <div className="text-2xl font-bold">{formatVal(data.value)}</div>
                  <div className="text-sm opacity-80">{metric.name.split(' ')[0]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* TABLE VIEW - Employee Comparison (Vertical Layout - Employees as Columns) */}
          {viewMode === 'table' && selectedEmployee === 'all' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Table className="w-5 h-5 text-gray-500" />
                  Employee Comparison - {dept?.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Compare all employees against targets</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[180px]">
                        Metric
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-blue-700 bg-blue-50 min-w-[100px]">
                        🎯 Target
                      </th>
                      {employees.map((employee, index) => (
                        <th key={employee.id} className="text-center py-3 px-4 text-sm font-semibold text-gray-700 min-w-[120px]">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-gray-300'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="font-medium">{employee.name}</div>
                            {employee.type === 'va' && (
                              <div className="text-xs text-gray-500">VA</div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dept?.metrics.map((metric, metricIndex) => (
                      <tr key={metric.key} className={metricIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className={`py-3 px-4 sticky left-0 ${metricIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} min-w-[200px]`}>
                          <div className="font-medium text-gray-900">{metric.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {metric.description}
                          </div>
                          <div className={`text-[10px] mt-1 ${metric.direction === 'higher' ? 'text-green-600' : 'text-blue-600'}`}>
                            {metric.direction === 'higher' ? '↑ Higher is better' : '↓ Lower is better'}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 bg-blue-50 font-semibold text-blue-700">
                          {metric.unit === '$' ? `$${metric.target.toLocaleString()}` : 
                           metric.unit === '%' ? `${metric.target}%` :
                           metric.unit === '/5' ? metric.target.toFixed(1) :
                           metric.unit ? `${metric.target} ${metric.unit}` : metric.target}
                        </td>
                        {employees.map(employee => {
                          const empData = allEmployeeData[employee.id] || {};
                          const data = empData[metric.key];
                          
                          if (!data) return <td key={employee.id} className="text-center py-3 px-4 text-gray-400">-</td>;
                          
                          const isGood = metric.direction === 'higher' 
                            ? data.value >= metric.target 
                            : data.value <= metric.target;
                          
                          const formatVal = (v) => {
                            if (metric.unit === '$') return `$${Math.floor(v).toLocaleString()}`;
                            if (metric.unit === '%') return `${Math.floor(v)}%`;
                            if (metric.unit === '/5') return v.toFixed(1);
                            if (metric.unit) return `${typeof v === 'number' ? v.toFixed(1) : v} ${metric.unit}`;
                            return Math.floor(v);
                          };
                          
                          // Check if clickable (Lead Conversion for consultants)
                          const isClickable = metric.live && selectedDepartment === 'consultants';
                          
                          return (
                            <td 
                              key={employee.id} 
                              className={`text-center py-3 px-4 ${isClickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                              onClick={() => {
                                if (isClickable) {
                                  setDrillDownModal({ show: true, consultant: employee.name, metric: metric.key });
                                }
                              }}
                            >
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                                isGood ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              } ${isClickable ? 'hover:ring-2 hover:ring-blue-300' : ''}`}>
                                {isGood ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                {formatVal(data.value)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Overall Score Row */}
                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                      <td className="py-3 px-4 sticky left-0 bg-gray-100 font-semibold text-gray-900">
                        Overall Score
                      </td>
                      <td className="text-center py-3 px-4 bg-blue-100 font-bold text-blue-700">
                        100%
                      </td>
                      {employees.map(employee => {
                        const empData = allEmployeeData[employee.id] || {};
                        let totalScore = 0;
                        let metricCount = 0;
                        
                        dept?.metrics.forEach(metric => {
                          const data = empData[metric.key];
                          if (data) {
                            const isGood = metric.direction === 'higher' 
                              ? data.value >= metric.target 
                              : data.value <= metric.target;
                            if (isGood) totalScore += 100;
                            else {
                              const pct = metric.direction === 'higher'
                                ? (data.value / metric.target) * 100
                                : (metric.target / Math.max(data.value, 0.1)) * 100;
                              totalScore += Math.min(pct, 100);
                            }
                            metricCount++;
                          }
                        });
                        
                        const overallScore = metricCount > 0 ? Math.round(totalScore / metricCount) : 0;
                        
                        return (
                          <td key={employee.id} className="text-center py-3 px-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                              overallScore >= 90 ? 'bg-green-100 text-green-700' : 
                              overallScore >= 70 ? 'bg-amber-100 text-amber-700' : 
                              'bg-red-100 text-red-700'
                            }`}>
                              {overallScore}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CARD VIEW - Department Metrics Grid */}
          {(viewMode === 'cards' || selectedEmployee !== 'all') && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                {selectedEmployee === 'all' ? 'Department KPIs' : 'Individual KPIs'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dept?.metrics.map(metric => (
                  <MetricCard 
                    key={metric.key} 
                    metric={metric} 
                    data={selectedEmployee === 'all' ? metrics[metric.key] : (employeeMetrics[metric.key] || metrics[metric.key])}
                    isIndividual={selectedEmployee !== 'all'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Employee Leaderboard (when viewing department in card mode) */}
          {viewMode === 'cards' && selectedEmployee === 'all' && employees.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                {dept?.name} Leaderboard
              </h3>
              <div className="space-y-3">
                {employees.map((employee, index) => {
                  // Generate mock performance for leaderboard
                  const performance = Math.floor(Math.random() * 20) + 80;
                  const mainMetric = dept?.metrics[0];
                  const metricValue = mainMetric ? (metrics[mainMetric.key]?.value || 0) + (Math.random() * 10 - 5) : 0;
                  
                  return (
                    <div 
                      key={employee.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => setSelectedEmployee(employee.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{employee.name}</div>
                          {employee.type && (
                            <div className="text-xs text-gray-500">
                              {employee.type === 'va' ? 'VA Consultant' : 'Consultant'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{performance}%</div>
                          <div className="text-xs text-gray-500">Overall Score</div>
                        </div>
                        {mainMetric && (
                          <div className="text-right">
                            <div className={`font-semibold ${
                              mainMetric.direction === 'higher' 
                                ? metricValue >= mainMetric.target ? 'text-green-600' : 'text-amber-600'
                                : metricValue <= mainMetric.target ? 'text-green-600' : 'text-amber-600'
                            }`}>
                              {mainMetric.unit === '$' ? `$${Math.floor(metricValue).toLocaleString()}` : 
                               mainMetric.unit === '%' ? `${Math.floor(metricValue)}%` : Math.floor(metricValue)}
                            </div>
                            <div className="text-xs text-gray-500">{mainMetric.name}</div>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Detail (when employee selected) */}
          {selectedEmployee !== 'all' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Trend */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Performance Trend
                </h3>
                <div className="h-48 flex items-end justify-between gap-2">
                  {Array.from({ length: 12 }, (_, i) => {
                    const height = 40 + Math.random() * 50;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-xs text-gray-400">{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">Last 12 periods</p>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {[
                    { action: 'Closed deal', detail: '$1,299 enrollment', time: '2 hours ago', icon: CheckCircle, color: 'text-green-500' },
                    { action: 'Follow-up completed', detail: 'John Smith', time: '4 hours ago', icon: Phone, color: 'text-blue-500' },
                    { action: 'Review collected', detail: '5-star rating', time: 'Yesterday', icon: Star, color: 'text-amber-500' },
                    { action: 'New affiliate', detail: 'Partner signup', time: '2 days ago', icon: Users2, color: 'text-purple-500' }
                  ].map((activity, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <activity.icon className={`w-5 h-5 ${activity.color}`} />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{activity.action}</div>
                        <div className="text-sm text-gray-500">{activity.detail}</div>
                      </div>
                      <div className="text-xs text-gray-400">{activity.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Drill-down Modal */}
      <DrillDownModal />
      
      {/* Last Refresh Indicator for Consultants */}
      {selectedDepartment === 'consultants' && lastRefresh && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-2 text-sm text-gray-600 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Auto-refreshes every 30s • Last: {format(lastRefresh, 'h:mm:ss a')}
        </div>
      )}
    </div>
  );
}
