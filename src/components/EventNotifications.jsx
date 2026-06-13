import React, { useState, useEffect } from 'react';
import { Bell, X, Clock, Calendar } from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

export default function EventNotifications({ currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [events, setEvents] = useState([]);

  // Load today's events
  useEffect(() => {
    loadTodayEvents();
    // Reload events every 5 minutes
    const interval = setInterval(loadTodayEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Check for upcoming events every minute
  useEffect(() => {
    checkUpcomingEvents();
    const interval = setInterval(checkUpcomingEvents, 60 * 1000); // Every minute
    return () => clearInterval(interval);
  }, [events, dismissedIds]);

  const loadTodayEvents = async () => {
    if (!currentUser) return;
    
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      // Load calendar events
      const eventsUrl = `${SUPABASE_URL}/rest/v1/events?start_time=gte.${startOfDay}&start_time=lte.${endOfDay}&select=*`;
      const eventsRes = await fetch(eventsUrl, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        // Filter events that include current user or are for everyone
        const userEvents = eventsData.filter(e => 
          !e.attendees || 
          e.attendees.length === 0 || 
          e.attendees.includes(currentUser.id) ||
          e.created_by === currentUser.id
        );
        setEvents(userEvents);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const checkUpcomingEvents = () => {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    const upcomingNotifications = [];

    events.forEach(event => {
      if (dismissedIds.has(event.id)) return;
      
      const eventTime = new Date(event.start_time);
      const timeDiff = eventTime - now;
      const minutesUntil = Math.floor(timeDiff / (1000 * 60));

      // Show notification if event is 5 minutes away or less (but not past)
      if (minutesUntil <= 5 && minutesUntil >= -1) {
        upcomingNotifications.push({
          id: event.id,
          title: event.title,
          time: eventTime,
          minutesUntil,
          type: event.event_type,
          location: event.location,
        });
      }
    });

    setNotifications(upcomingNotifications);

    // Request browser notification permission if we have upcoming events
    if (upcomingNotifications.length > 0 && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show browser notification for events starting now
    upcomingNotifications.forEach(notif => {
      if (notif.minutesUntil <= 1 && notif.minutesUntil >= 0 && Notification.permission === 'granted') {
        showBrowserNotification(notif);
      }
    });
  };

  const showBrowserNotification = (notif) => {
    // Only show browser notification once per event
    const shownKey = `notif_shown_${notif.id}`;
    if (sessionStorage.getItem(shownKey)) return;
    
    sessionStorage.setItem(shownKey, 'true');
    
    new Notification(`📅 ${notif.title}`, {
      body: notif.minutesUntil === 0 
        ? 'Starting now!' 
        : `Starting in ${notif.minutesUntil} minute${notif.minutesUntil > 1 ? 's' : ''}`,
      icon: '/logo.png',
      tag: notif.id,
    });
  };

  const dismissNotification = (id) => {
    setDismissedIds(prev => new Set([...prev, id]));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`
            bg-white rounded-xl shadow-lg border-l-4 p-4 animate-pulse
            ${notif.minutesUntil <= 1 ? 'border-red-500' : 'border-amber-500'}
          `}
        >
          <div className="flex items-start gap-3">
            <div className={`
              p-2 rounded-lg flex-shrink-0
              ${notif.minutesUntil <= 1 ? 'bg-red-100' : 'bg-amber-100'}
            `}>
              <Bell 
                size={20} 
                className={notif.minutesUntil <= 1 ? 'text-red-600' : 'text-amber-600'} 
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-800 truncate">
                  {notif.title}
                </h4>
                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="p-1 hover:bg-slate-100 rounded-lg flex-shrink-0"
                >
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                <Clock size={14} className="text-slate-400" />
                <span className={`text-sm font-medium ${
                  notif.minutesUntil <= 1 ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {notif.minutesUntil <= 0 
                    ? 'Starting now!' 
                    : notif.minutesUntil === 1
                      ? '1 minute away'
                      : `${notif.minutesUntil} minutes away`
                  }
                </span>
              </div>
              
              {notif.location && (
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                  <Calendar size={14} />
                  <span>{notif.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
