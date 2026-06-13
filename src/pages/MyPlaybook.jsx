import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useCoverage } from '../hooks/useCoverage';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import TimeTracker from '../components/TimeTracker';
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Plus,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Trash2,
  AlertTriangle,
  Shield,
} from 'lucide-react';

// Helper to get current date in CST
const getCSTDate = () => {
  const now = new Date();
  // Format in CST timezone
  return formatInTimeZone(now, 'America/Chicago', 'yyyy-MM-dd');
};

const getCSTDateFormatted = () => {
  const now = new Date();
  return formatInTimeZone(now, 'America/Chicago', 'EEEE, MMMM d, yyyy');
};

// Get current CST time as minutes since midnight (for comparison)
const getCSTMinutes = () => {
  const now = new Date();
  const cstTime = formatInTimeZone(now, 'America/Chicago', 'HH:mm');
  const [hours, minutes] = cstTime.split(':').map(Number);
  return hours * 60 + minutes;
};

// Convert time string (HH:mm) to minutes since midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Time slot deadlines (in minutes since midnight) - when each slot should be done
const SLOT_DEADLINES = {
  morning: 10 * 60 + 30,      // 10:30 AM
  am_timed: 12 * 60 + 30,     // 12:30 PM
  afternoon: 15 * 60 + 30,    // 3:30 PM
  pm_timed: 16 * 60 + 30,     // 4:30 PM
  end_of_day: 17 * 60 + 30,   // 5:30 PM
  evening: 19 * 60,           // 7:00 PM
  daily: 17 * 60,             // 5:00 PM (end of typical workday)
};

// Check if a task is overdue
const isTaskOverdue = (task, currentMinutes) => {
  // Already completed = not overdue
  if (task.completed) return false;
  
  // If task has a specific time, check against that (with 30 min grace)
  if (task.specificTime) {
    const taskMinutes = timeToMinutes(task.specificTime);
    if (taskMinutes !== null) {
      return currentMinutes > taskMinutes + 30;
    }
  }
  
  // Check against time slot deadline
  const deadline = SLOT_DEADLINES[task.timeSlot];
  if (deadline) {
    return currentMinutes > deadline;
  }
  
  return false;
};

function MyPlaybook() {
  const { 
    currentUser, 
    users,
    taskTemplates,
    getTasksForUser, 
    sortTasks, 
    toggleTaskCompletion,
    addPersonalTask,
    deletePersonalTask,
    TIME_SLOTS,
    DEPARTMENTS,
    SHIFT_TYPES,
    supabaseFetch,
    todaySchedules,
  } = useApp();

  // Coverage/backup system
  const { usersOut, coverageActive, taskBackups, loading: coverageLoading } = useCoverage();

  const [showAddTask, setShowAddTask] = useState(false);
  const [filterSlot, setFilterSlot] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewDepartment, setViewDepartment] = useState('mine'); // 'mine' or department id
  const [expandedSlots, setExpandedSlots] = useState(
    { ...Object.keys(TIME_SLOTS).reduce((acc, key) => ({ ...acc, [TIME_SLOTS[key].id]: true }), {}), daily: true }
  );
  const [currentMinutes, setCurrentMinutes] = useState(getCSTMinutes());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinutes(getCSTMinutes());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Get available shifts for current user's department
  const currentDept = viewDepartment === 'mine' ? currentUser?.department : viewDepartment;
  const availableShifts = SHIFT_TYPES?.[currentDept] || [];

  // Get shift directly from today's schedule (auto-detect)
  const userTodaySchedule = currentUser?.id ? todaySchedules[currentUser.id] : null;
  const scheduledShift = userTodaySchedule?.shiftType || null;
  const hasScheduleForToday = !!userTodaySchedule;

  // Selected shift - prioritize schedule, fall back to user profile, then manual selection
  const [manualShift, setManualShift] = useState(null);
  const selectedShift = viewDepartment === 'mine' 
    ? (scheduledShift || currentUser?.shift_type || manualShift)
    : manualShift;
  
  // Determine if shift came from schedule or profile fallback
  const shiftSource = scheduledShift ? 'schedule' : (currentUser?.shift_type ? 'profile' : 'manual');

  // Handler for manual shift selection (only used by leadership viewing departments)
  const handleShiftSelect = (shiftId) => {
    setManualShift(shiftId);
  };

  // Check if user is leadership/admin
  const isLeadership = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  // Get tasks based on view mode and shift
  const getDisplayTasks = () => {
    if (viewDepartment === 'mine') {
      const myTasks = sortTasks(getTasksForUser(currentUser?.id, selectedShift));
      
      // Check if I'm covering for anyone who's out today
      const coverageTasks = [];
      if (currentUser?.id && usersOut.length > 0) {
        const myTaskIds = new Set(myTasks.map(t => t.id));
        const addedTaskIds = new Set();
        
        // Scan all task templates for backup assignments
        taskTemplates.forEach(template => {
          if (myTaskIds.has(template.id)) return; // Already have this task
          if (addedTaskIds.has(template.id)) return; // Already added as coverage
          
          // Determine if I'm the active backup for this task
          const b1 = template.backup_user_1;
          const b2 = template.backup_user_2;
          const isMyBackup1 = b1 === currentUser.id;
          const isMyBackup2 = b2 === currentUser.id;
          
          if (!isMyBackup1 && !isMyBackup2) return; // Not my backup
          
          // I'm backup 2 but backup 1 is available — skip, B1 handles it
          if (isMyBackup2 && !isMyBackup1 && b1 && !usersOut.includes(b1)) return;
          
          // Find who this task belongs to and check if they're out
          const assignedTo = template.assigned_to;
          let outUser = null;
          
          // If assigned to a specific user who's out
          if (assignedTo && usersOut.includes(assignedTo)) {
            outUser = users.find(u => u.id === assignedTo);
          }
          // If assigned to a department, check if anyone in that dept is out
          if (!outUser) {
            for (const outUserId of usersOut) {
              const u = users.find(usr => usr.id === outUserId);
              if (u && (u.department === assignedTo || assignedTo === 'everyone')) {
                outUser = u;
                break;
              }
            }
          }
          
          if (outUser) {
            addedTaskIds.add(template.id);
            coverageTasks.push({
              ...template,
              timeSlot: template.time_slot,
              specificTime: template.specific_time,
              assignedTo: template.assigned_to,
              description: template.description,
              frequency: template.frequency || 'daily',
              isCoverage: true,
              coveringForName: outUser.name,
              coveringForId: outUser.id,
              completed: false,
            });
          }
        });
        
        // Coverage is determined solely by backup_user_1 and backup_user_2 fields
        // on task_templates. If these are null, no coverage is assigned (intentional).
      }
      
      return sortTasks([...myTasks, ...coverageTasks]);
    }
    
    // Leadership viewing specific department
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    const deptTasks = taskTemplates.filter(task => {
      if (task.assigned_to !== viewDepartment && task.assigned_to !== 'everyone') return false;
      
      // Filter by shift if selected
      if (selectedShift && task.shift_type && task.shift_type !== selectedShift) return false;
      
      const frequency = task.frequency || 'daily';
      if (frequency === 'weekly') {
        const daysOfWeek = task.days_of_week || [1, 2, 3, 4, 5];
        return daysOfWeek.includes(dayOfWeek);
      }
      return true;
    });

    return sortTasks(deptTasks.map(t => ({
      ...t,
      timeSlot: t.time_slot,
      specificTime: t.specific_time,
      assignedTo: t.assigned_to,
      description: t.description,
      frequency: t.frequency || 'daily',
    })));
  };

  const allTasks = getDisplayTasks();
  
  // Apply filters
  const filteredTasks = allTasks.filter(task => {
    if (filterSlot !== 'all' && task.timeSlot !== filterSlot) return false;
    if (!showCompleted && task.completed) return false;
    return true;
  });

  // Group tasks by time slot - include "daily" or tasks with no time slot in a separate group
  const groupedTasks = Object.values(TIME_SLOTS).reduce((acc, slot) => {
    acc[slot.id] = filteredTasks.filter(t => t.timeSlot === slot.id);
    return acc;
  }, {});
  
  // Add "daily" tasks (tasks with no time_slot or time_slot='daily') to a special category
  const dailyTasks = filteredTasks.filter(t => !t.timeSlot || t.timeSlot === 'daily' || t.timeSlot === 'anytime');
  if (dailyTasks.length > 0) {
    groupedTasks['daily'] = dailyTasks;
  }

  // Calculate overdue tasks (only for own tasks, not when viewing other departments)
  const overdueTasks = viewDepartment === 'mine' 
    ? allTasks.filter(task => isTaskOverdue(task, currentMinutes))
    : [];

  const toggleSlot = (slotId) => {
    setExpandedSlots(prev => ({ ...prev, [slotId]: !prev[slotId] }));
  };

  // Calculate progress from ALL tasks (not affected by display filters)
  const displayedTasks = allTasks.filter(t => {
    const validSlotIds = Object.values(TIME_SLOTS).map(s => s.id);
    return validSlotIds.includes(t.timeSlot) || !t.timeSlot || t.timeSlot === 'daily' || t.timeSlot === 'anytime';
  });
  const completedCount = displayedTasks.filter(t => t.completed).length;
  const totalCount = displayedTasks.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">
            {viewDepartment === 'mine' ? 'My Playbook' : `${DEPARTMENTS.find(d => d.id === viewDepartment)?.name || ''} Playbook`}
          </h1>
          <p className="text-slate-500">{getCSTDateFormatted()}</p>
        </div>
        
        {viewDepartment === 'mine' && (
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-asap-blue hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add Personal Task
          </button>
        )}
      </div>

      {/* Progress Card */}
      <div className="bg-gradient-to-r from-asap-navy to-slate-800 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Today's Progress</h2>
            <p className="text-slate-300 text-sm">{completedCount} of {totalCount} tasks completed</p>
          </div>
          <div className="text-4xl font-bold text-asap-gold">{progressPercentage}%</div>
        </div>
        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-asap-gold rounded-full transition-all duration-700"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Time Tracker - Shows ahead/behind status */}
      {viewDepartment === 'mine' && selectedShift && (
        <div className="mb-6">
          <TimeTracker 
            tasks={displayedTasks}
            shift={availableShifts.find(s => s.id === selectedShift)?.name || selectedShift}
            shiftStart={
              selectedShift === '7-4' ? '07:00' :
              selectedShift === '7-6' ? '07:00' :
              selectedShift === '8-5' ? '08:00' :
              selectedShift === '8:30-5:30' ? '08:30' :
              selectedShift === '9-6' ? '09:00' :
              selectedShift === '10-7' ? '10:00' :
              selectedShift === '7-7' ? '07:00' : '08:00'
            }
            shiftEnd={
              selectedShift === '7-4' ? '16:00' :
              selectedShift === '7-6' ? '18:00' :
              selectedShift === '8-5' ? '17:00' :
              selectedShift === '8:30-5:30' ? '17:30' :
              selectedShift === '9-6' ? '18:00' :
              selectedShift === '10-7' ? '19:00' :
              selectedShift === '7-7' ? '19:00' : '17:00'
            }
          />
        </div>
      )}

      {/* Coverage Banner - shown when covering for someone who's out */}
      {viewDepartment === 'mine' && (() => {
        const coveringFor = allTasks.filter(t => t.isCoverage);
        const coveringNames = [...new Set(coveringFor.map(t => t.coveringForName))];
        if (coveringNames.length === 0) return null;
        return (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Shield size={20} className="text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-800">
                You're covering for {coveringNames.join(' & ')} today
              </p>
              <p className="text-sm text-orange-600">
                {coveringFor.length} additional task{coveringFor.length !== 1 ? 's' : ''} added to your playbook
              </p>
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter size={16} />
          <span>Filter:</span>
        </div>

        {/* Department filter for leadership */}
        {isLeadership && (
          <select
            value={viewDepartment}
            onChange={(e) => {
              setViewDepartment(e.target.value);
              setManualShift(null); // Reset manual shift when changing department
            }}
            className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asap-blue text-blue-800 font-medium"
          >
            <option value="mine">My Tasks</option>
            <option value="" disabled>── View Department ──</option>
            {DEPARTMENTS.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        )}

        {/* Shift selector - only for leadership viewing other departments */}
        {isLeadership && viewDepartment !== 'mine' && availableShifts.length > 0 && (
          <select
            value={manualShift || ''}
            onChange={(e) => handleShiftSelect(e.target.value || null)}
            className="px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-amber-800 font-medium"
          >
            <option value="">All Shifts</option>
            {availableShifts.map(shift => (
              <option key={shift.id} value={shift.id}>{shift.name}</option>
            ))}
          </select>
        )}
        
        <select
          value={filterSlot}
          onChange={(e) => setFilterSlot(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asap-blue"
        >
          <option value="all">All Time Slots</option>
          {Object.values(TIME_SLOTS).map(slot => (
            <option key={slot.id} value={slot.id}>{slot.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-asap-blue focus:ring-asap-blue"
          />
          Show Completed
        </label>
      </div>

      {/* Today's Shift indicator - show when user has a shift */}
      {viewDepartment === 'mine' && selectedShift && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
          <Clock size={18} className="text-green-600" />
          <span className="text-green-800 font-medium">
            Today's Shift: {availableShifts.find(s => s.id === selectedShift)?.name || selectedShift}
          </span>
          <span className="ml-auto text-green-600 text-sm">
            {shiftSource === 'schedule' ? 'From schedule' : 'Default shift'}
          </span>
        </div>
      )}

      {/* No shift warning - only if user has no shift at all */}
      {viewDepartment === 'mine' && !selectedShift && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-amber-600" />
            <span className="text-amber-800 font-semibold">No Shift Assigned</span>
          </div>
          <p className="text-amber-700 text-sm">
            You don't have a shift scheduled for today and no default shift is set. 
            Contact leadership to get your schedule set up.
          </p>
        </div>
      )}

      {/* Shift selector for leadership viewing departments (not their own tasks) */}
      {isLeadership && viewDepartment !== 'mine' && availableShifts.length > 0 && !selectedShift && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={20} className="text-amber-600" />
            <span className="text-amber-800 font-semibold">Select Shift to View</span>
          </div>
          <p className="text-amber-700 text-sm mb-3">Choose a shift to see tasks for this department:</p>
          <div className="flex flex-wrap gap-2">
            {availableShifts.map(shift => (
              <button
                key={shift.id}
                onClick={() => handleShiftSelect(shift.id)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {shift.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Viewing indicator */}
      {isLeadership && viewDepartment !== 'mine' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <span className="text-blue-800 font-medium">
            Viewing: {DEPARTMENTS.find(d => d.id === viewDepartment)?.name || viewDepartment} Playbook
            {selectedShift && ` (${availableShifts.find(s => s.id === selectedShift)?.name})`}
          </span>
          <button 
            onClick={() => {
              setViewDepartment('mine');
              setManualShift(null);
            }}
            className="ml-auto text-blue-600 hover:text-blue-800 text-sm underline"
          >
            Back to My Tasks
          </button>
        </div>
      )}

      {/* Task Groups */}
      <div className="space-y-4">
        {Object.values(TIME_SLOTS).map(slot => {
          const slotTasks = groupedTasks[slot.id];
          // Hide empty sections completely
          if (!slotTasks || slotTasks.length === 0) return null;
          
          const slotCompleted = slotTasks.filter(t => t.completed).length;
          const isExpanded = expandedSlots[slot.id];

          return (
            <div key={slot.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Slot Header */}
              <button
                onClick={() => toggleSlot(slot.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full bg-${slot.color}-500`} />
                  <h3 className="font-semibold text-slate-800">{slot.label}</h3>
                  <span className="text-sm text-slate-500">
                    {slotCompleted}/{slotTasks.length} completed
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
              </button>

              {/* Tasks */}
              {isExpanded && slotTasks.length > 0 && (
                <div className="border-t border-slate-100">
                  {slotTasks.map((task, index) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTaskCompletion(currentUser?.id, task.id)}
                      onDelete={task.isPersonal ? () => deletePersonalTask(task.id) : null}
                      isLast={index === slotTasks.length - 1}
                      isOverdue={viewDepartment === 'mine' && isTaskOverdue(task, currentMinutes)}
                    />
                  ))}
                </div>
              )}

              {isExpanded && slotTasks.length === 0 && (
                <div className="p-8 text-center text-slate-400 border-t border-slate-100">
                  No tasks in this time slot
                </div>
              )}
            </div>
          );
        })}
        
        {/* Daily Tasks Section - tasks with no specific time slot */}
        {groupedTasks['daily'] && groupedTasks['daily'].length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button
              onClick={() => toggleSlot('daily')}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h3 className="font-semibold text-slate-800">Daily Tasks</h3>
                <span className="text-sm text-slate-500">
                  {groupedTasks['daily'].filter(t => t.completed).length}/{groupedTasks['daily'].length} completed
                </span>
              </div>
              {expandedSlots['daily'] ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            
            {expandedSlots['daily'] && (
              <div className="border-t border-slate-100">
                {groupedTasks['daily'].map((task, index) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTaskCompletion(currentUser?.id, task.id)}
                    onDelete={task.isPersonal ? () => deletePersonalTask(task.id) : null}
                    isLast={index === groupedTasks['daily'].length - 1}
                    isOverdue={viewDepartment === 'mine' && isTaskOverdue(task, currentMinutes)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Personal Task Modal */}
      {showAddTask && (
        <AddTaskModal
          onClose={() => setShowAddTask(false)}
          onAdd={(task) => {
            addPersonalTask(currentUser?.id, task);
            setShowAddTask(false);
          }}
        />
      )}

      {/* Floating Overdue Tasks Indicator */}
      {viewDepartment === 'mine' && overdueTasks.length > 0 && (
        <OverdueIndicator 
          count={overdueTasks.length} 
          tasks={overdueTasks}
          onScrollToTask={(taskId) => {
            const element = document.querySelector(`[data-task-id="${taskId}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.classList.add('highlight-pulse');
              setTimeout(() => element.classList.remove('highlight-pulse'), 2000);
            }
          }}
        />
      )}
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete, isLast, isOverdue }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div 
      data-task-id={task.id}
      className={`task-card flex items-center gap-4 p-4 ${!isLast && 'border-b border-slate-100'} ${
        task.completed 
          ? 'bg-green-50/50' 
          : task.isCoverage
            ? 'bg-blue-50/50 border-l-4 border-l-blue-500'
            : isOverdue 
              ? 'bg-amber-50/50 border-l-4 border-l-amber-500' 
              : 'hover:bg-slate-50'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onToggle}
        className="flex-shrink-0 focus:outline-none"
      >
        {task.completed ? (
          <CheckCircle2 size={24} className="text-green-500" />
        ) : (
          <Circle size={24} className={isOverdue ? 'text-amber-500' : isHovered ? 'text-asap-blue' : 'text-slate-300'} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`font-medium ${task.completed ? 'text-slate-400 line-through' : isOverdue ? 'text-amber-900' : 'text-slate-800'}`}>
          {task.title}
        </p>
        {task.isCoverage && (
          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold mt-0.5">
            🔄 Covering for {task.coveringForName}
          </span>
        )}
        {task.description && (
          <p className={`text-sm mt-0.5 ${task.completed ? 'text-slate-300 line-through' : 'text-slate-500'}`}>
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.specificTime && (
            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? 'text-amber-600' : 'text-slate-500'}`}>
              <Clock size={12} />
              {formatTime(task.specificTime)}
            </span>
          )}
          {isOverdue && !task.completed && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
              ⏰ Overdue
            </span>
          )}
          {task.isPersonal && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Personal
            </span>
          )}
          {task.isCoverage && (
            <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              <Shield size={10} />
              Covering for {task.coveringForName}
            </span>
          )}
          {task.isRecurring && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Daily
            </span>
          )}
        </div>
      </div>

      {/* Show multiple links or single link for backwards compatibility */}
      {(task.links?.length > 0 ? task.links : task.link ? [task.link] : []).map((lnk, idx) => (
        <a
          key={idx}
          href={lnk}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-asap-blue hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
          {task.links?.length > 1 ? `Link ${idx + 1}` : 'Open'}
        </a>
      ))}

      {/* Delete button - only for personal tasks */}
      {onDelete && (
        <div className="relative">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete personal task"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Floating indicator for overdue tasks
function OverdueIndicator({ count, tasks, onScrollToTask }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (count === 0) return null;

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40">
      {/* Collapsed view - just the pill */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg transition-all animate-subtle-pulse"
        >
          <AlertTriangle size={18} />
          <span className="font-semibold">{count} behind</span>
        </button>
      )}

      {/* Expanded view - shows task list */}
      {isExpanded && (
        <div className="bg-white rounded-2xl shadow-xl border border-amber-200 w-72 overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={18} />
              <span className="font-semibold">{count} Overdue Tasks</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <X size={16} className="text-amber-600" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => {
                  onScrollToTask(task.id);
                  setIsExpanded(false);
                }}
                className="w-full text-left p-3 hover:bg-amber-50 border-b border-slate-100 last:border-0 transition-colors"
              >
                <p className="font-medium text-slate-800 text-sm truncate">{task.title}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {task.specificTime ? `Due: ${formatTime(task.specificTime)}` : task.timeSlot}
                </p>
              </button>
            ))}
          </div>
          <div className="p-2 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center">Click a task to scroll to it</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }) {
  const { TIME_SLOTS } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeSlot, setTimeSlot] = useState('morning');
  const [specificTime, setSpecificTime] = useState('');
  const [links, setLinks] = useState(['']);
  const [isRecurring, setIsRecurring] = useState(false);

  const addLink = () => setLinks([...links, '']);
  const removeLink = (index) => setLinks(links.filter((_, i) => i !== index));
  const updateLink = (index, value) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const validLinks = links.filter(l => l.trim());
    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      timeSlot,
      specificTime: specificTime || null,
      link: validLinks[0] || null,
      links: validLinks.length > 0 ? validLinks : null,
      isRecurring,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Add Personal Task</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, instructions, or notes..."
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue focus:border-transparent resize-none"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Links (Optional)
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
          </div>

          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-asap-blue focus:ring-asap-blue"
            />
            <div>
              <span className="font-medium text-slate-800">Make this a daily task</span>
              <p className="text-sm text-slate-500">This task will appear every day</p>
            </div>
          </label>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-asap-blue text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default MyPlaybook;
