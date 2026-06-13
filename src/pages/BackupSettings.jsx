import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle,
  CheckCircle,
  Search,
  ClipboardList,
  UserCheck,
  RefreshCw,
  History,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowRightLeft,
  Clock,
  Square,
  CheckSquare,
  X
} from 'lucide-react';

export default function BackupSettings() {
  const { supabase, user } = useApp();
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [userBackups, setUserBackups] = useState([]);
  const [taskBackups, setTaskBackups] = useState([]);
  const [coverageLog, setCoverageLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('user'); // 'user', 'task', 'quick', 'log'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUsers, setExpandedUsers] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Quick Reassign state
  const [quickReassignFrom, setQuickReassignFrom] = useState('');
  const [quickReassignTo, setQuickReassignTo] = useState('');
  const [quickReassignMode, setQuickReassignMode] = useState('all'); // 'all' or 'select'
  const [userTasks, setUserTasks] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // New backup form state
  const [newUserBackup, setNewUserBackup] = useState({ userId: '', backupUserId: '' });
  const [newTaskBackup, setNewTaskBackup] = useState({ taskId: '', backupUserId: '', timeSlot: '' });

  // Enhanced backup assignment state
  const [selectedOutUser, setSelectedOutUser] = useState('');
  const [outUserTasks, setOutUserTasks] = useState([]);
  const [backupLevels, setBackupLevels] = useState([
    { priority: 1, label: '1st Backup (Primary)', assignments: [] },
    { priority: 2, label: '2nd Backup (If 1st is out)', assignments: [] },
    { priority: 3, label: '3rd Backup (If 1st & 2nd are out)', assignments: [] },
  ]);
  const [loadingOutUserTasks, setLoadingOutUserTasks] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('name');
      setUsers(usersData || []);

      // Load tasks from task_templates (master list - no duplicates)
      const { data: tasksData } = await supabase
        .from('task_templates')
        .select('*')
        .order('department, title');
      setTasks(tasksData || []);

      // Load user backups
      const { data: userBackupsData } = await supabase
        .from('user_backups')
        .select(`
          *,
          user:user_id(id, name, department),
          backup_user:backup_user_id(id, name, department)
        `)
        .order('priority');
      setUserBackups(userBackupsData || []);

      // Load task backups
      const { data: taskBackupsData } = await supabase
        .from('task_backups')
        .select(`
          *,
          task:task_id(id, title, department),
          backup_user:backup_user_id(id, name, department)
        `)
        .order('priority');
      setTaskBackups(taskBackupsData || []);

      // Load recent coverage log
      const { data: logData } = await supabase
        .from('coverage_log')
        .select(`
          *,
          original_user:original_user_id(id, name),
          coverage_user:coverage_user_id(id, name),
          task:task_id(id, title)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      setCoverageLog(logData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('Error loading data', 'error');
    }
    setLoading(false);
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Group user backups by user
  const groupedUserBackups = userBackups.reduce((acc, backup) => {
    if (!backup.user) return acc;
    const userId = backup.user.id;
    if (!acc[userId]) {
      acc[userId] = {
        user: backup.user,
        backups: []
      };
    }
    acc[userId].backups.push(backup);
    return acc;
  }, {});

  // Group task backups by task
  const groupedTaskBackups = taskBackups.reduce((acc, backup) => {
    if (!backup.task) return acc;
    const taskId = backup.task.id;
    if (!acc[taskId]) {
      acc[taskId] = {
        task: backup.task,
        backups: []
      };
    }
    acc[taskId].backups.push(backup);
    return acc;
  }, {});

  // Add user backup
  const addUserBackup = async () => {
    if (!newUserBackup.userId || !newUserBackup.backupUserId) {
      showMessage('Please select both user and backup', 'error');
      return;
    }
    if (newUserBackup.userId === newUserBackup.backupUserId) {
      showMessage('User cannot be their own backup', 'error');
      return;
    }

    setSaving(true);
    try {
      // Get current max priority for this user
      const existingBackups = userBackups.filter(b => b.user_id === newUserBackup.userId);
      const maxPriority = existingBackups.length > 0 
        ? Math.max(...existingBackups.map(b => b.priority)) 
        : 0;

      const { error } = await supabase
        .from('user_backups')
        .insert({
          user_id: newUserBackup.userId,
          backup_user_id: newUserBackup.backupUserId,
          priority: maxPriority + 1
        });

      if (error) throw error;
      
      showMessage('Backup added successfully');
      setNewUserBackup({ userId: '', backupUserId: '' });
      loadData();
    } catch (error) {
      console.error('Error adding backup:', error);
      showMessage(error.message || 'Error adding backup', 'error');
    }
    setSaving(false);
  };

  // Enhanced backup functions
  const loadOutUserTasks = async (userId) => {
    if (!userId) {
      setOutUserTasks([]);
      setBackupLevels([
        { priority: 1, label: '1st Backup (Primary)', assignments: [] },
        { priority: 2, label: '2nd Backup (If 1st is out)', assignments: [] },
        { priority: 3, label: '3rd Backup (If 1st & 2nd are out)', assignments: [] },
      ]);
      return;
    }
    
    setLoadingOutUserTasks(true);
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      // Load tasks for this user's department from task_templates
      const { data: tasksData } = await supabase
        .from('task_templates')
        .select('*')
        .order('time_slot, title');
      
      // Filter to tasks relevant to this user's department
      const relevantTasks = (tasksData || []).filter(t => {
        const assignedTo = t.assigned_to;
        if (assignedTo === 'everyone') return true;
        if (assignedTo === user.department) return true;
        if (assignedTo === userId) return true;
        if (Array.isArray(assignedTo) && (assignedTo.includes(user.department) || assignedTo.includes('everyone') || assignedTo.includes(userId))) return true;
        // Also include tasks from the same department
        if (t.department === user.department) return true;
        return false;
      });
      
      setOutUserTasks(relevantTasks);
      setBackupLevels([
        { priority: 1, label: '1st Backup (Primary)', assignments: [] },
        { priority: 2, label: '2nd Backup (If 1st is out)', assignments: [] },
        { priority: 3, label: '3rd Backup (If 1st & 2nd are out)', assignments: [] },
      ]);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
    setLoadingOutUserTasks(false);
  };

  const addBackupUserToLevel = (priority, backupUserId) => {
    if (!backupUserId) return;
    
    // Check if user is already assigned at any level
    const alreadyAssigned = backupLevels.some(level => 
      level.assignments.some(a => a.backupUserId === backupUserId)
    );
    if (alreadyAssigned) {
      showMessage('This user is already assigned as a backup', 'error');
      return;
    }
    
    setBackupLevels(backupLevels.map(level => {
      if (level.priority !== priority) return level;
      return {
        ...level,
        assignments: [...level.assignments, { backupUserId, selectedTaskIds: [] }]
      };
    }));
  };

  const removeBackupUserFromLevel = (priority, backupUserId) => {
    setBackupLevels(backupLevels.map(level => {
      if (level.priority !== priority) return level;
      return {
        ...level,
        assignments: level.assignments.filter(a => a.backupUserId !== backupUserId)
      };
    }));
  };

  const toggleTaskForBackupInLevel = (priority, backupUserId, taskId) => {
    setBackupLevels(backupLevels.map(level => {
      if (level.priority !== priority) return level;
      return {
        ...level,
        assignments: level.assignments.map(a => {
          if (a.backupUserId !== backupUserId) return a;
          const hasTask = a.selectedTaskIds.includes(taskId);
          return {
            ...a,
            selectedTaskIds: hasTask 
              ? a.selectedTaskIds.filter(id => id !== taskId)
              : [...a.selectedTaskIds, taskId]
          };
        })
      };
    }));
  };

  const toggleAllTasksForBackupInLevel = (priority, backupUserId, selectAll) => {
    setBackupLevels(backupLevels.map(level => {
      if (level.priority !== priority) return level;
      return {
        ...level,
        assignments: level.assignments.map(a => {
          if (a.backupUserId !== backupUserId) return a;
          return {
            ...a,
            selectedTaskIds: selectAll ? outUserTasks.map(t => t.id) : []
          };
        })
      };
    }));
  };

  const saveEnhancedBackups = async () => {
    if (!selectedOutUser) {
      showMessage('Please select a user who will be out', 'error');
      return;
    }

    // Check if any level has assignments
    const hasAssignments = backupLevels.some(level => 
      level.assignments.some(a => a.selectedTaskIds.length > 0)
    );
    if (!hasAssignments) {
      showMessage('Please add at least one backup user and select tasks', 'error');
      return;
    }

    setSaving(true);
    try {
      // Process each priority level
      for (const level of backupLevels) {
        for (let i = 0; i < level.assignments.length; i++) {
          const assignment = level.assignments[i];
          if (assignment.selectedTaskIds.length === 0) continue;

          // Check if this user backup already exists
          const existingBackup = userBackups.find(
            b => b.user_id === selectedOutUser && b.backup_user_id === assignment.backupUserId
          );

          if (!existingBackup) {
            // Add user backup with correct priority
            await supabase.from('user_backups').insert({
              user_id: selectedOutUser,
              backup_user_id: assignment.backupUserId,
              priority: level.priority
            });
          }

          // Save task-specific backups
          for (const taskId of assignment.selectedTaskIds) {
            // Check if this task backup already exists
            const existingTaskBackup = taskBackups.find(
              b => b.task_id === taskId && b.backup_user_id === assignment.backupUserId
            );

            if (!existingTaskBackup) {
              await supabase.from('task_backups').insert({
                task_id: taskId,
                backup_user_id: assignment.backupUserId,
                priority: level.priority
              });
            }
          }
        }
      }

      showMessage('Backup assignments saved successfully!');
      setSelectedOutUser('');
      setOutUserTasks([]);
      setBackupLevels([
        { priority: 1, label: '1st Backup (Primary)', assignments: [] },
        { priority: 2, label: '2nd Backup (If 1st is out)', assignments: [] },
        { priority: 3, label: '3rd Backup (If 1st & 2nd are out)', assignments: [] },
      ]);
      loadData();
    } catch (error) {
      console.error('Error saving backups:', error);
      showMessage(error.message || 'Error saving backups', 'error');
    }
    setSaving(false);
  };

  // Add task backup
  const addTaskBackup = async () => {
    if (!newTaskBackup.taskId || !newTaskBackup.backupUserId) {
      showMessage('Please select both task and backup user', 'error');
      return;
    }

    setSaving(true);
    try {
      // Get current max priority for this task
      const existingBackups = taskBackups.filter(b => b.task_id === newTaskBackup.taskId);
      const maxPriority = existingBackups.length > 0 
        ? Math.max(...existingBackups.map(b => b.priority)) 
        : 0;

      const { error } = await supabase
        .from('task_backups')
        .insert({
          task_id: newTaskBackup.taskId,
          backup_user_id: newTaskBackup.backupUserId,
          priority: maxPriority + 1,
          ...(newTaskBackup.timeSlot ? { time_slot: newTaskBackup.timeSlot } : {})
        });

      if (error) throw error;
      
      showMessage('Task backup added successfully');
      setNewTaskBackup({ taskId: '', backupUserId: '', timeSlot: '' });
      loadData();
    } catch (error) {
      console.error('Error adding task backup:', error);
      showMessage(error.message || 'Error adding task backup', 'error');
    }
    setSaving(false);
  };

  // Delete backup
  const deleteBackup = async (table, id) => {
    if (!confirm('Are you sure you want to remove this backup?')) return;
    
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      showMessage('Backup removed');
      loadData();
    } catch (error) {
      console.error('Error deleting backup:', error);
      showMessage('Error removing backup', 'error');
    }
  };

  // Update priority
  const updatePriority = async (table, id, newPriority) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({ priority: newPriority })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  // Filter users by department
  const filteredUsers = users.filter(u => 
    selectedDepartment === 'all' || u.department === selectedDepartment
  );

  // Filter tasks by search and department - EXCLUDE temp tasks from backups
  const filteredTasks = tasks.filter(t => 
    !t.is_temp && // Exclude temp tasks - they shouldn't have backups
    (selectedDepartment === 'all' || t.department === selectedDepartment) &&
    (searchTerm === '' || t.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // ALL non-temp tasks for backup dropdown (regardless of department filter)
  const allBackupTasks = tasks.filter(t => !t.is_temp).sort((a, b) => {
    // Sort by department then title
    if (a.department !== b.department) {
      return (a.department || '').localeCompare(b.department || '');
    }
    return (a.title || '').localeCompare(b.title || '');
  });

  const getDepartmentLabel = (dept) => {
    const labels = {
      'leadership': 'Leadership',
      'credit_consultants': 'Consultants',
      'account_managers': 'Account Managers',
      'customer_support': 'Customer Support',
      'credit_team': 'Credit Team'
    };
    return labels[dept] || dept;
  };

  const getDepartmentColor = (dept) => {
    const colors = {
      'leadership': 'bg-purple-100 text-purple-800',
      'credit_consultants': 'bg-blue-100 text-blue-800',
      'account_managers': 'bg-green-100 text-green-800',
      'customer_support': 'bg-orange-100 text-orange-800',
      'credit_team': 'bg-cyan-100 text-cyan-800'
    };
    return colors[dept] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-blue-600" />
            Backup & Coverage Settings
          </h1>
          <p className="text-slate-500 mt-1">
            Configure who covers tasks when someone is out or doesn't show up
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b pb-4">
        <button
          onClick={() => setActiveTab('user')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'user' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          User Backups
        </button>
        <button
          onClick={() => setActiveTab('task')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'task' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Task Backups
        </button>
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'quick' 
              ? 'bg-orange-600 text-white' 
              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          Quick Reassign
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'log' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Coverage Log
        </button>
      </div>

      {/* Department Filter */}
      {activeTab !== 'log' && (
        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm font-medium text-slate-600">Filter by Department:</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Departments</option>
            <option value="leadership">Leadership</option>
            <option value="credit_consultants">Consultants</option>
            <option value="account_managers">Account Managers</option>
            <option value="customer_support">Customer Support</option>
            <option value="credit_team">Credit Team</option>
          </select>
        </div>
      )}

      {/* USER BACKUPS TAB */}
      {activeTab === 'user' && (
        <div className="space-y-6">
          {/* Enhanced Backup Assignment */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Assign Backup Coverage
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              Select the user who will be out, then add backup users and choose which tasks each backup should handle.
            </p>
            
            {/* Step 1: Select user who will be out */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Step 1: Who will be out?
              </label>
              <select
                value={selectedOutUser}
                onChange={(e) => {
                  setSelectedOutUser(e.target.value);
                  loadOutUserTasks(e.target.value);
                }}
                className="w-full max-w-md px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select user...</option>
                {filteredUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getDepartmentLabel(u.department)})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Add backup users by priority level */}
            {selectedOutUser && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-4">
                  Step 2: Add backup users at each priority level
                </label>
                
                {/* Priority Levels */}
                <div className="space-y-6">
                  {backupLevels.map((level) => {
                    const levelColor = level.priority === 1 ? 'green' : level.priority === 2 ? 'amber' : 'red';
                    const bgColor = level.priority === 1 ? 'bg-green-50' : level.priority === 2 ? 'bg-amber-50' : 'bg-red-50';
                    const borderColor = level.priority === 1 ? 'border-green-200' : level.priority === 2 ? 'border-amber-200' : 'border-red-200';
                    const textColor = level.priority === 1 ? 'text-green-800' : level.priority === 2 ? 'text-amber-800' : 'text-red-800';
                    const avatarBg = level.priority === 1 ? 'bg-green-600' : level.priority === 2 ? 'bg-amber-600' : 'bg-red-600';
                    
                    // Get all already assigned users across all levels
                    const assignedUserIds = backupLevels.flatMap(l => l.assignments.map(a => a.backupUserId));
                    
                    return (
                      <div key={level.priority} className={`border ${borderColor} rounded-lg overflow-hidden`}>
                        {/* Level Header */}
                        <div className={`${bgColor} p-3 border-b ${borderColor}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full ${avatarBg} text-white flex items-center justify-center text-sm font-bold`}>
                                {level.priority}
                              </span>
                              <span className={`font-semibold ${textColor}`}>{level.label}</span>
                              {level.assignments.length > 0 && (
                                <span className="text-sm text-slate-500">
                                  ({level.assignments.length} user{level.assignments.length !== 1 ? 's' : ''})
                                </span>
                              )}
                            </div>
                            
                            {/* Add user dropdown for this level */}
                            <div className="flex gap-2">
                              <select
                                id={`addBackupLevel${level.priority}`}
                                className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                                defaultValue=""
                              >
                                <option value="">+ Add backup user...</option>
                                {users
                                  .filter(u => u.id !== selectedOutUser && !assignedUserIds.includes(u.id))
                                  .map(u => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => {
                                  const select = document.getElementById(`addBackupLevel${level.priority}`);
                                  if (select.value) {
                                    addBackupUserToLevel(level.priority, select.value);
                                    select.value = '';
                                  }
                                }}
                                className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Backup users in this level */}
                        <div className="p-3">
                          {level.assignments.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-2">
                              No backup users at this level yet
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {level.assignments.map(assignment => {
                                const backupUser = users.find(u => u.id === assignment.backupUserId);
                                const allSelected = assignment.selectedTaskIds.length === outUserTasks.length && outUserTasks.length > 0;
                                
                                return (
                                  <div key={assignment.backupUserId} className="border rounded-lg overflow-hidden">
                                    <div className="flex items-center justify-between p-2 bg-slate-50 border-b">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-full ${avatarBg} text-white flex items-center justify-center text-xs font-semibold`}>
                                          {backupUser?.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                          <div className="font-medium text-sm text-slate-800">{backupUser?.name || 'Unknown'}</div>
                                          <div className="text-xs text-slate-500">
                                            {assignment.selectedTaskIds.length} of {outUserTasks.length} tasks
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => toggleAllTasksForBackupInLevel(level.priority, assignment.backupUserId, !allSelected)}
                                          className="text-xs px-2 py-0.5 bg-white border rounded hover:bg-slate-50"
                                        >
                                          {allSelected ? 'None' : 'All'}
                                        </button>
                                        <button
                                          onClick={() => removeBackupUserFromLevel(level.priority, assignment.backupUserId)}
                                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {/* Task checkboxes */}
                                    <div className="p-2 max-h-40 overflow-y-auto">
                                      {loadingOutUserTasks ? (
                                        <div className="text-center py-2 text-slate-500 text-sm">Loading...</div>
                                      ) : outUserTasks.length === 0 ? (
                                        <div className="text-center py-2 text-slate-500 text-sm">No tasks found</div>
                                      ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                          {outUserTasks.map(task => {
                                            const isSelected = assignment.selectedTaskIds.includes(task.id);
                                            return (
                                              <button
                                                key={task.id}
                                                type="button"
                                                onClick={() => toggleTaskForBackupInLevel(level.priority, assignment.backupUserId, task.id)}
                                                className={`flex items-center gap-2 p-1.5 rounded text-left text-sm transition ${
                                                  isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                                                }`}
                                              >
                                                {isSelected ? (
                                                  <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                ) : (
                                                  <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                )}
                                                <span className="truncate text-slate-700">{task.title}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save button */}
            {backupLevels.some(l => l.assignments.length > 0) && (
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={saveEnhancedBackups}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Backup Assignments
                </button>
              </div>
            )}
          </div>

          {/* Quick Add (Simple Mode) */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Quick Add (All Tasks)
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              Quickly assign ALL tasks from one user to a backup (no task selection).
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  When this user is out:
                </label>
                <select
                  value={newUserBackup.userId}
                  onChange={(e) => setNewUserBackup({ ...newUserBackup, userId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select user...</option>
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({getDepartmentLabel(u.department)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <ArrowRight className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Assign all tasks to:
                </label>
                <select
                  value={newUserBackup.backupUserId}
                  onChange={(e) => setNewUserBackup({ ...newUserBackup, backupUserId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select backup...</option>
                  {users.filter(u => u.id !== newUserBackup.userId).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({getDepartmentLabel(u.department)})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={addUserBackup}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Backup
              </button>
            </div>
          </div>

          {/* Existing User Backups */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Current User Backups ({Object.keys(groupedUserBackups).length} users configured)
            </h2>
            
            {Object.keys(groupedUserBackups).length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No user backups configured yet. Add one above!
              </p>
            ) : (
              <div className="space-y-3">
                {Object.values(groupedUserBackups).map(({ user, backups }) => (
                  <div key={user.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedUsers({ ...expandedUsers, [user.id]: !expandedUsers[user.id] })}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                          {user.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-slate-800">{user.name}</div>
                          <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${getDepartmentColor(user.department)}`}>
                            {getDepartmentLabel(user.department)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">
                          {backups.length} backup{backups.length !== 1 ? 's' : ''}
                        </span>
                        {expandedUsers[user.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>
                    
                    {expandedUsers[user.id] && (
                      <div className="p-4 space-y-2 bg-white">
                        {backups.sort((a, b) => a.priority - b.priority).map((backup, index) => (
                          <div 
                            key={backup.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium flex items-center justify-center">
                                {backup.priority}
                              </span>
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-semibold">
                                  {backup.backup_user?.name?.charAt(0)}
                                </div>
                                <span className="font-medium text-slate-700">
                                  {backup.backup_user?.name}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={backup.priority}
                                onChange={(e) => updatePriority('user_backups', backup.id, parseInt(e.target.value))}
                                className="px-2 py-1 border rounded text-sm"
                              >
                                {[1, 2, 3, 4, 5].map(p => (
                                  <option key={p} value={p}>Priority {p}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => deleteBackup('user_backups', backup.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TASK BACKUPS TAB */}
      {activeTab === 'task' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Add New Task Backup */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Add Task-Specific Backup
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              Override the user-level backup for specific tasks. This takes priority over user backups.
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[250px]">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Task:
                </label>
                <select
                  value={newTaskBackup.taskId}
                  onChange={(e) => setNewTaskBackup({ ...newTaskBackup, taskId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select task...</option>
                  {allBackupTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({getDepartmentLabel(t.department)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <ArrowRight className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Backup User:
                </label>
                <select
                  value={newTaskBackup.backupUserId}
                  onChange={(e) => setNewTaskBackup({ ...newTaskBackup, backupUserId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select backup...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({getDepartmentLabel(u.department)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Time Slot (optional):
                </label>
                <select
                  value={newTaskBackup.timeSlot}
                  onChange={(e) => setNewTaskBackup({ ...newTaskBackup, timeSlot: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Same as original</option>
                  <option value="morning">Morning</option>
                  <option value="am_timed">AM (Timed)</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="pm_timed">PM (12:01-4:00)</option>
                  <option value="end_of_day">End of Day</option>
                  <option value="evening">Evening (4:01-7:00)</option>
                </select>
              </div>
              <button
                onClick={addTaskBackup}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Backup
              </button>
            </div>
          </div>

          {/* Existing Task Backups */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Current Task Backups ({Object.keys(groupedTaskBackups).length} tasks configured)
            </h2>
            
            {Object.keys(groupedTaskBackups).length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No task-specific backups configured. Tasks will use user-level backups by default.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.values(groupedTaskBackups).map(({ task, backups }) => (
                  <div key={task.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedTasks({ ...expandedTasks, [task.id]: !expandedTasks[task.id] })}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="text-left">
                        <div className="font-medium text-slate-800">{task.title}</div>
                        <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${getDepartmentColor(task.department)}`}>
                          {getDepartmentLabel(task.department)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">
                          {backups.length} backup{backups.length !== 1 ? 's' : ''}
                        </span>
                        {expandedTasks[task.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>
                    
                    {expandedTasks[task.id] && (
                      <div className="p-4 space-y-2 bg-white">
                        {backups.sort((a, b) => a.priority - b.priority).map((backup) => (
                          <div 
                            key={backup.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 text-sm font-medium flex items-center justify-center">
                                {backup.priority}
                              </span>
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-semibold">
                                  {backup.backup_user?.name?.charAt(0)}
                                </div>
                                <span className="font-medium text-slate-700">
                                  {backup.backup_user?.name}
                                </span>
                                {backup.time_slot && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    {backup.time_slot === 'morning' ? 'Morning' :
                                     backup.time_slot === 'am_timed' ? 'AM (Timed)' :
                                     backup.time_slot === 'afternoon' ? 'Afternoon' :
                                     backup.time_slot === 'pm_timed' ? 'PM (12:01-4:00)' :
                                     backup.time_slot === 'end_of_day' ? 'End of Day' :
                                     backup.time_slot === 'evening' ? 'Evening (4:01-7:00)' :
                                     backup.time_slot}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={backup.priority}
                                onChange={(e) => updatePriority('task_backups', backup.id, parseInt(e.target.value))}
                                className="px-2 py-1 border rounded text-sm"
                              >
                                {[1, 2, 3, 4, 5].map(p => (
                                  <option key={p} value={p}>Priority {p}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => deleteBackup('task_backups', backup.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK REASSIGN TAB */}
      {activeTab === 'quick' && (
        <div className="space-y-6">
          {/* Quick Reassign Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-8 h-8" />
              <h2 className="text-xl font-bold">Quick Task Reassignment</h2>
            </div>
            <p className="text-orange-100">
              Instantly move tasks from one employee to another. Use when someone goes home sick, 
              has an emergency, or you need to redistribute workload on the fly.
            </p>
          </div>

          {/* Reassignment Form */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* From User */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Move tasks FROM:
                </label>
                <select
                  value={quickReassignFrom}
                  onChange={async (e) => {
                    const userId = e.target.value;
                    setQuickReassignFrom(userId);
                    setSelectedTasks([]);
                    if (userId) {
                      setLoadingTasks(true);
                      // Get today's uncompleted tasks for this user
                      const today = new Date().toISOString().split('T')[0];
                      const { data: userTasksData } = await supabase
                        .from('task_templates')
                        .select('*')
                        .order('title');
                      
                      // Filter to tasks relevant to this user
                      const selectedUser = users.find(u => u.id === userId);
                      const relevantTasks = (userTasksData || []).filter(t => {
                        if (!selectedUser) return true;
                        const assignedTo = t.assigned_to;
                        if (assignedTo === 'everyone') return true;
                        if (assignedTo === selectedUser.department) return true;
                        if (assignedTo === userId) return true;
                        if (Array.isArray(assignedTo) && (assignedTo.includes(selectedUser.department) || assignedTo.includes('everyone') || assignedTo.includes(userId))) return true;
                        if (t.department === selectedUser.department) return true;
                        return false;
                      });
                      
                      // Get today's completions to filter out
                      const { data: completions } = await supabase
                        .from('task_completions')
                        .select('task_id')
                        .eq('user_id', userId)
                        .gte('completed_at', today);
                      
                      const completedIds = new Set((completions || []).map(c => c.task_id));
                      const incompleteTasks = relevantTasks.filter(t => !completedIds.has(t.id));
                      setUserTasks(incompleteTasks);
                      setLoadingTasks(false);
                    } else {
                      setUserTasks([]);
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                >
                  <option value="">Select employee...</option>
                  {users.filter(u => u.is_active !== false).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({getDepartmentLabel(u.department)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex justify-center">
                <ArrowRightLeft className="w-10 h-10 text-orange-500" />
              </div>

              {/* To User */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Reassign tasks TO:
                </label>
                <select
                  value={quickReassignTo}
                  onChange={(e) => setQuickReassignTo(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                >
                  <option value="">Select employee...</option>
                  {users.filter(u => u.id !== quickReassignFrom && u.is_active !== false).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({getDepartmentLabel(u.department)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mode Selection */}
            {quickReassignFrom && quickReassignTo && (
              <div className="mt-6 pt-6 border-t">
                <label className="block text-sm font-medium text-slate-600 mb-3">
                  What to reassign:
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setQuickReassignMode('all')}
                    className={`flex-1 p-4 rounded-lg border-2 transition ${
                      quickReassignMode === 'all' 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">All Tasks</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Move ALL {userTasks.length} uncompleted tasks
                    </div>
                  </button>
                  <button
                    onClick={() => setQuickReassignMode('select')}
                    className={`flex-1 p-4 rounded-lg border-2 transition ${
                      quickReassignMode === 'select' 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">Select Tasks</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Choose specific tasks to move
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Task Selection (if select mode) */}
            {quickReassignFrom && quickReassignTo && quickReassignMode === 'select' && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-600">
                    Select tasks to reassign ({selectedTasks.length} selected):
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTasks(userTasks.map(t => t.id))}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setSelectedTasks([])}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                
                {loadingTasks ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                  </div>
                ) : userTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No uncompleted tasks found for this user today.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                    {userTasks.map(task => (
                      <label
                        key={task.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition ${
                          selectedTasks.includes(task.id) ? 'bg-orange-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTasks([...selectedTasks, task.id]);
                            } else {
                              setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                            }
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{task.title}</div>
                          <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${getDepartmentColor(task.department)}`}>
                            {getDepartmentLabel(task.department)}
                          </div>
                        </div>
                        {task.time_block && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Clock className="w-4 h-4" />
                            {task.time_block}
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Execute Button */}
            {quickReassignFrom && quickReassignTo && (
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={async () => {
                    const tasksToReassign = quickReassignMode === 'all' 
                      ? userTasks 
                      : userTasks.filter(t => selectedTasks.includes(t.id));
                    
                    if (tasksToReassign.length === 0) {
                      showMessage('No tasks selected to reassign', 'error');
                      return;
                    }

                    if (!confirm(`Are you sure you want to reassign ${tasksToReassign.length} task(s) from ${users.find(u => u.id === quickReassignFrom)?.name} to ${users.find(u => u.id === quickReassignTo)?.name}?`)) {
                      return;
                    }

                    setSaving(true);
                    try {
                      // Log each reassignment
                      for (const task of tasksToReassign) {
                        await supabase.from('coverage_log').insert({
                          original_user_id: quickReassignFrom,
                          coverage_user_id: quickReassignTo,
                          task_id: task.id,
                          reason: 'quick_reassign',
                          notes: `Quick reassignment by ${user?.email || 'admin'}`
                        });
                      }

                      showMessage(`Successfully reassigned ${tasksToReassign.length} task(s)!`);
                      
                      // Reset form
                      setQuickReassignFrom('');
                      setQuickReassignTo('');
                      setSelectedTasks([]);
                      setUserTasks([]);
                      loadData();
                    } catch (error) {
                      console.error('Error reassigning tasks:', error);
                      showMessage('Error reassigning tasks', 'error');
                    }
                    setSaving(false);
                  }}
                  disabled={saving || (quickReassignMode === 'select' && selectedTasks.length === 0)}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold text-lg hover:from-orange-600 hover:to-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Reassigning...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Reassign {quickReassignMode === 'all' ? userTasks.length : selectedTasks.length} Task(s) Now
                    </>
                  )}
                </button>
                <p className="text-center text-sm text-slate-500 mt-2">
                  This will be logged in Coverage Log for tracking
                </p>
              </div>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">💡 When to use Quick Reassign</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Employee goes home sick mid-day</li>
                <li>• Emergency or unexpected absence</li>
                <li>• Redistributing workload</li>
                <li>• Covering for late arrivals</li>
              </ul>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-800 mb-2">✅ For scheduled absences</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Use the <strong>User Backups</strong> tab instead</li>
                <li>• Set up who covers whom in advance</li>
                <li>• Tasks auto-reassign when PTO is scheduled</li>
                <li>• No daily action needed</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* COVERAGE LOG TAB */}
      {activeTab === 'log' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Coverage History
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Log of when tasks were automatically reassigned due to PTO or no-shows.
          </p>
          
          {coverageLog.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No coverage events logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-3 font-medium text-slate-600">Date</th>
                    <th className="text-left p-3 font-medium text-slate-600">Original User</th>
                    <th className="text-left p-3 font-medium text-slate-600">Coverage By</th>
                    <th className="text-left p-3 font-medium text-slate-600">Task</th>
                    <th className="text-left p-3 font-medium text-slate-600">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageLog.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 text-slate-600">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-800">
                          {log.original_user?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-green-600">
                          {log.coverage_user?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {log.task?.title || 'All tasks'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.reason === 'pto' ? 'bg-blue-100 text-blue-700' :
                          log.reason === 'no_clock_in' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.reason === 'pto' ? 'PTO' : 
                           log.reason === 'no_clock_in' ? 'No Clock-In' : 
                           log.reason || 'Manual'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="font-semibold text-blue-800 mb-3">How Coverage Works</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-700">
          <div className="bg-white rounded-lg p-4">
            <div className="font-medium mb-2">1. PTO Detection</div>
            <p>When someone has approved PTO, their tasks automatically go to their backup.</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="font-medium mb-2">2. Priority System</div>
            <p>Task-specific backups take priority over user backups. Priority 1 is tried first.</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="font-medium mb-2">3. Coverage Log</div>
            <p>Every reassignment is logged so you can track who covered what and when.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
