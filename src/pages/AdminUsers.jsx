import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  UserCog,
  Shield,
  Mail,
  Lock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

function AdminUsers() {
  const { 
    users, 
    loadUsers,
    updateUser, 
    DEPARTMENTS,
    currentUser,
    taskTemplates,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filter users
  const filteredUsers = users.filter(user => {
    if (searchQuery && !user.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !user.email?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterDepartment !== 'all' && user.department !== filterDepartment) return false;
    return true;
  });

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    // Close modal immediately for better UX
    setDeleteConfirm(null);
    const userName = user.name;
    
    try {
      // Try Netlify function first
      await fetch('/.netlify/functions/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          userData: { userId: user.id, authId: user.auth_id }
        })
      });
    } catch (error) {
      console.error('Error in delete:', error);
      // Try direct delete as fallback
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
      } catch (e) {
        // Ignore
      }
    }
    
    // Refresh the entire page to show updated list
    window.location.reload();
  };

  const handleSave = async (userData, isNew) => {
    console.log('handleSave called with:', { userData, isNew });
    try {
      if (isNew) {
        console.log('Creating new user...');
        // Use Netlify function to create user with auth
        const response = await fetch('/.netlify/functions/manage-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            userData
          })
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response result:', result);
        
        if (response.ok) {
          setSuccessMessage({
            type: 'success',
            title: 'User Created!',
            name: userData.name,
            email: userData.email,
            password: userData.password,
            emailSent: result.emailSent || false,
            sendEmailRequested: userData.sendEmail || false
          });
          if (typeof loadUsers === 'function') {
            await loadUsers();
          }
        } else {
          setSuccessMessage({
            type: 'error',
            title: 'Error',
            message: result.error || 'Failed to create user'
          });
        }
      } else {
        // Update existing user - use direct Supabase call
        console.log('Updating existing user...');
        
        // Only include fields that exist in the users table
        const userUpdates = {
          name: userData.name,
          email: userData.email,
          department: userData.department,
          role: userData.role,
          is_va: userData.is_va,
        };
        
        // Add pipedrive_name if provided (column may not exist in all environments)
        if (userData.pipedrive_name !== undefined) {
          userUpdates.pipedrive_name = userData.pipedrive_name || null;
        }
        // Add pipedrive_org_id (AM referral org) if provided
        if (userData.pipedrive_org_id !== undefined) {
          userUpdates.pipedrive_org_id = userData.pipedrive_org_id || null;
        }
        
        // Only add optional fields if they have values
        if (userData.hire_date) userUpdates.hire_date = userData.hire_date;
        // Always save shift_type (can be null to clear)
        userUpdates.shift_type = userData.shift_type || null;
        
        console.log('Sending update:', userUpdates);
        
        // Direct Supabase update
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${editingUser.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(userUpdates)
        });
        
        if (response.ok) {
          setSuccessMessage({
            type: 'updated',
            title: 'User Updated',
            name: userData.name,
          });
          if (typeof loadUsers === 'function') {
            await loadUsers(); // Refresh user list
          }
        } else {
          const errorText = await response.text();
          console.error('Update failed:', errorText);
          setSuccessMessage({
            type: 'error',
            title: 'Error',
            message: `Failed to update user: ${errorText}`
          });
        }
      }
      setShowModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      setSuccessMessage({
        type: 'error',
        title: 'Error',
        message: error.message || 'An error occurred'
      });
    }
  };

  const handleResetPassword = async (user, newPassword) => {
    try {
      const response = await fetch('/.netlify/functions/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          userData: { authId: user.auth_id, newPassword }
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setSuccessMessage({
          type: 'success',
          title: 'Password Reset!',
          name: user.name,
          email: user.email,
          password: newPassword
        });
      } else {
        setSuccessMessage({
          type: 'error',
          title: 'Error',
          message: result.error || 'Failed to reset password'
        });
      }
      setShowResetModal(false);
      setResetUser(null);
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  const getDepartmentName = (id) => DEPARTMENTS.find(d => d.id === id)?.name || id;

  const linkedCount = users.filter(u => u.auth_id).length;
  const unlinkedCount = users.filter(u => !u.auth_id).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Manage Users</h1>
          <p className="text-slate-500">Add and manage team members</p>
        </div>
        
        <button
          onClick={() => {
            setEditingUser(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-asap-blue hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      {/* Auth Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <UserCog size={20} />
            <span className="font-semibold">{users.length} Total Users</span>
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={20} />
            <span className="font-semibold">{linkedCount} Can Log In</span>
          </div>
          <p className="text-xs text-green-600 mt-1">Auth account linked</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle size={20} />
            <span className="font-semibold">{unlinkedCount} Need Setup</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">No auth account yet</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
        >
          <option value="all">All Departments</option>
          {DEPARTMENTS.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-4 font-semibold text-slate-700">User</th>
              <th className="text-left p-4 font-semibold text-slate-700">Department</th>
              <th className="text-left p-4 font-semibold text-slate-700">Role</th>
              <th className="text-center p-4 font-semibold text-slate-700">Auth Status</th>
              <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-asap-navy rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-slate-600">{getDepartmentName(user.department)}</span>
                  {user.is_va && (
                    <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">VA</span>
                  )}
                  {user.shift_type ? (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{user.shift_type}</span>
                  ) : (
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">No Shift!</span>
                  )}
                </td>
                <td className="p-4">
                  {user.role === 'admin' ? (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Shield size={14} /> Admin
                    </span>
                  ) : (
                    <span className="text-slate-600">User</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {user.auth_id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                      <CheckCircle size={12} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                      <AlertTriangle size={12} /> No Login
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    {user.auth_id && (
                      <button
                        onClick={() => { setResetUser(user); setShowResetModal(true); }}
                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Reset Password"
                      >
                        <Key size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-slate-400 hover:text-asap-blue hover:bg-blue-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => setDeleteConfirm(user)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {showModal && (
        <UserModal
          user={editingUser}
          onClose={() => { setShowModal(false); setEditingUser(null); }}
          onSave={handleSave}
          taskTemplates={taskTemplates}
        />
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => { setShowResetModal(false); setResetUser(null); }}
          onReset={handleResetPassword}
        />
      )}

      {/* Success/Error Message Modal */}
      {successMessage && (
        <SuccessModal
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (() => {
        const backupTasks1 = (taskTemplates || []).filter(t => t.backup_user_1 === deleteConfirm.id);
        const backupTasks2 = (taskTemplates || []).filter(t => t.backup_user_2 === deleteConfirm.id);
        const assignedTasks = (taskTemplates || []).filter(t => t.assigned_to === deleteConfirm.id);
        const hasBackupDeps = backupTasks1.length > 0 || backupTasks2.length > 0;
        const hasAssigned = assignedTasks.length > 0;
        
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete User?</h3>
            <p className="text-slate-600 mb-4">
              This will remove <strong>{deleteConfirm.name}</strong>'s access to the playbook and delete their login account.
            </p>
            
            {(hasBackupDeps || hasAssigned) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-semibold">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  Reassignment Needed
                </div>
                
                {hasBackupDeps && (
                  <div>
                    <p className="text-sm text-amber-700 font-medium mb-1">
                      Backup for {backupTasks1.length + backupTasks2.length} task{backupTasks1.length + backupTasks2.length !== 1 ? 's' : ''}:
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {backupTasks1.map(t => (
                        <div key={`b1-${t.id}`} className="text-xs text-amber-800 bg-amber-100/50 px-2 py-1 rounded flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-orange-200 text-orange-800 rounded text-[10px] font-bold">B1</span>
                          {t.title}
                        </div>
                      ))}
                      {backupTasks2.map(t => (
                        <div key={`b2-${t.id}`} className="text-xs text-amber-800 bg-amber-100/50 px-2 py-1 rounded flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-[10px] font-bold">B2</span>
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {hasAssigned && (
                  <div>
                    <p className="text-sm text-amber-700 font-medium mb-1">
                      Directly assigned {assignedTasks.length} task{assignedTasks.length !== 1 ? 's' : ''}:
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {assignedTasks.map(t => (
                        <div key={`a-${t.id}`} className="text-xs text-amber-800 bg-amber-100/50 px-2 py-1 rounded">
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-amber-600">
                  Go to <strong>Admin → Tasks</strong> to reassign these backups before deleting. Use the backup filter (⚠️ No Backup) to find tasks that need attention.
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className={`flex-1 px-4 py-2.5 ${hasBackupDeps || hasAssigned ? 'bg-red-600' : 'bg-red-600'} text-white rounded-xl hover:bg-red-700 transition-colors`}
              >
                {hasBackupDeps || hasAssigned ? 'Delete Anyway' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function UserModal({ user, onClose, onSave, taskTemplates }) {
  const { DEPARTMENTS } = useApp();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [pipedriveName, setPipedriveName] = useState(user?.pipedrive_name || '');
  const [pipedriveOrgId, setPipedriveOrgId] = useState(user?.pipedrive_org_id || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState(user?.department || 'credit_consultants');
  const [role, setRole] = useState(user?.role || 'user');
  const [isVA, setIsVA] = useState(user?.is_va || false);
  const [shiftType, setShiftType] = useState(user?.shift_type || '');
  const [isNewEmployee, setIsNewEmployee] = useState(false);
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [onboardingTemplates, setOnboardingTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendEmail, setSendEmail] = useState(true); // Send welcome email option

  // Check if user has backup responsibilities
  const backupTasks1 = user ? (taskTemplates || []).filter(t => t.backup_user_1 === user.id) : [];
  const backupTasks2 = user ? (taskTemplates || []).filter(t => t.backup_user_2 === user.id) : [];
  const totalBackupTasks = backupTasks1.length + backupTasks2.length;
  const isDeptChanging = user && department !== user.department;

  const isNew = !user;

  // Re-initialize form when user changes
  useEffect(() => {
    if (user) {
      console.log('UserModal received user:', user);
      console.log('pipedrive_name from user:', user.pipedrive_name);
      setName(user.name || '');
      setEmail(user.email || '');
      setPipedriveName(user.pipedrive_name || '');
      setPipedriveOrgId(user.pipedrive_org_id || '');
      setDepartment(user.department || 'credit_consultants');
      setRole(user.role || 'user');
      setIsVA(user.is_va || false);
      setShiftType(user.shift_type || '');
    }
  }, [user]);

  // Load onboarding templates
  useEffect(() => {
    loadOnboardingTemplates();
  }, []);

  // Auto-select matching template when department or isVA changes
  useEffect(() => {
    if (isNewEmployee && onboardingTemplates.length > 0) {
      const matchingTemplate = onboardingTemplates.find(t => 
        t.department === department && t.is_va === isVA && t.is_active
      );
      if (matchingTemplate) {
        setSelectedTemplate(matchingTemplate.id);
      } else {
        setSelectedTemplate('');
      }
    }
  }, [department, isVA, isNewEmployee, onboardingTemplates]);

  const loadOnboardingTemplates = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_templates?is_active=eq.true&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        setOnboardingTemplates(await res.json() || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setShowPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    if (isNew && !password) return;

    setLoading(true);
    try {
      console.log('handleSubmit - calling onSave');
      if (typeof onSave === 'function') {
        await onSave({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          pipedrive_name: pipedriveName.trim() || null,
          pipedrive_org_id: pipedriveOrgId.trim() || null,
          password: password,
          department,
          role,
          is_va: isVA,
          shift_type: shiftType || null,
          is_new_employee: isNewEmployee,
          hire_date: isNewEmployee ? hireDate : null,
          onboarding_status: isNewEmployee ? 'in_progress' : 'none',
          playbook_access: isNewEmployee ? 'limited' : 'full',
          onboarding_template_id: isNewEmployee && selectedTemplate ? selectedTemplate : null,
          sendEmail: sendEmail,
        }, isNew);
      } else {
        console.error('onSave is not a function:', onSave);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
    setLoading(false);
  };

  // Get available templates for current department/VA combo
  const availableTemplates = onboardingTemplates.filter(t => 
    t.department === department && t.is_va === isVA
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-slate-800">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@asapcreditrepair.com"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
                required
                disabled={!!user} // Can't change email after creation
              />
            </div>
          </div>

          {/* Pipedrive Name - for payment sync matching */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pipedrive Name
            </label>
            <input
              type="text"
              value={pipedriveName}
              onChange={(e) => setPipedriveName(e.target.value)}
              placeholder="Name as it appears in Pipedrive (for payment matching)"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
            />
            <p className="text-xs text-slate-500 mt-1">
              Must match exactly how the name appears in Pipedrive for payments to sync correctly
            </p>          </div>

          {/* Pipedrive Org ID - for AM referral tracking */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pipedrive Org ID (referrals)
            </label>
            <input
              type="text"
              value={pipedriveOrgId}
              onChange={(e) => setPipedriveOrgId(e.target.value)}
              placeholder="Numeric Pipedrive organization ID for this AM's referrals"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
            />
            <p className="text-xs text-slate-500 mt-1">
              Referred clients placed under this organization count as this AM's referrals.
            </p>
          </div>

          {/* Password field - only for new users */}
          {isNew && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 whitespace-nowrap"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  This will be their login password. Make sure to share it with them!
                </p>
              </div>

              {/* Send Welcome Email Toggle */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="sendEmail" className="flex-1">
                  <span className="font-medium text-blue-800">Send Welcome Email</span>
                  <p className="text-sm text-blue-600">
                    Automatically send login credentials to {email || 'the user'}
                  </p>
                </label>
                <Mail size={20} className="text-blue-500" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Department Change + Backup Warning */}
          {user && (isDeptChanging || totalBackupTasks > 0) && (
            <div className={`rounded-xl p-3 border ${isDeptChanging ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
              {isDeptChanging && totalBackupTasks > 0 && (
                <p className="text-sm text-amber-800 font-medium mb-1">
                  ⚠️ {user.name} is moving departments and is backup for {totalBackupTasks} task{totalBackupTasks !== 1 ? 's' : ''}. Reassign their backups in Admin → Tasks.
                </p>
              )}
              {isDeptChanging && totalBackupTasks === 0 && (
                <p className="text-sm text-amber-700">
                  ⚠️ Changing department — their task assignments may need updating.
                </p>
              )}
              {!isDeptChanging && totalBackupTasks > 0 && (
                <p className="text-sm text-blue-700">
                  ℹ️ This person is backup for {totalBackupTasks} task{totalBackupTasks !== 1 ? 's' : ''} ({backupTasks1.length} as B1, {backupTasks2.length} as B2).
                </p>
              )}
            </div>
          )}

          {/* Shift Type - Important for task filtering */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Shift Type <span className="text-amber-600 text-xs font-normal">(Required for correct task assignment)</span>
            </label>
            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue"
            >
              <option value="">-- Select Shift --</option>
              <option value="7-4">7:00 AM - 4:00 PM</option>
              <option value="8-5">8:00 AM - 5:00 PM</option>
              <option value="8:30-5:30">8:30 AM - 5:30 PM</option>
              <option value="9-6">9:00 AM - 6:00 PM</option>
              <option value="10-7">10:00 AM - 7:00 PM</option>
              <option value="7-7">7:00 AM - 7:00 PM</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Tasks with specific shift requirements will only show for employees on that shift
            </p>
          </div>

          {/* VA Toggle - Show for all departments now */}
          <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
            <input
              type="checkbox"
              id="isVA"
              checked={isVA}
              onChange={(e) => setIsVA(e.target.checked)}
              className="w-5 h-5 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <div>
              <label htmlFor="isVA" className="font-medium text-slate-700 cursor-pointer">
                Remote / VA Employee
              </label>
              <p className="text-sm text-slate-500">
                Different onboarding flow and commission structure for remote workers
              </p>
            </div>
          </div>

          {/* New Employee vs Current Employee - Only for new users */}
          {isNew && (
            <>
              <div className="border-t border-slate-200 pt-4 mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Employee Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewEmployee(false)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      !isNewEmployee 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={18} className={!isNewEmployee ? 'text-green-600' : 'text-slate-400'} />
                      <span className="font-medium text-slate-800">Current Employee</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Existing team member, skip onboarding
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewEmployee(true)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isNewEmployee 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlus size={18} className={isNewEmployee ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className="font-medium text-slate-800">New Employee</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Needs onboarding, limited access
                    </p>
                  </button>
                </div>
              </div>

              {/* Onboarding Options - Show only for new employees */}
              {isNewEmployee && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <ClipboardList size={18} />
                    <span className="font-medium">Onboarding Setup</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Hire Date *
                    </label>
                    <input
                      type="date"
                      value={hireDate}
                      onChange={(e) => setHireDate(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                      required={isNewEmployee}
                    />
                    <p className="text-xs text-slate-500 mt-1">Task deadlines calculated from this date</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Onboarding Flow
                    </label>
                    {availableTemplates.length > 0 ? (
                      <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                      >
                        {availableTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 bg-amber-100 rounded-lg text-amber-800 text-sm">
                        <AlertTriangle size={16} className="inline mr-2" />
                        No onboarding template found for {DEPARTMENTS.find(d => d.id === department)?.name} ({isVA ? 'VA' : 'In-House'}).
                        <a href="/admin/onboarding" className="underline ml-1">Create one</a>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-slate-600 bg-white rounded-lg p-3">
                    <p className="font-medium mb-1">What happens next:</p>
                    <ul className="space-y-1 text-slate-500">
                      <li>• Employee gets <strong>limited</strong> playbook access</li>
                      <li>• Onboarding tasks appear in their dashboard</li>
                      <li>• Admin approves completed tasks</li>
                      <li>• Full access granted after onboarding complete</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-asap-blue text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="animate-spin" size={16} />}
              {user ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onReset }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setShowPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) return;
    setLoading(true);
    await onReset(user, password);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Reset Password</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="font-medium text-slate-800">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New Password
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="button"
                onClick={generatePassword}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || password.length < 6}
              className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="animate-spin" size={16} />}
              Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SuccessModal({ message, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyCredentials = () => {
    const text = `Email: ${message.email}\nPassword: ${message.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.type === 'error') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">{message.title}</h3>
            <p className="text-slate-600 mb-6">{message.message}</p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-slate-600 text-white rounded-xl hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Deleted user confirmation
  if (message.type === 'deleted') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">{message.title}</h3>
            <p className="text-slate-600 mb-6">
              <strong>{message.name}</strong> has been removed from the system.
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Updated user confirmation
  if (message.type === 'updated') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-blue-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">{message.title}</h3>
            <p className="text-slate-600 mb-6">
              <strong>{message.name}</strong>'s profile has been updated.
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">{message.title}</h3>
          <p className="text-slate-600 mb-4">
            {message.name} can now log in with these credentials:
          </p>
          
          <div className="bg-slate-50 rounded-xl p-4 text-left mb-4">
            <div className="mb-2">
              <span className="text-sm text-slate-500">Email:</span>
              <p className="font-mono text-slate-800">{message.email}</p>
            </div>
            <div>
              <span className="text-sm text-slate-500">Password:</span>
              <p className="font-mono text-slate-800">{message.password}</p>
            </div>
          </div>

          {/* Email Status */}
          {message.sendEmailRequested && (
            <div className={`rounded-xl p-3 mb-4 flex items-center gap-2 ${
              message.emailSent 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <Mail size={18} className={message.emailSent ? 'text-green-600' : 'text-amber-600'} />
              <span className={`text-sm ${message.emailSent ? 'text-green-700' : 'text-amber-700'}`}>
                {message.emailSent 
                  ? `Welcome email sent to ${message.email}` 
                  : 'Email not sent - configure RESEND_API_KEY in Netlify'}
              </span>
            </div>
          )}

          <button
            onClick={copyCredentials}
            className="w-full mb-3 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 flex items-center justify-center gap-2"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Credentials'}
          </button>

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;
