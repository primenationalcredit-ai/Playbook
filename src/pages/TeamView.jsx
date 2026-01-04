import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  X,
  LayoutGrid,
  Table,
  Filter,
  ChevronDown,
  ChevronRight,
  Check,
  XCircle,
} from 'lucide-react';

function TeamView() {
  const { 
    getAllUsersStats, 
    getTasksForUser, 
    taskTemplates,
    sortTasks,
    DEPARTMENTS,
    currentUser,
    users,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'spreadsheet'
  const [expandedSections, setExpandedSections] = useState({ morning: true, midday: true, afternoon: true, closing: true });

  const allUsersStats = getAllUsersStats();

  // Apply filters and sorting
  let filteredUsers = allUsersStats.filter(user => {
    if (searchQuery && !user.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterDepartment !== 'all' && user.department !== filterDepartment) return false;
    return true;
  });

  // Sort users
  filteredUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'progress_high':
        return b.stats.percentage - a.stats.percentage;
      case 'progress_low':
        return a.stats.percentage - b.stats.percentage;
      case 'department':
        return a.department.localeCompare(b.department);
      default:
        return 0;
    }
  });

  // Calculate team stats
  const teamStats = {
    totalTasks: allUsersStats.reduce((sum, u) => sum + u.stats.total, 0),
    completedTasks: allUsersStats.reduce((sum, u) => sum + u.stats.completed, 0),
    averageProgress: allUsersStats.length > 0 ? Math.round(
      allUsersStats.reduce((sum, u) => sum + u.stats.percentage, 0) / allUsersStats.length
    ) : 0,
    atRisk: allUsersStats.filter(u => u.stats.percentage < 50).length,
  };

  // Group tasks by time slot for spreadsheet view
  const tasksByTimeSlot = useMemo(() => {
    const groups = {
      morning: { label: 'Opening Duties', tasks: [] },
      midday: { label: 'Midday Tasks', tasks: [] },
      afternoon: { label: 'Afternoon Tasks', tasks: [] },
      closing: { label: 'Closing Duties', tasks: [] },
    };

    // Get all unique tasks from all filtered users
    const taskMap = new Map();
    filteredUsers.forEach(user => {
      const userTasks = getTasksForUser(user.id);
      userTasks.forEach(task => {
        const key = task.templateId || task.title;
        if (!taskMap.has(key)) {
          taskMap.set(key, task);
        }
      });
    });

    // Sort into time slots
    taskMap.forEach(task => {
      const slot = task.timeSlot || 'morning';
      if (groups[slot]) {
        groups[slot].tasks.push(task);
      }
    });

    // Sort tasks within each slot
    Object.values(groups).forEach(group => {
      group.tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });

    return groups;
  }, [filteredUsers, getTasksForUser]);

  // Get task status for a specific user
  const getTaskStatus = (userId, taskTitle, templateId) => {
    const userTasks = getTasksForUser(userId);
    const task = userTasks.find(t => 
      (templateId && t.templateId === templateId) || 
      t.title === taskTitle
    );
    return task?.completed || false;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="p-6 lg:p-8 max-w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Team View</h1>
          <p className="text-slate-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              viewMode === 'cards' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <LayoutGrid size={18} />
            Cards
          </button>
          <button
            onClick={() => setViewMode('spreadsheet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              viewMode === 'spreadsheet' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Table size={18} />
            Spreadsheet
          </button>
        </div>
      </div>

      {/* Team Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Team Members" value={filteredUsers.length} color="blue" />
        <StatCard icon={CheckCircle2} label="Tasks Completed" value={`${teamStats.completedTasks}/${teamStats.totalTasks}`} color="green" />
        <StatCard icon={TrendingUp} label="Average Progress" value={`${teamStats.averageProgress}%`} color="purple" />
        <StatCard icon={AlertTriangle} label="Need Attention" value={teamStats.atRisk} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue focus:border-transparent"
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue"
        >
          <option value="all">All Departments</option>
          {DEPARTMENTS.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue"
        >
          <option value="name">Sort by Name</option>
          <option value="progress_high">Progress (High to Low)</option>
          <option value="progress_low">Progress (Low to High)</option>
          <option value="department">Department</option>
        </select>
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        // Card View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map(user => (
            <UserCard
              key={user.id}
              user={user}
              onClick={() => setSelectedUser(user)}
              DEPARTMENTS={DEPARTMENTS}
            />
          ))}
          {filteredUsers.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              No team members found matching your filters.
            </div>
          )}
        </div>
      ) : (
        // Spreadsheet View
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-100">
                  <th className="sticky left-0 bg-slate-100 z-10 text-left p-3 border-b border-r font-semibold text-slate-700 min-w-[280px]">
                    Tasks
                  </th>
                  {filteredUsers.map(user => (
                    <th key={user.id} className="p-2 border-b text-center min-w-[90px] max-w-[100px]">
                      <div className="font-medium text-slate-700 text-xs truncate" title={user.name}>
                        {user.name.split(' ')[0]}
                      </div>
                      <div className={`text-xs font-bold ${
                        user.stats.percentage >= 80 ? 'text-green-600' :
                        user.stats.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {user.stats.percentage}%
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(tasksByTimeSlot).map(([slotKey, slotData]) => (
                  <React.Fragment key={slotKey}>
                    {/* Section Header */}
                    {slotData.tasks.length > 0 && (
                      <>
                        <tr 
                          className="bg-slate-800 cursor-pointer hover:bg-slate-700"
                          onClick={() => toggleSection(slotKey)}
                        >
                          <td 
                            colSpan={filteredUsers.length + 1}
                            className="sticky left-0 bg-slate-800 p-3 font-bold text-white border-b z-10"
                          >
                            <div className="flex items-center gap-2">
                              {expandedSections[slotKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              {slotData.label}
                              <span className="text-xs text-slate-300 font-normal ml-2">
                                ({slotData.tasks.length} tasks)
                              </span>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Tasks */}
                        {expandedSections[slotKey] && slotData.tasks.map((task, idx) => (
                          <tr key={task.id || idx} className="hover:bg-slate-50">
                            <td className="sticky left-0 bg-white z-10 p-3 border-b border-r text-sm text-slate-700">
                              <div className="max-w-[280px]" title={task.title}>
                                {task.title}
                              </div>
                            </td>
                            {filteredUsers.map(user => {
                              const completed = getTaskStatus(user.id, task.title, task.templateId);
                              return (
                                <td 
                                  key={user.id} 
                                  className={`p-1 border-b text-center ${
                                    completed ? 'bg-green-600' : 'bg-red-900'
                                  }`}
                                >
                                  <span className="text-white text-xs font-bold">
                                    {completed ? 'DONE' : 'INCOMPLETE'}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                ))}
                
                {/* Empty state */}
                {Object.values(tasksByTimeSlot).every(slot => slot.tasks.length === 0) && (
                  <tr>
                    <td colSpan={filteredUsers.length + 1} className="p-8 text-center text-slate-500">
                      No tasks found. Add task templates in Manage Tasks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Legend */}
          <div className="p-3 border-t bg-slate-50 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-green-600 rounded text-white text-xs flex items-center justify-center font-bold">✓</div>
              <span className="text-slate-600">Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-red-900 rounded text-white text-xs flex items-center justify-center font-bold">✗</div>
              <span className="text-slate-600">Incomplete</span>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          getTasksForUser={getTasksForUser}
          sortTasks={sortTasks}
          DEPARTMENTS={DEPARTMENTS}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function UserCard({ user, onClick, DEPARTMENTS }) {
  const progressColor = 
    user.stats.percentage >= 80 ? 'bg-green-500' :
    user.stats.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const dept = DEPARTMENTS.find(d => d.id === user.department);

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-asap-blue/30 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-800">{user.name}</h3>
          <p className="text-sm text-slate-500">{dept?.name || user.department}</p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          user.stats.percentage >= 80 ? 'bg-green-100 text-green-700' :
          user.stats.percentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>
          {user.stats.percentage}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full ${progressColor} transition-all`}
            style={{ width: `${user.stats.percentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {user.stats.completed} / {user.stats.total} tasks
        </span>
        <span className="text-slate-400">
          {user.stats.total - user.stats.completed} remaining
        </span>
      </div>
    </div>
  );
}

function UserDetailModal({ user, onClose, getTasksForUser, sortTasks, DEPARTMENTS }) {
  const tasks = sortTasks(getTasksForUser(user.id));
  const dept = DEPARTMENTS.find(d => d.id === user.department);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
            <p className="text-slate-500">{dept?.name || user.department}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Daily Progress</span>
            <span className="text-lg font-bold text-slate-800">{user.stats.percentage}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                user.stats.percentage >= 80 ? 'bg-green-500' :
                user.stats.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${user.stats.percentage}%` }}
            />
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {user.stats.completed} of {user.stats.total} tasks completed
          </p>
        </div>

        {/* Tasks */}
        <div className="p-6 overflow-y-auto max-h-[400px]">
          <h3 className="font-semibold text-slate-700 mb-4">Today's Tasks</h3>
          <div className="space-y-2">
            {tasks.map(task => (
              <div 
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  task.completed ? 'bg-green-50' : 'bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  task.completed ? 'bg-green-500 text-white' : 'border-2 border-slate-300'
                }`}>
                  {task.completed && <Check size={12} />}
                </div>
                <span className={`flex-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                  {task.title}
                </span>
                {task.completed && task.completedAt && (
                  <span className="text-xs text-slate-400">
                    {format(new Date(task.completedAt), 'h:mm a')}
                  </span>
                )}
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-slate-500 text-center py-4">No tasks assigned today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeamView;
