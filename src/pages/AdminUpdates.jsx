import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Megaphone,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

function AdminUpdates() {
  const { 
    currentUser,
    users,
    DEPARTMENTS,
    supabaseFetch,
    supabasePost,
    supabaseDelete,
  } = useApp();

  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expandedUpdate, setExpandedUpdate] = useState(null);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseFetch('updates', 'select=*,update_acknowledgements(*)&order=created_at.desc');
      console.log('AdminUpdates loaded:', data);
      
      if (data && data.error) {
        throw new Error(data.message || 'Failed to load updates');
      }
      
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
      setError('Unable to load updates. Make sure the updates table exists in Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Safe date formatting helper
  const formatDate = (dateValue, formatStr = 'MMM d, yyyy h:mm a') => {
    if (!dateValue) return 'Unknown date';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Unknown date';
      return format(date, formatStr);
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Filter updates
  const filteredUpdates = (updates || []).filter(update => {
    if (!update) return false;
    if (searchQuery && !(update.title || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const getAcknowledgementStats = (update) => {
    const assignedTo = update.assigned_to || ['everyone'];
    const targetUsers = (users || []).filter(user => {
      if (assignedTo.includes('everyone')) return true;
      if (assignedTo.includes(user.department)) return true;
      return false;
    });

    const acks = update.acknowledgements || {};
    const ackList = update.update_acknowledgements || [];
    
    const acknowledged = targetUsers.filter(u => {
      return acks[u.id] || ackList.some(a => a.user_id === u.id);
    });
    
    return {
      total: targetUsers.length,
      acknowledged: acknowledged.length,
      percentage: targetUsers.length > 0 ? Math.round((acknowledged.length / targetUsers.length) * 100) : 0,
      acknowledgedUsers: acknowledged,
      pendingUsers: targetUsers.filter(u => !acks[u.id] && !ackList.some(a => a.user_id === u.id)),
    };
  };

  const handleSave = async (updateData) => {
    try {
      const result = await supabasePost('updates', {
        title: updateData.title,
        content: updateData.content,
        priority: updateData.priority,
        assigned_to: updateData.assignedTo,
        created_by: currentUser?.id,
      });
      
      console.log('Update saved:', result);
      
      if (result && result.error) {
        alert('Error saving update: ' + (result.message || result.error));
        return;
      }
      
      setShowModal(false);
      loadUpdates();
    } catch (error) {
      console.error('Failed to save update:', error);
      alert('Failed to save update: ' + error.message);
    }
  };

  const handleDelete = async (updateId) => {
    if (!confirm('Delete this update?')) return;
    try {
      await supabaseDelete('updates', `id=eq.${updateId}`);
      loadUpdates();
    } catch (error) {
      console.error('Error deleting update:', error);
      alert('Failed to delete update');
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
          <button 
            onClick={loadUpdates}
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
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Manage Updates</h1>
          <p className="text-slate-500">Create announcements and track acknowledgements</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadUpdates}
            className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={18} className="text-slate-600" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-asap-blue hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            Create Update
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search updates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <p className="text-sm text-slate-500">Total Updates</p>
          <p className="text-2xl font-bold text-slate-800">{updates.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <p className="text-sm text-slate-500">High Priority</p>
          <p className="text-2xl font-bold text-red-600">{updates.filter(u => u.priority === 'high').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <p className="text-sm text-slate-500">This Week</p>
          <p className="text-2xl font-bold text-asap-blue">
            {updates.filter(u => {
              try {
                const created = new Date(u.created_at);
                if (isNaN(created.getTime())) return false;
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return created > weekAgo;
              } catch (e) { return false; }
            }).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <p className="text-sm text-slate-500">Avg. Acknowledgement</p>
          <p className="text-2xl font-bold text-green-600">
            {updates.length > 0 
              ? Math.round(updates.reduce((sum, u) => sum + getAcknowledgementStats(u).percentage, 0) / updates.length)
              : 0}%
          </p>
        </div>
      </div>

      {/* Updates List */}
      <div className="space-y-4">
        {filteredUpdates.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <Megaphone size={48} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No Updates Yet</h3>
            <p className="text-slate-400 mb-4">Create your first announcement to keep your team informed.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600"
            >
              Create Update
            </button>
          </div>
        ) : (
          filteredUpdates.map(update => {
            const stats = getAcknowledgementStats(update);
            const isExpanded = expandedUpdate === update.id;
            
            return (
              <div key={update.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          update.priority === 'high' ? 'bg-red-100 text-red-700' :
                          update.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {(update.priority || 'normal').toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(update.created_at)}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800">{update.title}</h3>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(update.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Content */}
                  <p className="text-slate-600 mb-4 line-clamp-2">{update.content}</p>

                  {/* Stats */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>Posted by {getUserName(update.created_by)}</span>
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {(update.assigned_to || ['everyone']).includes('everyone') 
                          ? 'Everyone' 
                          : update.assigned_to?.map(d => DEPARTMENTS.find(dept => dept.id === d)?.name || d).join(', ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${stats.percentage === 100 ? 'bg-green-500' : 'bg-asap-blue'}`}
                            style={{ width: `${stats.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-600">
                          {stats.acknowledged}/{stats.total}
                        </span>
                      </div>
                      <button
                        onClick={() => setExpandedUpdate(isExpanded ? null : update.id)}
                        className="text-sm text-asap-blue hover:underline"
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-slate-100 bg-slate-50">
                    <div className="grid md:grid-cols-2 gap-6 pt-4">
                      {/* Pending */}
                      <div>
                        <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                          <Clock size={16} className="text-amber-500" />
                          Pending ({stats.pendingUsers.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {stats.pendingUsers.map(user => (
                            <div key={user.id} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                              <div className="w-8 h-8 bg-asap-navy rounded-full flex items-center justify-center text-white text-xs">
                                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-700">{user.name}</p>
                                <p className="text-xs text-slate-500">
                                  {DEPARTMENTS.find(d => d.id === user.department)?.name}
                                </p>
                              </div>
                            </div>
                          ))}
                          {stats.pendingUsers.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">Everyone has acknowledged!</p>
                          )}
                        </div>
                      </div>

                      {/* Acknowledged */}
                      <div>
                        <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-500" />
                          Acknowledged ({stats.acknowledgedUsers.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {stats.acknowledgedUsers.map(user => {
                            let ackDate = '';
                            try {
                              const dateVal = update.acknowledgements?.[user.id];
                              if (dateVal) {
                                const d = new Date(dateVal);
                                if (!isNaN(d.getTime())) ackDate = format(d, 'MMM d, h:mm a');
                              }
                            } catch (e) {}
                            return (
                              <div key={user.id} className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                                <div className="w-8 h-8 bg-asap-navy rounded-full flex items-center justify-center text-white text-xs">
                                  {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-slate-700">{user.name}</p>
                                  {ackDate && <p className="text-xs text-slate-500">{ackDate}</p>}
                                </div>
                                <CheckCircle2 size={14} className="text-green-500" />
                              </div>
                            );
                          })}
                          {stats.acknowledgedUsers.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">No acknowledgements yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <UpdateModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          DEPARTMENTS={DEPARTMENTS}
        />
      )}
    </div>
  );
}

function UpdateModal({ onClose, onSave, DEPARTMENTS }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState(['everyone']);

  const handleToggleDepartment = (deptId) => {
    if (deptId === 'everyone') {
      setAssignedTo(['everyone']);
    } else {
      const newAssigned = assignedTo.filter(d => d !== 'everyone');
      if (newAssigned.includes(deptId)) {
        const filtered = newAssigned.filter(d => d !== deptId);
        setAssignedTo(filtered.length > 0 ? filtered : ['everyone']);
      } else {
        setAssignedTo([...newAssigned, deptId]);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({
      title: title.trim(),
      content: content.trim(),
      priority,
      assignedTo,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">Create Update</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-asap-blue"
              placeholder="Update title"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-asap-blue resize-none"
              placeholder="Write your announcement..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <div className="flex gap-2">
              {['low', 'normal', 'high'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium capitalize ${
                    priority === p
                      ? p === 'high' ? 'border-red-500 bg-red-50 text-red-700' :
                        p === 'low' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                        'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Assign To</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleToggleDepartment('everyone')}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  assignedTo.includes('everyone')
                    ? 'bg-asap-blue text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Everyone
              </button>
              {DEPARTMENTS.map(dept => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleToggleDepartment(dept.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    assignedTo.includes(dept.id)
                      ? 'bg-asap-blue text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600"
            >
              Publish Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminUpdates;
