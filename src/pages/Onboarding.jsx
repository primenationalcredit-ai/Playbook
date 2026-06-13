import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ClipboardList, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Video,
  FileText,
  HelpCircle,
  Upload,
  Calendar,
  GraduationCap,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Play,
  Send,
  X,
  Check,
  XCircle,
  Loader,
  Lock,
  Star
} from 'lucide-react';
import { format, parseISO, addDays, differenceInDays, isPast, isToday } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const TASK_TYPES = {
  video: { name: 'Watch Video', icon: Video, color: 'red' },
  document: { name: 'Read Document', icon: FileText, color: 'blue' },
  quiz: { name: 'Complete Quiz', icon: HelpCircle, color: 'purple' },
  form: { name: 'Fill Out Form', icon: ClipboardList, color: 'green' },
  upload: { name: 'Upload Document', icon: Upload, color: 'amber' },
  meeting: { name: 'Schedule Meeting', icon: Calendar, color: 'pink' },
  training: { name: 'Complete Training', icon: GraduationCap, color: 'indigo' },
  checklist: { name: 'Checklist Item', icon: CheckSquare, color: 'slate' },
};

export default function Onboarding() {
  const { currentUser } = useApp();
  const [onboarding, setOnboarding] = useState(null);
  const [template, setTemplate] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    if (currentUser?.id) {
      loadOnboardingData();
    }
  }, [currentUser]);

  const loadOnboardingData = async () => {
    setLoading(true);
    try {
      // Get user's onboarding assignment
      const onboardingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_onboarding?user_id=eq.${currentUser.id}&select=*`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      const onboardingData = await onboardingRes.json();
      
      if (onboardingData && onboardingData.length > 0) {
        setOnboarding(onboardingData[0]);
        
        // Get template
        const templateRes = await fetch(
          `${SUPABASE_URL}/rest/v1/onboarding_templates?id=eq.${onboardingData[0].template_id}&select=*`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
        );
        const templateData = await templateRes.json();
        if (templateData.length > 0) setTemplate(templateData[0]);
        
        // Get tasks for template
        const tasksRes = await fetch(
          `${SUPABASE_URL}/rest/v1/onboarding_tasks?template_id=eq.${onboardingData[0].template_id}&is_active=eq.true&order=order_index&select=*`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
        );
        setTasks(await tasksRes.json() || []);
        
        // Get user's task progress
        const userTasksRes = await fetch(
          `${SUPABASE_URL}/rest/v1/user_onboarding_tasks?user_id=eq.${currentUser.id}&select=*`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
        );
        setUserTasks(await userTasksRes.json() || []);
      }
    } catch (error) {
      console.error('Error loading onboarding:', error);
    }
    setLoading(false);
  };

  const getTaskProgress = (taskId) => {
    return userTasks.find(ut => ut.task_id === taskId);
  };

  const getDeadlineDate = (task) => {
    if (!task.deadline_days || !currentUser?.hire_date) return null;
    return addDays(parseISO(currentUser.hire_date), task.deadline_days);
  };

  const getDeadlineStatus = (task) => {
    const deadline = getDeadlineDate(task);
    if (!deadline) return 'none';
    const progress = getTaskProgress(task.id);
    if (progress?.status === 'approved' || progress?.status === 'submitted') return 'complete';
    if (isPast(deadline)) return 'overdue';
    if (differenceInDays(deadline, new Date()) <= 2) return 'soon';
    return 'ok';
  };

  const startTask = async (task) => {
    const existing = getTaskProgress(task.id);
    if (existing) {
      setExpandedTask(task.id);
      return;
    }

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_onboarding_tasks`, {
        method: 'POST',
        headers: { 
          'apikey': SUPABASE_KEY, 
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: currentUser.id,
          task_id: task.id,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
      });
      await loadOnboardingData();
      setExpandedTask(task.id);
    } catch (error) {
      console.error('Error starting task:', error);
    }
  };

  const completeTask = async (task, submissionData = {}) => {
    const progress = getTaskProgress(task.id);
    const status = task.requires_approval ? 'submitted' : 'approved';
    
    try {
      if (progress) {
        await fetch(`${SUPABASE_URL}/rest/v1/user_onboarding_tasks?id=eq.${progress.id}`, {
          method: 'PATCH',
          headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status,
            completed_at: new Date().toISOString(),
            submission_data: submissionData,
            updated_at: new Date().toISOString()
          })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/user_onboarding_tasks`, {
          method: 'POST',
          headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            task_id: task.id,
            status,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            submission_data: submissionData
          })
        });
      }
      await loadOnboardingData();
      setExpandedTask(null);
      setActiveModal(null);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  // Calculate progress
  const completedTasks = tasks.filter(t => {
    const progress = getTaskProgress(t.id);
    return progress?.status === 'approved';
  }).length;
  const submittedTasks = tasks.filter(t => {
    const progress = getTaskProgress(t.id);
    return progress?.status === 'submitted';
  }).length;
  const overdueTasks = tasks.filter(t => getDeadlineStatus(t) === 'overdue').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!onboarding || !template) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Active Onboarding</h2>
          <p className="text-slate-500">You don't have any onboarding tasks assigned. You have full access to the Playbook!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Your Onboarding</h1>
            <p className="text-slate-500 text-sm">{template.name}</p>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-indigo-100 text-sm">Overall Progress</p>
            <p className="text-3xl font-bold">{progressPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-100 text-sm">Tasks Completed</p>
            <p className="text-xl font-semibold">{completedTasks} / {tasks.length}</p>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div 
            className="bg-white rounded-full h-3 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          {submittedTasks > 0 && (
            <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded">
              <Clock size={14} /> {submittedTasks} pending approval
            </span>
          )}
          {overdueTasks > 0 && (
            <span className="flex items-center gap-1 bg-red-500/50 px-2 py-1 rounded">
              <AlertTriangle size={14} /> {overdueTasks} overdue
            </span>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.map((task, index) => {
          const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.checklist;
          const TaskIcon = taskType.icon;
          const progress = getTaskProgress(task.id);
          const deadline = getDeadlineDate(task);
          const deadlineStatus = getDeadlineStatus(task);
          const isExpanded = expandedTask === task.id;

          return (
            <div 
              key={task.id} 
              className={`bg-white rounded-xl border transition-all ${
                progress?.status === 'approved' ? 'border-green-200 bg-green-50/50' :
                progress?.status === 'submitted' ? 'border-amber-200 bg-amber-50/50' :
                progress?.status === 'rejected' ? 'border-red-200 bg-red-50/50' :
                deadlineStatus === 'overdue' ? 'border-red-300' :
                'border-slate-200'
              }`}
            >
              <div 
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => progress?.status === 'approved' ? null : startTask(task)}
              >
                {/* Number */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  progress?.status === 'approved' ? 'bg-green-500 text-white' :
                  progress?.status === 'submitted' ? 'bg-amber-500 text-white' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {progress?.status === 'approved' ? <Check size={16} /> : index + 1}
                </div>

                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${taskType.color}-100`}>
                  <TaskIcon size={20} className={`text-${taskType.color}-600`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium ${
                      progress?.status === 'approved' ? 'text-green-800 line-through' : 'text-slate-800'
                    }`}>
                      {task.title}
                    </h3>
                    {task.is_required && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Required</span>
                    )}
                    {task.requires_approval && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Needs Approval</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate">{task.description || taskType.name}</p>
                </div>

                {/* Deadline */}
                {deadline && (
                  <div className={`text-right text-sm ${
                    deadlineStatus === 'overdue' ? 'text-red-600' :
                    deadlineStatus === 'soon' ? 'text-amber-600' :
                    deadlineStatus === 'complete' ? 'text-green-600' :
                    'text-slate-500'
                  }`}>
                    <p className="font-medium">
                      {deadlineStatus === 'overdue' ? 'Overdue!' : 
                       deadlineStatus === 'complete' ? 'Done' :
                       `Day ${task.deadline_days}`}
                    </p>
                    <p className="text-xs">{format(deadline, 'MMM d')}</p>
                  </div>
                )}

                {/* Status / Action */}
                <div className="w-24 text-right">
                  {progress?.status === 'approved' ? (
                    <span className="text-green-600 text-sm font-medium">Completed</span>
                  ) : progress?.status === 'submitted' ? (
                    <span className="text-amber-600 text-sm font-medium">Pending...</span>
                  ) : progress?.status === 'rejected' ? (
                    <span className="text-red-600 text-sm font-medium">Try Again</span>
                  ) : progress?.status === 'in_progress' ? (
                    <ChevronDown size={20} className="text-slate-400 ml-auto" />
                  ) : (
                    <button className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                      Start
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Task Content */}
              {isExpanded && progress?.status !== 'approved' && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4">
                  <TaskContent 
                    task={task} 
                    progress={progress}
                    onComplete={(data) => completeTask(task, data)} 
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion Message */}
      {progressPercent === 100 && (
        <div className="mt-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white text-center">
          <Star size={48} className="mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">Congratulations!</h2>
          <p className="text-green-100">
            You've completed all your onboarding tasks. Your admin will review and grant you full Playbook access soon!
          </p>
        </div>
      )}
    </div>
  );
}

// Task Content Component - renders different content based on task type
function TaskContent({ task, progress, onComplete }) {
  const [videoWatched, setVideoWatched] = useState(false);
  const [documentRead, setDocumentRead] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [formData, setFormData] = useState({});
  const [quizAnswers, setQuizAnswers] = useState({});

  const content = task.content || {};

  // Video Task
  if (task.task_type === 'video') {
    const videoUrl = content.url || '';
    const embedUrl = videoUrl.includes('youtube') 
      ? videoUrl.replace('watch?v=', 'embed/')
      : videoUrl.includes('loom') 
        ? videoUrl.replace('share', 'embed')
        : videoUrl;

    return (
      <div className="space-y-4">
        {embedUrl && (
          <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden">
            <iframe 
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              onLoad={() => setVideoWatched(true)}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="watched"
            checked={videoWatched}
            onChange={(e) => setVideoWatched(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="watched" className="text-sm text-slate-600">I have watched this video completely</label>
        </div>
        <button
          onClick={() => onComplete({ watched: true })}
          disabled={!videoWatched}
          className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Check size={16} className="inline mr-2" /> Mark as Complete
        </button>
      </div>
    );
  }

  // Document Task
  if (task.task_type === 'document') {
    return (
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: content.content || task.description }} />
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="read"
            checked={documentRead}
            onChange={(e) => setDocumentRead(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="read" className="text-sm text-slate-600">I have read and understand this document</label>
        </div>
        <button
          onClick={() => onComplete({ acknowledged: true })}
          disabled={!documentRead}
          className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Check size={16} className="inline mr-2" /> Acknowledge & Complete
        </button>
      </div>
    );
  }

  // Checklist Task
  if (task.task_type === 'checklist') {
    return (
      <div className="space-y-4">
        {task.description && (
          <p className="text-slate-600">{task.description}</p>
        )}
        <button
          onClick={() => onComplete({ completed: true })}
          className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Check size={16} className="inline mr-2" /> Mark as Complete
        </button>
      </div>
    );
  }

  // Upload Task
  if (task.task_type === 'upload') {
    return (
      <div className="space-y-4">
        <p className="text-slate-600">{content.instructions || 'Please upload the required document.'}</p>
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <Upload size={32} className="mx-auto text-slate-400 mb-2" />
          <input 
            type="file" 
            onChange={(e) => setUploadFile(e.target.files[0])}
            className="text-sm"
            accept={content.accepted_types?.map(t => `.${t}`).join(',')}
          />
        </div>
        {uploadFile && (
          <p className="text-sm text-green-600">Selected: {uploadFile.name}</p>
        )}
        <button
          onClick={() => onComplete({ fileName: uploadFile?.name, uploaded: true })}
          disabled={!uploadFile}
          className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Send size={16} className="inline mr-2" /> Submit
        </button>
        <p className="text-xs text-slate-500">Note: File upload is simulated. In production, integrate with cloud storage.</p>
      </div>
    );
  }

  // Meeting Task
  if (task.task_type === 'meeting') {
    return (
      <div className="space-y-4">
        <p className="text-slate-600">
          Schedule a meeting with: <strong>{content.with || 'Your Manager'}</strong>
          {content.duration_minutes && ` (${content.duration_minutes} minutes)`}
        </p>
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="scheduled"
            checked={documentRead}
            onChange={(e) => setDocumentRead(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="scheduled" className="text-sm text-slate-600">I have scheduled/attended this meeting</label>
        </div>
        <button
          onClick={() => onComplete({ scheduled: true })}
          disabled={!documentRead}
          className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Check size={16} className="inline mr-2" /> Mark as Complete
        </button>
      </div>
    );
  }

  // Training Task
  if (task.task_type === 'training') {
    return (
      <div className="space-y-4">
        <p className="text-slate-600">Complete the assigned training course.</p>
        <a 
          href="/training" 
          className="block text-center py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <GraduationCap size={16} className="inline mr-2" /> Go to Training
        </a>
        <button
          onClick={() => onComplete({ completed: true })}
          className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Check size={16} className="inline mr-2" /> Mark as Complete
        </button>
      </div>
    );
  }

  // Default / Form Task
  return (
    <div className="space-y-4">
      <p className="text-slate-600">{task.description || 'Complete this task.'}</p>
      <button
        onClick={() => onComplete({ completed: true })}
        className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        <Check size={16} className="inline mr-2" /> Mark as Complete
      </button>
    </div>
  );
}
