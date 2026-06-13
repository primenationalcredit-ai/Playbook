import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings as SettingsIcon,
  Bell,
  BellOff,
  Shield,
  Users,
  Eye,
  EyeOff,
  Save,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Search,
  AlertCircle,
  Info,
  Lock,
  Unlock,
  Mail,
  Smartphone,
  MessageSquare,
  Calendar,
  Star,
  DollarSign,
  GraduationCap,
  ClipboardList,
  Target,
  Headphones,
  Wallet,
  Sparkles,
  Database,
} from 'lucide-react';

// Feature/Access definitions
const ACCESS_FEATURES = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Main dashboard with overview stats',
    icon: ClipboardList,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'playbook',
    name: 'My Playbook',
    description: 'Personal task management and daily tasks',
    icon: ClipboardList,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'team_view',
    name: 'Team View',
    description: 'View team members and their progress',
    icon: Users,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'training',
    name: 'Training',
    description: 'Access training courses and materials',
    icon: GraduationCap,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'View and manage calendar events',
    icon: Calendar,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'reviews',
    name: 'Reviews',
    description: 'Track and submit Google reviews',
    icon: Star,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'review_link',
    name: 'Get Review Link',
    description: 'Access the smart review link generator',
    icon: Star,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'scorecards',
    name: 'Score Cards',
    description: 'View and track performance scorecards',
    icon: Target,
    category: 'core',
    defaultAccess: ['all'],
  },
  {
    id: 'ask_ai',
    name: 'Ask AI',
    description: 'AI assistant for questions and help',
    icon: Sparkles,
    category: 'tools',
    defaultAccess: ['all'],
  },
  {
    id: 'affiliates',
    name: 'Affiliates',
    description: 'Manage affiliate referrals and tracking',
    icon: Users,
    category: 'sales',
    defaultAccess: ['credit_consultants', 'account_managers', 'leadership'],
  },
  {
    id: 'payments',
    name: 'Payment Dashboard',
    description: 'View payment and commission information',
    icon: DollarSign,
    category: 'sales',
    defaultAccess: ['credit_consultants', 'account_managers', 'leadership'],
  },
  {
    id: 'paysheet',
    name: 'My Paysheet',
    description: 'Personal paysheet and earnings tracker',
    icon: Wallet,
    category: 'sales',
    defaultAccess: ['credit_consultants', 'account_managers', 'leadership'],
  },
  {
    id: 'csr_dashboard',
    name: 'CSR Dashboard',
    description: 'Customer support representative dashboard',
    icon: Headphones,
    category: 'support',
    defaultAccess: ['customer_support', 'leadership'],
  },
  {
    id: 'incoming_reviews',
    name: 'Incoming Reviews',
    description: 'Manage incoming Google reviews from Zapier',
    icon: Star,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'financial_dashboard',
    name: 'Financial Dashboard',
    description: 'Company financial overview and metrics',
    icon: DollarSign,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_tasks',
    name: 'Manage Tasks',
    description: 'Create and manage team tasks',
    icon: ClipboardList,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_users',
    name: 'Manage Users',
    description: 'Add, edit, and manage team members',
    icon: Users,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_training',
    name: 'Manage Training',
    description: 'Create and edit training courses',
    icon: GraduationCap,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_updates',
    name: 'Manage Updates',
    description: 'Post company announcements',
    icon: Bell,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_knowledge',
    name: 'Knowledge Base',
    description: 'Manage AI knowledge base content',
    icon: Database,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_pto',
    name: 'Manage PTO',
    description: 'Approve and manage time off requests',
    icon: Calendar,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_onboarding',
    name: 'Manage Onboarding',
    description: 'Create onboarding tasks for new hires',
    icon: ClipboardList,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
  {
    id: 'admin_scorecards',
    name: 'Manage Scorecards',
    description: 'Configure scorecard metrics and targets',
    icon: Target,
    category: 'admin',
    defaultAccess: ['leadership'],
  },
];

const NOTIFICATION_TYPES = [
  {
    id: 'task_reminders',
    name: 'Task Reminders',
    description: 'Reminders for incomplete daily tasks',
    icon: ClipboardList,
    channels: ['push', 'email'],
  },
  {
    id: 'company_updates',
    name: 'Company Updates',
    description: 'Important announcements and news',
    icon: Bell,
    channels: ['push', 'email'],
  },
  {
    id: 'training_assigned',
    name: 'Training Assignments',
    description: 'When new training is assigned to you',
    icon: GraduationCap,
    channels: ['push', 'email'],
  },
  {
    id: 'review_assigned',
    name: 'Review Assignments',
    description: 'When a review is assigned to you',
    icon: Star,
    channels: ['push'],
  },
  {
    id: 'calendar_events',
    name: 'Calendar Events',
    description: 'Reminders for upcoming events',
    icon: Calendar,
    channels: ['push', 'email'],
  },
  {
    id: 'pto_updates',
    name: 'PTO Updates',
    description: 'Status updates on your time off requests',
    icon: Calendar,
    channels: ['push', 'email'],
  },
  {
    id: 'payment_updates',
    name: 'Payment Updates',
    description: 'Commission and payment notifications',
    icon: DollarSign,
    channels: ['push', 'email'],
  },
  {
    id: 'scorecard_updates',
    name: 'Scorecard Updates',
    description: 'Weekly scorecard summary',
    icon: Target,
    channels: ['email'],
  },
];

const CATEGORY_LABELS = {
  core: 'Core Features',
  tools: 'Tools',
  sales: 'Sales & Payments',
  support: 'Customer Support',
  admin: 'Admin Features',
};

function Settings() {
  const { currentUser, users, supabaseFetch, supabasePost } = useApp();
  
  const [activeTab, setActiveTab] = useState('notifications');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // User being edited (for admin access control)
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(['core', 'admin']);
  
  // Settings state
  const [notificationSettings, setNotificationSettings] = useState({});
  const [accessSettings, setAccessSettings] = useState({});
  
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    loadSettings();
  }, [currentUser, selectedUserId]);

  const loadSettings = async () => {
    if (!currentUser) return;
    setLoading(true);
    
    try {
      // Load user settings
      const targetUserId = selectedUserId || currentUser.id;
      const settings = await supabaseFetch('user_settings', `user_id=eq.${targetUserId}`);
      
      if (settings && settings.length > 0) {
        const userSettings = settings[0];
        setNotificationSettings(userSettings.notifications || getDefaultNotifications());
        setAccessSettings(userSettings.access || getDefaultAccess(targetUserId));
      } else {
        // Set defaults
        setNotificationSettings(getDefaultNotifications());
        setAccessSettings(getDefaultAccess(targetUserId));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setNotificationSettings(getDefaultNotifications());
      setAccessSettings(getDefaultAccess(selectedUserId || currentUser?.id));
    } finally {
      setLoading(false);
    }
  };

  const getDefaultNotifications = () => {
    const defaults = {};
    NOTIFICATION_TYPES.forEach(type => {
      defaults[type.id] = {
        enabled: true,
        push: type.channels.includes('push'),
        email: type.channels.includes('email'),
      };
    });
    return defaults;
  };

  const getDefaultAccess = (userId) => {
    const user = users.find(u => u.id === userId) || currentUser;
    const userDept = user?.department;
    const isLeadership = userDept === 'leadership' || user?.role === 'admin';
    
    const access = {};
    ACCESS_FEATURES.forEach(feature => {
      // Check if user's department is in default access
      const hasAccess = feature.defaultAccess.includes('all') ||
                        feature.defaultAccess.includes(userDept) ||
                        (isLeadership && feature.category !== 'hidden');
      access[feature.id] = hasAccess;
    });
    return access;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const targetUserId = selectedUserId || currentUser.id;
      
      // Check if settings exist
      const existing = await supabaseFetch('user_settings', `user_id=eq.${targetUserId}`);
      
      const settingsData = {
        user_id: targetUserId,
        notifications: notificationSettings,
        access: accessSettings,
        updated_at: new Date().toISOString(),
      };
      
      if (existing && existing.length > 0) {
        // Update existing
        const url = `https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/user_settings?user_id=eq.${targetUserId}`;
        await fetch(url, {
          method: 'PATCH',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(settingsData)
        });
      } else {
        // Insert new
        await supabasePost('user_settings', settingsData);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (typeId, field) => {
    setNotificationSettings(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [field]: !prev[typeId]?.[field],
      }
    }));
  };

  const toggleAccess = (featureId) => {
    setAccessSettings(prev => ({
      ...prev,
      [featureId]: !prev[featureId],
    }));
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : currentUser;

  // Group features by category
  const featuresByCategory = ACCESS_FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-3">
          <SettingsIcon className="text-asap-blue" />
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Manage notifications and access permissions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'notifications'
              ? 'text-asap-blue border-asap-blue'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Bell size={18} className="inline mr-2" />
          Notifications
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('access')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'access'
                ? 'text-asap-blue border-asap-blue'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            <Shield size={18} className="inline mr-2" />
            Access Control
          </button>
        )}
      </div>

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm text-blue-800 font-medium">Notification Preferences</p>
                <p className="text-sm text-blue-600">
                  Choose which notifications you want to receive and how you want to receive them.
                </p>
              </div>
            </div>
          </div>

          {NOTIFICATION_TYPES.map(type => {
            const Icon = type.icon;
            const settings = notificationSettings[type.id] || { enabled: true, push: true, email: true };
            
            return (
              <div 
                key={type.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  settings.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      settings.enabled ? 'bg-asap-blue/10 text-asap-blue' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-800">{type.name}</h3>
                      <p className="text-sm text-slate-500">{type.description}</p>
                    </div>
                  </div>
                  
                  {/* Master Toggle */}
                  <button
                    onClick={() => toggleNotification(type.id, 'enabled')}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.enabled ? 'bg-asap-blue' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.enabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* Channel toggles */}
                {settings.enabled && (
                  <div className="flex gap-4 mt-4 ml-13 pl-13">
                    {type.channels.includes('push') && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.push !== false}
                          onChange={() => toggleNotification(type.id, 'push')}
                          className="w-4 h-4 rounded border-slate-300 text-asap-blue focus:ring-asap-blue"
                        />
                        <Smartphone size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-600">Push</span>
                      </label>
                    )}
                    {type.channels.includes('email') && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.email !== false}
                          onChange={() => toggleNotification(type.id, 'email')}
                          className="w-4 h-4 rounded border-slate-300 text-asap-blue focus:ring-asap-blue"
                        />
                        <Mail size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-600">Email</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Access Control Tab */}
      {activeTab === 'access' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Selector */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
              <h3 className="font-semibold text-slate-800 mb-3">Select User</h3>
              
              <div className="relative mb-3">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-asap-blue text-sm"
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1">
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id === currentUser.id ? null : user.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      (selectedUserId === user.id) || (!selectedUserId && user.id === currentUser.id)
                        ? 'bg-asap-blue/10 text-asap-blue'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                      {user.avatar || user.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.name}
                        {user.id === currentUser.id && (
                          <span className="text-xs text-slate-400 ml-1">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user.department}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Access Controls */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">
                    Editing access for: {selectedUser?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-amber-600">
                    Toggle features on/off to control what this user can see and access.
                  </p>
                </div>
              </div>
            </div>

            {Object.entries(featuresByCategory).map(([category, features]) => (
              <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <h3 className="font-semibold text-slate-800">
                    {CATEGORY_LABELS[category] || category}
                  </h3>
                  {expandedCategories.includes(category) ? (
                    <ChevronDown size={20} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400" />
                  )}
                </button>

                {expandedCategories.includes(category) && (
                  <div className="border-t border-slate-100">
                    {features.map(feature => {
                      const Icon = feature.icon;
                      const hasAccess = accessSettings[feature.id] !== false;
                      
                      return (
                        <div 
                          key={feature.id}
                          className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              hasAccess ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <p className={`font-medium text-sm ${hasAccess ? 'text-slate-800' : 'text-slate-400'}`}>
                                {feature.name}
                              </p>
                              <p className="text-xs text-slate-500">{feature.description}</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => toggleAccess(feature.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              hasAccess 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {hasAccess ? (
                              <>
                                <Unlock size={14} />
                                Enabled
                              </>
                            ) : (
                              <>
                                <Lock size={14} />
                                Disabled
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg transition-all ${
            saveSuccess
              ? 'bg-green-500 text-white'
              : 'bg-asap-blue text-white hover:bg-blue-600'
          } disabled:opacity-50`}
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check size={20} />
              Saved!
            </>
          ) : (
            <>
              <Save size={20} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default Settings;
