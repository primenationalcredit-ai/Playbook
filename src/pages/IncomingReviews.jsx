import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import {
  Star,
  Search,
  Filter,
  UserPlus,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  X,
  ExternalLink,
  Building2,
  Edit3,
  Trash2,
} from 'lucide-react';

// GMB Locations
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

function IncomingReviews() {
  const { currentUser, users, supabaseFetch, supabasePost } = useApp();
  
  const [reviews, setReviews] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [locationFilter, setLocationFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Assignment modal
  const [assigningReview, setAssigningReview] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  
  // Edit modal
  const [editingReview, setEditingReview] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [editLocation, setEditLocation] = useState('');

  useEffect(() => {
    loadData();
  }, [locationFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load ALL reviews (every status) so the Pending/Assigned/Completed counts are
      // always complete. The active tab filters the displayed list client-side.
      let query = 'select=*&order=created_at.desc';
      if (locationFilter !== 'all') {
        query += `&location_name=eq.${encodeURIComponent(locationFilter)}`;
      }
      
      const reviewsData = await supabaseFetch('incoming_reviews', query);
      console.log('Incoming reviews loaded:', reviewsData);
      
      if (reviewsData && !reviewsData.error) {
        setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      } else {
        throw new Error(reviewsData?.message || 'Failed to load reviews');
      }
      
      // Load locations (active only)
      const locationsData = await supabaseFetch('gmb_locations', 'select=*&is_active=eq.true&order=name');
      if (locationsData && Array.isArray(locationsData)) {
        setLocations(locationsData);
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Unable to load incoming reviews. Make sure the table exists in Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assigningReview || !selectedUser) return;
    
    try {
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/incoming_reviews?id=eq.${assigningReview.id}`;
      const updateData = {
        status: 'assigned',
        assigned_to: selectedUser,
        assigned_by: currentUser?.id,
        assigned_at: new Date().toISOString(),
      };
      
      // Include location if it was changed
      if (selectedLocation && selectedLocation !== assigningReview.location_name) {
        updateData.location_name = selectedLocation;
      }
      
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(updateData)
      });
      
      setAssigningReview(null);
      setSelectedUser('');
      setSelectedLocation('');
      loadData();
    } catch (err) {
      console.error('Error assigning review:', err);
      alert('Failed to assign review');
    }
  };

  const handleEditReview = async () => {
    if (!editingReview) return;
    
    try {
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/incoming_reviews?id=eq.${editingReview.id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          rating: editRating,
          location_name: editLocation,
        })
      });
      
      setEditingReview(null);
      loadData();
    } catch (err) {
      console.error('Error updating review:', err);
      alert('Failed to update review');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!confirm('Are you sure you want to delete this review? This cannot be undone.')) return;
    
    try {
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/incoming_reviews?id=eq.${reviewId}`;
      await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        },
      });
      
      loadData();
    } catch (err) {
      console.error('Error deleting review:', err);
      alert('Failed to delete review');
    }
  };

  const openEditModal = (review) => {
    setEditingReview(review);
    setEditRating(review.rating || 5);
    setEditLocation(review.location_name || '');
  };

  const handleMarkComplete = async (reviewId) => {
    try {
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/incoming_reviews?id=eq.${reviewId}`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'completed',
        })
      });
      
      loadData();
    } catch (err) {
      console.error('Error completing review:', err);
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const renderStars = (rating) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}
          />
        ))}
      </div>
    );
  };

  // Filter reviews by search
  const filteredReviews = reviews.filter(review => {
    if (statusFilter !== 'all' && review.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      review.reviewer_name?.toLowerCase().includes(query) ||
      review.review_text?.toLowerCase().includes(query) ||
      review.location_name?.toLowerCase().includes(query)
    );
  });

  // Stats
  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const assignedCount = reviews.filter(r => r.status === 'assigned').length;
  const completedCount = reviews.filter(r => r.status === 'completed').length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-asap-blue" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 text-amber-500" size={48} />
          <h2 className="text-lg font-semibold text-amber-800 mb-2">Incoming Reviews Not Available</h2>
          <p className="text-amber-600 mb-4">{error}</p>
          <p className="text-sm text-amber-600 mb-4">
            Run <code className="bg-amber-100 px-2 py-1 rounded">incoming-reviews-schema.sql</code> in Supabase to enable this feature.
          </p>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Incoming Reviews</h1>
          <p className="text-slate-500">Google reviews from all locations - assign to team members</p>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-xl border transition-colors ${
            statusFilter === 'pending' 
              ? 'bg-amber-50 border-amber-200' 
              : 'bg-white border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusFilter === 'pending' ? 'bg-amber-100' : 'bg-slate-100'}`}>
              <Clock size={20} className={statusFilter === 'pending' ? 'text-amber-600' : 'text-slate-600'} />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-slate-800">{pendingCount}</p>
              <p className="text-sm text-slate-500">Pending</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setStatusFilter('assigned')}
          className={`p-4 rounded-xl border transition-colors ${
            statusFilter === 'assigned' 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-white border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusFilter === 'assigned' ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <UserPlus size={20} className={statusFilter === 'assigned' ? 'text-blue-600' : 'text-slate-600'} />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-slate-800">{assignedCount}</p>
              <p className="text-sm text-slate-500">Assigned</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setStatusFilter('completed')}
          className={`p-4 rounded-xl border transition-colors ${
            statusFilter === 'completed' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-white border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusFilter === 'completed' ? 'bg-green-100' : 'bg-slate-100'}`}>
              <CheckCircle2 size={20} className={statusFilter === 'completed' ? 'text-green-600' : 'text-slate-600'} />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-slate-800">{completedCount}</p>
              <p className="text-sm text-slate-500">Completed</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-slate-400" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue"
            >
              <option value="all">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg border ${
              statusFilter === 'all' 
                ? 'bg-asap-blue text-white border-asap-blue' 
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Show All
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <Star size={48} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No Reviews Found</h3>
            <p className="text-slate-400">
              {statusFilter === 'pending' 
                ? 'No pending reviews to assign.' 
                : 'No reviews match your filters.'}
            </p>
          </div>
        ) : (
          filteredReviews.map(review => (
            <div 
              key={review.id} 
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                review.status === 'pending' ? 'border-amber-200' :
                review.status === 'assigned' ? 'border-blue-200' :
                'border-slate-100'
              }`}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    {review.profile_photo_url ? (
                      <img 
                        src={review.profile_photo_url} 
                        alt={review.reviewer_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-medium">
                        {review.reviewer_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-slate-800">{review.reviewer_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {renderStars(review.rating)}
                        <span className="text-sm text-slate-500">
                          {review.review_date && format(parseISO(review.review_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      review.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      review.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {review.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                  <MapPin size={14} />
                  <span>{review.location_name}</span>
                </div>

                {/* Review Text */}
                {review.review_text && (
                  <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <MessageSquare size={14} className="text-slate-400 mb-2" />
                    <p className="text-slate-700">{review.review_text}</p>
                  </div>
                )}

                {/* Assigned Info */}
                {review.assigned_to && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                    <UserPlus size={14} />
                    <span>Assigned to <strong>{getUserName(review.assigned_to)}</strong></span>
                    {review.assigned_at && (
                      <span className="text-slate-400">
                        on {format(new Date(review.assigned_at), 'MMM d, h:mm a')}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    {review.status === 'pending' && (
                      <button
                        onClick={() => {
                          setAssigningReview(review);
                          setSelectedLocation(review.location_name || '');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <UserPlus size={16} />
                        Assign
                      </button>
                    )}
                    
                    {review.status === 'assigned' && (
                      <>
                        <button
                          onClick={() => handleMarkComplete(review.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle2 size={16} />
                          Mark Complete
                        </button>
                        <button
                          onClick={() => {
                            setAssigningReview(review);
                            setSelectedLocation(review.location_name || '');
                          }}
                          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <UserPlus size={16} />
                          Reassign
                        </button>
                      </>
                    )}
                    
                    {review.status === 'completed' && (
                      <span className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle2 size={16} />
                        Completed
                      </span>
                    )}
                  </div>
                  
                  {/* Edit/Delete buttons - always visible */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(review)}
                      className="p-2 text-slate-400 hover:text-asap-blue hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit review"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete review"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Zapier Setup Info */}
      <div className="mt-8 bg-slate-50 rounded-2xl p-6 border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-2">📡 Zapier Webhook Setup</h3>
        <p className="text-sm text-slate-600 mb-4">
          Send Google reviews to this webhook URL:
        </p>
        <code className="block bg-white p-3 rounded-lg text-sm text-asap-blue border border-slate-200 mb-4 break-all">
          https://cute-cat-d9631c.netlify.app/.netlify/functions/google-review-webhook
        </code>
        <p className="text-xs text-slate-500">
          Required fields: <code>location_name</code> | 
          Optional: <code>reviewer_name</code>, <code>rating</code>, <code>review_text</code>, <code>review_date</code>, <code>review_id</code>
        </p>
      </div>

      {/* Assignment Modal */}
      {assigningReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Assign Review</h2>
              <button 
                onClick={() => { setAssigningReview(null); setSelectedUser(''); setSelectedLocation(''); }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {/* Review Summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(assigningReview.rating)}
                  <span className="text-sm text-slate-500">by {assigningReview.reviewer_name}</span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{assigningReview.review_text}</p>
              </div>
              
              {/* Location Selection */}
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <MapPin size={14} className="inline mr-1" />
                GMB Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue mb-4"
              >
                <option value="">Keep current: {assigningReview.location_name || 'Unknown'}</option>
                {GMB_LOCATIONS.map(loc => (
                  <option key={loc.name} value={loc.name}>
                    {loc.city}, {loc.state}
                  </option>
                ))}
              </select>
              
              {/* User Selection */}
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assign to Team Member
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue mb-4"
              >
                <option value="">Select a team member...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setAssigningReview(null); setSelectedUser(''); setSelectedLocation(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedUser}
                  className="flex-1 px-4 py-2.5 bg-asap-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Review Modal */}
      {editingReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Edit Review</h2>
              <button 
                onClick={() => setEditingReview(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {/* Review Info */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-slate-600">
                  <strong>{editingReview.reviewer_name}</strong>
                </p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{editingReview.review_text}</p>
              </div>
              
              {/* Star Rating */}
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Star Rating
              </label>
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEditRating(star)}
                    className={`p-2 rounded-lg transition-colors ${
                      star <= editRating 
                        ? 'bg-yellow-100 text-yellow-500' 
                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Star size={24} className={star <= editRating ? 'fill-yellow-400' : ''} />
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {editRating < 5 && (
                  <span className="text-amber-600">⚠️ Non-5-star reviews don't count toward monthly goals</span>
                )}
                {editRating === 5 && (
                  <span className="text-green-600">✓ 5-star reviews count toward monthly goals</span>
                )}
              </p>
              
              {/* Location */}
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <MapPin size={14} className="inline mr-1" />
                GMB Location
              </label>
              <select
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue mb-4"
              >
                <option value="">Select location...</option>
                {GMB_LOCATIONS.map(loc => (
                  <option key={loc.name} value={loc.name}>
                    {loc.city}, {loc.state}
                  </option>
                ))}
              </select>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingReview(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditReview}
                  className="flex-1 px-4 py-2.5 bg-asap-blue text-white rounded-lg hover:bg-blue-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncomingReviews;
