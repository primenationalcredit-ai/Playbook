import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserX,
  Calendar,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';

function WhosOut() {
  const { users, supabaseFetch } = useApp();
  
  const [outToday, setOutToday] = useState([]);
  const [notClockedIn, setNotClockedIn] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadAbsences();
    const interval = setInterval(loadAbsences, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [users]);

  const loadAbsences = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Check daily_out table (admin toggle) - primary source
      let dailyOutData = [];
      try { dailyOutData = await supabaseFetch('daily_out', `date=eq.${today}`) || []; } catch(e) {}
      
      // 2. Check PTO/time off requests (may not exist)
      let ptoRequests = [];
      try { ptoRequests = await supabaseFetch('time_off_requests', `status=eq.approved&start_date=lte.${today}&end_date=gte.${today}`) || []; } catch(e) {}
      
      // 3. Check who hasn't clocked in today
      let timeRecords = [];
      try { timeRecords = await supabaseFetch('time_records', `date=eq.${today}`) || []; } catch(e) {}
      const clockedInUserIds = timeRecords.map(r => r.user_id);
      
      // Build out today list
      const outList = [];
      
      // Add PTO users
      (ptoRequests || []).forEach(pto => {
        const user = users.find(u => u.id === pto.user_id);
        if (user) {
          outList.push({
            user,
            reason: pto.type || 'PTO',
            type: 'pto',
          });
        }
      });
      
      // Add admin-toggled "out" users
      (dailyOutData || []).forEach(entry => {
        const user = users.find(u => u.id === entry.user_id);
        if (user && !outList.find(o => o.user.id === user.id)) {
          outList.push({
            user,
            reason: 'Out (Admin)',
            type: 'calendar',
          });
        }
      });
      
      setOutToday(outList);
      
      // Find users who should be working but haven't clocked in
      // (scheduled but no time record after 1 hour from start)
      const now = new Date();
      const currentHour = now.getHours();
      
      // Simple logic: if it's after 9am and user hasn't clocked in, flag them
      // In production, this would check their actual schedule
      const notIn = [];
      if (currentHour >= 9 && Array.isArray(users)) {
        users.forEach(user => {
          if (user.role !== 'admin' && 
              !clockedInUserIds.includes(user.id) && 
              !outList.find(o => o.user.id === user.id)) {
            notIn.push(user);
          }
        });
      }
      
      setNotClockedIn(notIn);
    } catch (err) {
      console.error('Error loading absences:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalOut = outToday.length + notClockedIn.length;

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock size={16} className="animate-pulse" />
          <span className="text-sm">Checking attendance...</span>
        </div>
      </div>
    );
  }

  // Everyone is here!
  if (totalOut === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Clock size={16} className="text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-800">Full Team Today</p>
            <p className="text-xs text-green-600">Everyone is clocked in ✓</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <UserX size={16} className="text-amber-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-amber-800">
              {totalOut} team member{totalOut !== 1 ? 's' : ''} out today
            </p>
            <p className="text-xs text-amber-600">
              {outToday.length > 0 && `${outToday.length} scheduled off`}
              {outToday.length > 0 && notClockedIn.length > 0 && ' • '}
              {notClockedIn.length > 0 && `${notClockedIn.length} not clocked in`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-amber-600" /> : <ChevronDown size={18} className="text-amber-600" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Scheduled Off */}
          {outToday.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Scheduled Off</p>
              <div className="space-y-2">
                {outToday.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-medium text-amber-700">
                      {item.user.avatar || item.user.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{item.user.name}</p>
                      <p className="text-xs text-slate-500">{item.reason}</p>
                    </div>
                    <Calendar size={14} className="text-amber-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Clocked In */}
          {notClockedIn.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase mb-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                Not Clocked In
              </p>
              <div className="space-y-2">
                {notClockedIn.map((user, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-red-50 rounded-lg p-2 border border-red-100">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-medium text-red-700">
                      {user.avatar || user.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{user.name}</p>
                      <p className="text-xs text-red-500">Tasks may need reassignment</p>
                    </div>
                    <Clock size={14} className="text-red-400" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WhosOut;
