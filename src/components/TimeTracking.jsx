import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  Play,
  Square,
  Coffee,
  Pause,
  LogIn,
  LogOut,
  Timer,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import DailyCheckout from './DailyCheckout';

function TimeTracking() {
  const { currentUser, supabaseFetch, supabasePost } = useApp();
  
  const [status, setStatus] = useState('not_clocked_in'); // not_clocked_in, working, on_break, rr_break
  const [todayRecord, setTodayRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutCompleted, setCheckoutCompleted] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadTodayRecord();
    }
  }, [currentUser]);

  // Timer effect
  useEffect(() => {
    let interval;
    if (status === 'working' && todayRecord?.clock_in) {
      interval = setInterval(() => {
        const totalBreakMinutes = (todayRecord.break_minutes || 0);
        const elapsed = differenceInMinutes(new Date(), new Date(todayRecord.clock_in)) - totalBreakMinutes;
        setElapsedTime(Math.max(0, elapsed));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, todayRecord]);

  const loadTodayRecord = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const records = await supabaseFetch('time_records', 
        `user_id=eq.${currentUser.id}&date=eq.${today}`
      );
      
      if (records && records.length > 0) {
        const record = records[0];
        setTodayRecord(record);
        
        // Determine current status
        if (record.clock_out) {
          setStatus('clocked_out');
        } else if (record.current_break_start) {
          setStatus(record.break_type || 'on_break');
        } else if (record.clock_in) {
          setStatus('working');
        }
      } else {
        setTodayRecord(null);
        setStatus('not_clocked_in');
      }

      // Check if checkout was already completed today
      await checkTodayCheckout();
    } catch (err) {
      console.error('Error loading time record:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkTodayCheckout = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/daily_checkouts?user_id=eq.${currentUser.id}&checkout_date=eq.${today}`;
      const response = await fetch(url, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        }
      });
      
      if (!response.ok) {
        console.error('Checkout check failed:', response.status);
        setCheckoutCompleted(false);
        return;
      }
      
      const data = await response.json();
      const completed = data && data.length > 0;
      console.log('Checkout status for today:', completed, data);
      setCheckoutCompleted(completed);
    } catch (err) {
      console.error('Error checking checkout status:', err);
      setCheckoutCompleted(false); // Default to false on error - require checkout
    }
  };

  const updateRecord = async (updates) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/time_records?user_id=eq.${currentUser.id}&date=eq.${today}`;
    
    await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    });
    
    await loadTodayRecord();
  };

  const handleClockIn = async () => {
    try {
      const now = new Date().toISOString();
      const today = format(new Date(), 'yyyy-MM-dd');
      
      await supabasePost('time_records', {
        user_id: currentUser.id,
        date: today,
        clock_in: now,
        break_minutes: 0,
      });
      
      await loadTodayRecord();
    } catch (err) {
      console.error('Error clocking in:', err);
    }
  };

  const handleClockOut = async () => {
    // Re-check checkout status before allowing clock out
    await checkTodayCheckout();
    
    // If checkout not completed, show checkout modal instead
    if (!checkoutCompleted) {
      alert('Please complete your daily checkout before clocking out.');
      setShowCheckout(true);
      return;
    }
    
    if (!confirm('Are you sure you want to clock out for the day?')) return;
    
    try {
      await updateRecord({
        clock_out: new Date().toISOString(),
      });
      setStatus('clocked_out');
    } catch (err) {
      console.error('Error clocking out:', err);
    }
  };

  const handleCheckoutComplete = () => {
    setCheckoutCompleted(true);
    setShowCheckout(false);
    // Auto clock out after successful checkout
    setTimeout(() => {
      if (confirm('Checkout complete! Would you like to clock out now?')) {
        updateRecord({ clock_out: new Date().toISOString() })
          .then(() => setStatus('clocked_out'));
      }
    }, 500);
  };

  const handleStartBreak = async (breakType) => {
    try {
      await updateRecord({
        current_break_start: new Date().toISOString(),
        break_type: breakType,
      });
      setStatus(breakType);
    } catch (err) {
      console.error('Error starting break:', err);
    }
  };

  const handleEndBreak = async () => {
    try {
      const breakStart = new Date(todayRecord.current_break_start);
      const breakMinutes = differenceInMinutes(new Date(), breakStart);
      const totalBreakMinutes = (todayRecord.break_minutes || 0) + breakMinutes;
      
      await updateRecord({
        current_break_start: null,
        break_type: null,
        break_minutes: totalBreakMinutes,
      });
      setStatus('working');
    } catch (err) {
      console.error('Error ending break:', err);
    }
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
          <div className="h-4 bg-slate-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-asap-blue" />
          <span className="font-medium text-slate-800">Time Clock</span>
        </div>
        {todayRecord?.clock_in && (
          <span className="text-sm text-slate-500">
            In: {format(new Date(todayRecord.clock_in), 'h:mm a')}
          </span>
        )}
      </div>

      {/* Status Display */}
      <div className="mb-4">
        {status === 'not_clocked_in' && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
            <span>Not clocked in</span>
          </div>
        )}
        {status === 'working' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Working</span>
            </div>
            <div className="text-lg font-bold text-slate-800">
              {formatTime(elapsedTime)}
            </div>
          </div>
        )}
        {status === 'on_break' && (
          <div className="flex items-center gap-2 text-amber-600">
            <Coffee size={16} />
            <span className="font-medium">On Break</span>
          </div>
        )}
        {status === 'rr_break' && (
          <div className="flex items-center gap-2 text-blue-600">
            <Pause size={16} />
            <span className="font-medium">RR Break</span>
          </div>
        )}
        {status === 'clocked_out' && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
            <span>Clocked out at {todayRecord?.clock_out && format(new Date(todayRecord.clock_out), 'h:mm a')}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {status === 'not_clocked_in' && (
          <button
            onClick={handleClockIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            <LogIn size={18} />
            Start My Day
          </button>
        )}

        {status === 'working' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleStartBreak('on_break')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium"
              >
                <Coffee size={16} />
                Break
              </button>
              <button
                onClick={() => handleStartBreak('rr_break')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
              >
                <Pause size={16} />
                RR Break
              </button>
            </div>
            
            {/* Checkout Button - Shows if not yet completed */}
            {!checkoutCompleted && (
              <button
                onClick={() => setShowCheckout(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium"
              >
                <ClipboardCheck size={16} />
                Daily Checkout
              </button>
            )}
            
            {/* Checkout Completed Badge */}
            {checkoutCompleted && (
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm">
                <ClipboardCheck size={16} />
                Checkout Complete ✓
              </div>
            )}
            
            <button
              onClick={handleClockOut}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium ${
                checkoutCompleted 
                  ? 'border-red-200 text-red-600 hover:bg-red-50' 
                  : 'border-purple-200 text-purple-600 hover:bg-purple-50'
              }`}
            >
              <LogOut size={16} />
              {checkoutCompleted ? 'End My Day' : 'Checkout & End Day'}
            </button>
          </>
        )}

        {(status === 'on_break' || status === 'rr_break') && (
          <button
            onClick={handleEndBreak}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            <Play size={18} />
            Back to Work
          </button>
        )}

        {status === 'clocked_out' && (
          <div className="text-center text-sm text-slate-500 py-2">
            Total worked: {formatTime(
              differenceInMinutes(
                new Date(todayRecord.clock_out), 
                new Date(todayRecord.clock_in)
              ) - (todayRecord.break_minutes || 0)
            )}
          </div>
        )}
      </div>

      {/* Break time summary */}
      {todayRecord?.break_minutes > 0 && status !== 'clocked_out' && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          Total break time: {formatTime(todayRecord.break_minutes)}
        </div>
      )}

      {/* Daily Checkout Modal */}
      <DailyCheckout 
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onCheckoutComplete={handleCheckoutComplete}
      />
    </div>
  );
}

export default TimeTracking;
