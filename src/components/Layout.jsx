import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import FloatingTools from './FloatingTools';
import EventNotifications from './EventNotifications';
import {Award,
  LayoutDashboard,
  ClipboardList,
  Users,
  Bell,
  MessageSquare,
  ShieldCheck,
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
  Shuffle, BookOpen,
  CreditCard,
  FolderKanban,
  Link,
  BarChart3,
  Trophy,
  FileText, Video,
  Search,
} from 'lucide-react';
import CoverageAlerts from './CoverageAlerts';
import { useTrainingLock, TrainingLockScreen } from './TrainingLockGate';

function Layout() {
  const { currentUser, logout, getCompletionStats, notifications, isViewingAs, realUser, stopViewingAs } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  // PHASE D (Joe 8/13): overdue training locks every page except /training.
  // Leadership exempt; fails open. See TrainingLockGate.jsx.
  const { locked: trainingLocked, overdue: overdueTraining } = useTrainingLock(currentUser);
  const onTrainingPage = (location.pathname || '').startsWith('/training');
  // --- Sidebar customization (saved in this browser) ---
  const NAVPREF_KEY = 'navPrefs:v1';
  const [navPrefs, setNavPrefs] = useState(() => { try { return JSON.parse(localStorage.getItem(NAVPREF_KEY)) || { hidden: [], order: {} }; } catch { return { hidden: [], order: {} }; } });
  const [showCustomize, setShowCustomize] = useState(false);
  const saveNavPrefs = (p) => { setNavPrefs(p); try { localStorage.setItem(NAVPREF_KEY, JSON.stringify(p)); } catch (e) {} };
  const applyNavPrefs = (items, section) => {
    const hidden = new Set(navPrefs.hidden || []);
    const order = (navPrefs.order || {})[section] || [];
    const pos = new Map(order.map((p, i) => [p, i]));
    return items.filter(it => !hidden.has(it.path)).slice()
      .sort((a, b) => (pos.has(a.path) ? pos.get(a.path) : 999) - (pos.has(b.path) ? pos.get(b.path) : 999));
  };
  const moveNavItem = (section, items, path, dir) => {
    const base = ((navPrefs.order || {})[section] && navPrefs.order[section].length ? navPrefs.order[section] : items.map(i => i.path)).slice();
    const idx = base.indexOf(path); const j = idx + dir;
    if (idx < 0 || j < 0 || j >= base.length) return;
    [base[idx], base[j]] = [base[j], base[idx]];
    saveNavPrefs({ ...navPrefs, order: { ...(navPrefs.order || {}), [section]: base } });
  };
  const toggleNavItem = (path) => {
    const hidden = new Set(navPrefs.hidden || []);
    if (hidden.has(path)) hidden.delete(path); else hidden.add(path);
    saveNavPrefs({ ...navPrefs, hidden: [...hidden] });
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  
  const stats = getCompletionStats(currentUser?.id);
  const unreadNotifications = notifications.filter(n => !n.read).length;

  // Combined "needs approval" badge for leadership: payment date-change/pause
  // requests (from the payment processor, via the proxy) plus pending time-off
  // requests (Playbook db). Built generic so more approval types can be added.
  const [approvalCounts, setApprovalCounts] = useState({ payments: 0, timeOff: 0, unread: 0 });
  // Leadership: badge = things to act on (pending payments + pending time-off).
  // AMs: badge = unread only (replies/decisions on their own requests) â€” they don't
  // act on the pending queue, so a pending count would be noise.
  const approvalsBadge = approvalCounts.payments + approvalCounts.timeOff;
  const approvalsUnread = approvalCounts.unread || 0;
  const amApprovalsBadge = approvalsUnread; // AM-specific badge value

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
    ];
  const isRestrictedLeader = RESTRICTED_LEADER_IDS.includes(currentUser?.id);
  
  // Check if user is leadership (show More menu with hidden items)
  const isLeadership = currentUser?.department === 'leadership' || currentUser?.role === 'admin';
  
  // Check if user is Credit Team (no Get Review Link)
  const isCreditTeam = currentUser?.department === 'credit_team';
  
  // Full access users (Joe, Astrid, and other leadership)
  const hasFullNavAccess = isJoe || isAstrid || isLeadership;

  // Poll the combined approval count for leadership. Restricted leaders (Kim,
  // Mariana) handle time-off but not payment financials, so they only get the
  // time-off count.
  const [affiliateCallsDue, setAffiliateCallsDue] = useState(0);
  const [affiliateCallsOverdue, setAffiliateCallsOverdue] = useState(false);
  useEffect(() => {
    if (!currentUser) return;
    const k = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
    let alive = true;
    const leadView = currentUser?.department === 'leadership' || currentUser?.role === 'admin';
    const myFirst = String(currentUser?.name || '').toLowerCase().split(/\s+/)[0];
    const check = () => {
      fetch('https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/affiliate_call_tasks?status=eq.open&select=assigned_to,due_date&limit=1000', {
        headers: { apikey: k, Authorization: `Bearer ${k}` }
      })
        .then((r) => r.json())
        .then((rows) => {
          if (!alive || !Array.isArray(rows)) return;
          const mine = leadView ? rows : rows.filter((t) => String(t.assigned_to || '').toLowerCase().split(/\s+/)[0] === myFirst);
          const today = new Date().toISOString().slice(0, 10);
          setAffiliateCallsDue(mine.length);
          setAffiliateCallsOverdue(mine.some((t) => t.due_date && String(t.due_date).slice(0, 10) < today));
        })
        .catch(() => {});
    };
    check();
    const t = setInterval(check, 120000);
    return () => { alive = false; clearInterval(t); };
  }, [currentUser]);

  const SUPABASE_URL_LAYOUT = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
  const SUPABASE_KEY_LAYOUT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
  useEffect(() => {
    let cancelled = false;
    const isAMForCount = currentUser?.department === 'account_managers' || currentUser?.role === 'account_manager';
    const showsApprovals = hasFullNavAccess || isAMForCount;
    const loadApprovalCounts = async () => {
      if (!showsApprovals) { if (!cancelled) setApprovalCounts({ payments: 0, timeOff: 0, unread: 0 }); return; }
      let payments = 0, timeOff = 0, unread = 0;
      // payment approvals: all pending (AMs see all account managers' requests; leadership too).
      // Restricted leaders don't see payment financials.
      if (!isRestrictedLeader) {
        try {
          let authHeader = {};
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
          } catch (e) {}
          const res = await fetch('/.netlify/functions/invoices-api', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({ action: 'list_pending_approvals', include_my_decisions: true }),
          });
          if (res.ok) {
            const d = await res.json().catch(() => ({}));
            const arr = Array.isArray(d) ? d : (d.approvals || d.data || d.rows || []);
            const pendingArr = arr.filter(a => (a.status || 'pending') === 'pending');
            // pending count = actual pending requests in the array. Do NOT use d.count:
            // with include_my_decisions it also counts the user's decided requests.
            payments = pendingArr.length;
            // total_unread = unread messages + unseen decisions for this user.
            unread = typeof d.total_unread === 'number'
              ? d.total_unread
              : arr.reduce((s, a) => s + (a.unread_count || 0), 0);
          }
        } catch (e) {}
      }
      // time-off approvals: leadership only (AMs don't approve time off).
      if (hasFullNavAccess) {
        try {
          const res = await fetch(`${SUPABASE_URL_LAYOUT}/rest/v1/time_off_requests?status=eq.pending&select=id`, {
            headers: { apikey: SUPABASE_KEY_LAYOUT, Authorization: `Bearer ${SUPABASE_KEY_LAYOUT}` },
          });
          if (res.ok) { const d = await res.json(); timeOff = Array.isArray(d) ? d.length : 0; }
        } catch (e) {}
      }
      if (!cancelled) setApprovalCounts({ payments, timeOff, unread });
    };
    loadApprovalCounts();
    const t = setInterval(loadApprovalCounts, 60000);
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFullNavAccess, isRestrictedLeader, currentUser?.id, currentUser?.department, currentUser?.role]);

  // Credit consultants get a lean nav: claiming lives in their Bonus tracker, so the standalone
  // Playbook, Team View, Training, Ask AI, and Claim Reviews items are hidden for them.
  const isCreditConsultant = currentUser?.department === 'credit_consultants';

  // Credit Team, Account Managers, AND Customer Support (CSR) get the lean nav: hide My Playbook,
  // Team View, Training, Ask AI, and My Paysheet for all three departments.
  const isAccountManagerDept = currentUser?.department === 'account_managers' || currentUser?.role === 'account_manager';
  const isCustomerSupportDept = currentUser?.department === 'customer_support';
  const hideExtras = isCreditConsultant || isAccountManagerDept || isCustomerSupportDept;

  // Core nav items (shown to regular employees only)
  const coreNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isInOnboarding ? [{ path: '/onboarding', icon: ClipboardList, label: 'Onboarding', highlight: true }] : []),
    ...(!hideExtras ? [{ path: '/playbook', icon: ClipboardList, label: 'My Playbook' }] : []),
    ...(!hideExtras ? [{ path: '/team', icon: Users, label: 'Team View' }] : []),
    { path: '/bonus-tracker', icon: Trophy, label: 'Bonus & Payment Tracker' },
    ...(!hideExtras ? [{ path: '/training', icon: GraduationCap, label: 'Training' }] : []),
    ...(!hideExtras ? [{ path: '/sops', icon: BookOpen, label: 'SOP Library' }, { path: '/media', icon: Video, label: 'Media Library' }] : []),
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    ...(!hideExtras ? [{ path: '/ask-ai', icon: Sparkles, label: 'Ask AI' }] : []),
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
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/my-day', icon: ClipboardList, label: 'My Day' },
    { path: '/pipelines', icon: Shuffle, label: 'Pipelines' },
    { path: '/my-book', icon: BookOpen, label: 'My Book' },
    { path: '/bonus-tracker', icon: Trophy, label: 'Bonus & Payment Tracker' },
    { path: '/team', icon: Users, label: 'Team View' },
    { path: '/training', icon: GraduationCap, label: 'Training' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/ask-ai', icon: Sparkles, label: 'Ask AI' },
    { path: '/reviews', icon: Star, label: 'Reviews' },
    { path: '/review-link', icon: Shuffle, label: 'Get Review Link' },
    { path: '/approvals', icon: ShieldCheck, label: 'Approvals', badge: approvalsBadge, unread: approvalsUnread },
    { path: '/updates', icon: Bell, label: 'Updates', badge: unreadNotifications },
  ] : coreNavItems;

  // Department-specific items
  const isConsultant = currentUser?.department === 'credit_consultants' || 
                       currentUser?.department === 'account_managers' ||
                       currentUser?.role === 'account_manager' ||
                       currentUser?.role === 'admin';
  const isCSR = currentUser?.department === 'customer_support' || currentUser?.role === 'admin';

  const isAM = currentUser?.department === 'account_managers' || currentUser?.role === 'admin' || isLeadership;

  // Core department items (Payment Dashboard & Paysheet - shown in main nav)
  const coreDepartmentItems = [
    ...((isConsultant && !isLeadership && !isAccountManagerDept) ? [{ path: '/affiliate-outreach', icon: Users2, label: 'Affiliates', badge: affiliateCallsDue, unread: affiliateCallsOverdue }] : []),
    ...(isConsultant ? [{ path: '/payments', icon: DollarSign, label: 'Payment Dashboard' }] : []),
    ...((isAM || isConsultant) ? [{ path: '/invoices', icon: FileText, label: 'Invoices' }] : []),
    ...((isAM || isConsultant) ? [{ path: '/agreements', icon: FileText, label: 'Agreements' }] : []),
    ...(isAM ? [{ path: '/approvals', icon: ShieldCheck, label: 'Approvals', badge: amApprovalsBadge, unread: approvalsUnread }] : []),
    // AMs get Additional Rounds (Joe 8/4) - THIS array is what regular AMs
    // actually render (departmentItems = isJoe ? [...] : coreDepartmentItems);
    // the earlier inserts sat in leadership-only arrays and never showed.
    ...(isAccountManagerDept ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    // AMs and Consultants get their own Refund Tracking view (Joe 8/18) - the page
    // itself narrows admin actions and other people's requests for non-leadership.
    ...((isAccountManagerDept || isConsultant) ? [{ path: '/admin/refunds', icon: DollarSign, label: 'Refund Tracking' }] : []),
    ...(isLeadership ? [{ path: '/admin/automations', icon: ShieldCheck, label: 'Automations' }] : []),
    ...(isAccountManagerDept ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),
    ...(isConsultant && !hideExtras ? [{ path: '/paysheet', icon: Receipt, label: 'My Paysheet' }] : []),
    ...(((isConsultant || isCSR) && !isCreditConsultant) ? [{ path: '/claim-reviews', icon: Star, label: 'Claim Reviews' }] : []),
  ];

  // Additional department items (hidden in "More" for leadership only - NOT shown to employees)
  // PRESERVED FOR FUTURE USE - can be re-enabled one at a time
  const additionalDepartmentItems = [
    ...((isConsultant || isLeadership) ? [{ path: '/affiliate-outreach', icon: Users2, label: 'Affiliates', badge: affiliateCallsDue, unread: affiliateCallsOverdue }] : []),
    ...(currentUser?.department === 'account_managers' || currentUser?.role === 'admin' ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),
    // AMs get Additional Rounds (Joe 8/4) - page's internal admin gates unchanged
    ...(currentUser?.department === 'account_managers' && currentUser?.role !== 'admin' ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    ...(isCSR ? [{ path: '/csr-dashboard', icon: Headphones, label: 'CSR Dashboard' }] : []),
  ];

  // Full department items for Joe
  const departmentItems = isJoe ? [
    ...((isConsultant || isLeadership) ? [{ path: '/affiliate-outreach', icon: Users2, label: 'Affiliates', badge: affiliateCallsDue, unread: affiliateCallsOverdue }] : []),
    ...(isConsultant ? [{ path: '/payments', icon: DollarSign, label: 'Payment Dashboard' }] : []),
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/agreements', icon: FileText, label: 'Agreements' },
    { path: '/admin/automations', icon: ShieldCheck, label: 'Automations' },
    ...((isConsultant || isCSR) ? [{ path: '/claim-reviews', icon: Star, label: 'Claim Reviews' }] : []),
    ...(currentUser?.department === 'account_managers' || currentUser?.role === 'admin' ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),
    // AMs get Additional Rounds (Joe 8/4) - page's internal admin gates unchanged
    ...(currentUser?.department === 'account_managers' && currentUser?.role !== 'admin' ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    ...((currentUser?.department === 'account_managers' || isConsultant) && currentUser?.role !== 'admin' ? [{ path: '/admin/refunds', icon: DollarSign, label: 'Refund Tracking' }] : []),
    ...(isConsultant ? [{ path: '/paysheet', icon: Receipt, label: 'My Paysheet' }] : []),
    ...(isCSR ? [{ path: '/csr-dashboard', icon: Headphones, label: 'CSR Dashboard' }] : []),
  ] : coreDepartmentItems;

  // Red pill on Refund Tracking: refunds awaiting leadership action.
  const [refundActionCount, setRefundActionCount] = useState(0);
  const [arPendingCount, setArPendingCount] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch('/.netlify/functions/ar-tracker').then((r) => r.json()).then((d) => {
      if (alive) setArPendingCount(((d && d.offers) || []).filter((o) => o.status === 'zelle_pending').length);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (currentUser?.department !== 'leadership') return;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch('/.netlify/functions/refund-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) });
        const d = await r.json();
        if (alive) setRefundActionCount(((d && d.requests) || []).filter(x => ['pending', 'ready_to_pay', 'check_needed'].includes(x.status)).length);
      } catch (e) {}
    };
    check();
    const t = setInterval(check, 120000);
    return () => { alive = false; clearInterval(t); };
  }, [currentUser]);

  const adminItems = [
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/admin/command-center', icon: BarChart3, label: 'Command Center' },
    { path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' },
    { path: '/admin/tasks', icon: ListTodo, label: 'Manage Tasks' },
    { path: '/admin/users', icon: UserCog, label: 'Manage Users' },
  { path: '/admin/consults', icon: Search, label: 'Consult Records' },
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
          {applyNavPrefs(navItems, 'main').map(item => (
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
              <span className="relative">
                <item.icon size={20} />
                {/* collapsed sidebar: red dot on the icon when there are new messages */}
                {!sidebarOpen && item.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-asap-red rounded-full ring-2 ring-asap-navy" />
                )}
              </span>
              {sidebarOpen && (
                <span className="flex-1">{item.label}</span>
              )}
              {/* expanded sidebar: message icon + dot when there are new messages */}
              {sidebarOpen && item.unread > 0 && (
                <span className="relative inline-flex items-center" title={`${item.unread} new message${item.unread === 1 ? '' : 's'}`}>
                  <MessageSquare size={18} className="text-asap-gold" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-asap-red rounded-full ring-2 ring-asap-navy" />
                </span>
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
                  {applyNavPrefs(additionalNavItems, 'more').map(item => (
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
                  {applyNavPrefs(additionalDepartmentItems, 'deptMore').map(item => (
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
              {applyNavPrefs(departmentItems, 'dept').map(item => (
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
                  <span className="relative">
                    <item.icon size={20} />
                    {!sidebarOpen && item.unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-asap-red rounded-full ring-2 ring-asap-navy" />
                    )}
                  </span>
                  {sidebarOpen && <span className="flex-1">{item.label}</span>}
                  {sidebarOpen && item.unread > 0 && (
                    <span className="relative inline-flex items-center" title={`${item.unread} new message${item.unread === 1 ? '' : 's'}`}>
                      <MessageSquare size={18} className="text-asap-gold" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-asap-red rounded-full ring-2 ring-asap-navy" />
                    </span>
                  )}
                  {sidebarOpen && item.badge > 0 && (
                    <span className="bg-asap-red text-white text-xs px-2 py-0.5 rounded-full">{item.badge}</span>
                  )}
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
                  {applyNavPrefs(adminItems, 'admin').map(item => (
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
                      {item.path === '/admin/additional-rounds' && arPendingCount > 0 && (
                        <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{arPendingCount}</span>
                      )}
                      {item.path === '/admin/refunds' && refundActionCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{refundActionCount}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {applyNavPrefs(adminItems, 'admin').map(item => (
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
                      <span className="relative inline-flex"><item.icon size={20} />{item.path === '/admin/refunds' && refundActionCount > 0 && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />)}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>

        {/* Settings & Logout */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            onClick={() => setShowCustomize(true)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-slate-300 hover:bg-white/10 hover:text-white ${!sidebarOpen && 'justify-center'}`}
            title={!sidebarOpen ? 'Customize Menu' : undefined}
          >
            <Settings size={20} />
            {sidebarOpen && <span>Customize Menu</span>}
          </button>
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
      {showCustomize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCustomize(false)}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="font-semibold text-slate-800">Customize Menu</div>
              <button onClick={() => setShowCustomize(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">{'\u00D7'}</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              <p className="text-xs text-slate-500">Reorder with the arrows, hide what you don't use. Changes save instantly and only affect your view on this device.</p>
              {[['main', 'Main', navItems], ['dept', 'Department', departmentItems], ['deptMore', 'Department extras', additionalDepartmentItems], ['more', 'More', additionalNavItems], ['admin', 'Admin', typeof adminItems !== 'undefined' ? adminItems : []]].filter(([, , arr]) => arr && arr.length).map(([sec, secLabel, arr]) => (
                <div key={sec}>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{secLabel}</div>
                  {applyNavPrefs(arr, sec).concat(arr.filter(i => (navPrefs.hidden || []).includes(i.path))).map(item => { const isHidden = (navPrefs.hidden || []).includes(item.path); return (
                    <div key={sec + item.path} className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded ${isHidden ? 'opacity-40' : ''}`}>
                      <span className="text-sm text-slate-700 truncate">{item.label}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        <button onClick={() => moveNavItem(sec, arr, item.path, -1)} className="px-1.5 py-0.5 text-xs border rounded hover:bg-slate-50">{'\u2191'}</button>
                        <button onClick={() => moveNavItem(sec, arr, item.path, 1)} className="px-1.5 py-0.5 text-xs border rounded hover:bg-slate-50">{'\u2193'}</button>
                        <button onClick={() => toggleNavItem(item.path)} className={`px-2 py-0.5 text-xs border rounded hover:bg-slate-50 ${isHidden ? 'text-slate-400' : 'text-emerald-600'}`}>{isHidden ? 'Show' : 'Hide'}</button>
                      </span>
                    </div>
                  ); })}
                </div>
              ))}
              <button onClick={() => saveNavPrefs({ hidden: [], order: {} })} className="text-xs text-indigo-600 hover:underline">Reset to default</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {trainingLocked && !onTrainingPage
          ? <TrainingLockScreen overdue={overdueTraining} onGo={() => navigate('/training')} />
          : <Outlet />}
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
