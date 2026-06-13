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
  FileText,
} from 'lucide-react';

function Updates() {
  const { 
    currentUser, 
    users,
    updates,
    acknowledgeUpdate,
    getUpdatesForUser,
    refreshData,
  } = useApp();

  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);

  // Get updates relevant to current user
  const userUpdates = getUpdatesForUser(currentUser?.id) || [];
  
  const pendingUpdates = userUpdates.filter(u => {
    if (!u || !currentUser) return false;
    return !u.acknowledgements || !u.acknowledgements[currentUser.id];
  });

  const acknowledgedUpdates = userUpdates.filter(u => {
    if (!u || !currentUser) return false;
    return u.acknowledgements && u.acknowledgements[currentUser.id];
  });

  // Auto-switch to acknowledged tab if no pending
  useEffect(() => {
    if (pendingUpdates.length === 0 && acknowledgedUpdates.length > 0 && activeTab === 'pending') {
      setActiveTab('acknowledged');
    }
  }, [pendingUpdates.length, acknowledgedUpdates.length]);

  const handleAcknowledge = async (updateId) => {
    setLoading(true);
    await acknowledgeUpdate(updateId, currentUser.id);
    setLoading(false);
  };

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

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Updates & Announcements</h1>
        <p className="text-slate-500">Stay informed about company updates and changes</p>
      </div>

      {/* Pending Updates Banner */}
      {pendingUpdates.length > 0 && activeTab === 'pending' && (
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'pending'
              ? 'text-asap-blue border-asap-blue'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <AlertCircle size={18} />
          Pending Review
          {pendingUpdates.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
              {pendingUpdates.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('acknowledged')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'acknowledged'
              ? 'text-asap-blue border-asap-blue'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <CheckCircle2 size={18} />
          Acknowledged
          {acknowledgedUpdates.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
              {acknowledgedUpdates.length}
            </span>
          )}
        </button>
      </div>

      {/* Pending Tab Content */}
      {activeTab === 'pending' && (
        <div>
          {pendingUpdates.length > 0 ? (
            <div className="space-y-4">
              {pendingUpdates.map(update => (
                <UpdateCard
                  key={update.id}
                  update={update}
                  getUserName={getUserName}
                  getPriorityColor={getPriorityColor}
                  onAcknowledge={() => handleAcknowledge(update.id)}
                  isPending
                  loading={loading}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-green-50 rounded-2xl border border-green-200">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-medium text-green-800 mb-2">All Caught Up!</h3>
              <p className="text-green-600">You have no pending updates to review.</p>
              {acknowledgedUpdates.length > 0 && (
                <button
                  onClick={() => setActiveTab('acknowledged')}
                  className="mt-4 text-green-700 underline hover:text-green-800"
                >
                  View your acknowledged updates →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Acknowledged Tab Content */}
      {activeTab === 'acknowledged' && (
        <div>
          {acknowledgedUpdates.length > 0 ? (
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
          ) : (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No Acknowledged Updates</h3>
              <p className="text-slate-400">Updates you acknowledge will appear here for reference.</p>
            </div>
          )}
        </div>
      )}

      {/* No Updates at All */}
      {userUpdates.length === 0 && (
        <div className="text-center py-12">
          <Bell size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No Updates</h3>
          <p className="text-slate-400">You're all caught up! Check back later for new announcements.</p>
        </div>
      )}
    </div>
  );
}

function UpdateCard({ update, getUserName, getPriorityColor, onAcknowledge, isPending, acknowledgedAt, loading }) {
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
          <div className="mt-4 flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
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
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-asap-blue hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-xl font-medium transition-colors"
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            I have read and acknowledge this update
          </button>
        </div>
      )}
    </div>
  );
}

export default Updates;
