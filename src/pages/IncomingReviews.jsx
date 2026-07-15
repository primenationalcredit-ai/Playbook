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
  ShieldAlert,
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
  const [rechecking, setRechecking] = useState(false);
  const [recheckMsg, setRecheckMsg] = useState(null);
  
  // Assignment modal
  const [assigningReview, setAssigningReview] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [assignDealId, setAssignDealId] = useState('');
  
  // Edit modal
  const [editingReview, setEditingReview] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [editLocation, setEditLocation] = useState('');

  useEffect(() => {
    loadData();
    // Auto-refresh every 30s so newly-arrived reviews appear without a manual reload.
    const id = setInterval(() => { loadData(); }, 30000);
    return () => clearInterval(id);
  }, [locationFilter]);

  const runRecheck = async () => {
    if (rechecking) return;
    setRechecking(true);
    setRecheckMsg(null);
    let flagged = 0, cleared = 0, rounds = 0, reset = true;
    try {
      // Loop one location per call until the pass reports done. reset=1 on the
      // first call starts a fresh pass.
      while (rounds < 40) {
        const url = `/.netlify/functions/review-reconcile?step=1${reset ? '&reset=1' : ''}`;
        const r = await fetch(url);
        const d = await r.json().catch(() => ({}));
        reset = false;
        flagged += d.flagged || 0;
        cleared += d.cleared || 0;
        rounds++;
        if (d.error) { setRecheckMsg({ ok: false, text: d.error }); break; }
        if (d.done) {
          const t = d.totals || { flagged, cleared };
          setRecheckMsg({ ok: true, text: `Re-check complete. ${t.flagged || flagged} newly delisted, ${t.cleared || cleared} restored.` });
          break;
        }
      }
      await loadData();
    } catch (e) {
      setRecheckMsg({ ok: false, text: 'Re-check failed. Try again.' });
    }
    setRechecking(false);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load ALL reviews (every status) so the Pending/Assigned/Completed counts are
      // always complete. The active tab filters the displayed list client-side.
      // Only surface reviews left on/after June 1, 2026 (launch). Undated rows use their created date.
      let query = 'select=*&or=(review_date.gte.2026-06-01,and(review_date.is.null,created_at.gte.2026-06-01))&order=created_at.desc';
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
    const dealId = (assignDealId || assigningReview.pipedrive_deal_id || '').trim();
    if (!dealId || !/^\d+$/.test(dealId)) { alert('A numeric Pipedrive deal ID is required to assign this review.'); return; }
    
    try {
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/incoming_reviews?id=eq.${assigningReview.id}`;
      const updateData = {
        status: 'assigned',
        assigned_to: selectedUser,
        assigned_by: currentUser?.id,
        assigned_at: new Date().toISOString(),
        pipedrive_deal_id: String(dealId),
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
      
      await postReviewNote(assigningReview, String(dealId), getUserName(selectedUser));

      setAssigningReview(null);
      setSelectedUser('');
      setSelectedLocation('');
      setAssignDealId('');
      loadData();
    } catch (err) {
      console.error('Error assigning review:', err);
      alert('Failed to assign review');
    }
  };

  const REVIEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
  const patchReview = async (id, data) => {
    await fetch(`https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/incoming_reviews?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: REVIEW_KEY, Authorization: `Bearer ${REVIEW_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(data),
    });
  };

  // Approve a team member's claim: assign the review to whoever claimed it (this is what credits their bonus).
  const postReviewNote = async (review, dealId, creditedTo) => {
    try {
      await fetch('/.netlify/functions/review-post-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, dealId, reviewerName: review.reviewer_name, rating: review.rating, reviewText: review.review_text, creditedTo: creditedTo || null }),
      });
    } catch (e) { /* note is best-effort; assignment already saved */ }
  };

  const handleApproveClaim = async (review) => {
    if (!review?.claimed_by) return;
    let dealId = review.pipedrive_deal_id;
    if (!dealId) {
      dealId = (prompt('Enter the Pipedrive deal ID for this review (needed to log it on the client file):') || '').trim();
      if (!dealId || !/^\d+$/.test(dealId)) { alert('A numeric deal ID is required to approve this review.'); return; }
    }
    try {
      await patchReview(review.id, { status: 'assigned', assigned_to: review.claimed_by, assigned_by: currentUser?.id, assigned_at: new Date().toISOString(), pipedrive_deal_id: String(dealId) });
      await postReviewNote(review, String(dealId), review.claimed_by_name || getUserName(review.claimed_by));
      loadData();
    } catch (err) { console.error('Error approving claim:', err); alert('Failed to approve claim'); }
  };

  // Reject a claim: clear the claim so it returns to the available pool.
  const handleRejectClaim = async (review) => {
    if (!review?.claimed_by) return;
    if (!confirm(`Release ${review.claimed_by_name || 'this'} claim and return the review to the available pool?`)) return;
    try {
      await patchReview(review.id, { claimed_by: null, claimed_by_name: null, claimed_at: null });
      loadData();
    } catch (err) { console.error('Error rejecting claim:', err); alert('Failed to release claim'); }
  };
  // Fully release an assigned/completed review: back to the pending pool, credit removed,
  // audit trail stamped in notes. Metrics recalculate on their next load.
  const handleReleaseAssignment = async (review) => {
    const who = review.claimed_by_name || getUserName(review.assigned_to) || 'its current owner';
    if (!confirm(`Release this review from ${who}? It returns to Pending and no longer counts toward their review metric.`)) return;
    try {
      const stamp = `Released from ${who} by ${getUserName(currentUser?.id) || currentUser?.email || 'admin'} on ${new Date().toISOString().slice(0, 10)}`;
      await patchReview(review.id, {
        status: 'pending',
        assigned_to: null, assigned_by: null, assigned_at: null,
        claimed_by: null, claimed_by_name: null, claimed_at: null,
        notes: review.notes ? `${review.notes} | ${stamp}` : stamp,
      });
      loadData();
    } catch (err) { console.error('Error releasing review:', err); alert('Failed to release review'); }
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
  }).sort((a, b) => {
    // claimed-but-pending float to the top so they're easy to approve
    const ac = a.status === 'pending' && a.claimed_by ? 1 : 0;
    const bc = b.status === 'pending' && b.claimed_by ? 1 : 0;
    return bc - ac;
  });

  // Stats
  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const assignedCount = reviews.filter(r => r.status === 'assigned').length;
  const completedCount = reviews.filter(r => r.status === 'completed').length;
  const claimedCount = reviews.filter(r => r.status === 'pending' && r.claimed_by).length;
  const delistedCount = reviews.filter(r => r.delisted_at).length;

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
        
        <div className="flex items-center gap-2">
          <button
            onClick={runRecheck}
            disabled={rechecking}
            title="Re-check Google to flag reviews that have dropped off (delisted)"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
          >
            <ShieldAlert size={18} className={rechecking ? 'animate-pulse' : ''} />
            {rechecking ? 'Re-checking…' : 'Re-check Google'}
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {recheckMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${recheckMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {recheckMsg.text}
        </div>
      )}

      {delistedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200">
          <ShieldAlert size={18} className="text-rose-600" />
          <span className="text-sm text-rose-800"><strong>{delistedCount}</strong> review{delistedCount === 1 ? '' : 's'} dropped off Google (delisted). They stay assigned but are flagged so the team knows they no longer count.</span>
        </div>
      )}

      {/* Claims awaiting approval */}
      {claimedCount > 0 && (
        <button
          onClick={() => setStatusFilter('pending')}
          className="w-full mb-6 flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-left hover:bg-purple-100 transition-colors"
        >
          <Star size={18} className="text-purple-600 fill-purple-200" />
          <span className="text-sm text-purple-800"><strong>{claimedCount}</strong> review{claimedCount === 1 ? '' : 's'} claimed by team members and waiting for your approval.</span>
        </button>
      )}

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
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${review.delisted_at ? 'opacity-60 grayscale-[35%]' : ''} ${
                review.delisted_at ? 'border-rose-200' :
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
                    {review.delisted_at && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700" title={`No longer on Google as of ${format(parseISO(review.delisted_at), 'MMM d, yyyy')}`}>
                        <ShieldAlert size={12} /> DELISTED
                      </span>
                    )}
                    {review.status === 'pending' && review.claimed_by && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">CLAIMED</span>
                    )}
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
                    {review.status === 'pending' && review.claimed_by && (
                      <>
                        <span className="text-sm text-slate-600 mr-1">Claimed by <strong>{review.claimed_by_name || getUserName(review.claimed_by)}</strong></span>
                        <button
                          onClick={() => handleApproveClaim(review)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle2 size={16} />
                          Approve claim
                        </button>
                        <button
                          onClick={() => handleRejectClaim(review)}
                          className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Release
                        </button>
                      </>
                    )}
                    {review.status === 'pending' && (
                      <button
                        onClick={() => {
                          setAssigningReview(review);
                          setSelectedLocation(review.location_name || '');
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${review.claimed_by ? 'border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-asap-blue text-white hover:bg-blue-600'}`}
                      >
                        <UserPlus size={16} />
                        {review.claimed_by ? 'Assign to someone else' : 'Assign'}
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
                        <button
                          onClick={() => handleReleaseAssignment(review)}
                          className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Release
                        </button>
                      </>
                    )}
                    
                    {review.status === 'completed' && (
                      <>
                        <span className="flex items-center gap-2 text-green-600 text-sm">
                          <CheckCircle2 size={16} />
                          Completed
                        </span>
                        <button
                          onClick={() => {
                            setAssigningReview(review);
                            setSelectedLocation(review.location_name || '');
                          }}
                          className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <UserPlus size={16} />
                          Reassign
                        </button>
                        <button
                          onClick={() => handleReleaseAssignment(review)}
                          className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Release
                        </button>
                      </>
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
              
              {/* Pipedrive Deal ID (required so we can log the review on the client's deal) */}
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pipedrive Deal ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={assignDealId}
                onChange={(e) => setAssignDealId(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={assigningReview.pipedrive_deal_id ? `Claimed with deal ${assigningReview.pipedrive_deal_id}` : 'e.g. 12345'}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue mb-1"
              />
              <p className="text-xs text-slate-400 mb-4">We will post a note on this deal that a review was left.</p>

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
