import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  Clock,
  Users,
  User,
  Filter,
  Calendar,
  Repeat,
  CalendarDays,
  Eye,
  CheckCircle2,
  Copy,
  Shield,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { id: 0, short: 'Sun', full: 'Sunday' },
  { id: 1, short: 'Mon', full: 'Monday' },
  { id: 2, short: 'Tue', full: 'Tuesday' },
  { id: 3, short: 'Wed', full: 'Wednesday' },
  { id: 4, short: 'Thu', full: 'Thursday' },
  { id: 5, short: 'Fri', full: 'Friday' },
  { id: 6, short: 'Sat', full: 'Saturday' },
];

function AdminTasks() {
  const { 
    taskTemplates, 
    addTaskTemplate, 
    updateTaskTemplate, 
    deleteTaskTemplate,
    TIME_SLOTS,
    DEPARTMENTS,
    SHIFT_TYPES,
    users,
    supabaseFetch,
    supabasePost,
    supabaseDelete,
  } = useApp();

  // === Out Today State ===
  const [outUserIds, setOutUserIds] = useState(new Set());
  const [outLoading, setOutLoading] = useState(true);
  const [togglingUser, setTogglingUser] = useState(null);
  const [showOutPanel, setShowOutPanel] = useState(true);

  // Load who's out on mount
  React.useEffect(() => {
    loadOutUsers();
  }, []);

  const loadOutUsers = async () => {
    setOutLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check daily_out table (primary source - admin toggle)
      let dailyOutIds = [];
      try { dailyOutIds = ((await supabaseFetch('daily_out', `select=user_id&date=eq.${today}`)) || []).map(e => e.user_id); } catch(e) {}
      
      // Also check PTO requests (may not exist)
      let ptoOutIds = [];
      try { ptoOutIds = ((await supabaseFetch('time_off_requests', `select=user_id&status=eq.approved&start_date=lte.${today}&end_date=gte.${today}`)) || []).map(p => p.user_id); } catch(e) {}
      
      setOutUserIds(new Set([...dailyOutIds, ...ptoOutIds]));
    } catch (err) {
      console.error('Error loading out users:', err);
    }
    setOutLoading(false);
  };

  const toggleUserOut = async (userId) => {
    setTogglingUser(userId);
    const today = new Date().toISOString().split('T')[0];
    const isCurrentlyOut = outUserIds.has(userId);
    
    try {
      if (isCurrentlyOut) {
        // Remove from daily_out
        await supabaseDelete('daily_out', `user_id=eq.${userId}&date=eq.${today}`);
        setOutUserIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        // Add to daily_out
        await supabasePost('daily_out', {
          user_id: userId,
          date: today,
          marked_by: 'admin',
        });
        setOutUserIds(prev => new Set([...prev, userId]));
      }
    } catch (err) {
      console.error('Error toggling out status:', err);
    }
    setTogglingUser(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSlot, setFilterSlot] = useState('all');
  const [filterShift, setFilterShift] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDepartment, setPreviewDepartment] = useState('credit_consultants');
  const [previewShift, setPreviewShift] = useState('7-4');
  const [editingBackup, setEditingBackup] = useState(null); // task id of inline backup editor
  const [filterBackup, setFilterBackup] = useState('all'); // 'all', 'no_backup', 'has_backup'

  const [savedBackup, setSavedBackup] = useState(null); // flash 'saved' indicator

  // Quick update just backup fields - focused PATCH for reliability
  const quickUpdateBackup = async (taskId, field, value) => {
    try {
      // 1. Direct focused PATCH - only send the one field being changed
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/task_templates?id=eq.${taskId}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ [field]: value || null })
      });
      
      if (res.ok) {
        // 2. Update local state so dropdown reflects change immediately
        const task = taskTemplates.find(t => t.id === taskId);
        if (task) {
          updateTaskTemplate(taskId, { ...task, [field]: value || null });
        }
        setSavedBackup(taskId + field);
        setTimeout(() => setSavedBackup(null), 1500);
      } else {
        const errText = await res.text();
        console.error('Backup save failed:', res.status, errText);
        alert('Failed to save backup. Make sure you ran the SQL migration:\n\nALTER TABLE task_templates ADD COLUMN IF NOT EXISTS backup_user_1 UUID;\nALTER TABLE task_templates ADD COLUMN IF NOT EXISTS backup_user_2 UUID;');
      }
    } catch (err) {
      console.error('Backup save error:', err);
    }
  };

  // All available shifts (combined from all departments)
  const ALL_SHIFTS = [
    { id: '7-4', name: '7:00 AM - 4:00 PM' },
    { id: '7-6', name: '7:00 AM - 6:00 PM' },
    { id: '8-5', name: '8:00 AM - 5:00 PM' },
    { id: '8:30-5:30', name: '8:30 AM - 5:30 PM' },
    { id: '9-6', name: '9:00 AM - 6:00 PM' },
    { id: '10-7', name: '10:00 AM - 7:00 PM' },
    { id: '7-7', name: '7:00 AM - 7:00 PM' },
  ];

  // Filter tasks
  const filteredTasks = taskTemplates.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterSlot !== 'all' && task.time_slot !== filterSlot) return false;
    
    // Shift filter
    if (filterShift !== 'all') {
      // Show tasks that match the shift OR have no shift (apply to all)
      if (task.shift_type && task.shift_type !== filterShift) return false;
    }
    
    // Department filter
    if (filterDepartment !== 'all') {
      const assignedTo = task.assigned_to;
      if (assignedTo === 'everyone') { /* everyone passes */ }
      else if (assignedTo === filterDepartment) { /* department match */ }
      else {
        // Check if assigned to an individual user in this department
        const assignedUser = (users || []).find(u => u.id === assignedTo);
        if (!assignedUser || assignedUser.department !== filterDepartment) return false;
      }
    }
    
    // User filter - show tasks assigned to user's department, everyone, OR directly to this user
    if (filterUser !== 'all') {
      const user = users.find(u => u.id === filterUser);
      if (user) {
        const assignedTo = task.assigned_to;
        if (assignedTo === 'everyone') { /* passes */ }
        else if (assignedTo === user.department) { /* department match */ }
        else if (assignedTo === filterUser) { /* directly assigned to this user */ }
        else return false;
      }
    }
    
    // Backup filter
    if (filterBackup === 'no_backup' && (task.backup_user_1 || task.backup_user_2)) return false;
    if (filterBackup === 'has_backup' && !task.backup_user_1 && !task.backup_user_2) return false;
    
    return true;
  });

  // Group by time slot
  const groupedTasks = Object.values(TIME_SLOTS).map(slot => ({
    ...slot,
    tasks: filteredTasks.filter(t => t.time_slot === slot.id),
  }));

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleDelete = (taskId) => {
    deleteTaskTemplate(taskId);
    setDeleteConfirm(null);
  };

  const handleSave = (taskData) => {
    console.log('handleSave called with:', taskData);
    if (editingTask) {
      updateTaskTemplate(editingTask.id, taskData);
    } else {
      addTaskTemplate(taskData);
    }
    setShowModal(false);
    setEditingTask(null);
  };

  const handleDuplicate = (task) => {
    // Create a new task with same data but no ID
    const duplicatedTask = {
      title: `${task.title} (Copy)`,
      description: task.description,
      time_slot: task.time_slot,
      specific_time: task.specific_time,
      assigned_to: task.assigned_to,
      link: task.link,
      links: task.links,
      frequency: task.frequency,
      days_of_week: task.days_of_week,
      shift_type: task.shift_type,
      backup_user_1: task.backup_user_1,
      backup_user_2: task.backup_user_2,
    };
    
    addTaskTemplate(duplicatedTask);
    setShowModal(false);
    setEditingTask(null);
  };

  const getFrequencyLabel = (task) => {
    if (!task.frequency || task.frequency === 'daily') return 'Daily';
    if (task.frequency === 'one_time') return 'One-time';
    if (task.frequency === 'weekly') {
      const days = task.days_of_week || [];
      if (days.length === 0) return 'Weekly';
      if (days.length === 7) return 'Daily';
      return days.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.short).join(', ');
    }
    return task.frequency;
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Manage Tasks</h1>
          <p className="text-slate-500">Create and edit daily task templates for your team</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            <Eye size={18} />
            Preview Playbook
          </button>
          <button
            onClick={() => {
              setEditingTask(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-asap-blue hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add Task
          </button>
        </div>
      </div>

      {/* === Who's Out Today === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
        <button
          onClick={() => setShowOutPanel(!showOutPanel)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-orange-500" />
            <span className="font-semibold text-slate-700">Who's Out Today</span>
            {outUserIds.size > 0 && (
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {outUserIds.size} out
              </span>
            )}
          </div>
          {showOutPanel ? <X size={16} className="text-slate-400" /> : <Eye size={16} className="text-slate-400" />}
        </button>
        
        {showOutPanel && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500 mb-3">Toggle a team member as "out" — their tasks will appear on their backup's playbook.</p>
            {outLoading ? (
              <div className="text-sm text-slate-400">Loading...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {users
                  .filter(u => u.role !== 'admin' || u.department !== 'leadership')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(u => {
                    const isOut = outUserIds.has(u.id);
                    const isToggling = togglingUser === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUserOut(u.id)}
                        disabled={isToggling}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                          isOut 
                            ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        } ${isToggling ? 'opacity-50' : ''}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${isOut ? 'bg-orange-500' : 'bg-green-500'}`} />
                        {u.name}
                        {isOut && <span className="text-xs bg-orange-200 px-1.5 py-0.5 rounded">OUT</span>}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            
            {/* Department Filter */}
            <select
              value={filterDepartment}
              onChange={(e) => {
                setFilterDepartment(e.target.value);
                setFilterUser('all'); // Reset user filter when department changes
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue text-sm"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            
            {/* User Filter */}
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue text-sm"
            >
              <option value="all">All Users</option>
              {users
                .filter(u => filterDepartment === 'all' || u.department === filterDepartment)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))
              }
            </select>
            
            {/* Time Slot Filter */}
            <select
              value={filterSlot}
              onChange={(e) => setFilterSlot(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue text-sm"
            >
              <option value="all">All Time Slots</option>
              {Object.values(TIME_SLOTS).map(slot => (
                <option key={slot.id} value={slot.id}>{slot.label}</option>
              ))}
            </select>
            
            {/* Shift Filter */}
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue text-sm"
            >
              <option value="all">All Shifts</option>
              {ALL_SHIFTS.map(shift => (
                <option key={shift.id} value={shift.id}>{shift.name}</option>
              ))}
            </select>
            
            {/* Backup Filter */}
            <select
              value={filterBackup}
              onChange={(e) => setFilterBackup(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-400 text-sm"
            >
              <option value="all">All Backups</option>
              <option value="no_backup">⚠️ No Backup Assigned</option>
              <option value="has_backup">✅ Has Backup</option>
            </select>
            
            {/* Clear Filters */}
            {(filterDepartment !== 'all' || filterUser !== 'all' || filterSlot !== 'all' || filterShift !== 'all' || filterBackup !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setFilterDepartment('all');
                  setFilterUser('all');
                  setFilterSlot('all');
                  setFilterShift('all');
                  setFilterBackup('all');
                  setSearchQuery('');
                }}
                className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
        
        {/* Active Filters Summary */}
        {(filterDepartment !== 'all' || filterUser !== 'all' || filterShift !== 'all') && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Showing tasks for:</span>
            {filterDepartment !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                {DEPARTMENTS.find(d => d.id === filterDepartment)?.name}
              </span>
            )}
            {filterUser !== 'all' && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                {users.find(u => u.id === filterUser)?.name}
              </span>
            )}
            {filterShift !== 'all' && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                {ALL_SHIFTS.find(s => s.id === filterShift)?.name} shift
              </span>
            )}
            <span className="text-slate-400">({filteredTasks.length} tasks)</span>
          </div>
        )}
      </div>

      {/* Task List - Table Layout */}
      <div className="space-y-6">
        {groupedTasks.map(slot => slot.tasks.length > 0 && (
          <div key={slot.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className={`px-6 py-3 bg-${getSlotColor(slot.id)}-50 border-b border-${getSlotColor(slot.id)}-100`}>
              <div className="flex items-center gap-2">
                <Clock size={18} className={`text-${getSlotColor(slot.id)}-600`} />
                <h2 className={`font-semibold text-${getSlotColor(slot.id)}-800`}>{slot.label}</h2>
                <span className={`text-sm text-${getSlotColor(slot.id)}-600`}>
                  ({slot.tasks.length} tasks)
                </span>
              </div>
            </div>
            
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_160px_160px_80px] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div>Task</div>
              <div className="text-center text-orange-600">Backup 1</div>
              <div className="text-center text-amber-600">Backup 2</div>
              <div className="text-center">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100">
              {slot.tasks.map((task, idx) => (
                <div key={task.id} className="grid grid-cols-[1fr_160px_160px_80px] gap-2 px-4 py-3 items-start hover:bg-slate-50 transition-colors">
                  {/* Task Info */}
                  <div style={{minWidth:0, wordBreak:'break-word'}}>
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded text-center text-xs font-medium text-slate-500 leading-6">
                        {idx + 1}
                      </span>
                      <h3 className="font-medium text-slate-800">{task.title}</h3>
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-400 mt-0.5 ml-8" style={{wordBreak:'break-word'}}>{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1 ml-8">
                      {task.specific_time && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock size={10} />
                          {formatTime(task.specific_time)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        {task.assigned_to === 'everyone' ? (
                          <><Users size={10} />Everyone</>
                        ) : DEPARTMENTS.find(d => d.id === task.assigned_to) ? (
                          <><Users size={10} />{DEPARTMENTS.find(d => d.id === task.assigned_to).name}</>
                        ) : (
                          <><User size={10} className="text-emerald-500" /><span className="text-emerald-600 font-medium">{users.find(u => u.id === task.assigned_to)?.name || task.assigned_to}</span></>
                        )}
                      </span>
                      {task.shift_type && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {task.shift_type}
                        </span>
                      )}
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                        task.frequency === 'one_time' ? 'bg-amber-100 text-amber-700' :
                        task.frequency === 'weekly' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {task.frequency === 'one_time' ? '📅' : '🔁'} {getFrequencyLabel(task)}
                      </span>
                      {(task.links?.length > 0 ? task.links : task.link ? [task.link] : []).map((lnk, linkIdx) => (
                        <a 
                          key={linkIdx}
                          href={lnk} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                        >
                          <ExternalLink size={10} />
                          Link{task.links?.length > 1 ? ` ${linkIdx + 1}` : ''}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Backup 1 Column */}
                  <div className="flex items-center gap-1 justify-center">
                    <select
                      value={task.backup_user_1 || ''}
                      onChange={(e) => quickUpdateBackup(task.id, 'backup_user_1', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white cursor-pointer ${
                        task.backup_user_1 ? 'border-orange-300 text-slate-700' : 'border-red-200 text-red-400 bg-red-50/30'
                      }`}
                    >
                      <option value="">— none —</option>
                      {(users || []).filter(u => u.role !== 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    {savedBackup === task.id + 'backup_user_1' && (
                      <span className="text-green-500 text-[10px] font-bold whitespace-nowrap">✓</span>
                    )}
                  </div>

                  {/* Backup 2 Column */}
                  <div className="flex items-center gap-1 justify-center">
                    <select
                      value={task.backup_user_2 || ''}
                      onChange={(e) => quickUpdateBackup(task.id, 'backup_user_2', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white cursor-pointer ${
                        task.backup_user_2 ? 'border-amber-300 text-slate-700' : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      <option value="">— none —</option>
                      {(users || []).filter(u => u.role !== 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    {savedBackup === task.id + 'backup_user_2' && (
                      <span className="text-green-500 text-[10px] font-bold whitespace-nowrap">✓</span>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => handleEdit(task)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(task.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <p className="text-slate-500">No tasks found matching your filters</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <TaskModal
          task={editingTask}
          onClose={() => {
            setShowModal(false);
            setEditingTask(null);
          }}
          onSave={handleSave}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Task?</h3>
            <p className="text-slate-600 mb-6">
              This will permanently remove this task from all employees' playbooks. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Playbook Modal */}
      {showPreview && (
        <PlaybookPreviewModal
          taskTemplates={taskTemplates}
          TIME_SLOTS={TIME_SLOTS}
          DEPARTMENTS={DEPARTMENTS}
          SHIFT_TYPES={SHIFT_TYPES}
          previewDepartment={previewDepartment}
          setPreviewDepartment={setPreviewDepartment}
          previewShift={previewShift}
          setPreviewShift={setPreviewShift}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

function TaskModal({ task, onClose, onSave, onDuplicate }) {
  const { TIME_SLOTS, DEPARTMENTS, SHIFT_TYPES, users } = useApp();
  
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [timeSlot, setTimeSlot] = useState(task?.time_slot || 'morning');
  const [specificTime, setSpecificTime] = useState(task?.specific_time || '');
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || 'everyone');
  const [links, setLinks] = useState(task?.links || (task?.link ? [task.link] : ['']));
  const [frequency, setFrequency] = useState(task?.frequency || 'daily');
  const [daysOfWeek, setDaysOfWeek] = useState(task?.days_of_week || [1, 2, 3, 4, 5]); // Mon-Fri default
  const [shiftType, setShiftType] = useState(task?.shift_type || '');
  const [backupUser1, setBackupUser1] = useState(task?.backup_user_1 || '');
  const [backupUser2, setBackupUser2] = useState(task?.backup_user_2 || '');

  const addLink = () => setLinks([...links, '']);
  const removeLink = (index) => setLinks(links.filter((_, i) => i !== index));
  const updateLink = (index, value) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  // Group users by department for the dropdown
  const usersByDepartment = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept.id] = (users || []).filter(u => u.department === dept.id && u.role !== 'admin');
    return acc;
  }, {});

  // Determine if assignedTo is a user ID (not 'everyone' and not a department ID)
  const isDepartment = assignedTo === 'everyone' || DEPARTMENTS.some(d => d.id === assignedTo);
  const isUserAssignment = !isDepartment;
  
  // Get the department context for shift type display
  const getAssignedDepartment = () => {
    if (assignedTo === 'everyone') return null;
    if (DEPARTMENTS.some(d => d.id === assignedTo)) return assignedTo;
    // It's a user ID - find their department
    const assignedUser = (users || []).find(u => u.id === assignedTo);
    return assignedUser?.department || null;
  };
  const assignedDepartment = getAssignedDepartment();

  const toggleDay = (dayId) => {
    setDaysOfWeek(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId].sort((a, b) => a - b)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Filter out empty links
    const validLinks = links.filter(l => l.trim());

    onSave({
      title: title.trim(),
      description: description.trim() || null,
      time_slot: timeSlot,
      specific_time: specificTime || null,
      assigned_to: assignedTo,
      link: validLinks[0] || null, // Keep single link for backwards compatibility
      links: validLinks.length > 0 ? validLinks : null, // New: array of links
      frequency,
      days_of_week: frequency === 'weekly' ? daysOfWeek : null,
      shift_type: shiftType || null,
      backup_user_1: backupUser1 || null,
      backup_user_2: backupUser2 || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-slate-800">
            {task ? 'Edit Task' : 'Add New Task'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the task..."
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue resize-none"
            />
          </div>

          {/* Time Slot & Specific Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Time Slot
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              >
                {Object.values(TIME_SLOTS).map(slot => (
                  <option key={slot.id} value={slot.id}>{slot.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Specific Time (Optional)
              </label>
              <input
                type="time"
                value={specificTime}
                onChange={(e) => setSpecificTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Frequency
            </label>
            <div className="flex gap-2">
              {[
                { id: 'daily', label: 'Every Day', icon: Repeat },
                { id: 'weekly', label: 'Specific Days', icon: Calendar },
                { id: 'one_time', label: 'One-Time', icon: CalendarDays },
              ].map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFrequency(opt.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-colors ${
                      frequency === opt.id
                        ? 'border-asap-blue bg-blue-50 text-asap-blue'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Days of Week (for weekly) */}
          {frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Days
              </label>
              <div className="flex gap-1">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                      daysOfWeek.includes(day.id)
                        ? 'bg-asap-blue text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Task will appear only on selected days
              </p>
            </div>
          )}

          {/* One-time info */}
          {frequency === 'one_time' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-800">
                <strong>One-time task:</strong> This task will appear today and be removed after completion or at end of day.
              </p>
            </div>
          )}

          {/* Assign To */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Assign To
            </label>
            <select
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value);
                // Reset shift type when changing assignment
                setShiftType('');
              }}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
            >
              <option value="everyone">Everyone</option>
              <optgroup label="── Departments ──">
                {DEPARTMENTS.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </optgroup>
              {DEPARTMENTS.map(dept => {
                const deptUsers = usersByDepartment[dept.id];
                if (!deptUsers || deptUsers.length === 0) return null;
                return (
                  <optgroup key={`users-${dept.id}`} label={`── ${dept.name} (Individual) ──`}>
                    {deptUsers.map(u => (
                      <option key={u.id} value={u.id}>👤 {u.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {isUserAssignment && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <User size={12} />
                Assigned to individual — only this person will see this task
              </p>
            )}
          </div>

          {/* Shift Type - show when department has shifts */}
          {assignedDepartment && SHIFT_TYPES[assignedDepartment] && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Shift Type {assignedDepartment ? `(${DEPARTMENTS.find(d => d.id === assignedDepartment)?.name || ''})` : ''}
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              >
                <option value="">All Shifts</option>
                {SHIFT_TYPES[assignedDepartment].map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Leave as "All Shifts" to show for all shifts in this department</p>
            </div>
          )}
          {assignedTo === 'everyone' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Shift Type (Optional)
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              >
                <option value="">All Shifts</option>
                <option value="7-4">7:00 AM - 4:00 PM</option>
                <option value="7-6">7:00 AM - 6:00 PM</option>
                <option value="8-5">8:00 AM - 5:00 PM</option>
                <option value="10-7">10:00 AM - 7:00 PM</option>
                <option value="7-7">7:00 AM - 7:00 PM</option>
              </select>
            </div>
          )}

          {/* Backup Users */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Backup Users (Optional)
            </label>
            <p className="text-xs text-slate-500 mb-2">Who covers this task when the assigned person is out?</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-orange-600 mb-1">🛡 Backup 1 (Primary)</label>
                <select
                  value={backupUser1}
                  onChange={(e) => setBackupUser1(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                >
                  <option value="">None</option>
                  {DEPARTMENTS.map(dept => {
                    const deptUsers = usersByDepartment[dept.id];
                    if (!deptUsers || deptUsers.length === 0) return null;
                    return (
                      <optgroup key={`b1-${dept.id}`} label={dept.name}>
                        {deptUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">🛡 Backup 2 (If #1 is out)</label>
                <select
                  value={backupUser2}
                  onChange={(e) => setBackupUser2(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                >
                  <option value="">None</option>
                  {DEPARTMENTS.map(dept => {
                    const deptUsers = usersByDepartment[dept.id];
                    if (!deptUsers || deptUsers.length === 0) return null;
                    return (
                      <optgroup key={`b2-${dept.id}`} label={dept.name}>
                        {deptUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Links / Filter URLs (Optional)
            </label>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => updateLink(index, e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLink(index)}
                      className="px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addLink}
                className="flex items-center gap-1 text-sm text-asap-blue hover:text-blue-700 font-medium"
              >
                <Plus size={14} />
                Add Another Link
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Add Pipedrive filters, Google Docs, or other resource links</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            {task && onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(task)}
                className="flex-1 px-4 py-2.5 border-2 border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Copy size={16} />
                Duplicate
              </button>
            )}
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-asap-blue text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              {task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getSlotColor(slotId) {
  const colors = {
    morning: 'amber',
    am_timed: 'blue',
    afternoon: 'orange',
    pm_timed: 'purple',
    eod: 'slate',
    evening: 'indigo',
  };
  return colors[slotId] || 'slate';
}

function formatTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function PlaybookPreviewModal({ 
  taskTemplates, 
  TIME_SLOTS, 
  DEPARTMENTS, 
  SHIFT_TYPES,
  previewDepartment,
  setPreviewDepartment,
  previewShift,
  setPreviewShift,
  onClose 
}) {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Get shifts available for selected department
  const availableShifts = SHIFT_TYPES[previewDepartment] || [];

  // Update shift when department changes
  const handleDepartmentChange = (dept) => {
    setPreviewDepartment(dept);
    const shifts = SHIFT_TYPES[dept] || [];
    if (shifts.length > 0 && !shifts.find(s => s.id === previewShift)) {
      setPreviewShift(shifts[0].id);
    }
  };

  // Filter tasks for the preview (mimics getTasksForUser logic)
  const previewTasks = taskTemplates.filter(task => {
    // Check assignment
    if (task.assigned_to === 'everyone') {}
    else if (task.assigned_to === previewDepartment) {}
    else if (Array.isArray(task.assigned_to) && task.assigned_to.includes(previewDepartment)) {}
    else return false;

    // Check shift_type if specified
    if (previewShift && task.shift_type && task.shift_type !== previewShift) {
      return false;
    }

    // Check frequency
    const frequency = task.frequency || 'daily';
    
    if (frequency === 'one_time') {
      return true;
    }
    
    if (frequency === 'weekly') {
      const daysOfWeek = task.days_of_week || [1, 2, 3, 4, 5];
      return daysOfWeek.includes(dayOfWeek);
    }
    
    return true;
  });

  // Group by time slot
  const groupedTasks = Object.values(TIME_SLOTS).map(slot => ({
    ...slot,
    tasks: previewTasks.filter(t => t.time_slot === slot.id),
  }));

  const totalTasks = previewTasks.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <Eye size={22} className="text-purple-500" />
              Preview Playbook
            </h2>
            <p className="text-sm text-slate-500 mt-1">See exactly what employees will see in their daily playbook</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Selectors */}
        <div className="p-4 bg-purple-50 border-b flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-purple-600" />
            <label className="text-sm font-medium text-purple-800">Department:</label>
            <select
              value={previewDepartment}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="px-3 py-2 border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 text-sm"
            >
              {DEPARTMENTS.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {availableShifts.length > 0 && (
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-purple-600" />
              <label className="text-sm font-medium text-purple-800">Shift:</label>
              <select
                value={previewShift}
                onChange={(e) => setPreviewShift(e.target.value)}
                className="px-3 py-2 border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 text-sm"
              >
                {availableShifts.map(shift => (
                  <option key={shift.id} value={shift.id}>{shift.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="ml-auto bg-white px-4 py-2 rounded-lg border border-purple-200">
            <span className="text-sm text-purple-700 font-medium">{totalTasks} tasks today</span>
          </div>
        </div>

        {/* Preview Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {groupedTasks.map(slot => slot.tasks.length > 0 && (
              <div key={slot.id} className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                <div className={`px-4 py-2 bg-${getSlotColor(slot.id)}-100 border-b border-${getSlotColor(slot.id)}-200`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className={`text-${getSlotColor(slot.id)}-600`} />
                      <span className={`font-medium text-${getSlotColor(slot.id)}-800`}>{slot.label}</span>
                    </div>
                    <span className={`text-sm text-${getSlotColor(slot.id)}-600`}>{slot.tasks.length} tasks</span>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-200">
                  {slot.tasks.map((task, idx) => (
                    <div key={task.id} className="p-3 flex items-center gap-3 bg-white">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{task.title}</p>
                        {task.specific_time && (
                          <p className="text-xs text-slate-500">@ {formatTime(task.specific_time)}</p>
                        )}
                      </div>
                      {task.shift_type && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          {task.shift_type} only
                        </span>
                      )}
                      {(task.links?.length > 0 || task.link) && (
                        <ExternalLink size={14} className="text-slate-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {totalTasks === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Users size={48} className="mx-auto mb-4 text-slate-300" />
                <p className="font-medium">No tasks assigned</p>
                <p className="text-sm">This department/shift combination has no tasks for today</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
          <p className="text-xs text-slate-500">
            Previewing: <span className="font-medium">{DEPARTMENTS.find(d => d.id === previewDepartment)?.name}</span>
            {previewShift && availableShifts.length > 0 && (
              <> • <span className="font-medium">{availableShifts.find(s => s.id === previewShift)?.name}</span></>
            )}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminTasks;
