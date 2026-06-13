import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import {
  ClipboardList,
  Star,
  TrendingUp,
  Users,
  Filter,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Search,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function AdminSurveys() {
  const { users } = useApp();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterConsultant, setFilterConsultant] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSurvey, setExpandedSurvey] = useState(null);
  const [dateRange, setDateRange] = useState('all');

  // Load surveys
  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/client_surveys?select=*&order=submitted_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSurveys(data || []);
      }
    } catch (error) {
      console.error('Error loading surveys:', error);
    }
    setLoading(false);
  };

  // Filter surveys
  const filteredSurveys = surveys.filter(survey => {
    if (filterType !== 'all' && survey.survey_type !== filterType) return false;
    if (filterConsultant !== 'all' && survey.consultant_id !== filterConsultant) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!survey.client_name?.toLowerCase().includes(query) &&
          !survey.client_email?.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (dateRange !== 'all') {
      const surveyDate = new Date(survey.submitted_at);
      const now = new Date();
      if (dateRange === '7days' && (now - surveyDate) > 7 * 24 * 60 * 60 * 1000) return false;
      if (dateRange === '30days' && (now - surveyDate) > 30 * 24 * 60 * 60 * 1000) return false;
      if (dateRange === '90days' && (now - surveyDate) > 90 * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  // Calculate stats
  const stats = {
    total: filteredSurveys.length,
    enrollment: filteredSurveys.filter(s => s.survey_type === 'enrollment').length,
    completion: filteredSurveys.filter(s => s.survey_type === 'completion').length,
    avgNPS: filteredSurveys.filter(s => s.nps_score != null).length > 0
      ? (filteredSurveys.reduce((acc, s) => acc + (s.nps_score || 0), 0) / 
         filteredSurveys.filter(s => s.nps_score != null).length).toFixed(1)
      : 'N/A',
    avgConsultantRating: filteredSurveys.filter(s => s.consultant_rating != null).length > 0
      ? (filteredSurveys.reduce((acc, s) => acc + (s.consultant_rating || 0), 0) / 
         filteredSurveys.filter(s => s.consultant_rating != null).length).toFixed(1)
      : 'N/A',
    avgSatisfaction: filteredSurveys.filter(s => s.overall_satisfaction != null).length > 0
      ? (filteredSurveys.reduce((acc, s) => acc + (s.overall_satisfaction || 0), 0) / 
         filteredSurveys.filter(s => s.overall_satisfaction != null).length).toFixed(1)
      : 'N/A',
  };

  // NPS breakdown
  const npsBreakdown = {
    promoters: filteredSurveys.filter(s => s.nps_score >= 9).length,
    passives: filteredSurveys.filter(s => s.nps_score >= 7 && s.nps_score <= 8).length,
    detractors: filteredSurveys.filter(s => s.nps_score <= 6 && s.nps_score != null).length,
  };
  const npsScore = filteredSurveys.filter(s => s.nps_score != null).length > 0
    ? Math.round(((npsBreakdown.promoters - npsBreakdown.detractors) / 
        filteredSurveys.filter(s => s.nps_score != null).length) * 100)
    : 'N/A';

  const getConsultantName = (consultantId) => {
    const user = users.find(u => u.id === consultantId);
    return user?.name || 'Unknown';
  };

  const renderStars = (rating, max = 5) => {
    if (!rating) return <span className="text-slate-400">N/A</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(max)].map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
          />
        ))}
        <span className="ml-1 text-sm text-slate-600">{rating}/{max}</span>
      </div>
    );
  };

  const getNPSColor = (score) => {
    if (score >= 9) return 'text-green-600 bg-green-50';
    if (score >= 7) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Client Name', 'Client Email', 'Consultant', 'NPS Score', 'Consultant Rating', 'Satisfaction', 'Comments'];
    const rows = filteredSurveys.map(s => [
      format(new Date(s.submitted_at), 'yyyy-MM-dd'),
      s.survey_type,
      s.client_name,
      s.client_email,
      s.consultant_name || getConsultantName(s.consultant_id),
      s.nps_score || '',
      s.consultant_rating || '',
      s.overall_satisfaction || '',
      (s.additional_comments || s.what_could_improve || '').replace(/,/g, ';'),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `surveys-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Survey Results</h1>
          <p className="text-slate-500">View and analyze client feedback from enrollment and completion surveys</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={loadSurveys}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={18} className="text-blue-500" />
            <span className="text-sm text-slate-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-purple-500" />
            <span className="text-sm text-slate-500">Enrollment</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats.enrollment}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <ThumbsUp size={18} className="text-green-500" />
            <span className="text-sm text-slate-500">Completion</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completion}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-amber-500" />
            <span className="text-sm text-slate-500">Avg NPS</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.avgNPS}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Star size={18} className="text-amber-400" />
            <span className="text-sm text-slate-500">Consultant Avg</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.avgConsultantRating}/10</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <ThumbsUp size={18} className="text-blue-500" />
            <span className="text-sm text-slate-500">Satisfaction</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.avgSatisfaction}/5</p>
        </div>
      </div>

      {/* NPS Breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <h3 className="font-semibold text-slate-800 mb-4">Net Promoter Score (NPS)</h3>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600">{npsScore}</p>
            <p className="text-sm text-slate-500">NPS Score</p>
          </div>
          <div className="flex-1 flex gap-4">
            <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{npsBreakdown.promoters}</p>
              <p className="text-xs text-green-700">Promoters (9-10)</p>
            </div>
            <div className="flex-1 bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{npsBreakdown.passives}</p>
              <p className="text-xs text-amber-700">Passives (7-8)</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{npsBreakdown.detractors}</p>
              <p className="text-xs text-red-700">Detractors (0-6)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by client name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="enrollment">Enrollment</option>
            <option value="completion">Completion</option>
          </select>
          
          <select
            value={filterConsultant}
            onChange={(e) => setFilterConsultant(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Consultants</option>
            {users.filter(u => u.department === 'credit_consultants').map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Survey List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw size={32} className="mx-auto mb-4 animate-spin text-slate-300" />
            <p>Loading surveys...</p>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ClipboardList size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="font-medium">No surveys found</p>
            <p className="text-sm">Adjust your filters or wait for new submissions</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSurveys.map(survey => (
              <div key={survey.id} className="hover:bg-slate-50 transition-colors">
                {/* Survey Row */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedSurvey(expandedSurvey === survey.id ? null : survey.id)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    survey.survey_type === 'enrollment' ? 'bg-purple-100' : 'bg-green-100'
                  }`}>
                    {survey.survey_type === 'enrollment' ? (
                      <Users size={20} className="text-purple-600" />
                    ) : (
                      <ThumbsUp size={20} className="text-green-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 truncate">{survey.client_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        survey.survey_type === 'enrollment' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {survey.survey_type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{survey.client_email}</p>
                  </div>
                  
                  {survey.nps_score != null && (
                    <div className={`px-3 py-1 rounded-lg font-semibold ${getNPSColor(survey.nps_score)}`}>
                      NPS: {survey.nps_score}
                    </div>
                  )}
                  
                  {survey.consultant_rating && (
                    <div className="hidden md:flex items-center gap-1 text-amber-500">
                      <Star size={16} className="fill-amber-400" />
                      <span className="font-medium">{survey.consultant_rating}/10</span>
                    </div>
                  )}
                  
                  <div className="text-sm text-slate-500 hidden lg:block">
                    {format(new Date(survey.submitted_at), 'MMM d, yyyy')}
                  </div>
                  
                  {expandedSurvey === survey.id ? (
                    <ChevronUp size={20} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                  )}
                </div>
                
                {/* Expanded Details */}
                {expandedSurvey === survey.id && (
                  <div className="px-4 pb-4 pt-0 bg-slate-50 border-t border-slate-100">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                      {/* Contact Info */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">Contact Info</h4>
                        <div className="space-y-2 text-sm">
                          <p><span className="text-slate-500">Name:</span> {survey.client_name}</p>
                          <p><span className="text-slate-500">Email:</span> {survey.client_email}</p>
                          {survey.client_phone && (
                            <p><span className="text-slate-500">Phone:</span> {survey.client_phone}</p>
                          )}
                          <p><span className="text-slate-500">Submitted:</span> {format(new Date(survey.submitted_at), 'PPp')}</p>
                        </div>
                      </div>
                      
                      {/* Ratings */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">Ratings</h4>
                        <div className="space-y-3">
                          {survey.consultant_id && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Consultant</p>
                              <p className="font-medium">{survey.consultant_name || getConsultantName(survey.consultant_id)}</p>
                            </div>
                          )}
                          {survey.initial_impression && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Initial Impression</p>
                              {renderStars(survey.initial_impression)}
                            </div>
                          )}
                          {survey.consultant_rating && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Consultant Rating</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-amber-400 rounded-full"
                                    style={{ width: `${survey.consultant_rating * 10}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{survey.consultant_rating}/10</span>
                              </div>
                            </div>
                          )}
                          {survey.consultant_explanation_quality && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Explanation Quality</p>
                              {renderStars(survey.consultant_explanation_quality)}
                            </div>
                          )}
                          {survey.overall_satisfaction && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Overall Satisfaction</p>
                              {renderStars(survey.overall_satisfaction)}
                            </div>
                          )}
                          {survey.process_explained_clearly !== null && (
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">Process Explained Clearly:</p>
                              {survey.process_explained_clearly ? (
                                <ThumbsUp size={16} className="text-green-500" />
                              ) : (
                                <ThumbsDown size={16} className="text-red-500" />
                              )}
                            </div>
                          )}
                          {survey.met_expectations !== null && (
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">Met Expectations:</p>
                              {survey.met_expectations ? (
                                <ThumbsUp size={16} className="text-green-500" />
                              ) : (
                                <ThumbsDown size={16} className="text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Comments */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200 md:col-span-2 lg:col-span-1">
                        <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                          <MessageSquare size={16} />
                          Comments
                        </h4>
                        {survey.what_could_improve && (
                          <div className="mb-3">
                            <p className="text-xs text-slate-500 mb-1">What Could Improve</p>
                            <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{survey.what_could_improve}</p>
                          </div>
                        )}
                        {survey.additional_comments && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Additional Comments</p>
                            <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{survey.additional_comments}</p>
                          </div>
                        )}
                        {!survey.what_could_improve && !survey.additional_comments && (
                          <p className="text-sm text-slate-400 italic">No comments provided</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSurveys;
