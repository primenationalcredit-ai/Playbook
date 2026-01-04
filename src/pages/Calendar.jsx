import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  X,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Copy,
  CalendarPlus,
  Umbrella,
  CheckCircle,
  XCircle,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, addWeeks, eachDayOfInterval } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const EVENT_TYPES = [
  { id: 'meeting', name: 'Meeting', color: '#3B82F6' },
  { id: 'deadline', name: 'Deadline', color: '#EF4444' },
  { id: 'company', name: 'Company Event', color: '#8B5CF6' },
  { id: 'training', name: 'Training', color: '#10B981' },
  { id: 'other', name: 'Other', color: '#6B7280' },
];

const SHIFT_TYPES = [
  { id: 'regular', name: 'Regular', color: '#3B82F6' },
  { id: 'overtime', name: 'Overtime', color: '#F59E0B' },
  { id: 'on-call', name: 'On Call', color: '#8B5CF6' },
  { id: 'training', name: 'Training', color: '#10B981' },
];

const TIME_OFF_TYPES = [
  { id: 'vacation', name: 'Vacation', color: '#3B82F6', icon: '🏖️' },
  { id: 'sick', name: 'Sick Leave', color: '#EF4444', icon: '🤒' },
  { id: 'personal', name: 'Personal', color: '#8B5CF6', icon: '👤' },
  { id: 'unpaid', name: 'Unpaid Leave', color: '#6B7280', icon: '📋' },
];

export default function Calendar() {
  const { currentUser, users } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [ptoBalance, setPtoBalance] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [showTimeOffReviewModal, setShowTimeOffReviewModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [reviewingTimeOff, setReviewingTimeOff] = useState(null);
  const [view, setView] = useState('calendar'); // calendar, schedules, time-off
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadEvents(), loadSchedules(), loadTimeOffRequests(), loadPtoBalance()]);
    setLoading(false);
  };

  const loadPtoBalance = async () => {
    if (!currentUser?.id) return;
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

  const loadEvents = async () => {
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const url = `${SUPABASE_URL}/rest/v1/events?start_time=gte.${monthStart.toISOString()}&start_time=lte.${addDays(monthEnd, 7).toISOString()}&select=*&order=start_time`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setEvents(await res.json() || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadSchedules = async () => {
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const url = `${SUPABASE_URL}/rest/v1/schedules?date=gte.${format(monthStart, 'yyyy-MM-dd')}&date=lte.${format(monthEnd, 'yyyy-MM-dd')}&select=*&order=date,start_time`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setSchedules(await res.json() || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  };

  const loadTimeOffRequests = async () => {
    try {
      const url = `${SUPABASE_URL}/rest/v1/time_off_requests?select=*&order=created_at.desc`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setTimeOffRequests(await res.json() || []);
    } catch (error) {
      console.error('Error loading time off requests:', error);
    }
  };

  const saveEvent = async (eventData) => {
    try {
      if (editingEvent) {
        await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${editingEvent.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...eventData, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/events`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...eventData, created_by: currentUser?.id })
        });
      }
      await loadEvents();
      setShowEventModal(false);
      setEditingEvent(null);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      await loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const saveSchedule = async (scheduleData) => {
    try {
      if (editingSchedule) {
        await fetch(`${SUPABASE_URL}/rest/v1/schedules?id=eq.${editingSchedule.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...scheduleData, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/schedules`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ ...scheduleData, created_by: currentUser?.id })
        });
      }
      await loadSchedules();
      setShowScheduleModal(false);
      setEditingSchedule(null);
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  };

  const saveBulkSchedules = async (schedulesData) => {
    try {
      // Delete existing schedules for these dates/users first if replacing
      for (const schedule of schedulesData) {
        await fetch(`${SUPABASE_URL}/rest/v1/schedules?user_id=eq.${schedule.user_id}&date=eq.${schedule.date}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
      }
      
      // Insert new schedules
      await fetch(`${SUPABASE_URL}/rest/v1/schedules`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(schedulesData.map(s => ({ ...s, created_by: currentUser?.id })))
      });
      
      await loadSchedules();
      setShowBulkScheduleModal(false);
    } catch (error) {
      console.error('Error saving bulk schedules:', error);
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/schedules?id=eq.${scheduleId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      await loadSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const submitTimeOffRequest = async (requestData) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/time_off_requests`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestData, user_id: currentUser?.id })
      });
      await loadTimeOffRequests();
      setShowTimeOffModal(false);
    } catch (error) {
      console.error('Error submitting time off request:', error);
    }
  };

  const reviewTimeOffRequest = async (requestId, status, notes) => {
    try {
      // Get the request details
      const request = timeOffRequests.find(r => r.id === requestId);
      
      await fetch(`${SUPABASE_URL}/rest/v1/time_off_requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          admin_notes: notes,
          reviewed_by: currentUser?.id, 
          reviewed_at: new Date().toISOString() 
        })
      });

      // If approved, deduct from PTO balance
      if (status === 'approved' && request) {
        const days = calculateBusinessDays(request.start_date, request.end_date);
        await deductPtoBalance(request.user_id, days, requestId);
      }

      await loadTimeOffRequests();
      setShowTimeOffReviewModal(false);
      setReviewingTimeOff(null);
    } catch (error) {
      console.error('Error reviewing time off request:', error);
    }
  };

  // Calculate business days (Mon-Fri) between two dates
  const calculateBusinessDays = (startDate, endDate) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    let count = 0;
    let current = start;
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
        count++;
      }
      current = addDays(current, 1);
    }
    return count;
  };

  // Deduct PTO balance when time-off is approved
  const deductPtoBalance = async (userId, days, requestId) => {
    try {
      // Get current balance
      const balanceRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        const currentBalance = balanceData?.[0];
        
        if (currentBalance) {
          const newBalance = Math.max(0, (currentBalance.balance || 0) - days);
          const newUsed = (currentBalance.used || 0) + days;
          
          // Update balance
          await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              balance: newBalance, 
              used: newUsed,
              updated_at: new Date().toISOString() 
            })
          });

          // Record transaction
          await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              transaction_type: 'used',
              amount: -days,
              balance_after: newBalance,
              description: `Time off approved (${days} days)`,
              time_off_request_id: requestId,
              created_by: currentUser?.id
            })
          });
        }
      }
    } catch (error) {
      console.error('Error deducting PTO balance:', error);
    }
  };

  const getEventsForDate = (date) => {
    return events.filter(event => isSameDay(parseISO(event.start_time), date));
  };

  const getSchedulesForDate = (date) => {
    return schedules.filter(schedule => schedule.date === format(date, 'yyyy-MM-dd'));
  };

  const getTimeOffForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return timeOffRequests.filter(req => 
      req.status === 'approved' && 
      dateStr >= req.start_date && 
      dateStr <= req.end_date
    );
  };

  const getUserName = (userId) => users?.find(u => u.id === userId)?.name || 'Unknown';

  const pendingTimeOffRequests = timeOffRequests.filter(r => r.status === 'pending');
  const myTimeOffRequests = timeOffRequests.filter(r => r.user_id === currentUser?.id);

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      const currentDay = day;
      const dayEvents = getEventsForDate(currentDay);
      const daySchedules = getSchedulesForDate(currentDay);
      const dayTimeOff = getTimeOffForDate(currentDay);
      const isToday = isSameDay(day, new Date());
      const isSelected = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, currentMonth);

      days.push(
        <div
          key={day.toString()}
          onClick={() => setSelectedDate(currentDay)}
          className={`min-h-[100px] p-2 border border-slate-100 cursor-pointer transition-colors ${
            isCurrentMonth ? 'bg-white' : 'bg-slate-50'
          } ${isSelected ? 'ring-2 ring-asap-blue' : ''} hover:bg-slate-50`}
        >
          <div className={`text-sm font-medium mb-1 ${
            isToday ? 'w-7 h-7 bg-asap-blue text-white rounded-full flex items-center justify-center' : 
            isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
          }`}>
            {format(day, 'd')}
          </div>
          <div className="space-y-1">
            {dayTimeOff.slice(0, 1).map(req => (
              <div key={req.id} className="text-xs px-1.5 py-0.5 rounded truncate bg-orange-100 text-orange-700">
                🏖️ {getUserName(req.user_id).split(' ')[0]}
              </div>
            ))}
            {dayEvents.slice(0, 2).map(event => (
              <div
                key={event.id}
                className="text-xs px-1.5 py-0.5 rounded truncate text-white"
                style={{ backgroundColor: event.color || '#3B82F6' }}
              >
                {event.title}
              </div>
            ))}
            {view === 'schedules' && daySchedules.slice(0, 2).map(schedule => (
              <div key={schedule.id} className="text-xs px-1.5 py-0.5 rounded truncate bg-blue-100 text-blue-700">
                {getUserName(schedule.user_id).split(' ')[0]}
              </div>
            ))}
            {(dayEvents.length + daySchedules.length + dayTimeOff.length) > 3 && (
              <div className="text-xs text-slate-500">+more</div>
            )}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }

    return days;
  };

  const selectedDateEvents = getEventsForDate(selectedDate);
  const selectedDateSchedules = getSchedulesForDate(selectedDate);
  const selectedDateTimeOff = getTimeOffForDate(selectedDate);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <CalendarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Calendar</h1>
            <p className="text-slate-500 text-sm">Events, schedules & time off</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'calendar' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setView('schedules')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'schedules' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              Schedules
            </button>
            <button
              onClick={() => setView('time-off')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative ${
                view === 'time-off' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              Time Off
              {isAdmin && pendingTimeOffRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {pendingTimeOffRequests.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Action Buttons */}
          <button
            onClick={() => setShowTimeOffModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm"
          >
            <Umbrella size={16} />
            Request Time Off
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
                className="flex items-center gap-2 px-3 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                <Plus size={16} />
                Event
              </button>
              <button
                onClick={() => setShowBulkScheduleModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <CalendarPlus size={16} />
                Build Schedule
              </button>
            </>
          )}
        </div>
      </div>

      {/* PTO Balance Card */}
      {ptoBalance && (
        <div className="mb-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Umbrella size={24} />
              </div>
              <div>
                <p className="text-green-100 text-sm">Your PTO Balance</p>
                <p className="text-3xl font-bold">{ptoBalance.balance?.toFixed(1) || '0.0'} <span className="text-lg font-normal">days</span></p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-green-100">Used</p>
                <p className="text-xl font-semibold">{ptoBalance.used?.toFixed(1) || '0.0'}</p>
              </div>
              <div className="text-center">
                <p className="text-green-100">Pending</p>
                <p className="text-xl font-semibold">{ptoBalance.pending?.toFixed(1) || '0.0'}</p>
              </div>
              {ptoBalance.period_end && (
                <div className="text-center">
                  <p className="text-green-100">Expires</p>
                  <p className="text-xl font-semibold">{format(parseISO(ptoBalance.period_end), 'MMM d')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time Off View */}
      {view === 'time-off' ? (
        <TimeOffView 
          requests={isAdmin ? timeOffRequests : myTimeOffRequests}
          users={users}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onReview={(req) => { setReviewingTimeOff(req); setShowTimeOffReviewModal(true); }}
          getUserName={getUserName}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Month Navigation */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold text-slate-800">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 bg-slate-50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-3 text-center text-sm font-semibold text-slate-600">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {renderCalendarDays()}
              </div>
            </div>
          </div>

          {/* Selected Day Details */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sticky top-6">
              <h3 className="font-semibold text-slate-800 mb-4">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h3>

              {/* Time Off for selected date */}
              {selectedDateTimeOff.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-orange-600 mb-2">🏖️ Time Off</h4>
                  {selectedDateTimeOff.map(req => (
                    <div key={req.id} className="p-2 bg-orange-50 rounded-lg text-sm mb-2">
                      <span className="font-medium">{getUserName(req.user_id)}</span>
                      <span className="text-orange-600 ml-2">
                        {TIME_OFF_TYPES.find(t => t.id === req.request_type)?.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Events */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Events</h4>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-slate-400">No events</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDateEvents.map(event => (
                      <div key={event.id} className="p-3 rounded-lg border border-slate-100">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }} />
                            <span className="font-medium text-slate-800 text-sm">{event.title}</span>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingEvent(event); setShowEventModal(true); }} className="p-1 text-slate-400 hover:text-slate-600">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => deleteEvent(event.id)} className="p-1 text-slate-400 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        {!event.all_day && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                            <Clock size={12} />
                            {format(parseISO(event.start_time), 'h:mm a')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedules */}
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Work Schedules</h4>
                {selectedDateSchedules.length === 0 ? (
                  <p className="text-sm text-slate-400">No schedules</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDateSchedules.map(schedule => (
                      <div key={schedule.id} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-medium text-slate-800 text-sm">
                              {getUserName(schedule.user_id)}
                            </span>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {schedule.start_time?.slice(0, 5)} - {schedule.end_time?.slice(0, 5)}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingSchedule(schedule); setShowScheduleModal(true); }} className="p-1 text-slate-400 hover:text-slate-600">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => deleteSchedule(schedule.id)} className="p-1 text-slate-400 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          selectedDate={selectedDate}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
          onSave={saveEvent}
        />
      )}

      {showScheduleModal && (
        <ScheduleModal
          schedule={editingSchedule}
          selectedDate={selectedDate}
          users={users}
          onClose={() => { setShowScheduleModal(false); setEditingSchedule(null); }}
          onSave={saveSchedule}
        />
      )}

      {showTimeOffModal && (
        <TimeOffRequestModal
          onClose={() => setShowTimeOffModal(false)}
          onSubmit={submitTimeOffRequest}
        />
      )}

      {showBulkScheduleModal && (
        <BulkScheduleModal
          users={users}
          currentMonth={currentMonth}
          existingSchedules={schedules}
          onClose={() => setShowBulkScheduleModal(false)}
          onSave={saveBulkSchedules}
        />
      )}

      {showTimeOffReviewModal && reviewingTimeOff && (
        <TimeOffReviewModal
          request={reviewingTimeOff}
          getUserName={getUserName}
          onClose={() => { setShowTimeOffReviewModal(false); setReviewingTimeOff(null); }}
          onReview={reviewTimeOffRequest}
        />
      )}
    </div>
  );
}

// Time Off View Component
function TimeOffView({ requests, users, isAdmin, currentUser, onReview, getUserName }) {
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Pending Requests (Admin sees all, users see their own) */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="text-amber-500" size={20} />
            Pending Requests ({pendingRequests.length})
          </h3>
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{TIME_OFF_TYPES.find(t => t.id === req.request_type)?.icon}</div>
                  <div>
                    <p className="font-semibold text-slate-800">{getUserName(req.user_id)}</p>
                    <p className="text-sm text-slate-600">
                      {TIME_OFF_TYPES.find(t => t.id === req.request_type)?.name} • {req.start_date} to {req.end_date}
                    </p>
                    {req.reason && <p className="text-sm text-slate-500 mt-1">"{req.reason}"</p>}
                  </div>
                </div>
                {isAdmin && req.user_id !== currentUser?.id && (
                  <button
                    onClick={() => onReview(req)}
                    className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600 text-sm"
                  >
                    Review
                  </button>
                )}
                {req.user_id === currentUser?.id && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">Pending</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed Requests */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Request History</h3>
        {processedRequests.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No processed requests yet</p>
        ) : (
          <div className="space-y-3">
            {processedRequests.map(req => (
              <div key={req.id} className={`flex items-center justify-between p-4 rounded-xl border ${
                req.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{TIME_OFF_TYPES.find(t => t.id === req.request_type)?.icon}</div>
                  <div>
                    <p className="font-semibold text-slate-800">{getUserName(req.user_id)}</p>
                    <p className="text-sm text-slate-600">
                      {req.start_date} to {req.end_date}
                    </p>
                    {req.admin_notes && (
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <MessageSquare size={12} /> {req.admin_notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {req.status === 'approved' ? (
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      <CheckCircle size={14} /> Approved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                      <XCircle size={14} /> Denied
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Event Modal
function EventModal({ event, selectedDate, onClose, onSave }) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [eventType, setEventType] = useState(event?.event_type || 'meeting');
  const [date, setDate] = useState(event ? format(parseISO(event.start_time), 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(event ? format(parseISO(event.start_time), 'HH:mm') : '09:00');
  const [endTime, setEndTime] = useState(event?.end_time ? format(parseISO(event.end_time), 'HH:mm') : '10:00');
  const [allDay, setAllDay] = useState(event?.all_day || false);
  const [location, setLocation] = useState(event?.location || '');
  const [recurrence, setRecurrence] = useState(event?.recurrence || 'none');
  const [recurrenceEnd, setRecurrenceEnd] = useState(event?.recurrence_end || '');
  const [recurrenceDays, setRecurrenceDays] = useState(event?.recurrence_days || [1, 2, 3, 4, 5]); // Mon-Fri default

  const RECURRENCE_OPTIONS = [
    { id: 'none', label: 'Does not repeat (One-time)' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly on specific days' },
    { id: 'biweekly', label: 'Every 2 weeks' },
    { id: 'monthly', label: 'Monthly' },
  ];

  const DAYS_OF_WEEK = [
    { id: 0, short: 'Sun', full: 'Sunday' },
    { id: 1, short: 'Mon', full: 'Monday' },
    { id: 2, short: 'Tue', full: 'Tuesday' },
    { id: 3, short: 'Wed', full: 'Wednesday' },
    { id: 4, short: 'Thu', full: 'Thursday' },
    { id: 5, short: 'Fri', full: 'Friday' },
    { id: 6, short: 'Sat', full: 'Saturday' },
  ];

  const toggleDay = (dayId) => {
    setRecurrenceDays(prev => 
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
      description: description.trim(),
      event_type: eventType,
      start_time: allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`,
      end_time: allDay ? null : `${date}T${endTime}:00`,
      all_day: allDay,
      location: location.trim(),
      color: EVENT_TYPES.find(t => t.id === eventType)?.color || '#3B82F6',
      recurrence: recurrence,
      recurrence_end: recurrence !== 'none' && recurrenceEnd ? recurrenceEnd : null,
      recurrence_days: recurrence === 'weekly' ? recurrenceDays : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">{event ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-asap-blue" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Event details..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-asap-blue resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
              {EVENT_TYPES.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
            <span className="text-sm">All day event</span>
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, Zoom, etc." className="w-full px-4 py-2 border rounded-lg" />
          </div>
          
          {/* Recurrence Options */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Repeat</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
              {RECURRENCE_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          {/* Day Selection for Weekly */}
          {recurrence === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Repeat on these days</label>
              <div className="flex gap-1">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                      recurrenceDays.includes(day.id)
                        ? 'bg-asap-blue text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
              {recurrenceDays.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Please select at least one day</p>
              )}
            </div>
          )}
          
          {recurrence !== 'none' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Repeat Until (Optional)</label>
              <input 
                type="date" 
                value={recurrenceEnd} 
                onChange={(e) => setRecurrenceEnd(e.target.value)} 
                min={date}
                className="w-full px-4 py-2 border rounded-lg" 
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty to repeat indefinitely</p>
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600">{event ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Schedule Modal
function ScheduleModal({ schedule, selectedDate, users, onClose, onSave }) {
  const [userId, setUserId] = useState(schedule?.user_id || '');
  const [date, setDate] = useState(schedule?.date || format(selectedDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) || '09:00');
  const [endTime, setEndTime] = useState(schedule?.end_time?.slice(0, 5) || '17:00');
  const [shiftType, setShiftType] = useState(schedule?.shift_type || 'regular');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userId) return;
    onSave({ user_id: userId, date, start_time: startTime, end_time: endTime, shift_type: shiftType });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{schedule ? 'Edit Shift' : 'New Shift'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required>
              <option value="">Select...</option>
              {users?.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
              {SHIFT_TYPES.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{schedule ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Time Off Request Modal
function TimeOffRequestModal({ onClose, onSubmit }) {
  const [requestType, setRequestType] = useState('vacation');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ request_type: requestType, start_date: startDate, end_date: endDate, reason: reason.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Request Time Off</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Type of Leave</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_OFF_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setRequestType(type.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    requestType === type.id ? 'border-asap-blue bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xl">{type.icon}</span>
                  <p className="font-medium text-sm mt-1">{type.name}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Any details for your manager..." className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Submit Request</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Time Off Review Modal (Admin)
function TimeOffReviewModal({ request, getUserName, onClose, onReview }) {
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Review Time Off Request</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="font-semibold text-lg">{getUserName(request.user_id)}</p>
            <p className="text-slate-600 mt-1">
              {TIME_OFF_TYPES.find(t => t.id === request.request_type)?.icon} {TIME_OFF_TYPES.find(t => t.id === request.request_type)?.name}
            </p>
            <p className="text-slate-600">{request.start_date} to {request.end_date}</p>
            {request.reason && <p className="text-slate-500 mt-2 italic">"{request.reason}"</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes for Employee (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any message for the employee..." className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => onReview(request.id, 'denied', notes)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2">
              <XCircle size={18} /> Deny
            </button>
            <button onClick={() => onReview(request.id, 'approved', notes)} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
              <CheckCircle size={18} /> Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bulk Schedule Builder Modal
function BulkScheduleModal({ users, currentMonth, existingSchedules, onClose, onSave }) {
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [scheduleGrid, setScheduleGrid] = useState({});
  const [defaultShift, setDefaultShift] = useState({ start: '09:00', end: '17:00', type: 'regular' });
  const [copyFromWeek, setCopyFromWeek] = useState('');

  const weekDays = eachDayOfInterval({ start: selectedWeek, end: addDays(selectedWeek, 6) });

  const toggleUserDay = (userId, date) => {
    const key = `${userId}-${format(date, 'yyyy-MM-dd')}`;
    setScheduleGrid(prev => {
      if (prev[key]) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { ...defaultShift, user_id: userId, date: format(date, 'yyyy-MM-dd') } };
    });
  };

  const selectAllForUser = (userId) => {
    const newGrid = { ...scheduleGrid };
    weekDays.forEach(day => {
      const key = `${userId}-${format(day, 'yyyy-MM-dd')}`;
      newGrid[key] = { ...defaultShift, user_id: userId, date: format(day, 'yyyy-MM-dd') };
    });
    setScheduleGrid(newGrid);
  };

  const selectWeekdaysForUser = (userId) => {
    const newGrid = { ...scheduleGrid };
    weekDays.forEach(day => {
      const dayOfWeek = day.getDay();
      const key = `${userId}-${format(day, 'yyyy-MM-dd')}`;
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Mon-Fri
        newGrid[key] = { ...defaultShift, user_id: userId, date: format(day, 'yyyy-MM-dd') };
      }
    });
    setScheduleGrid(newGrid);
  };

  const copyWeekSchedule = () => {
    if (!copyFromWeek) return;
    const sourceWeekStart = parseISO(copyFromWeek);
    const sourceWeekDays = eachDayOfInterval({ start: sourceWeekStart, end: addDays(sourceWeekStart, 6) });
    
    const newGrid = { ...scheduleGrid };
    sourceWeekDays.forEach((sourceDay, index) => {
      const targetDay = weekDays[index];
      const sourceDateStr = format(sourceDay, 'yyyy-MM-dd');
      const targetDateStr = format(targetDay, 'yyyy-MM-dd');
      
      existingSchedules
        .filter(s => s.date === sourceDateStr)
        .forEach(s => {
          const key = `${s.user_id}-${targetDateStr}`;
          newGrid[key] = { 
            user_id: s.user_id, 
            date: targetDateStr, 
            start: s.start_time, 
            end: s.end_time, 
            type: s.shift_type 
          };
        });
    });
    setScheduleGrid(newGrid);
  };

  const handleSave = () => {
    const schedulesToSave = Object.values(scheduleGrid).map(s => ({
      user_id: s.user_id,
      date: s.date,
      start_time: s.start,
      end_time: s.end,
      shift_type: s.type
    }));
    if (schedulesToSave.length === 0) {
      alert('No schedules selected');
      return;
    }
    onSave(schedulesToSave);
  };

  // Get previous weeks for copy dropdown
  const previousWeeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(addWeeks(new Date(), -i - 1));
    return { value: format(weekStart, 'yyyy-MM-dd'), label: `Week of ${format(weekStart, 'MMM d')}` };
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Build Weekly Schedule</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Week Selector & Copy */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedWeek(addWeeks(selectedWeek, -1))} className="p-2 hover:bg-slate-100 rounded-lg">
                <ChevronLeft size={20} />
              </button>
              <span className="font-medium text-slate-700 min-w-[200px] text-center">
                Week of {format(selectedWeek, 'MMM d, yyyy')}
              </span>
              <button onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))} className="p-2 hover:bg-slate-100 rounded-lg">
                <ChevronRight size={20} />
              </button>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <select 
                value={copyFromWeek} 
                onChange={(e) => setCopyFromWeek(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Copy from week...</option>
                {previousWeeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              <button 
                onClick={copyWeekSchedule} 
                disabled={!copyFromWeek}
                className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 text-sm"
              >
                <Copy size={16} /> Copy
              </button>
            </div>
          </div>

          {/* Default Shift Settings */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <span className="text-sm font-medium text-slate-600">Default Shift:</span>
            <input 
              type="time" 
              value={defaultShift.start} 
              onChange={(e) => setDefaultShift(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
            <span className="text-slate-400">to</span>
            <input 
              type="time" 
              value={defaultShift.end} 
              onChange={(e) => setDefaultShift(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
            <select 
              value={defaultShift.type} 
              onChange={(e) => setDefaultShift(prev => ({ ...prev, type: e.target.value }))}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              {SHIFT_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Schedule Grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-left bg-slate-50 border">Employee</th>
                  {weekDays.map(day => (
                    <th key={day.toString()} className={`p-3 text-center bg-slate-50 border min-w-[80px] ${
                      day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-100' : ''
                    }`}>
                      <div className="text-xs text-slate-500">{format(day, 'EEE')}</div>
                      <div className="font-semibold">{format(day, 'd')}</div>
                    </th>
                  ))}
                  <th className="p-3 bg-slate-50 border">Quick</th>
                </tr>
              </thead>
              <tbody>
                {users?.map(user => (
                  <tr key={user.id}>
                    <td className="p-3 border font-medium">{user.name}</td>
                    {weekDays.map(day => {
                      const key = `${user.id}-${format(day, 'yyyy-MM-dd')}`;
                      const isSelected = !!scheduleGrid[key];
                      return (
                        <td 
                          key={day.toString()} 
                          onClick={() => toggleUserDay(user.id, day)}
                          className={`p-3 border text-center cursor-pointer transition-colors ${
                            isSelected ? 'bg-green-100 hover:bg-green-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          {isSelected && <Check size={20} className="mx-auto text-green-600" />}
                        </td>
                      );
                    })}
                    <td className="p-2 border">
                      <div className="flex gap-1">
                        <button 
                          onClick={() => selectWeekdaysForUser(user.id)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="Mon-Fri"
                        >
                          M-F
                        </button>
                        <button 
                          onClick={() => selectAllForUser(user.id)}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                          title="All Week"
                        >
                          All
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-slate-500">
              {Object.keys(scheduleGrid).length} shifts selected
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Check size={18} /> Save Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
