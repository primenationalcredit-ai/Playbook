import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import FloatingTools from './FloatingTools';
import EventNotifications from './EventNotifications';
import {
  Award,
  LayoutDashboard,
  ClipboardList,
  Users,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  UserCog,
  ListTodo,
  Megaphone,
  GraduationCap,
  Star,
  DollarSign,
  Headphones,
  Receipt,
  Sparkles,
  Database,
  Calendar,
  Umbrella,
  UserPlus,
  UserCheck,
  Target,
  Users2,
  Wallet,
  Inbox,
  Shuffle,
  CreditCard,
  FolderKanban,
  Link,
  BarChart3,
  Trophy,
} from 'lucide-react';
import CoverageAlerts from './CoverageAlerts';

function Layout() {
  const { currentUser, logout, getCompletionStats, notifications, isViewingAs, realUser, stopViewingAs } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  
  const stats = getCompletionStats(currentUser?.id);
  const unreadNotifications = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Check if user is in onboarding
  const isInOnboarding = currentUser?.onboarding_status === 'in_progress' || currentUser?.onboarding_status === 'pending_approval';

  // Check if user is Joe Mahlow (show full menu)
  const isJoe = currentUser?.email === 'joe@asapcreditrepairusa.com' || currentUser?.name === 'Joe Mahlow';
  
  // Check if user is Astrid (full admin access)
  const isAstrid = currentUser?.name === 'Astrid Lemus' || currentUser?.email === 'astrid@asapcreditrepairusa.com';
  
  // Check if user is Kim or Mariana (leadership but restricted from financials)
  // Using IDs to prevent bypass via name change
  const RESTRICTED_LEADER_IDS = [
    'f7b8bc3a-74e6-46c2-a378-d19d204d7133', // Mariana Navarro
    '3ae5ad73-46eb-404f-8dc9-6d5cf53e9df0', // Kim Sanchez
  ];
  const isRestrictedLeader = RESTRICTED_LEADER_IDS.includes(currentUser?.id);
  
  // Check if user is leadership (show More menu with hidden items)
  const isLeadership = currentUser?.department === 'leadership' || currentUser?.role === 'admin';
  
  // Check if user is Credit Team (no Get Review Link)
  const isCreditTeam = currentUser?.department === 'credit_team';
  
  // Full access users (Joe, Astrid, and other leadership)
  const hasFullNavAccess = isJoe || isAstrid || isLeadership;

  // Core nav items (shown to regular employees only)
  const coreNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isInOnboarding ? [{ path: '/onboarding', icon: ClipboardList, label: 'Onboarding', highlight: true }] : []),
    { path: '/playbook', icon: ClipboardList, label: 'My Playbook' },
    { path: '/team', icon: Users, label: 'Team View' },
    { path: '/bonus-tracker', icon: Trophy, label: 'Bonus & Payment Tracker' },
    { path: '/training', icon: GraduationCap, label: 'Training' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/ask-ai', icon: Sparkles, label: 'Ask AI' },
    { path: '/reviews', icon: Star, label: 'Reviews' },
    // Get Review Link - shown to all employees EXCEPT Credit Team
    ...(!isCreditTeam && !isLeadership ? [{ path: '/review-link', icon: Shuffle, label: 'Get Review Link' }] : []),
  ];

  // Additional nav items (hidden in "More" for leadership only - NOT shown to employees)
  // PRESERVED FOR FUTURE USE - can be re-enabled one at a time
  const additionalNavItems = [
    { path: '/quick-links', icon: Link, label: 'Quick Links' },
    { path: '/scorecards', icon: Target, label: 'Score Cards' },
    { path: '/bonus-tracker', icon: Trophy, label: 'Bonus Tracker' },
    { path: '/training', icon: GraduationCap, label: 'Training' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/review-link', icon: Shuffle, label: 'Get Review Link' },
    { path: '/updates', icon: Bell, label: 'Updates', badge: unreadNotifications },
  ];

  // Full nav for leadership (Joe, Astrid, Kim, Mariana, etc.)
  const navItems = hasFullNavAccess ? [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isInOnboarding ? [{ path: '/onboarding', icon: ClipboardList, label: 'Onboarding', highlight: true }] : []),
    { path: '/playbook', icon: ClipboardList, label: 'My Playbook' },
    { path: '/quick-links', icon: Link, label: 'Quick Links' },
    { path: '/scorecards', icon: Target, label: 'Score Cards' },
    { path: '/bonus-tracker', icon: Trophy, label: 'Bonus & Payment Tracker' },
    { path: '/team', icon: Users, label: 'Team View' },
    { path: '/training', icon: GraduationCap, label: 'Training' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/ask-ai', icon: Sparkles, label: 'Ask AI' },
    { path: '/reviews', icon: Star, label: 'Reviews' },
    { path: '/review-link', icon: Shuffle, label: 'Get Review Link' },
    { path: '/updates', icon: Bell, label: 'Updates', badge: unreadNotifications },
  ] : coreNavItems;

  // Department-specific items
  const isConsultant = currentUser?.department === 'credit_consultants' || 
                       currentUser?.department === 'account_managers' ||
                       currentUser?.role === 'account_manager' ||
                       currentUser?.role === 'admin';
  const isCSR = currentUser?.department === 'customer_support' || currentUser?.role === 'admin';

  // Core department items (Payment Dashboard & Paysheet - shown in main nav)
  const coreDepartmentItems = [
    ...(isConsultant ? [{ path: '/payments', icon: DollarSign, label: 'Payment Dashboard' }] : []),
    ...(isConsultant ? [{ path: '/paysheet', icon: Receipt, label: 'My Paysheet' }] : []),
    ...((isConsultant || isCSR) ? [{ path: '/claim-reviews', icon: Star, label: 'Claim Reviews' }] : []),
  ];

  // Additional department items (hidden in "More" for leadership only - NOT shown to employees)
  // PRESERVED FOR FUTURE USE - can be re-enabled one at a time
  const additionalDepartmentItems = [
    ...(isConsultant ? [{ path: '/affiliates', icon: Users2, label: 'Affiliates' }] : []),
    ...(currentUser?.department === 'account_managers' || currentUser?.role === 'admin' ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),
    ...(isCSR ? [{ path: '/csr-dashboard', icon: Headphones, label: 'CSR Dashboard' }] : []),
  ];

  // Full department items for Joe
  const departmentItems = isJoe ? [
    ...(isConsultant ? [{ path: '/affiliates', icon: Users2, label: 'Affiliates' }] : []),
    ...(isConsultant ? [{ path: '/payments', icon: DollarSign, label: 'Payment Dashboard' }] : []),
    ...((isConsultant || isCSR) ? [{ path: '/claim-reviews', icon: Star, label: 'Claim Reviews' }] : []),
    ...(currentUser?.department === 'account_managers' || currentUser?.role === 'admin' ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),
    ...(isConsultant ? [{ path: '/paysheet', icon: Receipt, label: 'My Paysheet' }] : []),
    ...(isCSR ? [{ path: '/csr-dashboard', icon: Headphones, label: 'CSR Dashboard' }] : []),
  ] : coreDepartmentItems;

  const adminItems = [
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/admin/tasks', icon: ListTodo, label: 'Manage Tasks' },
    { path: '/admin/users', icon: UserCog, label: 'Manage Users' },
    { path: '/admin/backups', icon: UserCheck, label: 'Backup Settings' },
    { path: '/admin/onboarding', icon: UserPlus, label: 'Onboarding' },
    { path: '/admin/refunds', icon: DollarSign, label: 'Refund Tracking' },
    ...(!isRestrictedLeader ? [] : []),
    { path: '/admin/pipeline', icon: BarChart3, label: 'Client Pipeline' },
    // Financials - NOT for Kim or Mariana
    ...(!isRestrictedLeader ? [{ path: '/admin/financials', icon: Wallet, label: 'Financials' }] : []),
    // DOO Compensation - NOT for Kim or Mariana
    ...(!isRestrictedLeader ? [{ path: '/admin/doo-paysheet', icon: DollarSign, label: 'DOO Compensation' }] : []),
    { path: '/admin/updates', icon: Megaphone, label: 'Manage Updates' },
    { path: '/incoming-reviews', icon: Inbox, label: 'Incoming Reviews' },
    { path: '/admin/surveys', icon: ClipboardList, label: 'Survey Results' },
    { path: '/admin/training', icon: GraduationCap, label: 'Training Portal' },
    { path: '/admin/knowledge', icon: Database, label: 'Knowledge Base' },
    { path: '/admin/ai-learning', icon: Sparkles, label: 'Train AI' },
  ];

  return (
    <div className={`flex h-screen bg-slate-50 ${isViewingAs ? 'pt-9' : ''}`}>
      {isViewingAs && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow">
          <span>Viewing as <strong>{currentUser?.name}</strong>{realUser?.name ? ` (you are ${realUser.name})` : ''}</span>
          <button
            onClick={() => { stopViewingAs(); navigate('/'); }}
            className="px-3 py-1 rounded-md bg-white text-amber-700 font-semibold hover:bg-amber-50"
          >
            Exit to my view
          </button>
        </div>
      )}
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-asap-blue-dark to-asap-navy text-white transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <img 
              src="/logo.png" 
              alt="ASAP Credit Repair" 
              className={`${sidebarOpen ? 'h-10' : 'h-10'} w-auto object-contain`}
            />
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-sm leading-tight">ASAP</h1>
                <h1 className="font-bold text-sm leading-tight">Playbook</h1>
              </div>
            )}
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors lg:block hidden"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* User Profile Quick View */}
        {sidebarOpen && (
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-asap-blue-light rounded-full flex items-center justify-center font-semibold">
                {currentUser?.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{currentUser?.name}</p>
                <p className="text-xs text-slate-300 capitalize">{currentUser?.department?.replace('_', ' ')}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Today's Progress</span>
                <span className="text-asap-gold font-semibold">{stats.percentage}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-asap-gold rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                ${isActive 
                  ? 'bg-asap-blue-light text-white' 
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }
                ${!sidebarOpen && 'justify-center'}
              `}
            >
              <item.icon size={20} />
              {sidebarOpen && (
                <span className="flex-1">{item.label}</span>
              )}
              {sidebarOpen && item.badge > 0 && (
                <span className="bg-asap-red text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* More Section (for leadership only, not Joe, not employees) */}
          {!isJoe && isLeadership && (additionalNavItems.length > 0 || additionalDepartmentItems.length > 0) && (
            <>
              <div className="pt-4 pb-2">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-slate-300 hover:bg-white/10 hover:text-white ${!sidebarOpen && 'justify-center'}`}
                >
                  <BarChart3 size={20} />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-left">More</span>
                      <ChevronDown size={16} className={`transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
              </div>
              {moreMenuOpen && sidebarOpen && (
                <div className="space-y-1 pl-2 border-l border-white/10 ml-4">
                  {additionalNavItems.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm
                        ${isActive 
                          ? 'bg-asap-blue-light text-white' 
                          : 'text-slate-400 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <item.icon size={16} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge > 0 && (
                        <span className="bg-asap-red text-white text-xs px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                  {additionalDepartmentItems.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm
                        ${isActive 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'text-slate-400 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Department-specific items */}
          {departmentItems.length > 0 && (
            <>
              <div className="pt-4 pb-2">
                {sidebarOpen && (
                  <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    My Tools
                  </p>
                )}
              </div>
              {departmentItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                    ${isActive 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }
                    ${!sidebarOpen && 'justify-center'}
                  `}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon size={20} />
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              ))}
            </>
          )}

          {/* Admin Section */}
          {currentUser?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2">
                {sidebarOpen && (
                  <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Admin
                  </p>
                )}
              </div>
              
              {sidebarOpen ? (
                <div className="space-y-1">
                  {adminItems.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                        ${isActive 
                          ? 'bg-asap-gold/20 text-asap-gold' 
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <item.icon size={20} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {adminItems.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `
                        flex items-center justify-center p-2.5 rounded-lg transition-all
                        ${isActive 
                          ? 'bg-asap-gold/20 text-asap-gold' 
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }
                      `}
                      title={item.label}
                    >
                      <item.icon size={20} />
                    </NavLink>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>

        {/* Settings & Logout */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full
              ${isActive 
                ? 'bg-asap-gold/20 text-asap-gold' 
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }
              ${!sidebarOpen && 'justify-center'}
            `}
            title={!sidebarOpen ? 'Settings' : undefined}
          >
            <Settings size={20} />
            {sidebarOpen && <span>Settings</span>}
          </NavLink>
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full
              text-slate-300 hover:bg-red-500/20 hover:text-red-400
              ${!sidebarOpen && 'justify-center'}
            `}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Floating Tools (Notepad, Quick Reference, Feature Request) */}
      <FloatingTools />

      {/* Event Notifications - 5 min before alerts */}
      <EventNotifications currentUser={currentUser} />

      {/* Coverage Alerts for Leadership */}
      <CoverageAlerts />
    </div>
  );
}

export default Layout;
