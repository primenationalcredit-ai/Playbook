import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
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
} from 'lucide-react';

function MyPlaybook() {
  const { 
    currentUser, 
    getTasksForUser, 
    sortTasks, 
    toggleTaskCompletion,
    addPersonalTask,
    TIME_SLOTS,
  } = useApp();

  const [showAddTask, setShowAddTask] = useState(false);
  const [filterSlot, setFilterSlot] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [expandedSlots, setExpandedSlots] = useState(
    Object.keys(TIME_SLOTS).reduce((acc, key) => ({ ...acc, [TIME_SLOTS[key].id]: true }), {})
  );

  const allTasks = sortTasks(getTasksForUser(currentUser?.id));
  
  // Apply filters
  const filteredTasks = allTasks.filter(task => {
    if (filterSlot !== 'all' && task.timeSlot !== filterSlot) return false;
    if (!showCompleted && task.completed) return false;
    return true;
  });

  // Group tasks by time slot
  const groupedTasks = Object.values(TIME_SLOTS).reduce((acc, slot) => {
    acc[slot.id] = filteredTasks.filter(t => t.timeSlot === slot.id);
    return acc;
  }, {});

  const toggleSlot = (slotId) => {
    setExpandedSlots(prev => ({ ...prev, [slotId]: !prev[slotId] }));
  };

  const completedCount = allTasks.filter(t => t.completed).length;
  const totalCount = allTasks.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">My Playbook</h1>
          <p className="text-slate-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        
        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-asap-blue hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          Add Personal Task
        </button>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter size={16} />
          <span>Filter:</span>
        </div>
        
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

      {/* Task Groups */}
      <div className="space-y-4">
        {Object.values(TIME_SLOTS).map(slot => {
          const slotTasks = groupedTasks[slot.id];
          if (slotTasks.length === 0 && filterSlot !== 'all') return null;
          
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
                      isLast={index === slotTasks.length - 1}
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
    </div>
  );
}

function TaskItem({ task, onToggle, isLast }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`task-card flex items-center gap-4 p-4 ${!isLast && 'border-b border-slate-100'} ${task.completed ? 'bg-green-50/50' : 'hover:bg-slate-50'}`}
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
          <Circle size={24} className={isHovered ? 'text-asap-blue' : 'text-slate-300'} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {task.specificTime && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock size={12} />
              {formatTime(task.specificTime)}
            </span>
          )}
          {task.isPersonal && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Personal
            </span>
          )}
          {task.isRecurring && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Daily
            </span>
          )}
        </div>
      </div>

      {task.link && (
        <a
          href={task.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-asap-blue hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
          Open
        </a>
      )}
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }) {
  const { TIME_SLOTS } = useApp();
  const [title, setTitle] = useState('');
  const [timeSlot, setTimeSlot] = useState('morning');
  const [specificTime, setSpecificTime] = useState('');
  const [link, setLink] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      timeSlot,
      specificTime: specificTime || null,
      link: link.trim() || null,
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
              Link (Optional)
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
            />
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
