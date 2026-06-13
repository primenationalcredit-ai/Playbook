import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ClipboardList, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GripVertical,
  Video,
  FileText,
  HelpCircle,
  Upload,
  Calendar,
  GraduationCap,
  CheckSquare,
  Settings,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Play,
  RefreshCw
} from 'lucide-react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const TASK_TYPES = [
  { id: 'video', name: 'Watch Video', icon: Video, color: 'red', description: 'YouTube, Loom, or video URL' },
  { id: 'document', name: 'Read Document', icon: FileText, color: 'blue', description: 'Policy or document to acknowledge' },
  { id: 'quiz', name: 'Complete Quiz', icon: HelpCircle, color: 'purple', description: 'Quiz with passing score' },
  { id: 'form', name: 'Fill Out Form', icon: ClipboardList, color: 'green', description: 'Collect information' },
  { id: 'upload', name: 'Upload Document', icon: Upload, color: 'amber', description: 'ID, certification, etc.' },
  { id: 'meeting', name: 'Schedule Meeting', icon: Calendar, color: 'pink', description: 'Meet with manager/team' },
  { id: 'training', name: 'Complete Training', icon: GraduationCap, color: 'indigo', description: 'Training course module' },
  { id: 'checklist', name: 'Checklist Item', icon: CheckSquare, color: 'slate', description: 'Simple checkbox task' },
];

export default function AdminOnboarding() {
  const { users, DEPARTMENTS } = useApp();
  const [view, setView] = useState('templates'); // templates, progress
  const [templates, setTemplates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [userOnboarding, setUserOnboarding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadTemplates(), loadTasks(), loadUserOnboarding()]);
    setLoading(false);
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_templates?select=*&order=department,is_va`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setTemplates(await res.json() || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_tasks?select=*&order=template_id,order_index`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setTasks(await res.json() || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadUserOnboarding = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/user_onboarding?select=*,user_onboarding_tasks(*)&order=started_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setUserOnboarding(await res.json() || []);
    } catch (error) {
      console.error('Error loading user onboarding:', error);
    }
  };

  const saveTemplate = async (templateData) => {
    try {
      if (editingTemplate) {
        await fetch(`${SUPABASE_URL}/rest/v1/onboarding_templates?id=eq.${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...templateData, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/onboarding_templates`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        });
      }
      await loadTemplates();
      setShowTemplateModal(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!confirm('Delete this template and all its tasks?')) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/onboarding_templates?id=eq.${templateId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      await loadTemplates();
      await loadTasks();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const saveTask = async (taskData) => {
    try {
      if (editingTask) {
        await fetch(`${SUPABASE_URL}/rest/v1/onboarding_tasks?id=eq.${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...taskData, updated_at: new Date().toISOString() })
        });
      } else {
        // Get next order index
        const templateTasks = tasks.filter(t => t.template_id === selectedTemplateId);
        const nextIndex = templateTasks.length > 0 ? Math.max(...templateTasks.map(t => t.order_index)) + 1 : 0;
        
        await fetch(`${SUPABASE_URL}/rest/v1/onboarding_tasks`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...taskData, template_id: selectedTemplateId, order_index: nextIndex })
        });
      }
      await loadTasks();
      setShowTaskModal(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/onboarding_tasks?id=eq.${taskId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const moveTask = async (taskId, direction) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const templateTasks = tasks.filter(t => t.template_id === task.template_id).sort((a, b) => a.order_index - b.order_index);
    const currentIndex = templateTasks.findIndex(t => t.id === taskId);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= templateTasks.length) return;

    const swapTask = templateTasks[swapIndex];
    
    // Swap order indices
    await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/onboarding_tasks?id=eq.${task.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: swapTask.order_index })
      }),
      fetch(`${SUPABASE_URL}/rest/v1/onboarding_tasks?id=eq.${swapTask.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: task.order_index })
      })
    ]);
    
    await loadTasks();
  };

  const getTemplateTasks = (templateId) => {
    return tasks.filter(t => t.template_id === templateId).sort((a, b) => a.order_index - b.order_index);
  };

  const getDepartmentName = (id) => DEPARTMENTS?.find(d => d.id === id)?.name || id;
  const getTaskType = (typeId) => TASK_TYPES.find(t => t.id === typeId) || TASK_TYPES[7];
  const getUserName = (userId) => users?.find(u => u.id === userId)?.name || 'Unknown';
  const getTemplate = (templateId) => templates.find(t => t.id === templateId);

  // Group templates by department
  const templatesByDept = templates.reduce((acc, template) => {
    if (!acc[template.department]) acc[template.department] = [];
    acc[template.department].push(template);
    return acc;
  }, {});

  // Get users in onboarding
  const usersInOnboarding = users?.filter(u => u.onboarding_status === 'in_progress' || u.onboarding_status === 'pending_approval') || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Onboarding Management</h1>
            <p className="text-slate-500 text-sm">Create and manage onboarding flows</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('templates')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'templates' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <Settings size={16} className="inline mr-1" /> Templates
            </button>
            <button
              onClick={() => setView('progress')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative ${
                view === 'progress' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <Users size={16} className="inline mr-1" /> Progress
              {usersInOnboarding.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                  {usersInOnboarding.length}
                </span>
              )}
            </button>
          </div>
          {view === 'templates' && (
            <button
              onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus size={18} /> New Template
            </button>
          )}
        </div>
      </div>

      {/* Templates View */}
      {view === 'templates' && (
        <div className="space-y-6">
          {Object.entries(templatesByDept).map(([dept, deptTemplates]) => (
            <div key={dept} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">{getDepartmentName(dept)}</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {deptTemplates.map(template => {
                  const templateTasks = getTemplateTasks(template.id);
                  const isExpanded = expandedTemplate === template.id;
                  
                  return (
                    <div key={template.id}>
                      <div 
                        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                        onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            template.is_va ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {template.is_va ? 'VA' : 'IH'}
                          </div>
                          <div>
                            <h3 className="font-medium text-slate-800">{template.name}</h3>
                            <p className="text-sm text-slate-500">
                              {templateTasks.length} tasks • {template.estimated_days} days
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            template.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingTemplate(template); setShowTemplateModal(true); }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteTemplate(template.id); }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                          {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="px-6 pb-4 bg-slate-50">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm text-slate-600">{template.description}</p>
                            <button
                              onClick={() => { setSelectedTemplateId(template.id); setEditingTask(null); setShowTaskModal(true); }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                            >
                              <Plus size={14} /> Add Task
                            </button>
                          </div>
                          
                          {templateTasks.length === 0 ? (
                            <p className="text-center py-8 text-slate-400">No tasks yet. Add your first task!</p>
                          ) : (
                            <div className="space-y-2">
                              {templateTasks.map((task, index) => {
                                const taskType = getTaskType(task.task_type);
                                const TaskIcon = taskType.icon;
                                
                                return (
                                  <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                    <div className="flex flex-col gap-1">
                                      <button
                                        onClick={() => moveTask(task.id, 'up')}
                                        disabled={index === 0}
                                        className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-30"
                                      >
                                        <ChevronUp size={14} />
                                      </button>
                                      <button
                                        onClick={() => moveTask(task.id, 'down')}
                                        disabled={index === templateTasks.length - 1}
                                        className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-30"
                                      >
                                        <ChevronDown size={14} />
                                      </button>
                                    </div>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${taskType.color}-100`}>
                                      <TaskIcon size={16} className={`text-${taskType.color}-600`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-800 truncate">{task.title}</p>
                                      <p className="text-xs text-slate-500">
                                        {taskType.name}
                                        {task.deadline_days && ` • Due Day ${task.deadline_days}`}
                                        {task.requires_approval && ' • Requires Approval'}
                                        {task.is_required && ' • Required'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => { setSelectedTemplateId(template.id); setEditingTask(task); setShowTaskModal(true); }}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => deleteTask(task.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {templates.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
              <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Onboarding Templates</h3>
              <p className="text-slate-500 mb-4">Create templates to define onboarding flows for each department.</p>
              <button
                onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create First Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress View */}
      {view === 'progress' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700">Employee</th>
                <th className="text-left p-4 font-semibold text-slate-700">Template</th>
                <th className="text-center p-4 font-semibold text-slate-700">Progress</th>
                <th className="text-center p-4 font-semibold text-slate-700">Status</th>
                <th className="text-center p-4 font-semibold text-slate-700">Started</th>
                <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userOnboarding.map(uo => {
                const user = users?.find(u => u.id === uo.user_id);
                const template = getTemplate(uo.template_id);
                const templateTasks = getTemplateTasks(uo.template_id);
                const completedTasks = uo.user_onboarding_tasks?.filter(t => t.status === 'approved' || t.status === 'submitted').length || 0;
                const progress = templateTasks.length > 0 ? Math.round((completedTasks / templateTasks.length) * 100) : 0;
                
                return (
                  <tr key={uo.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-asap-navy rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user?.name || 'Unknown'}</p>
                          <p className="text-sm text-slate-500">{user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-slate-800">{template?.name || 'Unknown'}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-600">{progress}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        uo.status === 'completed' ? 'bg-green-100 text-green-700' :
                        uo.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {uo.status === 'completed' ? 'Completed' :
                         uo.status === 'pending_approval' ? 'Pending Approval' : 'In Progress'}
                      </span>
                    </td>
                    <td className="p-4 text-center text-sm text-slate-600">
                      {uo.started_at ? format(parseISO(uo.started_at), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <button className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200">
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {userOnboarding.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No employees currently in onboarding
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          departments={DEPARTMENTS}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
          onSave={saveTemplate}
        />
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSave={saveTask}
        />
      )}
    </div>
  );
}

// Template Modal
function TemplateModal({ template, departments, onClose, onSave }) {
  const [name, setName] = useState(template?.name || '');
  const [department, setDepartment] = useState(template?.department || 'credit_consultants');
  const [isVA, setIsVA] = useState(template?.is_va || false);
  const [description, setDescription] = useState(template?.description || '');
  const [estimatedDays, setEstimatedDays] = useState(template?.estimated_days || 14);
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      department,
      is_va: isVA,
      description,
      estimated_days: parseInt(estimatedDays),
      is_active: isActive
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{template ? 'Edit Template' : 'New Onboarding Template'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Credit Consultant - In House"
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Est. Duration (days)</label>
              <input
                type="number"
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
            <input
              type="checkbox"
              id="isVA"
              checked={isVA}
              onChange={(e) => setIsVA(e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <div>
              <label htmlFor="isVA" className="font-medium text-slate-700 cursor-pointer">VA Employee Flow</label>
              <p className="text-sm text-slate-500">Check if this is for remote/VA employees</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Brief description of this onboarding flow..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">Active (available for assignment)</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              {template ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Task Modal
function TaskModal({ task, onClose, onSave }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [taskType, setTaskType] = useState(task?.task_type || 'checklist');
  const [deadlineDays, setDeadlineDays] = useState(task?.deadline_days || '');
  const [requiresApproval, setRequiresApproval] = useState(task?.requires_approval || false);
  const [isRequired, setIsRequired] = useState(task?.is_required ?? true);
  const [content, setContent] = useState(task?.content || {});

  // Content fields based on task type
  const [videoUrl, setVideoUrl] = useState(content.url || '');
  const [documentContent, setDocumentContent] = useState(content.content || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    let taskContent = {};
    if (taskType === 'video') {
      taskContent = { url: videoUrl };
    } else if (taskType === 'document') {
      taskContent = { content: documentContent };
    }

    onSave({
      title,
      description,
      task_type: taskType,
      deadline_days: deadlineDays ? parseInt(deadlineDays) : null,
      requires_approval: requiresApproval,
      is_required: isRequired,
      content: taskContent
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">{task ? 'Edit Task' : 'Add Onboarding Task'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Watch Company Overview Video"
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {TASK_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTaskType(type.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                      taskType === type.id 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={18} className={taskType === type.id ? 'text-indigo-600' : 'text-slate-400'} />
                    <div>
                      <p className="font-medium text-sm">{type.name}</p>
                      <p className="text-xs text-slate-500">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic content fields based on task type */}
          {taskType === 'video' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Video URL</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://loom.com/..."
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          )}

          {taskType === 'document' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Document Content</label>
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                rows={6}
                placeholder="Enter the document/policy content here..."
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description / Instructions</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Instructions for completing this task..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deadline (days from hire date)</label>
            <input
              type="number"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              placeholder="e.g., 3 (due on day 3)"
              className="w-full px-4 py-2 border rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">Leave empty for no deadline</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Requires admin approval</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Required for full playbook access</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              {task ? 'Update' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
