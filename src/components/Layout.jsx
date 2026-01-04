import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
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
  Target,
  Users2,
  Wallet,
} from 'lucide-react';

function Layout() {
  const { currentUser, logout, getCompletionStats, notifications } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  
  const stats = getCompletionStats(currentUser?.id);
  const unreadNotifications = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Check if user is in onboarding
  const isInOnboarding = currentUser?.onboarding_status === 'in_progress' || currentUser?.onboarding_status === 'pending_approval';

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isInOnboarding ? [{ path: '/onboarding', icon: ClipboardList, label: 'Onboarding', highlight: true }] : []),
    { path: '/playbook', icon: ClipboardList, label: 'My Playbook' },
    { path: '/scorecards', icon: Target, label: 'Score Cards' },
    { path: '/team', icon: Users, label: 'Team View' },
    { path: '/training', icon: GraduationCap, label: 'Training' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/ask-ai', icon: Sparkles, label: 'Ask AI' },
    { path: '/reviews', icon: Star, label: 'Reviews' },
    { path: '/updates', icon: Bell, label: 'Updates', badge: unreadNotifications },
  ];

  // Department-specific items
  const isConsultant = currentUser?.department === 'credit_consultants' || 
                       currentUser?.department === 'account_managers' ||
                       currentUser?.role === 'admin';
  const isCSR = currentUser?.department === 'customer_support' || currentUser?.role === 'admin';

  const departmentItems = [
    ...(isConsultant ? [{ path: '/affiliates', icon: Users2, label: 'Affiliates' }] : []),
    ...(isConsultant ? [{ path: '/payments', icon: DollarSign, label: 'Payment Dashboard' }] : []),
    ...(isConsultant ? [{ path: '/paysheet', icon: Receipt, label: 'My Paysheet' }] : []),
    ...(isCSR ? [{ path: '/csr-dashboard', icon: Headphones, label: 'CSR Dashboard' }] : []),
  ];

  const adminItems = [
    { path: '/admin/tasks', icon: ListTodo, label: 'Manage Tasks' },
    { path: '/admin/users', icon: UserCog, label: 'Manage Users' },
    { path: '/admin/onboarding', icon: UserPlus, label: 'Onboarding' },
    { path: '/admin/scorecards', icon: Target, label: 'Score Cards' },
    { path: '/admin/financials', icon: Wallet, label: 'Financials' },
    { path: '/admin/updates', icon: Megaphone, label: 'Manage Updates' },
    { path: '/admin/training', icon: GraduationCap, label: 'Training Portal' },
    { path: '/admin/knowledge', icon: Database, label: 'Knowledge Base' },
    { path: '/admin/pto', icon: Umbrella, label: 'PTO Management' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
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

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
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
    </div>
  );
}

export default Layout;
