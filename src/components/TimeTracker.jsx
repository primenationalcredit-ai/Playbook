import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react';

// Calculate where user should be in their day based on shift and tasks
export default function TimeTracker({ tasks, shift, shiftStart, shiftEnd }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState({ ahead: 0, message: '', color: 'gray' });

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate progress
  useEffect(() => {
    if (!tasks || tasks.length === 0 || !shiftStart || !shiftEnd) {
      setStatus({ ahead: 0, message: 'No shift data', color: 'gray' });
      return;
    }

    const now = currentTime;
    const today = now.toISOString().split('T')[0];
    
    // Parse shift times
    const [startHour, startMin] = shiftStart.split(':').map(Number);
    const [endHour, endMin] = shiftEnd.split(':').map(Number);
    
    const shiftStartTime = new Date(now);
    shiftStartTime.setHours(startHour, startMin, 0, 0);
    
    const shiftEndTime = new Date(now);
    shiftEndTime.setHours(endHour, endMin, 0, 0);

    // Check if before shift starts
    if (now < shiftStartTime) {
      setStatus({ 
        ahead: 0, 
        message: `Shift starts at ${formatTime(shiftStartTime)}`, 
        color: 'gray',
        icon: 'clock'
      });
      return;
    }

    // Check if after shift ends
    if (now > shiftEndTime) {
      const completedCount = tasks.filter(t => t.completed).length;
      const total = tasks.length;
      if (completedCount === total) {
        setStatus({ 
          ahead: 0, 
          message: 'Shift complete! All tasks done.', 
          color: 'green',
          icon: 'check'
        });
      } else {
        const remaining = total - completedCount;
        setStatus({ 
          ahead: 0, 
          message: `Shift ended - ${remaining} tasks incomplete`, 
          color: 'red',
          icon: 'warning'
        });
      }
      return;
    }

    // Calculate expected progress based on time
    const totalShiftMinutes = (endHour - startHour) * 60 + (endMin - startMin);
    const minutesIntoDshift = (now - shiftStartTime) / (1000 * 60);
    const expectedProgress = minutesIntoDshift / totalShiftMinutes;

    // Get timed tasks (tasks with specific times)
    const timedTasks = tasks.filter(t => t.specificTime);
    const completedTimedTasks = timedTasks.filter(t => t.completed);

    // Calculate how many timed tasks should be done by now
    const tasksDueBefore = timedTasks.filter(t => {
      if (!t.specificTime) return false;
      const [taskHour, taskMin] = t.specificTime.split(':').map(Number);
      const taskTime = new Date(now);
      taskTime.setHours(taskHour, taskMin, 0, 0);
      return taskTime <= now;
    });

    const tasksDueCompleted = tasksDueBefore.filter(t => t.completed);
    
    // Calculate ahead/behind
    const expectedDone = tasksDueBefore.length;
    const actualDone = tasksDueCompleted.length;
    const taskDiff = actualDone - expectedDone;

    // Estimate minutes ahead/behind (rough estimate: 15 min per task)
    const minutesDiff = taskDiff * 15;

    // Find next upcoming task
    const upcomingTasks = timedTasks
      .filter(t => {
        if (!t.specificTime || t.completed) return false;
        const [taskHour, taskMin] = t.specificTime.split(':').map(Number);
        const taskTime = new Date(now);
        taskTime.setHours(taskHour, taskMin, 0, 0);
        return taskTime > now;
      })
      .sort((a, b) => a.specificTime.localeCompare(b.specificTime));

    const nextTask = upcomingTasks[0];
    
    // Determine status
    if (taskDiff > 0) {
      setStatus({
        ahead: Math.abs(minutesDiff),
        message: `${Math.abs(minutesDiff)} min ahead`,
        detail: nextTask ? `Next: ${nextTask.title} at ${formatTime12(nextTask.specificTime)}` : 'All timed tasks complete!',
        color: 'green',
        icon: 'up'
      });
    } else if (taskDiff < 0) {
      const overdueTasks = tasksDueBefore.filter(t => !t.completed);
      setStatus({
        ahead: -Math.abs(minutesDiff),
        message: `${Math.abs(minutesDiff)} min behind`,
        detail: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
        color: 'red',
        icon: 'down'
      });
    } else {
      setStatus({
        ahead: 0,
        message: 'On track',
        detail: nextTask ? `Next: ${nextTask.title} at ${formatTime12(nextTask.specificTime)}` : 'All caught up!',
        color: 'blue',
        icon: 'neutral'
      });
    }

  }, [tasks, shiftStart, shiftEnd, currentTime]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatTime12 = (time24) => {
    if (!time24) return '';
    const [hour, min] = time24.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
  };

  const getIcon = () => {
    switch (status.icon) {
      case 'up': return <TrendingUp size={20} className="text-green-600" />;
      case 'down': return <TrendingDown size={20} className="text-red-600" />;
      case 'check': return <CheckCircle size={20} className="text-green-600" />;
      case 'warning': return <AlertTriangle size={20} className="text-red-600" />;
      default: return <Minus size={20} className="text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (status.color) {
      case 'green': return 'bg-green-50 border-green-200';
      case 'red': return 'bg-red-50 border-red-200';
      case 'blue': return 'bg-blue-50 border-blue-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getTextColor = () => {
    switch (status.color) {
      case 'green': return 'text-green-800';
      case 'red': return 'text-red-800';
      case 'blue': return 'text-blue-800';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${getBgColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status.color === 'green' ? 'bg-green-100' : status.color === 'red' ? 'bg-red-100' : 'bg-blue-100'}`}>
            {getIcon()}
          </div>
          <div>
            <div className={`font-semibold ${getTextColor()}`}>
              {status.message}
            </div>
            {status.detail && (
              <div className={`text-sm ${getTextColor()} opacity-75`}>
                {status.detail}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-800">
            {formatTime(currentTime)}
          </div>
          <div className="text-xs text-slate-500">
            {shift || 'No shift selected'}
          </div>
        </div>
      </div>
    </div>
  );
}
