import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Users,
  Bell,
  ClipboardList,
  Umbrella,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

function Dashboard() {
  const { 
    currentUser, 
    getTasksForUser, 
    sortTasks, 
    getCompletionStats,
    getAllUsersStats,
    getUpdatesForUser,
    TIME_SLOTS,
  } = useApp();

  const [timeOffNotifications, setTimeOffNotifications] = useState([]);
  const [pendingTimeOffCount, setPendingTimeOffCount] = useState(0);
  const [ptoBalance, setPtoBalance] = useState(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  // Load time-off notifications and PTO balance
  useEffect(() => {
    if (currentUser?.id) {
      loadTimeOffNotifications();
      loadPtoBalance();
    }
  }, [currentUser?.id]);

  const loadPtoBalance = async () => {
    try {
      const url = `${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${currentUser.id}&select=*`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPtoBalance(data?.[0] || null);
      }
    } catch (error) {
      console.error('Error loading PTO balance:', error);
    }
  };

  const loadTimeOffNotifications = async () => {
    try {
      // Get user's recently reviewed time-off requests (approved/denied in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const url = `${SUPABASE_URL}/rest/v1/time_off_requests?user_id=eq.${currentUser.id}&status=neq.pending&reviewed_at=gte.${sevenDaysAgo.toISOString()}&select=*&order=reviewed_at.desc`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTimeOffNotifications(data || []);
      }

      // For admins, get count of pending requests
      if (isAdmin) {
        const pendingUrl = `${SUPABASE_URL}/rest/v1/time_off_requests?status=eq.pending&select=id`;
        const pendingRes = await fetch(pendingUrl, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingTimeOffCount(pendingData?.length || 0);
        }
      }
    } catch (error) {
      console.error('Error loading time-off notifications:', error);
    }
  };

  const tasks = sortTasks(getTasksForUser(currentUser?.id));
  const stats = getCompletionStats(currentUser?.id);
  const allUsersStats = currentUser?.role === 'admin' ? getAllUsersStats() : [];
  const updates = getUpdatesForUser(currentUser?.id);
  const pendingUpdates = updates.filter(u => u && (!u.acknowledgements || !u.acknowledgements[currentUser?.id]));

  const completedTasks = tasks.filter(t => t.completed);
  const overdueTasks = tasks.filter(t => !t.completed && t.specificTime && isOverdue(t.specificTime));
  const upcomingTasks = tasks.filter(t => !t.completed && !isOverdue(t.specificTime));

  function isOverdue(time) {
    if (!time) return false;
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const taskTime = new Date();
    taskTime.setHours(hours, minutes, 0, 0);
    return now > taskTime;
  }

  const getTimeSlotLabel = (slotId) => {
    const slot = Object.values(TIME_SLOTS).find(s => s.id === slotId);
    return slot?.label || slotId;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">
          Good {getGreeting()}, {currentUser?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-slate-500 mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={ClipboardList}
          label="Total Tasks"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completedTasks.length}
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={overdueTasks.length}
          color="red"
        />
        <StatCard
          icon={TrendingUp}
          label="Progress"
          value={`${stats.percentage}%`}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Tasks Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Progress */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Today's Progress</h2>
              <Link 
                to="/playbook" 
                className="text-sm text-asap-blue hover:text-blue-700 flex items-center gap-1"
              >
                View All <ArrowRight size={16} />
              </Link>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">{completedTasks.length} of {tasks.length} tasks completed</span>
                <span className="font-semibold text-asap-gold">{stats.percentage}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-asap-gold to-amber-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
            </div>

            {/* Time Slot Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.values(TIME_SLOTS).map(slot => {
                const slotTasks = tasks.filter(t => t.timeSlot === slot.id);
                const slotCompleted = slotTasks.filter(t => t.completed).length;
                const percentage = slotTasks.length > 0 ? Math.round((slotCompleted / slotTasks.length) * 100) : 0;
                
                return (
                  <div 
                    key={slot.id}
                    className={`p-3 rounded-xl bg-${slot.color}-50 border border-${slot.color}-100`}
                  >
                    <div className="text-xs font-medium text-slate-600 mb-1">{slot.label}</div>
                    <div className="flex items-end justify-between">
                      <span className={`text-lg font-bold text-${slot.color}-600`}>
                        {slotCompleted}/{slotTasks.length}
                      </span>
                      <span className="text-xs text-slate-500">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Tasks */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Next Up</h2>
            <div className="space-y-3">
              {upcomingTasks.slice(0, 5).map(task => (
                <div 
                  key={task.id}
                  className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${getSlotColor(task.timeSlot)}-100`}>
                    <Clock size={20} className={`text-${getSlotColor(task.timeSlot)}-600`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{task.title}</p>
                    <p className="text-sm text-slate-500">
                      {getTimeSlotLabel(task.timeSlot)}
                      {task.specificTime && ` • ${formatTime(task.specificTime)}`}
                    </p>
                  </div>
                  {task.link && (
                    <a 
                      href={task.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-asap-blue hover:text-blue-700 text-sm"
                    >
                      Open
                    </a>
                  )}
                </div>
              ))}
              {upcomingTasks.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 size={40} className="mx-auto mb-2 text-green-400" />
                  <p>All caught up! Great job! 🎉</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* PTO Balance Card */}
          {ptoBalance && (
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Umbrella size={20} />
                <h2 className="font-semibold">PTO Balance</h2>
              </div>
              <p className="text-4xl font-bold mb-1">{ptoBalance.balance?.toFixed(1) || '0.0'}</p>
              <p className="text-green-100 text-sm mb-4">days available</p>
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-green-200">Used</p>
                  <p className="font-semibold">{ptoBalance.used?.toFixed(1) || '0'} days</p>
                </div>
                <div className="text-right">
                  <p className="text-green-200">Pending</p>
                  <p className="font-semibold">{ptoBalance.pending?.toFixed(1) || '0'} days</p>
                </div>
              </div>
              <Link
                to="/calendar"
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors mt-4 w-full justify-center"
              >
                Request Time Off <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* Time-Off Request Notifications (for employees) */}
          {timeOffNotifications.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Umbrella size={20} className="text-orange-500" />
                <h2 className="font-semibold text-slate-800">Time-Off Updates</h2>
              </div>
              <div className="space-y-3">
                {timeOffNotifications.slice(0, 3).map(req => (
                  <div 
                    key={req.id} 
                    className={`p-3 rounded-xl ${
                      req.status === 'approved' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {req.status === 'approved' ? (
                        <CheckCircle size={18} className="text-green-600" />
                      ) : (
                        <XCircle size={18} className="text-red-600" />
                      )}
                      <span className={`font-medium text-sm ${req.status === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                        {req.status === 'approved' ? 'Approved!' : 'Denied'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {req.start_date} to {req.end_date}
                    </p>
                    {req.admin_notes && (
                      <p className="text-xs text-slate-500 mt-1 italic">"{req.admin_notes}"</p>
                    )}
                  </div>
                ))}
              </div>
              <Link
                to="/calendar"
                className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 mt-3"
              >
                View all requests <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* Pending Time-Off Requests (Admin Only) */}
          {isAdmin && pendingTimeOffCount > 0 && (
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Umbrella size={20} />
                <h2 className="font-semibold">Time-Off Requests</h2>
              </div>
              <p className="text-orange-100 text-sm mb-4">
                {pendingTimeOffCount} request{pendingTimeOffCount !== 1 ? 's' : ''} waiting for review
              </p>
              <Link
                to="/calendar"
                onClick={() => {}}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Review Now <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* Pending Updates */}
          {pendingUpdates.length > 0 && (
            <div className="bg-gradient-to-br from-asap-blue to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={20} />
                <h2 className="font-semibold">Pending Updates</h2>
              </div>
              <p className="text-blue-100 text-sm mb-4">
                You have {pendingUpdates.length} update{pendingUpdates.length !== 1 ? 's' : ''} to review
              </p>
              <Link
                to="/updates"
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Review Now <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* Team Overview (Admin Only) */}
          {currentUser?.role === 'admin' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Team Status</h2>
                <Link 
                  to="/team" 
                  className="text-sm text-asap-blue hover:text-blue-700 flex items-center gap-1"
                >
                  View All <ArrowRight size={16} />
                </Link>
              </div>
              <div className="space-y-3">
                {allUsersStats.slice(0, 5).map(user => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-asap-navy rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {user.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            user.stats.percentage >= 80 ? 'bg-green-500' :
                            user.stats.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${user.stats.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-600">
                      {user.stats.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4 text-red-700">
                <AlertTriangle size={20} />
                <h2 className="font-semibold">Overdue Tasks</h2>
              </div>
              <div className="space-y-2">
                {overdueTasks.slice(0, 3).map(task => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-3 p-2 bg-white rounded-lg"
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-sm text-slate-700 truncate flex-1">{task.title}</span>
                    <span className="text-xs text-red-600">{formatTime(task.specificTime)}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/playbook"
                className="inline-flex items-center gap-1 mt-4 text-sm text-red-700 hover:text-red-800 font-medium"
              >
                Complete Now <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className={`p-5 rounded-2xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-100`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
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

export default Dashboard;
