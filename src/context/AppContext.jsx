import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const AppContext = createContext();

// Time slot definitions for sorting
const TIME_SLOTS = {
  MORNING: { id: 'morning', label: 'Morning', order: 1, color: 'amber' },
  AM_TIMED: { id: 'am_timed', label: 'AM (Timed)', order: 2, color: 'blue' },
  AFTERNOON: { id: 'afternoon', label: 'Afternoon', order: 3, color: 'orange' },
  PM_TIMED: { id: 'pm_timed', label: 'PM (12:01-4:00)', order: 4, color: 'purple' },
  EOD: { id: 'eod', label: 'End of Day', order: 5, color: 'slate' },
  EVENING: { id: 'evening', label: 'Evening (4:01-7:00)', order: 6, color: 'indigo' },
};

const DEPARTMENTS = [
  { id: 'leadership', name: 'Leadership' },
  { id: 'admin', name: 'Admin' },
  { id: 'credit_team', name: 'Credit Team' },
  { id: 'credit_consultants', name: 'Credit Consultants' },
  { id: 'account_managers', name: 'Account Managers' },
  { id: 'customer_support', name: 'Customer Support' },
];

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [dailyCompletions, setDailyCompletions] = useState({});
  const [personalTasks, setPersonalTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Initialize - check for existing session
  useEffect(() => {
    // Force loading to false after 5 seconds no matter what
    const timeout = setTimeout(() => {
      console.log('Timeout reached, forcing loading to false');
      setLoading(false);
    }, 5000);

    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserProfile(session.user.id);
      } else if (event === 'INITIAL_SESSION' && session?.user) {
        // Handle page refresh with existing session
        console.log('Initial session detected on refresh');
        await loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Load all data when user is authenticated
  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser]);

  const checkUser = async () => {
    try {
      console.log('Checking for existing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        setLoading(false);
        return;
      }
      
      console.log('Session found:', session ? 'Yes' : 'No');
      
      if (session?.user) {
        console.log('Session user ID:', session.user.id);
        await loadUserProfile(session.user.id);
      } else {
        console.log('No active session, user needs to login');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setLoading(false);
    }
  };

  const loadUserProfile = async (authUserId) => {
    try {
      console.log('Loading profile for auth_id:', authUserId);
      
      // Use direct fetch instead of Supabase client
      const response = await fetch(
        `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/users?auth_id=eq.${authUserId}&select=*`,
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0'
          }
        }
      );
      
      console.log('Fetch response status:', response.status);
      const data = await response.json();
      console.log('Profile data:', data);
      
      if (!data || data.length === 0) {
        console.log('No profile found for auth_id');
        setLoading(false);
        return null;
      }
      
      const profile = data[0];
      console.log('Profile loaded successfully:', profile);
      setCurrentUser(profile);
      setLoading(false);
      return profile;
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
      return null;
    }
  };

  const loadAllData = async () => {
    console.log('Loading all data...');
    await Promise.all([
      loadUsers(),
      loadTaskTemplates(),
      loadDailyCompletions(),
      loadPersonalTasks(),
      loadUpdates(),
    ]);
    console.log('All data loaded');
  };

  // Helper function for direct fetch
  const supabaseFetch = async (table, query = '') => {
    const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/${table}?${query}`;
    const response = await fetch(url, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  };

  const supabasePost = async (table, data) => {
    const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/${table}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  };

  const supabaseDelete = async (table, query) => {
    const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/${table}?${query}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  };

  const supabasePatch = async (table, id, data) => {
    const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/${table}?id=eq.${id}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  };

  const loadUsers = async () => {
    try {
      const data = await supabaseFetch('users', 'select=*&order=name');
      console.log('Users loaded:', data);
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTaskTemplates = async () => {
    try {
      const data = await supabaseFetch('task_templates', 'select=*&order=time_slot');
      console.log('Task templates loaded:', data);
      setTaskTemplates(data || []);
    } catch (error) {
      console.error('Error loading task templates:', error);
    }
  };

  const loadDailyCompletions = async () => {
    try {
      const data = await supabaseFetch('task_completions', `select=*&completion_date=eq.${today}`);
      console.log('Completions loaded:', data);
      
      // Convert to lookup object
      const completions = {};
      (data || []).forEach(c => {
        completions[`${c.user_id}_${c.task_id}`] = true;
      });
      setDailyCompletions(completions);
    } catch (error) {
      console.error('Error loading completions:', error);
    }
  };

  const loadPersonalTasks = async () => {
    try {
      const data = await supabaseFetch('personal_tasks', `select=*&or=(is_recurring.eq.true,created_date.eq.${today})`);
      console.log('Personal tasks loaded:', data);
      setPersonalTasks(data || []);
    } catch (error) {
      console.error('Error loading personal tasks:', error);
    }
  };

  const loadUpdates = async () => {
    try {
      const data = await supabaseFetch('updates', 'select=*,update_acknowledgements(*)&order=created_at.desc');
      console.log('Updates loaded:', data);
      
      // Transform acknowledgements to object format
      const transformedUpdates = (data || []).map(update => ({
        ...update,
        acknowledgements: (update.update_acknowledgements || []).reduce((acc, ack) => {
          acc[ack.user_id] = ack.acknowledged_at;
          return acc;
        }, {}),
      }));
      
      setUpdates(transformedUpdates);
    } catch (error) {
      console.error('Error loading updates:', error);
    }
  };

  // Authentication
  const login = async (email, password) => {
    setAuthLoading(true);
    console.log('Login attempt for:', email);
    try {
      console.log('Calling Supabase signInWithPassword...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('SignIn result:', { data, error });

      if (error) throw error;
      
      console.log('Auth successful, user id:', data.user.id);
      await loadUserProfile(data.user.id);
      console.log('Profile loaded, currentUser should be set');
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    } finally {
      setAuthLoading(false);
      console.log('Login process complete, authLoading set to false');
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]);
    setTaskTemplates([]);
    setDailyCompletions({});
    setPersonalTasks([]);
    setUpdates([]);
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Get tasks for a user
  const getTasksForUser = (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return [];

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const userTasks = taskTemplates.filter(task => {
      // Check assignment
      if (task.assigned_to === 'everyone') {}
      else if (task.assigned_to === user.department) {}
      else if (Array.isArray(task.assigned_to) && task.assigned_to.includes(user.department)) {}
      else if (task.assigned_to === userId) {}
      else return false;

      // Check frequency
      const frequency = task.frequency || 'daily';
      
      if (frequency === 'one_time') {
        // One-time tasks show until completed (we'll handle cleanup separately)
        return true;
      }
      
      if (frequency === 'weekly') {
        // Only show on selected days
        const daysOfWeek = task.days_of_week || [1, 2, 3, 4, 5]; // Default Mon-Fri
        return daysOfWeek.includes(dayOfWeek);
      }
      
      // Daily tasks always show
      return true;
    });

    // Add personal tasks for this user
    const userPersonalTasks = personalTasks
      .filter(t => t.user_id === userId)
      .map(t => ({
        ...t,
        id: t.id,
        title: t.title,
        timeSlot: t.time_slot,
        specificTime: t.specific_time,
        link: t.link,
        isPersonal: true,
        isRecurring: t.is_recurring,
      }));

    const allTasks = [
      ...userTasks.map(t => ({
        ...t,
        timeSlot: t.time_slot,
        specificTime: t.specific_time,
        assignedTo: t.assigned_to,
        description: t.description,
        frequency: t.frequency || 'daily',
        daysOfWeek: t.days_of_week,
      })),
      ...userPersonalTasks,
    ];

    return allTasks.map(task => ({
      ...task,
      completed: dailyCompletions[`${userId}_${task.id}`] || false,
    }));
  };

  // Sort tasks by time slot
  const sortTasks = (tasks) => {
    const slotOrder = { morning: 1, am_timed: 2, afternoon: 3, pm_timed: 4, eod: 5, evening: 6 };
    
    return [...tasks].sort((a, b) => {
      const slotDiff = slotOrder[a.timeSlot] - slotOrder[b.timeSlot];
      if (slotDiff !== 0) return slotDiff;
      
      if (a.specificTime && b.specificTime) {
        return a.specificTime.localeCompare(b.specificTime);
      }
      if (a.specificTime) return -1;
      if (b.specificTime) return 1;
      return 0;
    });
  };

  // Toggle task completion
  const toggleTaskCompletion = async (userId, taskId) => {
    const key = `${userId}_${taskId}`;
    const isCurrentlyComplete = dailyCompletions[key];

    // Optimistic update
    setDailyCompletions(prev => ({
      ...prev,
      [key]: !isCurrentlyComplete,
    }));

    try {
      if (isCurrentlyComplete) {
        // Delete completion
        await supabaseDelete('task_completions', `user_id=eq.${userId}&task_id=eq.${taskId}&completion_date=eq.${today}`);
      } else {
        // Insert completion
        await supabasePost('task_completions', {
          user_id: userId,
          task_id: taskId,
          completion_date: today,
        });
      }
    } catch (error) {
      console.error('Error toggling completion:', error);
      // Revert on error
      setDailyCompletions(prev => ({
        ...prev,
        [key]: isCurrentlyComplete,
      }));
    }
  };

  // Add personal task
  const addPersonalTask = async (userId, task) => {
    try {
      const data = await supabasePost('personal_tasks', {
        user_id: userId,
        title: task.title,
        time_slot: task.timeSlot,
        specific_time: task.specificTime || null,
        link: task.link || null,
        is_recurring: task.isRecurring || false,
        created_date: today,
      });

      if (data && data[0]) {
        setPersonalTasks(prev => [...prev, data[0]]);
      }
    } catch (error) {
      console.error('Error adding personal task:', error);
    }
  };

  // Admin: Add task template
  const addTaskTemplate = async (task) => {
    try {
      const data = await supabasePost('task_templates', {
        title: task.title,
        description: task.description || null,
        time_slot: task.timeSlot,
        specific_time: task.specificTime || null,
        assigned_to: task.assignedTo,
        link: task.link || null,
        frequency: task.frequency || 'daily',
        days_of_week: task.daysOfWeek || null,
      });

      if (data && data[0]) {
        setTaskTemplates(prev => [...prev, data[0]]);
      }
    } catch (error) {
      console.error('Error adding task template:', error);
    }
  };

  // Admin: Update task template
  const updateTaskTemplate = async (taskId, updates) => {
    try {
      const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/task_templates?id=eq.${taskId}`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: updates.title,
          description: updates.description || null,
          time_slot: updates.timeSlot,
          specific_time: updates.specificTime || null,
          assigned_to: updates.assignedTo,
          link: updates.link || null,
          frequency: updates.frequency || 'daily',
          days_of_week: updates.daysOfWeek || null,
        })
      });
      setTaskTemplates(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    } catch (error) {
      console.error('Error updating task template:', error);
    }
  };

  // Admin: Delete task template
  const deleteTaskTemplate = async (taskId) => {
    try {
      await supabaseDelete('task_templates', `id=eq.${taskId}`);
      setTaskTemplates(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error deleting task template:', error);
    }
  };

  // Admin: Add user (creates auth + profile)
  const addUser = async (userData) => {
    try {
      const data = await supabasePost('users', {
        name: userData.name,
        email: userData.email,
        department: userData.department,
        role: userData.role || 'user',
        avatar: userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      });

      if (data && data[0]) {
        setUsers(prev => [...prev, data[0]]);
        return { success: true, data: data[0] };
      }
      return { success: false, error: 'Failed to create user' };
    } catch (error) {
      console.error('Error adding user:', error);
      return { success: false, error: error.message };
    }
  };

  // Admin: Update user
  const updateUser = async (userId, updates) => {
    try {
      console.log('Updating user:', userId, 'with:', updates);
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      console.log('Update result:', data);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  };

  // Admin: Delete user
  const deleteUser = async (userId) => {
    try {
      await supabaseDelete('users', `id=eq.${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // Updates/Announcements
  const addUpdate = async (update) => {
    try {
      if (!currentUser?.id) {
        console.error('No current user - cannot add update');
        return;
      }
      
      const data = await supabasePost('updates', {
        title: update.title,
        content: update.content,
        priority: update.priority || 'normal',
        assigned_to: Array.isArray(update.assignedTo) ? update.assignedTo : ['everyone'],
        created_by: currentUser.id,
      });

      if (data && data[0]) {
        setUpdates(prev => [{ ...data[0], acknowledgements: {}, update_acknowledgements: [] }, ...prev]);
      }
      
      return data;
    } catch (error) {
      console.error('Error adding update:', error);
      throw error;
    }
  };

  const acknowledgeUpdate = async (updateId, userId) => {
    try {
      await supabasePost('update_acknowledgements', {
        update_id: updateId,
        user_id: userId,
      });
      
      setUpdates(prev => prev.map(u => {
        if (u.id === updateId) {
          return {
            ...u,
            acknowledgements: {
              ...u.acknowledgements,
              [userId]: new Date().toISOString(),
            },
          };
        }
        return u;
      }));
    } catch (error) {
      console.error('Error acknowledging update:', error);
    }
  };

  // Get updates for user
  const getUpdatesForUser = (userId) => {
    const user = (users || []).find(u => u.id === userId);
    if (!user) return [];
    
    return (updates || []).filter(update => {
      if (!update) return false;
      const assignedTo = update.assigned_to || [];
      if (assignedTo.includes('everyone')) return true;
      if (assignedTo.includes(user.department)) return true;
      return false;
    });
  };

  // Get completion stats
  const getCompletionStats = (userId) => {
    const tasks = getTasksForUser(userId);
    const completed = tasks.filter(t => t.completed).length;
    return {
      total: tasks.length,
      completed,
      percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
    };
  };

  // Get all users' completion stats
  const getAllUsersStats = () => {
    return users.map(user => ({
      ...user,
      stats: getCompletionStats(user.id),
    }));
  };

  // Notifications
  const addNotification = (notification) => {
    const newNotification = {
      id: `n${Date.now()}`,
      ...notification,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markNotificationRead = (notificationId) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
  };

  const value = {
    // State
    currentUser,
    users,
    taskTemplates,
    dailyCompletions,
    updates,
    notifications,
    loading,
    authLoading,
    
    // Constants
    TIME_SLOTS,
    DEPARTMENTS,
    
    // Auth
    login,
    logout,
    resetPassword,
    
    // Tasks
    getTasksForUser,
    sortTasks,
    toggleTaskCompletion,
    addPersonalTask,
    addTaskTemplate,
    updateTaskTemplate,
    deleteTaskTemplate,
    
    // Users
    addUser,
    updateUser,
    deleteUser,
    
    // Updates
    addUpdate,
    acknowledgeUpdate,
    getUpdatesForUser,
    
    // Stats
    getCompletionStats,
    getAllUsersStats,
    
    // Notifications
    addNotification,
    markNotificationRead,
    
    // Refresh data
    refreshData: loadAllData,
    
    // Supabase helpers (for training module)
    supabaseFetch,
    supabasePost,
    supabaseDelete,
    supabasePatch,
    
    // Direct supabase client (for advanced queries)
    supabase,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
