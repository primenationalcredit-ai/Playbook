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
  Filter,
  Calendar,
  Repeat,
  CalendarDays,
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
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSlot, setFilterSlot] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filter tasks
  const filteredTasks = taskTemplates.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterSlot !== 'all' && task.timeSlot !== filterSlot) return false;
    return true;
  });

  // Group by time slot
  const groupedTasks = Object.values(TIME_SLOTS).map(slot => ({
    ...slot,
    tasks: filteredTasks.filter(t => t.timeSlot === slot.id),
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
    if (editingTask) {
      updateTaskTemplate(editingTask.id, taskData);
    } else {
      addTaskTemplate(taskData);
    }
    setShowModal(false);
    setEditingTask(null);
  };

  const getFrequencyLabel = (task) => {
    if (!task.frequency || task.frequency === 'daily') return 'Daily';
    if (task.frequency === 'one_time') return 'One-time';
    if (task.frequency === 'weekly') {
      const days = task.daysOfWeek || [];
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
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={filterSlot}
              onChange={(e) => setFilterSlot(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue"
            >
              <option value="all">All Time Slots</option>
              {Object.values(TIME_SLOTS).map(slot => (
                <option key={slot.id} value={slot.id}>{slot.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Task List */}
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
            
            <div className="divide-y divide-slate-100">
              {slot.tasks.map((task, idx) => (
                <div key={task.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-medium text-slate-600">
                    {idx + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-slate-500 mt-1">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {task.specificTime && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={12} />
                          {formatTime(task.specificTime)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Users size={12} />
                        {task.assignedTo === 'everyone' ? 'Everyone' : DEPARTMENTS.find(d => d.id === task.assignedTo)?.name || task.assignedTo}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        task.frequency === 'one_time' ? 'bg-amber-100 text-amber-700' :
                        task.frequency === 'weekly' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {task.frequency === 'one_time' ? <CalendarDays size={12} /> : <Repeat size={12} />}
                        {getFrequencyLabel(task)}
                      </span>
                      {task.link && (
                        <a 
                          href={task.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink size={12} />
                          Link
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(task)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(task.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
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
    </div>
  );
}

function TaskModal({ task, onClose, onSave }) {
  const { TIME_SLOTS, DEPARTMENTS } = useApp();
  
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [timeSlot, setTimeSlot] = useState(task?.timeSlot || 'morning');
  const [specificTime, setSpecificTime] = useState(task?.specificTime || '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo || 'everyone');
  const [link, setLink] = useState(task?.link || '');
  const [frequency, setFrequency] = useState(task?.frequency || 'daily');
  const [daysOfWeek, setDaysOfWeek] = useState(task?.daysOfWeek || [1, 2, 3, 4, 5]); // Mon-Fri default

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

    onSave({
      title: title.trim(),
      description: description.trim() || null,
      timeSlot,
      specificTime: specificTime || null,
      assignedTo,
      link: link.trim() || null,
      frequency,
      daysOfWeek: frequency === 'weekly' ? daysOfWeek : null,
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
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
            >
              <option value="everyone">Everyone</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Link / Filter URL (Optional)
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
            />
            <p className="text-xs text-slate-500 mt-1">Add a Pipedrive filter, Google Doc, or other resource link</p>
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

export default AdminTasks;
