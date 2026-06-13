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
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, addWeeks, eachDayOfInterval } from 'date-fns';
import AdminPTO from './AdminPTO';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const EVENT_TYPES = [
  { id: 'meeting', name: 'Meeting', color: '#3B82F6' },
  { id: 'deadline', name: 'Deadline', color: '#EF4444' },
  { id: 'company', name: 'Company Event', color: '#8B5CF6' },
  { id: 'training', name: 'Training', color: '#10B981' },
  { id: 'other', name: 'Other', color: '#6B7280' },
];

// Work schedule shift presets by department
const WORK_SHIFTS = {
  credit_consultants: [
    { id: '7-4', name: '7:00 AM - 4:00 PM', start: '07:00', end: '16:00' },
    { id: '8-5', name: '8:00 AM - 5:00 PM', start: '08:00', end: '17:00' },
    { id: '10-7', name: '10:00 AM - 7:00 PM', start: '10:00', end: '19:00' },
    { id: '7-7', name: '7:00 AM - 7:00 PM', start: '07:00', end: '19:00' },
  ],
  account_managers: [
    { id: '8-5', name: '8:00 AM - 5:00 PM', start: '08:00', end: '17:00' },
    { id: '9-6', name: '9:00 AM - 6:00 PM', start: '09:00', end: '18:00' },
  ],
  customer_support: [
    { id: '8-5', name: '8:00 AM - 5:00 PM', start: '08:00', end: '17:00' },
    { id: '8:30-5:30', name: '8:30 AM - 5:30 PM', start: '08:30', end: '17:30' },
    { id: '9-6', name: '9:00 AM - 6:00 PM', start: '09:00', end: '18:00' },
    { id: '10-7', name: '10:00 AM - 7:00 PM', start: '10:00', end: '19:00' },
  ],
  credit_team: [
    { id: '7-4', name: '7:00 AM - 4:00 PM (In-Office)', start: '07:00', end: '16:00' },
    { id: '8-5', name: '8:00 AM - 5:00 PM (Remote)', start: '08:00', end: '17:00' },
  ],
  leadership: [
    { id: '8-5', name: '8:00 AM - 5:00 PM', start: '08:00', end: '17:00' },
    { id: 'flex', name: 'Flexible', start: '08:00', end: '17:00' },
  ],
};

// Get all unique shifts for general use
const ALL_SHIFTS = [
  { id: '7-4', name: '7:00 AM - 4:00 PM', start: '07:00', end: '16:00' },
  { id: '8-5', name: '8:00 AM - 5:00 PM', start: '08:00', end: '17:00' },
  { id: '8:30-5:30', name: '8:30 AM - 5:30 PM', start: '08:30', end: '17:30' },
  { id: '9-6', name: '9:00 AM - 6:00 PM', start: '09:00', end: '18:00' },
  { id: '10-7', name: '10:00 AM - 7:00 PM', start: '10:00', end: '19:00' },
  { id: '7-7', name: '7:00 AM - 7:00 PM (12hr)', start: '07:00', end: '19:00' },
  { id: 'custom', name: 'Custom Times', start: '', end: '' },
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
  const [lunchSchedules, setLunchSchedules] = useState([]);
  const [ptoBalance, setPtoBalance] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [showTimeOffReviewModal, setShowTimeOffReviewModal] = useState(false);
  const [showLunchScheduleModal, setShowLunchScheduleModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [reviewingTimeOff, setReviewingTimeOff] = useState(null);
  const [view, setView] = useState('calendar'); // calendar, schedules, time-off, lunches, pto
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadEvents(), loadSchedules(), loadTimeOffRequests(), loadPtoBalance(), loadLunchSchedules(), loadHolidays()]);
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
      console.log('Loading time off requests from:', url);
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const data = await res.json() || [];
        console.log('Time off requests loaded:', data.length, data);
        setTimeOffRequests(data);
      } else {
        console.error('Failed to load time off requests:', res.status);
      }
    } catch (error) {
      console.error('Error loading time off requests:', error);
    }
  };

  const loadLunchSchedules = async () => {
    try {
      const url = `${SUPABASE_URL}/rest/v1/lunch_schedules?select=*&order=user_id,day_of_week`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setLunchSchedules(await res.json() || []);
    } catch (error) {
      console.error('Error loading lunch schedules:', error);
    }
  };

  // Company Holidays - stored as events with event_type 'company_holiday'
  const loadHolidays = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/events?event_type=eq.company_holiday&select=*&order=start_time.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.map(e => ({ 
          id: e.id, 
          date: e.start_time.split('T')[0], 
          name: e.title 
        })));
      }
    } catch (err) {
      console.log('Failed to load holidays:', err);
    }
  };

  const saveHolidays = async (newHolidays) => {
    try {
      // Delete all existing company_holiday events
      await fetch(`${SUPABASE_URL}/rest/v1/events?event_type=eq.company_holiday`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      // Insert new holidays as events
      if (newHolidays.length > 0) {
        const eventRows = newHolidays.map(h => ({
          title: h.name,
          event_type: 'company_holiday',
          start_time: `${h.date}T00:00:00`,
          end_time: `${h.date}T23:59:59`,
          all_day: true,
          description: 'Company Holiday',
          created_by: currentUser?.id
        }));
        await fetch(`${SUPABASE_URL}/rest/v1/events`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventRows)
        });
      }
      
      setHolidays(newHolidays);
      await loadEvents(); // Refresh events list
    } catch (err) {
      console.log('Failed to save holidays:', err);
      alert('Failed to save holidays: ' + err.message);
    }
  };

  const isHoliday = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dateStr);
  };

  const saveLunchSchedules = async (lunchData) => {
    try {
      // Delete existing lunch schedules for these users
      const userIds = [...new Set(lunchData.map(l => l.user_id))];
      for (const userId of userIds) {
        await fetch(`${SUPABASE_URL}/rest/v1/lunch_schedules?user_id=eq.${userId}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
      }
      
      // Insert new lunch schedules
      if (lunchData.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/lunch_schedules`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify(lunchData.map(l => ({ ...l, created_by: currentUser?.id })))
        });
      }
      
      await loadLunchSchedules();
      setShowLunchScheduleModal(false);
    } catch (error) {
      console.error('Error saving lunch schedules:', error);
    }
  };

  const saveEvent = async (eventData) => {
    try {
      // Start with core fields that definitely exist in the events table
      const coreData = {
        title: eventData.title,
        description: eventData.description || '',
        event_type: eventData.event_type,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        all_day: eventData.all_day || false,
      };
      
      // Optional fields - add if they have values
      if (eventData.color) coreData.color = eventData.color;
      if (eventData.location) coreData.location = eventData.location;

      console.log('Saving event:', JSON.stringify(coreData));

      let res;
      let saved = false;
      if (editingEvent) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${editingEvent.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ ...coreData, updated_at: new Date().toISOString() })
        });
        if (res.ok) saved = true;
      } else {
        res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ ...coreData, created_by: currentUser?.id })
        });
        if (res.ok) saved = true;
      }
      
      if (!saved) {
        const errText = await res.text();
        console.error('Event save failed:', res.status, errText);
        
        // Retry without color/location (minimal fields)
        const minimalData = {
          title: eventData.title,
          description: eventData.description || '',
          event_type: eventData.event_type,
          start_time: eventData.start_time,
          end_time: eventData.end_time,
          all_day: eventData.all_day || false,
        };
        // Only add created_by for new events
        if (!editingEvent && currentUser?.id) minimalData.created_by = currentUser.id;
        
        console.log('Retrying with minimal data:', JSON.stringify(minimalData));
        const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify(minimalData)
        });
        if (!retryRes.ok) {
          const retryErr = await retryRes.text();
          console.error('Event save retry failed:', retryRes.status, retryErr);
          
          // Last resort - try without created_by
          const lastResort = { ...minimalData };
          delete lastResort.created_by;
          const lastRes = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(lastResort)
          });
          if (!lastRes.ok) {
            const lastErr = await lastRes.text();
            alert('Failed to save event. Error: ' + lastErr);
            return;
          }
        }
      }
      
      await loadEvents();
      alert('Event saved successfully!');
      setShowEventModal(false);
      setEditingEvent(null);
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error saving event: ' + error.message);
      alert('Error saving event: ' + error.message);
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

  const saveBulkSchedules = async (schedulesData, schedulesToDelete = []) => {
    try {
      // 1. Delete schedules that were set to OFF
      for (const del of schedulesToDelete) {
        await fetch(`${SUPABASE_URL}/rest/v1/schedules?user_id=eq.${del.user_id}&date=eq.${del.date}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
      }
      
      // 2. Delete existing schedules for dates/users being updated, then re-insert
      for (const schedule of schedulesData) {
        const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/schedules?user_id=eq.${schedule.user_id}&date=eq.${schedule.date}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!deleteRes.ok) console.warn('Delete warning:', await deleteRes.text());
      }
      
      // 3. Insert new schedules
      if (schedulesData.length > 0) {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/schedules`, {
          method: 'POST',
          headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`, 
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(schedulesData.map(s => ({ ...s, created_by: currentUser?.id })))
        });
        
        if (!insertRes.ok) {
          const errorText = await insertRes.text();
          console.error('Insert error:', errorText);
          throw new Error('Failed to save schedules');
        }
      }
      
      await loadSchedules();
      setShowBulkScheduleModal(false);
    } catch (error) {
      console.error('Error saving bulk schedules:', error);
      throw error;
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
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/time_off_requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ 
          status, 
          admin_notes: notes,
          reviewed_by: currentUser?.id, 
          reviewed_at: new Date().toISOString() 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error updating time off request:', errorText);
        alert('Failed to update time off request. Please try again.');
        return;
      }

      // If approved, mark PTO as PENDING (deducted when dates arrive) and add calendar events
      if (status === 'approved' && request) {
        const hours = calculateBusinessHours(request.start_date, request.end_date);
        await addPtoPending(request.user_id, hours, requestId);
        
        // Add calendar events for the time off
        await addTimeOffToCalendar(request);
        
        // NOTE: We intentionally do NOT delete existing schedules here.
        // The schedule editor shows approved PTO as locked "🏖️ PTO" cells dynamically.
        // This way, if PTO is cancelled, the original schedule is automatically restored.
      }

      await loadTimeOffRequests();
      await loadEvents(); // Reload events to show new time off
      await loadPtoBalance(); // Refresh PTO balance display
      setShowTimeOffReviewModal(false);
      setReviewingTimeOff(null);
    } catch (error) {
      console.error('Error reviewing time off request:', error);
      alert('An error occurred. Please try again.');
    }
  };

  // Cancel an approved time off request - re-credit PTO, remove schedule & calendar entries
  const cancelTimeOff = async (request) => {
    // Guard: prevent double-cancel
    if (request.status === 'cancelled') {
      alert('This request was already cancelled.');
      await loadEvents();
      return;
    }
    
    const isPending = request.status === 'pending';
    const confirmMsg = isPending 
      ? `Withdraw time off request?`
      : `Cancel time off for ${getUserName(request.user_id)}?\n\nThis will:\n• Release pending PTO hours\n• Remove from the calendar`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
      // 1. Update request status to 'cancelled'
      const cancelRes = await fetch(`${SUPABASE_URL}/rest/v1/time_off_requests?id=eq.${request.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ 
          status: 'cancelled', 
          admin_notes: `Cancelled on ${new Date().toLocaleDateString()}`,
          reviewed_by: currentUser?.id
        })
      });
      
      if (!cancelRes.ok) {
        console.error('Failed to update request status:', await cancelRes.text());
        alert('Failed to cancel request. Please try again.');
        return;
      }

      const hours = calculateBusinessHours(request.start_date, request.end_date);
      
      // 2. Handle PTO balance - only if request was approved (pending requests never touched PTO)
      if (!isPending) {
        // Check if PTO was already deducted from balance (start date passed)
        const usedTxnRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions?time_off_request_id=eq.${request.id}&transaction_type=eq.used`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const usedTxns = usedTxnRes.ok ? await usedTxnRes.json() : [];
        
        if (usedTxns.length > 0) {
          // Already deducted from balance - credit back
          await creditPtoBalance(request.user_id, hours, request.id);
          console.log('Credited back', hours, 'hrs (was already deducted)');
        }
        
        // ALWAYS recalculate pending from remaining approved requests (prevents stuck pending)
        const today = format(new Date(), 'yyyy-MM-dd');
        const remainingRes = await fetch(`${SUPABASE_URL}/rest/v1/time_off_requests?user_id=eq.${request.user_id}&status=eq.approved&start_date=gt.${today}&id=neq.${request.id}&select=start_date,end_date`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        let recalcPending = 0;
        if (remainingRes.ok) {
          const remaining = await remainingRes.json();
          for (const r of remaining) {
            recalcPending += calculateBusinessHours(r.start_date, r.end_date);
          }
        }
        console.log('Recalculated pending:', recalcPending, 'hrs from remaining approved requests');
        
        await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${request.user_id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ pending: recalcPending, updated_at: new Date().toISOString() })
        });
        
        // Record cancellation transaction
        await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: request.user_id, transaction_type: 'cancel_pending', amount: hours,
            description: `Time off cancelled - ${hours} hrs. Pending recalculated to ${recalcPending} hrs`,
            time_off_request_id: request.id, created_by: currentUser?.id
          })
        });
      }

      // 3. Remove calendar events for this time off
      const userName = users.find(u => u.id === request.user_id)?.name || '';
      if (userName) {
        const eventsRes = await fetch(`${SUPABASE_URL}/rest/v1/events?event_type=eq.time_off&title=ilike.*${encodeURIComponent(userName)}*&start_time=gte.${request.start_date}T00:00:00&start_time=lte.${request.end_date}T23:59:59`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (eventsRes.ok) {
          const matchingEvents = await eventsRes.json();
          for (const evt of matchingEvents) {
            await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${evt.id}`, {
              method: 'DELETE',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
          }
          console.log('Removed', matchingEvents.length, 'calendar events');
        }
      }

      await loadTimeOffRequests();
      await loadEvents();
      await loadSchedules();
      await loadPtoBalance();
      alert(isPending 
        ? 'Time off request withdrawn.' 
        : `Time off cancelled. ${hours} PTO hrs released.`);
    } catch (error) {
      console.error('Error cancelling time off:', error);
      alert('Error cancelling time off: ' + error.message);
    }
  };

  // Re-credit PTO balance when time off is cancelled
  const creditPtoBalance = async (userId, hours, requestId) => {
    try {
      const balanceRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        let currentBalance = balanceData?.[0];
        
        // Auto-create if missing
        if (!currentBalance) {
          const createRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify({ user_id: userId, balance: 0, used: 0, pending: 0 })
          });
          if (createRes.ok) {
            const created = await createRes.json();
            currentBalance = created?.[0] || { balance: 0, used: 0, pending: 0 };
          } else {
            console.error('Failed to create PTO balance:', await createRes.text());
            return;
          }
        }
        
        const newBalance = (currentBalance.balance || 0) + hours;
        const newUsed = Math.max(0, (currentBalance.used || 0) - hours);
        
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ balance: newBalance, used: newUsed, updated_at: new Date().toISOString() })
        });
        if (!updateRes.ok) console.error('PTO credit PATCH failed:', await updateRes.text());

        await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            transaction_type: 'credit',
            amount: hours,
            balance_after: newBalance,
            description: `Time off cancelled - ${hours} hrs re-credited`,
            time_off_request_id: requestId,
            created_by: currentUser?.id
          })
        });
        
        console.log(`PTO credited: ${hours} hrs to user ${userId}. New balance: ${newBalance}, used: ${newUsed}`);
      }
    } catch (error) {
      console.error('Error crediting PTO balance:', error);
    }
  };

  // Add approved time off to calendar as events
  const addTimeOffToCalendar = async (request) => {
    try {
      const userName = users.find(u => u.id === request.user_id)?.name || 'Employee';
      const typeLabel = request.request_type === 'sick' ? '🤒 Sick Leave' : 
                        request.request_type === 'personal' ? '👤 Personal Day' : '🏖️ Vacation';
      
      // Create a single event spanning the entire time off period
      // Use T12:00:00 to avoid timezone offset shifting dates to previous day
      const eventData = {
        title: `${typeLabel}: ${userName}`,
        description: request.reason || '',
        start_time: `${request.start_date}T12:00:00`,
        end_time: `${request.end_date}T12:00:00`,
        all_day: true,
        event_type: 'time_off',
        created_by: currentUser?.id
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });

      if (!res.ok) {
        console.error('Error adding time off to calendar:', await res.text());
      }
    } catch (error) {
      console.error('Error adding time off to calendar:', error);
    }
  };

  // Calculate business hours (Mon-Fri, 8 hrs/day, excluding holidays) between two dates
  const calculateBusinessHours = (startDate, endDate) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    let businessDays = 0;
    let current = start;
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = format(current, 'yyyy-MM-dd');
      const isHol = holidays.some(h => h.date === dateStr);
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHol) { // Not weekend, not holiday
        businessDays++;
      }
      current = addDays(current, 1);
    }
    return businessDays * 8; // 8 hours per business day
  };

  // Add PTO to pending (on approval) - balance NOT deducted yet
  const addPtoPending = async (userId, hours, requestId) => {
    try {
      const balanceRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        let currentBalance = balanceData?.[0];
        if (!currentBalance) {
          const createRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify({ user_id: userId, balance: 0, used: 0, pending: 0 })
          });
          if (createRes.ok) currentBalance = (await createRes.json())?.[0] || { balance: 0, used: 0, pending: 0 };
        }
        const newPending = (currentBalance.pending || 0) + hours;
        await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ pending: newPending, updated_at: new Date().toISOString() })
        });
        await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId, transaction_type: 'pending', amount: -hours,
            balance_after: currentBalance.balance || 0,
            description: `Time off approved - pending until dates arrive (${hours} hrs)`,
            time_off_request_id: requestId, created_by: currentUser?.id
          })
        });
        console.log(`PTO pending: ${hours} hrs for user ${userId}. Pending total: ${newPending}`);
      }
    } catch (error) {
      console.error('Error adding PTO pending:', error);
    }
  };

  // Auto-process pending PTO: when start_date arrives, move from pending to used
  const processPendingPto = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const approvedRequests = timeOffRequests.filter(r => r.status === 'approved' && r.start_date <= today);
    
    for (const req of approvedRequests) {
      // Check if already processed (has a 'used' transaction for this request)
      const txnRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions?time_off_request_id=eq.${req.id}&transaction_type=eq.used`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (txnRes.ok) {
        const existingTxns = await txnRes.json();
        if (existingTxns.length > 0) continue; // Already processed
      }
      
      // Also check if there's a pending transaction (new flow)
      const pendingRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions?time_off_request_id=eq.${req.id}&transaction_type=eq.pending`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (pendingRes.ok) {
        const pendingTxns = await pendingRes.json();
        if (pendingTxns.length === 0) continue; // Approved under old flow (already deducted)
      }
      
      const hours = calculateBusinessHours(req.start_date, req.end_date);
      await deductPtoBalance(req.user_id, hours, req.id);
      
      // Reduce pending
      const balRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${req.user_id}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (balRes.ok) {
        const bal = (await balRes.json())?.[0];
        if (bal) {
          const newPending = Math.max(0, (bal.pending || 0) - hours);
          await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${req.user_id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ pending: newPending, updated_at: new Date().toISOString() })
          });
        }
      }
      console.log(`Auto-processed pending PTO for ${req.user_id}: ${hours} hrs deducted on start date ${req.start_date}`);
    }
  };

  // Run auto-process when time off requests load
  useEffect(() => {
    if (timeOffRequests.length > 0) {
      processPendingPto();
    }
  }, [timeOffRequests]);

  // Deduct PTO balance when time-off is approved
  const deductPtoBalance = async (userId, hours, requestId) => {
    try {
      // Get current balance
      const balanceRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        let currentBalance = balanceData?.[0];
        
        // Auto-create PTO balance record if none exists
        if (!currentBalance) {
          console.log(`Creating PTO balance record for user ${userId}`);
          const createRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify({ user_id: userId, balance: 0, used: 0, pending: 0 })
          });
          if (createRes.ok) {
            const created = await createRes.json();
            currentBalance = created?.[0] || { balance: 0, used: 0, pending: 0 };
          } else {
            console.error('Failed to create PTO balance:', await createRes.text());
            return;
          }
        }
        
        const newBalance = Math.max(0, (currentBalance.balance || 0) - hours);
        const newUsed = (currentBalance.used || 0) + hours;
        
        // Update balance
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ 
            balance: newBalance, 
            used: newUsed,
            updated_at: new Date().toISOString() 
          })
        });
        if (!updateRes.ok) console.error('PTO deduct PATCH failed:', await updateRes.text());

        // Record transaction
        await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            transaction_type: 'used',
            amount: -hours,
            balance_after: newBalance,
            description: `Time off approved (${hours} hrs)`,
            time_off_request_id: requestId,
            created_by: currentUser?.id
          })
        });
        
        console.log(`PTO deducted: ${hours} hrs from user ${userId}. New balance: ${newBalance}, used: ${newUsed}`);
      }
    } catch (error) {
      console.error('Error deducting PTO balance:', error);
    }
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start_time);
      const eventEnd = event.end_time ? parseISO(event.end_time) : eventStart;
      // For all-day/multi-day events, check if date falls within range
      if (event.all_day) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const startStr = format(eventStart, 'yyyy-MM-dd');
        const endStr = format(eventEnd, 'yyyy-MM-dd');
        return dateStr >= startStr && dateStr <= endStr;
      }
      return isSameDay(eventStart, date);
    });
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
      const dayEvents = getEventsForDate(currentDay).filter(e => {
        if (e.event_type === 'time_off' || e.event_type === 'company_holiday') return false;
        const t = (e.title || '').toLowerCase();
        if (t.includes('vacation:') || t.includes('personal day:') || t.includes('sick leave:')) return false;
        return true;
      });
      const daySchedules = getSchedulesForDate(currentDay);
      const dayTimeOff = getTimeOffForDate(currentDay);
      const dayHoliday = isHoliday(currentDay);
      const isToday = isSameDay(day, new Date());
      const isSelected = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, currentMonth);

      days.push(
        <div
          key={day.toString()}
          onClick={() => setSelectedDate(currentDay)}
          className={`min-h-[100px] p-2 border border-slate-100 cursor-pointer transition-colors ${
            dayHoliday ? 'bg-emerald-50' : isCurrentMonth ? 'bg-white' : 'bg-slate-50'
          } ${isSelected ? 'ring-2 ring-asap-blue' : ''} hover:bg-slate-50`}
        >
          <div className={`text-sm font-medium mb-1 ${
            isToday ? 'w-7 h-7 bg-asap-blue text-white rounded-full flex items-center justify-center' : 
            isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
          }`}>
            {format(day, 'd')}
          </div>
          <div className="space-y-1">
            {dayHoliday && (
              <div className="text-xs px-1.5 py-0.5 rounded truncate bg-emerald-200 text-emerald-800 font-medium">
                🎉 {dayHoliday.name}
              </div>
            )}
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

  const selectedDateEvents = getEventsForDate(selectedDate).filter(e => {
    if (e.event_type === 'time_off' || e.event_type === 'company_holiday') return false;
    const t = (e.title || '').toLowerCase();
    if (t.includes('vacation:') || t.includes('personal day:') || t.includes('sick leave:')) return false;
    return true;
  });
  const selectedDateTimeOff = getTimeOffForDate(selectedDate);
  const selectedDateHoliday = isHoliday(selectedDate);
  const selectedDateSchedules = selectedDateHoliday ? [] : getSchedulesForDate(selectedDate).filter(schedule => {
    // Hide users who have approved time off for this date
    return !selectedDateTimeOff.some(req => req.user_id === schedule.user_id);
  });

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
              onClick={() => setView('lunches')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'lunches' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              Lunches
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
            {isAdmin && (
              <button
                onClick={() => setView('pto')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === 'pto' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
                }`}
              >
                PTO Mgmt
              </button>
            )}
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
              <button
                onClick={() => setShowLunchScheduleModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
              >
                <Clock size={16} />
                Edit Lunches
              </button>
              <button
                onClick={() => setShowHolidayModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm"
              >
                🎉 Holidays
              </button>
            </>
          )}
        </div>
      </div>

      {/* PTO Balance Card */}
      {ptoBalance && (() => {
        const available = Math.max(0, (ptoBalance.balance || 0) - (ptoBalance.pending || 0));
        return (
        <div className="mb-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Umbrella size={24} />
              </div>
              <div>
                <p className="text-green-100 text-sm">Your PTO Balance</p>
                <p className="text-3xl font-bold">{available.toFixed(1)} <span className="text-lg font-normal">hrs</span></p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-green-100">Used</p>
                <p className="text-xl font-semibold">{ptoBalance.used?.toFixed(1) || '0.0'}</p>
              </div>
              <div className="text-center">
                <p className="text-green-100">Upcoming</p>
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
        );
      })()}

      {/* PTO Management View (Admin) */}
      {view === 'pto' ? (
        <AdminPTO />
      ) : view === 'time-off' ? (
        <TimeOffView 
          requests={isAdmin ? timeOffRequests : myTimeOffRequests}
          users={users}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onReview={(req) => { setReviewingTimeOff(req); setShowTimeOffReviewModal(true); }}
          onCancel={cancelTimeOff}
          getUserName={getUserName}
        />
      ) : view === 'lunches' ? (
        <LunchScheduleView 
          lunchSchedules={lunchSchedules}
          users={users}
          isAdmin={isAdmin}
          getUserName={getUserName}
          onEdit={() => setShowLunchScheduleModal(true)}
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

              {/* Holiday */}
              {selectedDateHoliday && (
                <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="font-semibold text-emerald-800">🎉 {selectedDateHoliday.name}</p>
                  <p className="text-sm text-emerald-600">Company Holiday — Office Closed</p>
                </div>
              )}

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
                {selectedDateHoliday ? (
                  <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700 font-medium">
                    🎉 Holiday — No schedules
                  </div>
                ) : selectedDateSchedules.length === 0 ? (
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
          timeOffRequests={timeOffRequests}
          onClose={() => setShowBulkScheduleModal(false)}
          onSave={saveBulkSchedules}
        />
      )}

      {showLunchScheduleModal && (
        <LunchScheduleModal
          users={users}
          existingSchedules={lunchSchedules}
          onClose={() => setShowLunchScheduleModal(false)}
          onSave={saveLunchSchedules}
        />
      )}

      {showHolidayModal && (
        <HolidayModal
          holidays={holidays}
          onClose={() => setShowHolidayModal(false)}
          onSave={(newHolidays) => { saveHolidays(newHolidays); setShowHolidayModal(false); }}
        />
      )}

      {showTimeOffReviewModal && reviewingTimeOff && (
        <TimeOffReviewModal
          request={reviewingTimeOff}
          getUserName={getUserName}
          onClose={() => { setShowTimeOffReviewModal(false); setReviewingTimeOff(null); }}
          onReview={reviewTimeOffRequest}
          supabaseUrl={SUPABASE_URL}
          supabaseKey={SUPABASE_KEY}
          calculateBusinessHours={calculateBusinessHours}
        />
      )}
    </div>
  );
}

// Time Off View Component
function TimeOffView({ requests, users, isAdmin, currentUser, onReview, onCancel, getUserName }) {
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const otherRequests = requests.filter(r => r.status !== 'pending' && r.status !== 'approved');

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
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={() => onReview(req)}
                      className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      Review
                    </button>
                  )}
                  {req.user_id === currentUser?.id && onCancel && (
                    <button
                      onClick={() => onCancel(req)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium flex items-center gap-1"
                    >
                      <XCircle size={14} /> Withdraw
                    </button>
                  )}
                  {!isAdmin && req.user_id !== currentUser?.id && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Time Off - with Cancel option */}
      {approvedRequests.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="text-green-500" size={20} />
            Approved Time Off ({approvedRequests.length})
          </h3>
          <div className="space-y-3">
            {approvedRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{TIME_OFF_TYPES.find(t => t.id === req.request_type)?.icon}</div>
                  <div>
                    <p className="font-semibold text-slate-800">{getUserName(req.user_id)}</p>
                    <p className="text-sm text-slate-600">
                      {TIME_OFF_TYPES.find(t => t.id === req.request_type)?.name} • {req.start_date} to {req.end_date}
                    </p>
                    {req.admin_notes && (
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <MessageSquare size={12} /> {req.admin_notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    <CheckCircle size={14} /> Approved
                  </span>
                  {isAdmin && onCancel && (
                    <div className="flex items-center gap-2">
                      {(req.admin_notes || '').includes('CANCEL_REQUESTED') && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium animate-pulse">
                          ⚠️ Cancel Requested
                        </span>
                      )}
                      <button
                        onClick={() => onCancel(req)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium flex items-center gap-1"
                      >
                        <XCircle size={14} /> Cancel
                      </button>
                    </div>
                  )}
                  {!isAdmin && req.user_id === currentUser?.id && (
                    (req.admin_notes || '').includes('CANCEL_REQUESTED') ? (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        ⏳ Cancel Requested
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!confirm('Request cancellation of this approved time off? Admin will be notified.')) return;
                          try {
                            const SUPABASE_URL_VAL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
                            const SUPABASE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
                            const existingNotes = req.admin_notes || '';
                            await fetch(`${SUPABASE_URL_VAL}/rest/v1/time_off_requests?id=eq.${req.id}`, {
                              method: 'PATCH',
                              headers: { 'apikey': SUPABASE_KEY_VAL, 'Authorization': `Bearer ${SUPABASE_KEY_VAL}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                              body: JSON.stringify({ admin_notes: `CANCEL_REQUESTED by employee on ${new Date().toLocaleDateString()}. ${existingNotes}` })
                            });
                            alert('Cancellation requested. Your admin will review it.');
                            window.location.reload();
                          } catch (err) {
                            alert('Failed to request cancellation: ' + err.message);
                          }
                        }}
                        className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium flex items-center gap-1"
                      >
                        <XCircle size={14} /> Request Cancel
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Requests (denied, cancelled) */}
      {otherRequests.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Request History</h3>
          <div className="space-y-3">
            {otherRequests.map(req => (
              <div key={req.id} className={`flex items-center justify-between p-4 rounded-xl border ${
                req.status === 'cancelled' ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-100'
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
                  {req.status === 'cancelled' ? (
                    <span className="flex items-center gap-1 px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-sm">
                      Cancelled
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
        </div>
      )}
    </div>
  );
}

// Event Modal
// Holiday Management Modal
function HolidayModal({ holidays, onClose, onSave }) {
  const [localHolidays, setLocalHolidays] = useState([...holidays]);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const DEFAULT_HOLIDAYS = [
    { date: `${new Date().getFullYear()}-01-01`, name: "New Year's Day" },
    { date: `${new Date().getFullYear()}-05-26`, name: 'Memorial Day' },
    { date: `${new Date().getFullYear()}-07-04`, name: 'Independence Day' },
    { date: `${new Date().getFullYear()}-09-01`, name: 'Labor Day' },
    { date: `${new Date().getFullYear()}-11-27`, name: 'Thanksgiving' },
    { date: `${new Date().getFullYear()}-11-28`, name: 'Day After Thanksgiving' },
    { date: `${new Date().getFullYear()}-12-24`, name: 'Christmas Eve' },
    { date: `${new Date().getFullYear()}-12-25`, name: 'Christmas Day' },
    { date: `${new Date().getFullYear()}-12-31`, name: "New Year's Eve" },
  ];

  const addHoliday = () => {
    if (!newDate || !newName.trim()) return;
    if (localHolidays.some(h => h.date === newDate)) {
      alert('This date is already a holiday.');
      return;
    }
    setLocalHolidays([...localHolidays, { date: newDate, name: newName.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate('');
    setNewName('');
  };

  const removeHoliday = (date) => {
    setLocalHolidays(localHolidays.filter(h => h.date !== date));
  };

  const loadDefaults = () => {
    const merged = [...localHolidays];
    for (const def of DEFAULT_HOLIDAYS) {
      if (!merged.some(h => h.date === def.date)) {
        merged.push(def);
      }
    }
    setLocalHolidays(merged.sort((a, b) => a.date.localeCompare(b.date)));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">🎉 Company Holidays</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">Holidays are excluded from work schedules and PTO calculations. Employees won't be charged PTO hours for holidays.</p>
          
          {localHolidays.length === 0 && (
            <div className="text-center py-4">
              <p className="text-slate-400 mb-3">No holidays set</p>
              <button onClick={loadDefaults} className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-sm font-medium">
                Load US Holidays for {new Date().getFullYear()}
              </button>
            </div>
          )}

          {localHolidays.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {localHolidays.map(h => (
                <div key={h.date} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">{h.name}</p>
                    <p className="text-sm text-slate-500">{h.date}</p>
                  </div>
                  <button onClick={() => removeHoliday(h.date)} className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Add Holiday</p>
            <div className="flex gap-2">
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Holiday name" className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              <button onClick={addHoliday} className="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm">Add</button>
            </div>
          </div>

          {localHolidays.length > 0 && (
            <button onClick={loadDefaults} className="text-sm text-emerald-600 hover:text-emerald-800">
              + Add missing US holidays for {new Date().getFullYear()}
            </button>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={() => onSave(localHolidays)} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">Save Holidays</button>
          </div>
        </div>
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
    const eventColor = EVENT_TYPES.find(t => t.id === eventType)?.color || '#3B82F6';
    onSave({
      title: title.trim(),
      description: description.trim(),
      event_type: eventType,
      start_time: allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`,
      end_time: allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`,
      all_day: allDay,
      location: location.trim(),
      color: eventColor,
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
  const [selectedShift, setSelectedShift] = useState('');
  const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) || '09:00');
  const [endTime, setEndTime] = useState(schedule?.end_time?.slice(0, 5) || '17:00');
  const [shiftType, setShiftType] = useState(schedule?.shift_type || 'regular');
  const [showCustom, setShowCustom] = useState(false);

  // Get selected user's department
  const selectedUser = users?.find(u => u.id === userId);
  const userDept = selectedUser?.department;
  
  // Get available shifts for this department
  const availableShifts = userDept ? (WORK_SHIFTS[userDept] || ALL_SHIFTS.slice(0, -1)) : ALL_SHIFTS.slice(0, -1);

  // Handle shift preset selection
  const handleShiftSelect = (shiftId) => {
    setSelectedShift(shiftId);
    if (shiftId === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      const shift = availableShifts.find(s => s.id === shiftId) || ALL_SHIFTS.find(s => s.id === shiftId);
      if (shift) {
        setStartTime(shift.start);
        setEndTime(shift.end);
      }
    }
  };

  // Auto-detect shift from existing times
  useEffect(() => {
    if (schedule?.start_time && schedule?.end_time) {
      const start = schedule.start_time.slice(0, 5);
      const end = schedule.end_time.slice(0, 5);
      const matchingShift = ALL_SHIFTS.find(s => s.start === start && s.end === end);
      if (matchingShift) {
        setSelectedShift(matchingShift.id);
      } else {
        setSelectedShift('custom');
        setShowCustom(true);
      }
    }
  }, [schedule]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userId) return;
    onSave({ 
      user_id: userId, 
      date, 
      start_time: startTime, 
      end_time: endTime, 
      shift_type: shiftType,
      work_shift: selectedShift // Store the shift preset ID
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{schedule ? 'Edit Shift' : 'Schedule Shift'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select 
              value={userId} 
              onChange={(e) => {
                setUserId(e.target.value);
                setSelectedShift(''); // Reset shift when user changes
              }} 
              className="w-full px-4 py-2 border rounded-lg" 
              required
            >
              <option value="">Select employee...</option>
              {users?.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.department?.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>

          {/* Shift Preset Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Work Shift *</label>
            <div className="grid grid-cols-2 gap-2">
              {availableShifts.map(shift => (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => handleShiftSelect(shift.id)}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedShift === shift.id
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {shift.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleShiftSelect('custom')}
                className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  selectedShift === 'custom'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                Custom Times
              </button>
            </div>
          </div>

          {/* Custom Time Inputs - Only show when custom is selected */}
          {showCustom && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div>
                <label className="block text-sm font-medium text-amber-800 mb-1">Start Time</label>
                <input 
                  type="time" 
                  value={startTime} 
                  onChange={(e) => setStartTime(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-800 mb-1">End Time</label>
                <input 
                  type="time" 
                  value={endTime} 
                  onChange={(e) => setEndTime(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg" 
                />
              </div>
            </div>
          )}

          {/* Selected times display */}
          {selectedShift && !showCustom && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                <Clock size={14} className="inline mr-1" />
                <span className="font-medium">{startTime}</span> to <span className="font-medium">{endTime}</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shift Type</label>
            <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
              {SHIFT_TYPES.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button 
              type="submit" 
              disabled={!selectedShift}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {schedule ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Time Off Request Modal
function TimeOffRequestModal({ onClose, onSubmit }) {
  // Date restrictions: must be 14 days to 3 months from today
  const minDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');
  const maxDate = format(addMonths(new Date(), 3), 'yyyy-MM-dd');
  
  const [requestType, setRequestType] = useState('vacation');
  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(minDate);
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (startDate < minDate) {
      alert('Requests must be at least 2 weeks in advance.');
      return;
    }
    if (endDate > maxDate) {
      alert('Requests cannot be more than 3 months out.');
      return;
    }
    if (endDate < startDate) {
      alert('End date cannot be before start date.');
      return;
    }
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
              <input type="date" value={startDate} min={minDate} max={maxDate} onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" value={endDate} min={startDate || minDate} max={maxDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
            </div>
          </div>
          <p className="text-xs text-slate-400">Requests must be at least 2 weeks in advance and no more than 3 months out.</p>
          
          {/* Live hours calculator */}
          {startDate && endDate && (() => {
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            let bizDays = 0;
            let current = start;
            while (current <= end) {
              const dow = current.getDay();
              if (dow !== 0 && dow !== 6) bizDays++;
              current = addDays(current, 1);
            }
            const totalHrs = bizDays * 8;
            return (
              <div className={`p-3 rounded-lg text-sm font-medium ${bizDays > 0 ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-50 text-slate-500'}`}>
                📅 {bizDays} business day{bizDays !== 1 ? 's' : ''} = {totalHrs} PTO hours
              </div>
            );
          })()}
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

// Lunch Schedule View Component
function LunchScheduleView({ lunchSchedules, users, isAdmin, getUserName, onEdit }) {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Group lunch schedules by user
  const schedulesByUser = {};
  users?.forEach(user => {
    schedulesByUser[user.id] = {
      user,
      schedules: lunchSchedules.filter(ls => ls.user_id === user.id)
    };
  });

  const formatTime = (time) => {
    if (!time) return '-';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Weekly Lunch Schedules</h3>
          <p className="text-sm text-slate-500">View and manage lunch times for all employees</p>
        </div>
        {isAdmin && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            <Edit2 size={16} />
            Edit Schedules
          </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Employee</th>
              {DAYS.slice(1, 6).map(day => (
                <th key={day} className="px-4 py-3 text-center text-sm font-semibold text-slate-700">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.values(schedulesByUser).map(({ user, schedules }) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.department}</div>
                </td>
                {[1, 2, 3, 4, 5].map(dayNum => {
                  const daySchedule = schedules.find(s => s.day_of_week === dayNum);
                  return (
                    <td key={dayNum} className="px-4 py-3 text-center">
                      {daySchedule ? (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm">
                          <Clock size={14} />
                          {formatTime(daySchedule.lunch_start)} - {formatTime(daySchedule.lunch_end)}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {(!users || users.length === 0) && (
        <div className="p-8 text-center text-slate-500">
          No employees found
        </div>
      )}
    </div>
  );
}

// Lunch Schedule Modal (Admin)
function LunchScheduleModal({ users, existingSchedules, onClose, onSave }) {
  const DAYS = [
    { num: 1, name: 'Monday' },
    { num: 2, name: 'Tuesday' },
    { num: 3, name: 'Wednesday' },
    { num: 4, name: 'Thursday' },
    { num: 5, name: 'Friday' }
  ];
  
  // Initialize grid with existing schedules
  const [lunchGrid, setLunchGrid] = useState(() => {
    const grid = {};
    existingSchedules?.forEach(ls => {
      const key = `${ls.user_id}-${ls.day_of_week}`;
      grid[key] = {
        user_id: ls.user_id,
        day_of_week: ls.day_of_week,
        lunch_start: ls.lunch_start,
        lunch_end: ls.lunch_end
      };
    });
    return grid;
  });
  
  const [defaultLunch, setDefaultLunch] = useState({ start: '12:00', end: '13:00' });

  const toggleUserDay = (userId, dayNum) => {
    const key = `${userId}-${dayNum}`;
    if (lunchGrid[key]) {
      // Remove
      const newGrid = { ...lunchGrid };
      delete newGrid[key];
      setLunchGrid(newGrid);
    } else {
      // Add with default times
      setLunchGrid({
        ...lunchGrid,
        [key]: {
          user_id: userId,
          day_of_week: dayNum,
          lunch_start: defaultLunch.start,
          lunch_end: defaultLunch.end
        }
      });
    }
  };

  const updateLunchTime = (userId, dayNum, field, value) => {
    const key = `${userId}-${dayNum}`;
    if (lunchGrid[key]) {
      setLunchGrid({
        ...lunchGrid,
        [key]: { ...lunchGrid[key], [field]: value }
      });
    }
  };

  const applyToAllDays = (userId) => {
    const newGrid = { ...lunchGrid };
    DAYS.forEach(day => {
      const key = `${userId}-${day.num}`;
      newGrid[key] = {
        user_id: userId,
        day_of_week: day.num,
        lunch_start: defaultLunch.start,
        lunch_end: defaultLunch.end
      };
    });
    setLunchGrid(newGrid);
  };

  const clearUser = (userId) => {
    const newGrid = { ...lunchGrid };
    DAYS.forEach(day => {
      const key = `${userId}-${day.num}`;
      delete newGrid[key];
    });
    setLunchGrid(newGrid);
  };

  const handleSave = () => {
    const schedulesToSave = Object.values(lunchGrid).map(s => ({
      user_id: s.user_id,
      day_of_week: s.day_of_week,
      lunch_start: s.lunch_start,
      lunch_end: s.lunch_end,
      is_active: true
    }));
    onSave(schedulesToSave);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-xl font-semibold">Edit Lunch Schedules</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        
        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Default Time Settings */}
          <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
            <span className="text-sm font-medium text-amber-700">Default Lunch Time:</span>
            <input 
              type="time" 
              value={defaultLunch.start} 
              onChange={(e) => setDefaultLunch(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
            <span className="text-slate-400">to</span>
            <input 
              type="time" 
              value={defaultLunch.end} 
              onChange={(e) => setDefaultLunch(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
          </div>

          {/* Schedule Grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-left bg-slate-50 border">Employee</th>
                  {DAYS.map(day => (
                    <th key={day.num} className="p-3 text-center bg-slate-50 border min-w-[120px]">
                      {day.name}
                    </th>
                  ))}
                  <th className="p-3 bg-slate-50 border">Quick</th>
                </tr>
              </thead>
              <tbody>
                {users?.filter(u => u.name !== 'Joe Mahlow').map(user => (
                  <tr key={user.id}>
                    <td className="p-3 border font-medium">{user.name}</td>
                    {DAYS.map(day => {
                      const key = `${user.id}-${day.num}`;
                      const schedule = lunchGrid[key];
                      return (
                        <td key={day.num} className="p-2 border">
                          {schedule ? (
                            <div className="space-y-1">
                              <input 
                                type="time" 
                                value={schedule.lunch_start || ''} 
                                onChange={(e) => updateLunchTime(user.id, day.num, 'lunch_start', e.target.value)}
                                className="w-full px-2 py-1 text-xs border rounded"
                              />
                              <input 
                                type="time" 
                                value={schedule.lunch_end || ''} 
                                onChange={(e) => updateLunchTime(user.id, day.num, 'lunch_end', e.target.value)}
                                className="w-full px-2 py-1 text-xs border rounded"
                              />
                              <button 
                                onClick={() => toggleUserDay(user.id, day.num)}
                                className="w-full text-xs text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => toggleUserDay(user.id, day.num)}
                              className="w-full py-3 text-slate-400 hover:bg-slate-50 rounded"
                            >
                              + Add
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 border">
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => applyToAllDays(user.id)}
                          className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                        >
                          Apply M-F
                        </button>
                        <button 
                          onClick={() => clearUser(user.id)}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                        >
                          Clear
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
              {Object.keys(lunchGrid).length} lunch schedules configured
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2">
                <Check size={18} /> Save Lunch Schedules
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Time Off Review Modal (Admin)
function TimeOffReviewModal({ request, getUserName, onClose, onReview, supabaseUrl, supabaseKey, calculateBusinessHours }) {
  const [notes, setNotes] = useState('');
  const [empBalance, setEmpBalance] = useState(null);
  const requestedHours = calculateBusinessHours ? calculateBusinessHours(request.start_date, request.end_date) : 0;

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/pto_balances?user_id=eq.${request.user_id}&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.[0]) setEmpBalance(data[0]);
        }
      } catch (err) { console.log('Failed to load employee balance:', err); }
    };
    if (supabaseUrl) loadBalance();
  }, [request.user_id]);

  const availableHrs = empBalance ? Math.max(0, (empBalance.balance || 0) - (empBalance.pending || 0)) : null;
  const willGoNegative = availableHrs !== null && requestedHours > availableHrs;

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
            <p className="text-slate-500 text-sm mt-1">{requestedHours} hrs ({requestedHours / 8} business days) requested</p>
            {request.reason && <p className="text-slate-500 mt-2 italic">"{request.reason}"</p>}
          </div>
          
          {empBalance && (
            <div className={`rounded-xl p-4 ${willGoNegative ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex justify-between text-sm">
                <span>Current Balance:</span>
                <span className="font-semibold">{empBalance.balance?.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Already Pending:</span>
                <span className="font-semibold">{empBalance.pending?.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Available:</span>
                <span className="font-semibold">{availableHrs?.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between text-sm mt-1 pt-1 border-t">
                <span>This Request:</span>
                <span className="font-semibold">{requestedHours} hrs</span>
              </div>
              {willGoNegative && (
                <div className="mt-2 p-2 bg-red-100 rounded-lg text-red-800 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Employee only has {availableHrs?.toFixed(1)} hrs — approving {requestedHours} hrs will put them {(requestedHours - availableHrs).toFixed(1)} hrs negative.
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes for Employee (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any message for the employee..." className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => onReview(request.id, 'denied', notes)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2">
              <XCircle size={18} /> Deny
            </button>
            <button onClick={() => onReview(request.id, 'approved', notes)} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
              <CheckCircle size={18} /> Approve{willGoNegative ? ' (Override)' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bulk Schedule Builder Modal
function BulkScheduleModal({ users, currentMonth, existingSchedules, timeOffRequests = [], onClose, onSave }) {
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [scheduleGrid, setScheduleGrid] = useState({});
  const [defaultShiftId, setDefaultShiftId] = useState('9-6');
  const [copyFromWeek, setCopyFromWeek] = useState('');
  const [saving, setSaving] = useState(false);
  const [customTimeModal, setCustomTimeModal] = useState(null); // {userId, date}
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('17:00');
  const [weekSchedules, setWeekSchedules] = useState([]);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const SHIFT_PRESETS = [
    { id: 'off', name: 'OFF', start: null, end: null, color: '#E5E7EB' },
    { id: '7-4', name: '7-4', start: '07:00', end: '16:00', color: '#DBEAFE' },
    { id: '7-6', name: '7-6', start: '07:00', end: '18:00', color: '#BFDBFE' },
    { id: '8-4', name: '8-4', start: '08:00', end: '16:00', color: '#BBF7D0' },
    { id: '8-5', name: '8-5', start: '08:00', end: '17:00', color: '#D1FAE5' },
    { id: '9-6', name: '9-6', start: '09:00', end: '18:00', color: '#FEF3C7' },
    { id: '10-7', name: '10-7', start: '10:00', end: '19:00', color: '#FCE7F3' },
    { id: '8:30-5:30', name: '8:30-5:30', start: '08:30', end: '17:30', color: '#E0E7FF' },
    { id: '7-7', name: '7-7 (12hr)', start: '07:00', end: '19:00', color: '#FECACA' },
    { id: 'custom', name: '⚙️', start: null, end: null, color: '#FEF08A' },
  ];

  // Check if a user has approved PTO on a specific date
  const approvedTimeOff = timeOffRequests.filter(r => r.status === 'approved');
  const isUserOnPTO = (userId, dateStr) => {
    return approvedTimeOff.some(req => 
      req.user_id === userId && req.start_date <= dateStr && req.end_date >= dateStr
    );
  };

  const weekDays = eachDayOfInterval({ start: selectedWeek, end: addDays(selectedWeek, 6) });

  // Fetch schedules for selected week
  useEffect(() => {
    const fetchWeekSchedules = async () => {
      const weekStart = format(selectedWeek, 'yyyy-MM-dd');
      const weekEnd = format(addDays(selectedWeek, 6), 'yyyy-MM-dd');
      try {
        const url = `${SUPABASE_URL}/rest/v1/schedules?date=gte.${weekStart}&date=lte.${weekEnd}&select=*`;
        const res = await fetch(url, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (res.ok) {
          const data = await res.json();
          setWeekSchedules(data || []);
        }
      } catch (error) {
        console.error('Error fetching week schedules:', error);
      }
    };
    fetchWeekSchedules();
  }, [selectedWeek]);

  // Initialize grid with fetched schedules for this week
  useEffect(() => {
    const newGrid = {};
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      weekSchedules
        .filter(s => s.date === dateStr)
        .forEach(s => {
          // Find matching preset (slice to remove seconds from DB time format)
          const startTime = s.start_time?.slice(0, 5);
          const endTime = s.end_time?.slice(0, 5);
          const preset = SHIFT_PRESETS.find(p => 
            p.start === startTime && p.end === endTime
          );
          
          const key = `${s.user_id}-${dateStr}`;
          newGrid[key] = {
            user_id: s.user_id,
            date: dateStr,
            shiftId: preset?.id || 'custom',
            start: startTime,
            end: endTime,
            type: s.shift_type || 'regular'
          };
        });
    });
    setScheduleGrid(newGrid);
  }, [weekSchedules]);

  const setShiftForUserDay = (userId, date, shiftId) => {
    const key = `${userId}-${format(date, 'yyyy-MM-dd')}`;
    const shift = SHIFT_PRESETS.find(s => s.id === shiftId);
    
    // Handle custom time selection
    if (shiftId === 'custom') {
      setCustomTimeModal({ userId, date: format(date, 'yyyy-MM-dd') });
      return;
    }
    
    if (shiftId === 'off' || !shift) {
      // Remove the schedule
      setScheduleGrid(prev => {
        const { [key]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      setScheduleGrid(prev => ({
        ...prev,
        [key]: {
          user_id: userId,
          date: format(date, 'yyyy-MM-dd'),
          shiftId: shiftId,
          start: shift.start,
          end: shift.end,
          type: 'regular'
        }
      }));
    }
  };

  // Save custom time
  const saveCustomTime = () => {
    if (!customTimeModal) return;
    const key = `${customTimeModal.userId}-${customTimeModal.date}`;
    setScheduleGrid(prev => ({
      ...prev,
      [key]: {
        user_id: customTimeModal.userId,
        date: customTimeModal.date,
        shiftId: 'custom',
        start: customStart,
        end: customEnd,
        type: 'regular'
      }
    }));
    setCustomTimeModal(null);
  };

  const applyDefaultToWeekdays = (userId) => {
    const shift = SHIFT_PRESETS.find(s => s.id === defaultShiftId);
    if (!shift || defaultShiftId === 'off') return;
    
    const newGrid = { ...scheduleGrid };
    weekDays.forEach(day => {
      const dayOfWeek = day.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Mon-Fri
        const key = `${userId}-${format(day, 'yyyy-MM-dd')}`;
        newGrid[key] = {
          user_id: userId,
          date: format(day, 'yyyy-MM-dd'),
          shiftId: defaultShiftId,
          start: shift.start,
          end: shift.end,
          type: 'regular'
        };
      }
    });
    setScheduleGrid(newGrid);
  };

  const clearUserSchedule = (userId) => {
    const newGrid = { ...scheduleGrid };
    weekDays.forEach(day => {
      const key = `${userId}-${format(day, 'yyyy-MM-dd')}`;
      delete newGrid[key];
    });
    setScheduleGrid(newGrid);
  };

  const copyWeekSchedule = async () => {
    if (!copyFromWeek) return;
    
    const sourceWeekStart = parseISO(copyFromWeek);
    const sourceWeekEnd = addDays(sourceWeekStart, 6);
    const sourceWeekDays = eachDayOfInterval({ start: sourceWeekStart, end: sourceWeekEnd });
    
    // Fetch schedules from the source week
    try {
      const url = `${SUPABASE_URL}/rest/v1/schedules?date=gte.${format(sourceWeekStart, 'yyyy-MM-dd')}&date=lte.${format(sourceWeekEnd, 'yyyy-MM-dd')}&select=*`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      if (!res.ok) {
        alert('Error fetching source week schedules');
        return;
      }
      
      const sourceSchedules = await res.json() || [];
      
      if (sourceSchedules.length === 0) {
        alert('No schedules found in the selected week to copy.');
        return;
      }
      
      const newGrid = { ...scheduleGrid };
      sourceWeekDays.forEach((sourceDay, index) => {
        const targetDay = weekDays[index];
        const sourceDateStr = format(sourceDay, 'yyyy-MM-dd');
        const targetDateStr = format(targetDay, 'yyyy-MM-dd');
        
        sourceSchedules
          .filter(s => s.date === sourceDateStr)
          .forEach(s => {
            // Slice to remove seconds from DB time format (e.g. "07:00:00" → "07:00")
            const startTime = s.start_time?.slice(0, 5);
            const endTime = s.end_time?.slice(0, 5);
            const preset = SHIFT_PRESETS.find(p => 
              p.start === startTime && p.end === endTime
            );
            
            const key = `${s.user_id}-${targetDateStr}`;
            newGrid[key] = { 
              user_id: s.user_id, 
              date: targetDateStr, 
              shiftId: preset?.id || 'custom',
              start: startTime || s.start_time, 
              end: endTime || s.end_time, 
              type: s.shift_type || 'regular'
            };
          });
      });
      setScheduleGrid(newGrid);
      setCopyFromWeek(''); // Reset dropdown
      alert(`Copied ${sourceSchedules.length} schedules from ${format(sourceWeekStart, 'MMM d')}!`);
    } catch (error) {
      console.error('Error copying week schedule:', error);
      alert('Error copying schedules. Please try again.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const schedulesToSave = Object.values(scheduleGrid)
      .filter(s => s.start && s.end) // Only save actual shifts, not "off"
      .map(s => ({
        user_id: s.user_id,
        date: s.date,
        start_time: s.start,
        end_time: s.end,
        shift_type: s.type
      }));
    
    // Also collect user/date combos that were set to OFF or removed
    // so we can delete their old schedules from the DB
    const schedulesToDelete = [];
    const gridUsers = users?.filter(u => u.name !== 'Joe Mahlow') || [];
    gridUsers.forEach(user => {
      weekDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const key = `${user.id}-${dateStr}`;
        const inGrid = scheduleGrid[key];
        const hadSchedule = weekSchedules.some(s => s.user_id === user.id && s.date === dateStr);
        // If user had a schedule but now it's removed (OFF) or not in grid
        if (hadSchedule && (!inGrid || !inGrid.start || !inGrid.end)) {
          schedulesToDelete.push({ user_id: user.id, date: dateStr });
        }
      });
    });
    
    if (schedulesToSave.length === 0 && schedulesToDelete.length === 0) {
      alert('No schedule changes to save.');
      setSaving(false);
      return;
    }
    
    try {
      await onSave(schedulesToSave, schedulesToDelete);
      alert(`Saved ${schedulesToSave.length} schedules${schedulesToDelete.length ? `, removed ${schedulesToDelete.length} day(s) off` : ''} successfully!`);
    } catch (error) {
      alert('Error saving schedules. Please try again.');
      console.error(error);
    }
    setSaving(false);
  };

  // Get previous weeks for copy dropdown
  const previousWeeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(addWeeks(new Date(), -i - 1));
    return { value: format(weekStart, 'yyyy-MM-dd'), label: `Week of ${format(weekStart, 'MMM d')}` };
  });

  const getShiftDisplay = (key) => {
    const schedule = scheduleGrid[key];
    if (!schedule) return null;
    
    // For custom times, create a display object with the actual times in 12-hour format
    if (schedule.shiftId === 'custom' && schedule.start && schedule.end) {
      return {
        id: 'custom',
        name: `${formatTimeShort(schedule.start)}-${formatTimeShort(schedule.end)}`,
        color: '#FEF08A' // Yellow for custom
      };
    }
    
    const preset = SHIFT_PRESETS.find(p => p.id === schedule.shiftId);
    return preset;
  };

  // Format time for display (07:00 -> 7a, 14:00 -> 2p, 14:30 -> 2:30p)
  const formatTimeShort = (time) => {
    if (!time) return '';
    const [hours, mins] = time.split(':');
    const h = parseInt(hours);
    const suffix = h >= 12 ? 'p' : 'a';
    const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return mins === '00' ? `${hour12}${suffix}` : `${hour12}:${mins}${suffix}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-xl font-semibold">Build Weekly Schedule</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        
        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
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

          {/* Default Shift for Quick Apply */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
            <span className="text-sm font-medium text-blue-700">Default Shift for M-F:</span>
            <div className="flex gap-2">
              {SHIFT_PRESETS.filter(s => s.id !== 'off').map(shift => (
                <button
                  key={shift.id}
                  onClick={() => setDefaultShiftId(shift.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    defaultShiftId === shift.id 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {shift.name}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-left bg-slate-50 border min-w-[150px]">Employee</th>
                  {weekDays.map(day => (
                    <th key={day.toString()} className={`p-3 text-center border min-w-[90px] ${
                      day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-100' : 'bg-slate-50'
                    }`}>
                      <div className="text-xs text-slate-500">{format(day, 'EEE')}</div>
                      <div className="font-semibold">{format(day, 'MMM d')}</div>
                    </th>
                  ))}
                  <th className="p-3 bg-slate-50 border">Quick</th>
                </tr>
              </thead>
              <tbody>
                {users?.filter(u => u.name !== 'Joe Mahlow').map(user => (
                  <tr key={user.id}>
                    <td className="p-3 border">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.department}</div>
                    </td>
                    {weekDays.map(day => {
                      const key = `${user.id}-${format(day, 'yyyy-MM-dd')}`;
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const shiftDisplay = getShiftDisplay(key);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const onPTO = isUserOnPTO(user.id, dateStr);
                      
                      return (
                        <td key={day.toString()} className={`p-1 border ${isWeekend ? 'bg-slate-50' : ''}`}>
                          {onPTO ? (
                            <div className="w-full px-2 py-2 text-sm font-bold rounded-lg text-center bg-orange-200 text-orange-800 cursor-not-allowed" title="Approved PTO - cancel in Time Off tab to re-schedule">
                              🏖️ PTO
                            </div>
                          ) : (
                          <select
                            value={scheduleGrid[key]?.shiftId || 'off'}
                            onChange={(e) => setShiftForUserDay(user.id, day, e.target.value)}
                            className="w-full px-2 py-2 text-sm font-medium rounded-lg border-0 cursor-pointer text-center"
                            style={{ 
                              backgroundColor: shiftDisplay?.color || '#F3F4F6',
                              color: shiftDisplay && shiftDisplay.id !== 'off' ? '#1F2937' : '#9CA3AF'
                            }}
                          >
                            {SHIFT_PRESETS.map(shift => (
                              <option key={shift.id} value={shift.id}>
                                {shift.id === 'custom' && scheduleGrid[key]?.shiftId === 'custom' && scheduleGrid[key]?.start
                                  ? `${formatTimeShort(scheduleGrid[key].start)}-${formatTimeShort(scheduleGrid[key].end)}`
                                  : shift.name}
                              </option>
                            ))}
                          </select>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 border">
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => applyDefaultToWeekdays(user.id)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium"
                          title={`Apply ${SHIFT_PRESETS.find(s => s.id === defaultShiftId)?.name} Mon-Fri`}
                        >
                          Apply M-F
                        </button>
                        <button 
                          onClick={() => clearUserSchedule(user.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          title="Clear all shifts"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shift Legend */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <span className="text-sm text-slate-600 font-medium">Shifts:</span>
            {SHIFT_PRESETS.filter(s => s.id !== 'off').map(shift => (
              <div 
                key={shift.id} 
                className="flex items-center gap-1.5 px-2 py-1 rounded text-sm"
                style={{ backgroundColor: shift.color }}
              >
                <span className="font-medium">{shift.name}</span>
                <span className="text-slate-500 text-xs">
                  {shift.start?.replace(':00', '')} - {shift.end?.replace(':00', '')}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-sm bg-orange-200">
              <span className="font-medium">🏖️ PTO</span>
              <span className="text-orange-600 text-xs">Approved time off</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-slate-500">
              {Object.keys(scheduleGrid).length} shifts scheduled
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={18} /> Save Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Custom Time Modal */}
        {customTimeModal && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl p-6 shadow-xl w-80">
              <h3 className="font-semibold text-lg mb-4">Set Custom Time</h3>
              <p className="text-sm text-slate-600 mb-4">
                {users.find(u => u.id === customTimeModal.userId)?.name} - {customTimeModal.date}
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                  <input 
                    type="time" 
                    value={customStart} 
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End</label>
                  <input 
                    type="time" 
                    value={customEnd} 
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCustomTimeModal(null)} 
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveCustomTime}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Set Time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
