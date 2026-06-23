import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Star, Plus, Upload, Calendar, Search, Check, X, 
  ChevronLeft, ChevronRight, Trophy, Users, Image,
  Filter, Download, UserPlus, MapPin, Table2, TrendingUp
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns';

// GMB Locations for manual review entry
const GMB_LOCATIONS = [
  { name: 'ASAP Credit Repair Detroit', city: 'Detroit', state: 'MI' },
  { name: 'ASAP Credit Repair Houston', city: 'Houston', state: 'TX' },
  { name: 'ASAP Credit Repair San Antonio', city: 'San Antonio', state: 'TX' },
  { name: 'ASAP Credit Repair El Paso', city: 'El Paso', state: 'TX' },
  { name: 'ASAP Credit Repair Albuquerque', city: 'Albuquerque', state: 'NM' },
  { name: 'ASAP Credit Repair Fort Myers', city: 'Fort Myers', state: 'FL' },
  { name: 'ASAP Credit Repair San Jose', city: 'San Jose', state: 'CA' },
  { name: 'ASAP Credit Repair & Financial Education Columbus', city: 'Columbus', state: 'OH' },
  { name: 'ASAP Credit Repair Birmingham', city: 'Birmingham', state: 'AL' },
  { name: 'ASAP Credit Repair Phoenix', city: 'Phoenix', state: 'AZ' },
  { name: 'ASAP Credit Repair Victoria', city: 'Victoria', state: 'TX' },
  { name: 'ASAP Credit Repair Lafayette', city: 'Lafayette', state: 'LA' },
  { name: 'ASAP Credit Repair Fort Washington', city: 'Fort Washington', state: 'MD' },
  { name: 'ASAP Credit Repair Tyler', city: 'Tyler', state: 'TX' },
  { name: 'ASAP Credit Repair Laurel', city: 'Laurel', state: 'MD' },
  { name: 'ASAP Credit Repair West Valley Utah', city: 'West Valley', state: 'UT' },
  { name: 'ASAP Credit Repair McAllen', city: 'McAllen', state: 'TX' },
];

function Reviews() {
  const { currentUser, users, supabaseFetch, supabasePost, supabaseDelete } = useApp();
  const [reviews, setReviews] = useState([]);
  const [allReviews, setAllReviews] = useState([]); // For table stats
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('my'); // my, team
  const [teamStats, setTeamStats] = useState([]);
  const [assignToUser, setAssignToUser] = useState(''); // For leadership assignment
  const [tableTimeframe, setTableTimeframe] = useState('month'); // month, quarter, year
  const [employeeStats, setEmployeeStats] = useState([]);

  // Check if user is leadership/admin
  const isLeadership = currentUser?.department === 'leadership' || currentUser?.role === 'admin';

  const [formData, setFormData] = useState({
    platform: 'google',
    client_name: '',
    review_date: format(new Date(), 'yyyy-MM-dd'),
    proof_url: '',
    notes: '',
    uploadMethod: 'file',
    imagePreview: '',
    location_name: '', // Added for GMB location tracking
    rating: 5, // Star rating - only 5-star counts toward goals
    pipedrive_deal_id: '', // Pipedrive deal id, required on manual entry
  });

  const PLATFORMS = [
    { id: 'google', name: 'Google', color: 'blue' },
    { id: 'yelp', name: 'Yelp', color: 'red' },
    { id: 'facebook', name: 'Facebook', color: 'indigo' },
    { id: 'bbb', name: 'BBB', color: 'green' },
    { id: 'trustpilot', name: 'Trustpilot', color: 'emerald' },
    { id: 'other', name: 'Other', color: 'slate' },
  ];

  useEffect(() => {
    if (currentUser) {
      loadAllReviewData();
    }
  }, [currentUser]);

  // Recalculate when filters change (no API call needed)
  useEffect(() => {
    if (allReviews.length > 0) {
      filterReviewsForDisplay();
      calculateEmployeeStats();
    }
  }, [allReviews, selectedMonth, viewMode, tableTimeframe]);

  const loadAllReviewData = async () => {
    setLoading(true);
    try {
      // Get all reviews for the year in ONE call
      const yearStart = format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd');
      const query = `select=*&review_date=gte.${yearStart}&order=review_date.desc`;
      const data = await supabaseFetch('reviews', query);
      
      const reviewsArray = Array.isArray(data) ? data : [];
      
      // Add user info
      const reviewsWithUsers = reviewsArray.map(review => {
        const user = users.find(u => u.id === review.user_id);
        return {
          ...review,
          users: user ? { name: user.name, avatar: user.avatar } : null
        };
      });
      
      setAllReviews(reviewsWithUsers);
    } catch (error) {
      console.error('Error loading reviews:', error);
      setAllReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const filterReviewsForDisplay = () => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    // Filter for selected month
    let filtered = allReviews.filter(r => {
      const reviewDate = new Date(r.review_date);
      return reviewDate >= monthStart && reviewDate <= monthEnd;
    });
    
    // Filter for view mode
    if (viewMode === 'my') {
      filtered = filtered.filter(r => r.user_id === currentUser.id);
    }
    
    setReviews(filtered);
    
    // Calculate team stats from month data
    calculateTeamStats(allReviews.filter(r => {
      const reviewDate = new Date(r.review_date);
      return reviewDate >= monthStart && reviewDate <= monthEnd;
    }));
  };

  const loadReviews = async () => {
    // Now handled by loadAllReviewData
  };

  const calculateTeamStats = (data) => {
    if (!Array.isArray(data)) {
      setTeamStats([]);
      return;
    }
    
    // Calculate stats per user
    const statsMap = {};
    data.forEach(review => {
      const userId = review.user_id;
      if (!statsMap[userId]) {
        const user = users.find(u => u.id === userId);
        statsMap[userId] = {
          user: user ? { id: user.id, name: user.name, avatar: user.avatar } : { id: userId, name: 'Unknown', avatar: null },
          count: 0,
          fiveStarCount: 0,
          verified: 0,
        };
      }
      statsMap[userId].count++;
      // Only count 5-star reviews toward goals
      if (review.rating === 5 || review.rating === null) {
        statsMap[userId].fiveStarCount++;
      }
      if (review.verified) statsMap[userId].verified++;
    });
    
    // Convert to array and sort by 5-star count
    const statsArray = Object.values(statsMap).sort((a, b) => b.fiveStarCount - a.fiveStarCount);
    setTeamStats(statsArray);
  };

  // Remove separate loadTeamStats - now calculated from same data
  const loadTeamStats = () => {
    // Stats are now calculated in filterReviewsForDisplay
  };

  const calculateEmployeeStats = () => {
    const now = new Date();
    
    // Calculate stats per employee from already loaded data
    const statsMap = {};
    
    // Initialize all users
    users.forEach(user => {
      if (user.role !== 'admin' || user.department !== 'leadership') {
        statsMap[user.id] = {
          user,
          thisMonth: 0,
          thisMonthFiveStar: 0,
          thisQuarter: 0,
          thisQuarterFiveStar: 0,
          thisYear: 0,
          thisYearFiveStar: 0,
          avgPerMonth: 0,
        };
      }
    });
    
    // Count reviews per timeframe
    const monthStart = startOfMonth(now);
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    
    allReviews.forEach(review => {
      const userId = review.user_id;
      if (!statsMap[userId]) return;
      
      const reviewDate = new Date(review.review_date);
      const isFiveStar = review.rating === 5 || review.rating === null;
      
      // This month
      if (reviewDate >= monthStart) {
        statsMap[userId].thisMonth++;
        if (isFiveStar) statsMap[userId].thisMonthFiveStar++;
      }
      
      // This quarter
      if (reviewDate >= quarterStart) {
        statsMap[userId].thisQuarter++;
        if (isFiveStar) statsMap[userId].thisQuarterFiveStar++;
      }
      
      // This year
      if (reviewDate >= yearStart) {
        statsMap[userId].thisYear++;
        if (isFiveStar) statsMap[userId].thisYearFiveStar++;
      }
    });
    
    // Calculate average per month
    const monthsInYear = now.getMonth() + 1;
    Object.values(statsMap).forEach(stat => {
      stat.avgPerMonth = (stat.thisYear / monthsInYear).toFixed(1);
    });
    
    // Sort by current timeframe's 5-star count
    const sortKey = tableTimeframe === 'month' ? 'thisMonthFiveStar' : 
                    tableTimeframe === 'quarter' ? 'thisQuarterFiveStar' : 'thisYearFiveStar';
    const statsArray = Object.values(statsMap).sort((a, b) => b[sortKey] - a[sortKey]);
    
    setEmployeeStats(statsArray);
  };

  // Keep for compatibility but not used
  const loadEmployeeStats = async () => {
    // Now handled by calculateEmployeeStats
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Pipedrive deal id is required on a manually added review so it can be tied to the client file.
      const dealId = (formData.pipedrive_deal_id || '').trim();
      if (!/^\d+$/.test(dealId)) {
        alert('A numeric Pipedrive deal ID is required to add a review.');
        return;
      }

      // Use assigned user if leadership selected one, otherwise current user
      const targetUserId = isLeadership && assignToUser ? assignToUser : currentUser.id;
      
      // Only send necessary fields to database
      const reviewData = {
        platform: formData.platform,
        client_name: formData.client_name,
        review_date: formData.review_date,
        proof_url: formData.proof_url,
        notes: formData.notes,
        user_id: targetUserId,
        location_name: formData.location_name || null, // GMB location
        rating: formData.rating, // Star rating
        pipedrive_deal_id: dealId,
      };
      
      const result = await supabasePost('reviews', reviewData);
      
      // Check for errors
      if (result && result.error) {
        console.error('Error adding review:', result);
        alert('Error adding review: ' + (result.message || result.error || 'Unknown error'));
        return;
      }
      
      console.log('Review added:', result);
      
      setShowAddModal(false);
      setFormData({
        platform: 'google',
        client_name: '',
        review_date: format(new Date(), 'yyyy-MM-dd'),
        proof_url: '',
        notes: '',
        uploadMethod: 'file',
        imagePreview: '',
        location_name: '',
        rating: 5,
        pipedrive_deal_id: '',
      });
      setAssignToUser(''); // Reset assignment
      loadReviews();
      loadTeamStats();
    } catch (error) {
      console.error('Error adding review:', error);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!confirm('Delete this review?')) return;
    try {
      await supabaseDelete('reviews', `id=eq.${reviewId}`);
      loadReviews();
      loadTeamStats();
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };

  // Only count 5-star reviews toward goals
  const myReviewCount = Array.isArray(reviews) ? reviews.filter(r => r.user_id === currentUser?.id && (r.rating === 5 || r.rating === null)).length : 0;
  const myTotalReviews = Array.isArray(reviews) ? reviews.filter(r => r.user_id === currentUser?.id).length : 0;
  const myRank = Array.isArray(teamStats) ? teamStats.findIndex(s => s.user?.id === currentUser?.id) + 1 : 0;

  const filteredReviews = Array.isArray(reviews) ? reviews.filter(r => {
    if (!searchTerm) return true;
    return r.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           r.platform?.toLowerCase().includes(searchTerm.toLowerCase());
  }) : [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Star className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Reviews Tracker</h1>
            <p className="text-slate-500 text-sm">Track and manage customer reviews</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-asap-blue text-white px-4 py-2 rounded-lg hover:bg-asap-blue-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Review
        </button>
      </div>

      {/* Employee Stats Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 size={18} className="text-asap-blue" />
            <h2 className="font-semibold text-slate-800">Team Review Stats</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={tableTimeframe}
              onChange={(e) => setTableTimeframe(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-asap-blue"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Employee</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">
                  {tableTimeframe === 'month' ? 'This Month' : tableTimeframe === 'quarter' ? 'This Quarter' : 'This Year'}
                </th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">5-Star ⭐</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Avg/Month</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Goal Progress</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats.map((stat, idx) => {
                const currentCount = tableTimeframe === 'month' ? stat.thisMonthFiveStar : 
                                     tableTimeframe === 'quarter' ? stat.thisQuarterFiveStar : stat.thisYearFiveStar;
                const totalCount = tableTimeframe === 'month' ? stat.thisMonth : 
                                   tableTimeframe === 'quarter' ? stat.thisQuarter : stat.thisYear;
                const goalProgress = Math.min((stat.thisMonthFiveStar / 10) * 100, 100);
                const isGoalMet = stat.thisMonthFiveStar >= 10;
                
                return (
                  <tr key={stat.user.id} className={`border-b border-slate-50 hover:bg-slate-50 ${idx === 0 ? 'bg-yellow-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {idx === 0 && <Trophy size={16} className="text-yellow-500" />}
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                          {stat.user.avatar || stat.user.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{stat.user.name}</p>
                          <p className="text-xs text-slate-400">{stat.user.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="font-semibold text-slate-700">{totalCount}</span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="font-semibold text-yellow-600">{currentCount}</span>
                      {totalCount > currentCount && (
                        <span className="text-xs text-slate-400 ml-1">({totalCount - currentCount} other)</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp size={14} className="text-slate-400" />
                        <span className="text-slate-600">{stat.avgPerMonth}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isGoalMet ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${goalProgress}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${isGoalMet ? 'text-green-600' : 'text-slate-500'}`}>
                          {stat.thisMonthFiveStar}/10
                        </span>
                        {isGoalMet && <Check size={14} className="text-green-500" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {employeeStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    No review data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">5-Star Reviews (Goal: 10)</p>
              <p className="text-3xl font-bold text-slate-800">
                {myReviewCount}
                <span className="text-lg text-slate-400">/10</span>
              </p>
              {myTotalReviews > myReviewCount && (
                <p className="text-xs text-amber-600 mt-1">
                  +{myTotalReviews - myReviewCount} non-5-star (don't count)
                </p>
              )}
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              myReviewCount >= 10 ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <Star className={`w-6 h-6 ${myReviewCount >= 10 ? 'text-green-600' : 'text-yellow-600'}`} />
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                myReviewCount >= 10 ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min((myReviewCount / 10) * 100, 100)}%` }}
            />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Team Rank</p>
              <p className="text-3xl font-bold text-slate-800">
                {myRank > 0 ? `#${myRank}` : '-'}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Team Total</p>
              <p className="text-3xl font-bold text-slate-800">{reviews.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Month Navigation & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg min-w-[180px] justify-center">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="font-medium">{format(selectedMonth, 'MMMM yyyy')}</span>
            </div>
            <button
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asap-blue"
              />
            </div>
            
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => { setViewMode('my'); loadReviews(); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'my' ? 'bg-white shadow text-asap-blue' : 'text-slate-600'
                }`}
              >
                My Reviews
              </button>
              <button
                onClick={() => { setViewMode('team'); loadReviews(); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'team' ? 'bg-white shadow text-asap-blue' : 'text-slate-600'
                }`}
              >
                Team View
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reviews List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">
                {viewMode === 'my' ? 'My Reviews' : 'All Team Reviews'}
              </h3>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Star className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No reviews found for {format(selectedMonth, 'MMMM yyyy')}</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-asap-blue hover:underline"
                >
                  Add your first review
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredReviews.map(review => {
                  const platform = PLATFORMS.find(p => p.id === review.platform) || PLATFORMS[5];
                  return (
                    <div key={review.id} className="p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {review.proof_url ? (
                            <a 
                              href={review.proof_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0"
                            >
                              <img 
                                src={review.proof_url} 
                                alt="Proof" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full items-center justify-center hidden">
                                <Image className="w-6 h-6 text-slate-400" />
                              </div>
                            </a>
                          ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Image className="w-6 h-6 text-slate-300" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded bg-${platform.color}-100 text-${platform.color}-700`}>
                                {platform.name}
                              </span>
                              {review.verified && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Verified
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-slate-800">
                              {review.client_name || 'Anonymous'}
                            </p>
                            <p className="text-sm text-slate-500">
                              {format(parseISO(review.review_date), 'MMM d, yyyy')}
                              {viewMode === 'team' && review.users && (
                                <span className="ml-2">• by {review.users.name}</span>
                              )}
                            </p>
                            {review.notes && (
                              <p className="text-sm text-slate-600 mt-1">{review.notes}</p>
                            )}
                          </div>
                        </div>
                        {review.user_id === currentUser?.id && (
                          <button
                            onClick={() => handleDelete(review.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Team Leaderboard */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-yellow-50">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-800">Leaderboard</h3>
              </div>
              <p className="text-sm text-slate-500">{format(selectedMonth, 'MMMM yyyy')}</p>
            </div>
            
            {teamStats.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Trophy className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No reviews yet this month</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {teamStats.map((stat, index) => (
                  <div 
                    key={stat.user?.id || index} 
                    className={`p-4 flex items-center gap-3 ${
                      stat.user?.id === currentUser?.id ? 'bg-asap-blue/5' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-slate-300 text-slate-700' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">
                        {stat.user?.name || 'Unknown'}
                        {stat.user?.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-asap-blue">(You)</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-slate-800">{stat.count}</p>
                      <p className="text-xs text-slate-500">reviews</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Review Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">Add Review</h2>
              <p className="text-sm text-slate-500">Log a customer review with proof</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Platform *</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                    required
                  >
                    {PLATFORMS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.review_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, review_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                    required
                  />
                </div>
              </div>
              
              {/* Location selector - only show for Google reviews */}
              {formData.platform === 'google' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <MapPin size={14} className="inline mr-1" />
                    GMB Location *
                  </label>
                  <select
                    value={formData.location_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, location_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                    required={formData.platform === 'google'}
                  >
                    <option value="">Select location...</option>
                    {GMB_LOCATIONS.map(loc => (
                      <option key={loc.name} value={loc.name}>
                        {loc.city}, {loc.state}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Select which Google location received this review
                  </p>
                </div>
              )}
              
              {/* Star Rating */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Star Rating *</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                      className={`p-2 rounded-lg transition-colors ${
                        star <= formData.rating 
                          ? 'bg-yellow-100 text-yellow-500' 
                          : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Star size={24} className={star <= formData.rating ? 'fill-yellow-400' : ''} />
                    </button>
                  ))}
                </div>
                {formData.rating < 5 && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Only 5-star reviews count toward your monthly goal of 10
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Name (optional)</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  placeholder="e.g., John D."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pipedrive Deal ID *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.pipedrive_deal_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, pipedrive_deal_id: e.target.value.replace(/[^\d]/g, '') }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  placeholder="e.g., 12345"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">The deal this review ties back to on the client file. Numbers only.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proof Image *</label>
                
                {/* Tab selection for upload method */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, uploadMethod: 'file' }))}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                      formData.uploadMethod !== 'url' 
                        ? 'bg-asap-blue text-white border-asap-blue' 
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    📁 Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, uploadMethod: 'url' }))}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                      formData.uploadMethod === 'url' 
                        ? 'bg-asap-blue text-white border-asap-blue' 
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    🔗 Paste URL
                  </button>
                </div>

                {formData.uploadMethod === 'url' ? (
                  <>
                    <input
                      type="url"
                      value={formData.proof_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, proof_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                      placeholder="https://..."
                      required={formData.uploadMethod === 'url'}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Paste a link from Imgur, Google Drive (public), or any image host
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('Image must be less than 5MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData(prev => ({ 
                              ...prev, 
                              proof_url: reader.result,
                              imagePreview: reader.result 
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-asap-blue/10 file:text-asap-blue hover:file:bg-asap-blue/20"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Upload a screenshot (PNG, JPG - max 5MB)
                    </p>
                  </>
                )}
                
                {/* Image Preview */}
                {(formData.proof_url || formData.imagePreview) && (
                  <div className="mt-3 relative">
                    <img 
                      src={formData.imagePreview || formData.proof_url} 
                      alt="Preview" 
                      className="w-full max-h-48 object-contain rounded-lg border"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, proof_url: '', imagePreview: '' }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>
              
              {/* Leadership: Assign to team member */}
              {isLeadership && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Assign to Team Member
                  </label>
                  <select
                    value={assignToUser}
                    onChange={(e) => setAssignToUser(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">Myself ({currentUser?.name})</option>
                    {Array.isArray(users) && users
                      .filter(u => u.id !== currentUser?.id)
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))
                    }
                  </select>
                  <p className="text-xs text-amber-600 mt-1">
                    As leadership, you can add reviews on behalf of team members
                  </p>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark"
                >
                  Add Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reviews;
