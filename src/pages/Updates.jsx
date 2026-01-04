import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

function Updates() {
  const { 
    currentUser, 
    users,
    supabaseFetch,
    supabasePost,
  } = useApp();

  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseFetch('updates', 'select=*,update_acknowledgements(*)&order=created_at.desc');
      
      // Transform acknowledgements to object format
      const transformedUpdates = (data || []).map(update => ({
        ...update,
        acknowledgements: (update.update_acknowledgements || []).reduce((acc, ack) => {
          acc[ack.user_id] = ack.acknowledged_at;
          return acc;
        }, {}),
      }));
      
      setUpdates(transformedUpdates);
    } catch (err) {
      console.error('Error loading updates:', err);
      setError('Unable to load updates. The updates table may not exist yet.');
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeUpdate = async (updateId) => {
    try {
      await supabasePost('update_acknowledgements', {
        update_id: updateId,
        user_id: currentUser.id,
      });
      loadUpdates();
    } catch (err) {
      console.error('Error acknowledging update:', err);
    }
  };

  const pendingUpdates = updates.filter(u => {
    if (!u || !currentUser) return false;
    const user = users.find(usr => usr.id === currentUser.id);
    if (!user) return false;
    
    // Check if assigned to this user
    const assignedTo = u.assigned_to || [];
    const isAssigned = assignedTo.includes('everyone') || assignedTo.includes(user.department);
    if (!isAssigned) return false;
    
    // Check if not acknowledged
    return !u.acknowledgements || !u.acknowledgements[currentUser.id];
  });

  const acknowledgedUpdates = updates.filter(u => {
    if (!u || !currentUser) return false;
    return u.acknowledgements && u.acknowledgements[currentUser.id];
  });

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'amber';
      default: return 'blue';
    }
  };

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
          <h2 className="text-lg font-semibold text-amber-800 mb-2">Updates Not Available</h2>
          <p className="text-amber-600 mb-4">{error}</p>
          <p className="text-sm text-amber-600">
            Run the <code className="bg-amber-100 px-2 py-1 rounded">updates-schema.sql</code> file in Supabase to enable this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Updates & Announcements</h1>
        <p className="text-slate-500">Stay informed about company updates and changes</p>
      </div>

      {/* Pending Updates Banner */}
      {pendingUpdates.length > 0 && (
        <div className="bg-gradient-to-r from-asap-blue to-blue-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Bell size={24} />
            <h2 className="text-xl font-semibold">Action Required</h2>
          </div>
          <p className="text-blue-100">
            You have {pendingUpdates.length} update{pendingUpdates.length !== 1 ? 's' : ''} that require{pendingUpdates.length === 1 ? 's' : ''} your acknowledgement.
          </p>
        </div>
      )}

      {/* Pending Updates */}
      {pendingUpdates.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-500" />
            Pending Review ({pendingUpdates.length})
          </h2>
          <div className="space-y-4">
            {pendingUpdates.map(update => (
              <UpdateCard
                key={update.id}
                update={update}
                getUserName={getUserName}
                getPriorityColor={getPriorityColor}
                onAcknowledge={() => acknowledgeUpdate(update.id)}
                isPending
              />
            ))}
          </div>
        </div>
      )}

      {/* Acknowledged Updates */}
      {acknowledgedUpdates.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            Reviewed ({acknowledgedUpdates.length})
          </h2>
          <div className="space-y-4">
            {acknowledgedUpdates.map(update => (
              <UpdateCard
                key={update.id}
                update={update}
                getUserName={getUserName}
                getPriorityColor={getPriorityColor}
                acknowledgedAt={update.acknowledgements[currentUser?.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Updates */}
      {updates.length === 0 && (
        <div className="text-center py-12">
          <Bell size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No Updates</h3>
          <p className="text-slate-400">You're all caught up! Check back later for new announcements.</p>
        </div>
      )}
    </div>
  );
}

function UpdateCard({ update, getUserName, getPriorityColor, onAcknowledge, isPending, acknowledgedAt }) {
  const priorityColor = getPriorityColor(update.priority);
  
  const priorityClasses = {
    red: 'bg-red-100 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  // Safe date formatting
  const formatDate = (dateValue) => {
    if (!dateValue) return 'Unknown date';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Unknown date';
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Handle both snake_case (from DB) and camelCase field names
  const createdAt = update.created_at || update.createdAt;
  const createdBy = update.created_by || update.createdBy;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${isPending ? 'border-amber-200' : 'border-slate-100'} overflow-hidden`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priorityClasses[priorityColor]}`}>
                {update.priority?.toUpperCase() || 'NORMAL'}
              </span>
              {isPending && (
                <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <Clock size={12} />
                  Pending Review
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-800">{update.title}</h3>
          </div>
        </div>

        {/* Content */}
        <p className="text-slate-600 mb-4 whitespace-pre-wrap">{update.content}</p>

        {/* Meta */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-4">
            <span>Posted by {getUserName(createdBy)}</span>
            <span>•</span>
            <span>{formatDate(createdAt)}</span>
          </div>
        </div>

        {/* Acknowledged info */}
        {acknowledgedAt && (
          <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 size={16} />
            <span>You acknowledged this on {formatDate(acknowledgedAt)}</span>
          </div>
        )}
      </div>

      {/* Acknowledge Button */}
      {isPending && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onAcknowledge}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-asap-blue hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
          >
            <CheckCircle2 size={18} />
            I have read and acknowledge this update
          </button>
        </div>
      )}
    </div>
  );
}

export default Updates;
