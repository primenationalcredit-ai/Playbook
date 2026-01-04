import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Star, Plus, Upload, Calendar, Search, Check, X, 
  ChevronLeft, ChevronRight, Trophy, Users, Image,
  Filter, Download, UserPlus
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns';

function Reviews() {
  const { currentUser, users, supabaseFetch, supabasePost, supabaseDelete } = useApp();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('my'); // my, team
  const [teamStats, setTeamStats] = useState([]);
  const [assignToUser, setAssignToUser] = useState(''); // For leadership assignment

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
      loadReviews();
      loadTeamStats();
    }
  }, [currentUser, selectedMonth, viewMode]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      console.log('Loading reviews for:', monthStart, 'to', monthEnd, 'viewMode:', viewMode);
      
      // Simpler query first - just get reviews without join
      let query = `select=*&review_date=gte.${monthStart}&review_date=lte.${monthEnd}&order=review_date.desc`;
      
      if (viewMode === 'my') {
        query += `&user_id=eq.${currentUser.id}`;
      }
      
      console.log('Reviews query:', query);
      const data = await supabaseFetch('reviews', query);
      console.log('Reviews loaded:', data);
      
      // Ensure we always have an array
      const reviewsArray = Array.isArray(data) ? data : [];
      
      // Add user info from users array
      const reviewsWithUsers = reviewsArray.map(review => {
        const user = users.find(u => u.id === review.user_id);
        return {
          ...review,
          users: user ? { name: user.name, avatar: user.avatar } : null
        };
      });
      
      setReviews(reviewsWithUsers);
    } catch (error) {
      console.error('Error loading reviews:', error);
      setReviews([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadTeamStats = async () => {
    try {
      const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      // Get all reviews for the month (without join)
      const data = await supabaseFetch('reviews', 
        `select=*&review_date=gte.${monthStart}&review_date=lte.${monthEnd}`);
      
      console.log('Team stats data:', data);
      
      // Ensure data is an array before processing
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
            verified: 0,
          };
        }
        statsMap[userId].count++;
        if (review.verified) statsMap[userId].verified++;
      });
      
      // Convert to array and sort by count
      const statsArray = Object.values(statsMap).sort((a, b) => b.count - a.count);
      setTeamStats(statsArray);
    } catch (error) {
      console.error('Error loading team stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
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

  const myReviewCount = Array.isArray(reviews) ? reviews.filter(r => r.user_id === currentUser?.id).length : 0;
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">My Reviews This Month</p>
              <p className="text-3xl font-bold text-slate-800">{myReviewCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
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
