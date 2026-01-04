import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  Search,
  Phone,
  Mail,
  Building,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  MessageSquare,
  PhoneCall,
  Video,
  AlertCircle,
  ArrowRight,
  BarChart3,
  UserCheck,
  UserX,
  RefreshCw
} from 'lucide-react';
import { format, parseISO, differenceInDays, isPast, isToday } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const AFFILIATE_TYPES = {
  realtor: { name: 'Realtor', icon: '🏠' },
  loan_officer: { name: 'Loan Officer', icon: '🏦' },
  car_dealer: { name: 'Car Dealer', icon: '🚗' },
  attorney: { name: 'Attorney', icon: '⚖️' },
  cpa: { name: 'CPA/Accountant', icon: '📊' },
  insurance_agent: { name: 'Insurance Agent', icon: '🛡️' },
  financial_advisor: { name: 'Financial Advisor', icon: '💼' },
  other: { name: 'Other', icon: '👤' },
};

const FOLLOWUP_TYPES = [
  { id: 'call', name: 'Phone Call', icon: PhoneCall },
  { id: 'email', name: 'Email', icon: Mail },
  { id: 'text', name: 'Text Message', icon: MessageSquare },
  { id: 'meeting', name: 'Meeting', icon: Video },
];

export default function Affiliates() {
  const { currentUser, users } = useApp();
  const [affiliates, setAffiliates] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('action');
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [expandedAffiliate, setExpandedAffiliate] = useState(null);
  const [viewMode, setViewMode] = useState('my');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    loadData();
  }, [currentUser, viewMode]);

  const loadData = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      let query = `${SUPABASE_URL}/rest/v1/affiliates?select=*&order=next_followup_date.asc.nullsfirst`;
      if (viewMode === 'my') {
        query += `&consultant_id=eq.${currentUser.id}`;
      }

      const affiliatesRes = await fetch(query, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      setAffiliates(await affiliatesRes.json() || []);
    } catch (error) {
      console.error('Error loading affiliates:', error);
    }
    setLoading(false);
  };

  const loadFollowups = async (affiliateId) => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/affiliate_followups?affiliate_id=eq.${affiliateId}&order=followup_date.desc&limit=10`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      setFollowups(await res.json() || []);
    } catch (error) {
      console.error('Error loading followups:', error);
    }
  };

  const logFollowup = async (data) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/affiliate_followups`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          affiliate_id: selectedAffiliate.id,
          consultant_id: currentUser.id,
          followup_date: new Date().toISOString().split('T')[0]
        })
      });
      await loadData();
      if (expandedAffiliate === selectedAffiliate.id) {
        await loadFollowups(selectedAffiliate.id);
      }
      setShowFollowupModal(false);
      setSelectedAffiliate(null);
    } catch (error) {
      console.error('Error logging followup:', error);
    }
  };

  const getFollowupStatus = (affiliate) => {
    if (!affiliate.next_followup_date) return 'none';
    const nextDate = parseISO(affiliate.next_followup_date);
    const daysOverdue = differenceInDays(new Date(), nextDate);
    if (daysOverdue > 14) return 'critical';
    if (daysOverdue > 0) return 'overdue';
    if (isToday(nextDate)) return 'due_today';
    if (differenceInDays(nextDate, new Date()) <= 3) return 'upcoming';
    return 'ok';
  };

  const getNeglectedDays = (affiliate) => {
    if (!affiliate.last_followup_date) {
      return differenceInDays(new Date(), parseISO(affiliate.acquired_date || affiliate.created_at));
    }
    return differenceInDays(new Date(), parseISO(affiliate.last_followup_date));
  };

  const getConsultantName = (id) => users?.find(u => u.id === id)?.name || 'Unknown';

  // Categorize affiliates
  const criticalAffiliates = affiliates.filter(a => getFollowupStatus(a) === 'critical');
  const overdueAffiliates = affiliates.filter(a => getFollowupStatus(a) === 'overdue');
  const dueTodayAffiliates = affiliates.filter(a => getFollowupStatus(a) === 'due_today');
  const neglectedAffiliates = affiliates.filter(a => getNeglectedDays(a) > 30).sort((a, b) => getNeglectedDays(b) - getNeglectedDays(a));

  // Stats
  const totalAffiliates = affiliates.length;
  const totalLeads = affiliates.reduce((sum, a) => sum + (a.leads_count || 0), 0);
  const totalSold = affiliates.reduce((sum, a) => sum + (a.sold_count || 0), 0);
  const totalInactive = affiliates.reduce((sum, a) => sum + (a.inactive_count || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((totalSold / (totalLeads + totalSold)) * 100) : 0;

  // Filter for search
  const filterAffiliates = (list) => {
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(a => 
      a.name?.toLowerCase().includes(query) || 
      a.organization_name?.toLowerCase().includes(query)
    );
  };

  // Action needed list
  const actionNeeded = [...criticalAffiliates, ...overdueAffiliates, ...dueTodayAffiliates];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Affiliate Dashboard</h1>
            <p className="text-slate-500 text-sm">Track your referral partner relationships</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
              <button
                onClick={() => setViewMode('my')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'my' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
                }`}
              >
                My Affiliates
              </button>
              <button
                onClick={() => setViewMode('team')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'team' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
                }`}
              >
                All Affiliates
              </button>
            </div>
          )}
          <button onClick={loadData} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <Users size={20} className="text-blue-500" />
            <span className="text-2xl font-bold text-slate-800">{totalAffiliates}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Total Affiliates</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <TrendingUp size={20} className="text-indigo-500" />
            <span className="text-2xl font-bold text-slate-800">{totalLeads}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Active Leads</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <UserCheck size={20} className="text-green-500" />
            <span className="text-2xl font-bold text-green-600">{totalSold}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Sold Clients</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <UserX size={20} className="text-slate-400" />
            <span className="text-2xl font-bold text-slate-500">{totalInactive}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Inactive</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <BarChart3 size={20} className="text-purple-500" />
            <span className="text-2xl font-bold text-purple-600">{conversionRate}%</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Conversion Rate</p>
        </div>
        <div className={`rounded-xl p-4 border ${actionNeeded.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center justify-between">
            {actionNeeded.length > 0 ? (
              <AlertTriangle size={20} className="text-red-500" />
            ) : (
              <CheckCircle size={20} className="text-green-500" />
            )}
            <span className={`text-2xl font-bold ${actionNeeded.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {actionNeeded.length}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Need Action</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('action')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'action' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertCircle size={16} className="inline mr-2" />
          Action Needed ({actionNeeded.length})
        </button>
        <button
          onClick={() => setActiveTab('neglected')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'neglected' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock size={16} className="inline mr-2" />
          Neglected ({neglectedAffiliates.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'all' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users size={16} className="inline mr-2" />
          All Affiliates ({totalAffiliates})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search affiliates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Action Needed Tab */}
      {activeTab === 'action' && (
        <div className="space-y-3">
          {actionNeeded.length === 0 ? (
            <div className="bg-green-50 rounded-2xl p-8 text-center border border-green-200">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-green-800 mb-2">All Caught Up!</h3>
              <p className="text-green-600">No affiliates need immediate follow-up.</p>
            </div>
          ) : (
            filterAffiliates(actionNeeded).map(affiliate => (
              <AffiliateCard
                key={affiliate.id}
                affiliate={affiliate}
                status={getFollowupStatus(affiliate)}
                viewMode={viewMode}
                getConsultantName={getConsultantName}
                expanded={expandedAffiliate === affiliate.id}
                followups={expandedAffiliate === affiliate.id ? followups : []}
                onExpand={() => {
                  if (expandedAffiliate === affiliate.id) {
                    setExpandedAffiliate(null);
                  } else {
                    setExpandedAffiliate(affiliate.id);
                    loadFollowups(affiliate.id);
                  }
                }}
                onLogFollowup={() => {
                  setSelectedAffiliate(affiliate);
                  setShowFollowupModal(true);
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Neglected Tab */}
      {activeTab === 'neglected' && (
        <div className="space-y-3">
          {neglectedAffiliates.length === 0 ? (
            <div className="bg-green-50 rounded-2xl p-8 text-center border border-green-200">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-green-800 mb-2">Great Job!</h3>
              <p className="text-green-600">No affiliates have been neglected for over 30 days.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-4">
                These affiliates haven't been contacted in over 30 days:
              </p>
              {filterAffiliates(neglectedAffiliates).map(affiliate => (
                <AffiliateCard
                  key={affiliate.id}
                  affiliate={affiliate}
                  status="neglected"
                  neglectedDays={getNeglectedDays(affiliate)}
                  viewMode={viewMode}
                  getConsultantName={getConsultantName}
                  expanded={expandedAffiliate === affiliate.id}
                  followups={expandedAffiliate === affiliate.id ? followups : []}
                  onExpand={() => {
                    if (expandedAffiliate === affiliate.id) {
                      setExpandedAffiliate(null);
                    } else {
                      setExpandedAffiliate(affiliate.id);
                      loadFollowups(affiliate.id);
                    }
                  }}
                  onLogFollowup={() => {
                    setSelectedAffiliate(affiliate);
                    setShowFollowupModal(true);
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* All Affiliates Tab */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {affiliates.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200">
              <Users size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Affiliates Yet</h3>
              <p className="text-slate-500">Affiliates will appear here once synced from Pipedrive.</p>
            </div>
          ) : (
            filterAffiliates(affiliates).map(affiliate => (
              <AffiliateCard
                key={affiliate.id}
                affiliate={affiliate}
                status={getFollowupStatus(affiliate)}
                viewMode={viewMode}
                getConsultantName={getConsultantName}
                expanded={expandedAffiliate === affiliate.id}
                followups={expandedAffiliate === affiliate.id ? followups : []}
                onExpand={() => {
                  if (expandedAffiliate === affiliate.id) {
                    setExpandedAffiliate(null);
                  } else {
                    setExpandedAffiliate(affiliate.id);
                    loadFollowups(affiliate.id);
                  }
                }}
                onLogFollowup={() => {
                  setSelectedAffiliate(affiliate);
                  setShowFollowupModal(true);
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Log Follow-up Modal */}
      {showFollowupModal && selectedAffiliate && (
        <FollowupModal
          affiliate={selectedAffiliate}
          onClose={() => { setShowFollowupModal(false); setSelectedAffiliate(null); }}
          onSave={logFollowup}
        />
      )}
    </div>
  );
}

// Affiliate Card Component
function AffiliateCard({ affiliate, status, neglectedDays, viewMode, getConsultantName, expanded, followups, onExpand, onLogFollowup }) {
  const getStatusBadge = () => {
    switch (status) {
      case 'critical':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertTriangle size={12} /> 2+ Weeks Overdue
        </span>;
      case 'overdue':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock size={12} /> Overdue
        </span>;
      case 'due_today':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock size={12} /> Due Today
        </span>;
      case 'neglected':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
          {neglectedDays} days since contact
        </span>;
      case 'upcoming':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          Due Soon
        </span>;
      default:
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <CheckCircle size={12} className="inline mr-1" /> On Track
        </span>;
    }
  };

  const statusBorderColor = {
    critical: 'border-red-300 bg-red-50',
    overdue: 'border-orange-200',
    due_today: 'border-amber-200',
    neglected: 'border-purple-200',
    upcoming: 'border-blue-200',
    ok: 'border-slate-200',
    none: 'border-slate-200'
  };

  return (
    <div className={`bg-white rounded-xl border transition-all ${statusBorderColor[status] || 'border-slate-200'}`}>
      <div className="p-4 flex items-center gap-4">
        {/* Type Icon */}
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
          {AFFILIATE_TYPES[affiliate.type]?.icon || '👤'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-800">{affiliate.organization_name || affiliate.name}</h3>
            {affiliate.classification === 'affiliate' && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">💰 Paid</span>
            )}
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
            {affiliate.name && affiliate.organization_name && <span>{affiliate.name}</span>}
            <span>{AFFILIATE_TYPES[affiliate.type]?.name || 'Other'}</span>
            {viewMode === 'team' && (
              <span className="text-blue-600">• {getConsultantName(affiliate.consultant_id)}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6 text-center">
          <div>
            <p className="text-lg font-semibold text-slate-800">{affiliate.leads_count || 0}</p>
            <p className="text-xs text-slate-500">Leads</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-green-600">{affiliate.sold_count || 0}</p>
            <p className="text-xs text-slate-500">Sold</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onLogFollowup(); }}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"
          >
            <CheckCircle size={14} /> Log Follow-up
          </button>
          <button
            onClick={onExpand}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 bg-slate-50">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Contact Info */}
            <div>
              <h4 className="font-medium text-slate-700 mb-3">Contact Information</h4>
              <div className="space-y-2 text-sm">
                {affiliate.email && (
                  <a href={`mailto:${affiliate.email}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Mail size={14} /> {affiliate.email}
                  </a>
                )}
                {affiliate.phone && (
                  <a href={`tel:${affiliate.phone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Phone size={14} /> {affiliate.phone}
                  </a>
                )}
                <p className="flex items-center gap-2 text-slate-600">
                  <Calendar size={14} /> Acquired: {affiliate.acquired_date ? format(parseISO(affiliate.acquired_date), 'MMM d, yyyy') : 'N/A'}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Clock size={14} /> Stage: {affiliate.followup_stage?.replace('_', ' ').toUpperCase() || 'Day 1'}
                </p>
                {affiliate.next_followup_date && (
                  <p className="flex items-center gap-2 text-slate-600">
                    <ArrowRight size={14} /> Next: {format(parseISO(affiliate.next_followup_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>

            {/* Follow-up History */}
            <div>
              <h4 className="font-medium text-slate-700 mb-3">Recent Follow-ups</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {followups.length > 0 ? (
                  followups.map(f => (
                    <div key={f.id} className="flex items-start gap-2 text-sm bg-white p-2 rounded-lg">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        {f.followup_type === 'call' && <PhoneCall size={12} className="text-blue-600" />}
                        {f.followup_type === 'email' && <Mail size={12} className="text-blue-600" />}
                        {f.followup_type === 'text' && <MessageSquare size={12} className="text-blue-600" />}
                        {f.followup_type === 'meeting' && <Video size={12} className="text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 truncate">{f.notes || 'Follow-up logged'}</p>
                        <p className="text-xs text-slate-500">
                          {format(parseISO(f.followup_date), 'MMM d, yyyy')} • {f.outcome || f.followup_type}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No follow-ups recorded yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Follow-up Modal
function FollowupModal({ affiliate, onClose, onSave }) {
  const [followupType, setFollowupType] = useState('call');
  const [outcome, setOutcome] = useState('connected');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      followup_type: followupType,
      outcome,
      notes
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Log Follow-up</h2>
            <p className="text-sm text-slate-500">{affiliate.organization_name || affiliate.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">How did you reach out?</label>
            <div className="grid grid-cols-4 gap-2">
              {FOLLOWUP_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFollowupType(t.id)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      followupType === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={20} className={`mx-auto ${followupType === t.id ? 'text-blue-600' : 'text-slate-400'}`} />
                    <p className="text-xs mt-1">{t.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="connected">Connected / Spoke</option>
              <option value="voicemail">Left Voicemail</option>
              <option value="no_answer">No Answer</option>
              <option value="scheduled_meeting">Scheduled Meeting</option>
              <option value="sent_info">Sent Information</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="What did you discuss?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <CheckCircle size={16} className="inline mr-2" /> Log Follow-up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
