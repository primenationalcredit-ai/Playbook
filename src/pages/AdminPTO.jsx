import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  Users, 
  Settings, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check,
  Clock,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  History,
  ChevronDown,
  ChevronUp,
  Gift,
  Minus
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const ACCRUAL_TYPES = [
  { id: 'annual', name: 'Annual (All at Once)', description: 'Full balance given at start of year' },
  { id: 'monthly', name: 'Monthly', description: 'Accrues each month' },
  { id: 'per_pay_period', name: 'Per Pay Period', description: 'Accrues each pay period (bi-weekly)' },
];

const EXPIRATION_TYPES = [
  { id: 'calendar_year', name: 'Calendar Year End', description: 'Expires December 31st' },
  { id: 'anniversary', name: 'Work Anniversary', description: 'Expires on hire date anniversary' },
  { id: 'custom_date', name: 'Custom Date', description: 'Set a specific expiration date' },
  { id: 'never', name: 'Never Expires', description: 'PTO rolls over indefinitely' },
];

export default function AdminPTO() {
  const { currentUser, users } = useApp();
  const [view, setView] = useState('balances'); // balances, policies, transactions
  const [policies, setPolicies] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadPolicies(), loadBalances(), loadTransactions()]);
    setLoading(false);
  };

  const loadPolicies = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pto_policies?select=*&order=name`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setPolicies(await res.json() || []);
    } catch (error) {
      console.error('Error loading policies:', error);
    }
  };

  const loadBalances = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?select=*&order=user_id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setBalances(await res.json() || []);
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions?select=*&order=created_at.desc&limit=100`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setTransactions(await res.json() || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const savePolicy = async (policyData) => {
    try {
      if (editingPolicy) {
        await fetch(`${SUPABASE_URL}/rest/v1/pto_policies?id=eq.${editingPolicy.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...policyData, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/pto_policies`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(policyData)
        });
      }
      await loadPolicies();
      setShowPolicyModal(false);
      setEditingPolicy(null);
    } catch (error) {
      console.error('Error saving policy:', error);
    }
  };

  const deletePolicy = async (policyId) => {
    if (!confirm('Delete this policy? Users assigned to it will need a new policy.')) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/pto_policies?id=eq.${policyId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      await loadPolicies();
    } catch (error) {
      console.error('Error deleting policy:', error);
    }
  };

  const adjustBalance = async (userId, amount, description) => {
    try {
      // Get current balance
      const currentBalance = balances.find(b => b.user_id === userId);
      const newBalance = (currentBalance?.balance || 0) + amount;

      // Update balance
      if (currentBalance) {
        await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ balance: newBalance, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/pto_balances`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, balance: newBalance })
        });
      }

      // Record transaction
      await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          transaction_type: 'adjustment',
          amount: amount,
          balance_after: newBalance,
          description: description,
          created_by: currentUser?.id
        })
      });

      await loadData();
      setShowAdjustModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error adjusting balance:', error);
    }
  };

  const assignPolicy = async (userId, policyId, startingBalance) => {
    try {
      const policy = policies.find(p => p.id === policyId);
      const now = new Date();
      const yearEnd = new Date(now.getFullYear(), 11, 31);

      // Check if balance exists
      const existingBalance = balances.find(b => b.user_id === userId);

      const balanceData = {
        user_id: userId,
        policy_id: policyId,
        balance: startingBalance,
        used: 0,
        pending: 0,
        accrued_ytd: startingBalance,
        period_start: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
        period_end: format(yearEnd, 'yyyy-MM-dd'),
        updated_at: new Date().toISOString()
      };

      if (existingBalance) {
        await fetch(`${SUPABASE_URL}/rest/v1/pto_balances?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(balanceData)
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/pto_balances`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(balanceData)
        });
      }

      // Record transaction
      await fetch(`${SUPABASE_URL}/rest/v1/pto_transactions`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          transaction_type: 'accrual',
          amount: startingBalance,
          balance_after: startingBalance,
          description: `Assigned to ${policy?.name} policy with ${startingBalance} days`,
          created_by: currentUser?.id
        })
      });

      await loadData();
      setShowAssignModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error assigning policy:', error);
    }
  };

  const getUserName = (userId) => users?.find(u => u.id === userId)?.name || 'Unknown';
  const getUserBalance = (userId) => balances.find(b => b.user_id === userId);
  const getPolicy = (policyId) => policies.find(p => p.id === policyId);
  const getUserTransactions = (userId) => transactions.filter(t => t.user_id === userId);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">PTO Management</h1>
            <p className="text-slate-500 text-sm">Manage time-off balances and policies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('balances')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'balances' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <Users size={16} className="inline mr-1" /> Balances
            </button>
            <button
              onClick={() => setView('policies')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'policies' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <Settings size={16} className="inline mr-1" /> Policies
            </button>
            <button
              onClick={() => setView('transactions')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'transactions' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
            >
              <History size={16} className="inline mr-1" /> History
            </button>
          </div>
          {view === 'policies' && (
            <button
              onClick={() => { setEditingPolicy(null); setShowPolicyModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus size={18} /> New Policy
            </button>
          )}
        </div>
      </div>

      {/* Balances View */}
      {view === 'balances' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700">Employee</th>
                <th className="text-center p-4 font-semibold text-slate-700">Policy</th>
                <th className="text-center p-4 font-semibold text-slate-700">Available</th>
                <th className="text-center p-4 font-semibold text-slate-700">Used</th>
                <th className="text-center p-4 font-semibold text-slate-700">Pending</th>
                <th className="text-center p-4 font-semibold text-slate-700">Expires</th>
                <th className="text-center p-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map(user => {
                const balance = getUserBalance(user.id);
                const policy = balance ? getPolicy(balance.policy_id) : null;
                const isExpanded = expandedUser === user.id;
                const userTxns = getUserTransactions(user.id);

                return (
                  <React.Fragment key={user.id}>
                    <tr className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-asap-navy rounded-full flex items-center justify-center text-white font-semibold">
                            {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{user.name}</p>
                            <p className="text-sm text-slate-500">{user.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {policy ? (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                            {policy.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">Not assigned</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xl font-bold ${
                          (balance?.balance || 0) <= 2 ? 'text-red-600' : 
                          (balance?.balance || 0) <= 5 ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          {balance?.balance?.toFixed(1) || '0.0'}
                        </span>
                        <span className="text-slate-500 text-sm ml-1">days</span>
                      </td>
                      <td className="p-4 text-center text-slate-600">
                        {balance?.used?.toFixed(1) || '0.0'} days
                      </td>
                      <td className="p-4 text-center">
                        {(balance?.pending || 0) > 0 ? (
                          <span className="text-amber-600">{balance.pending.toFixed(1)} days</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center text-sm">
                        {balance?.period_end ? (
                          <span className={`${
                            differenceInDays(parseISO(balance.period_end), new Date()) <= 30 
                              ? 'text-red-600' : 'text-slate-600'
                          }`}>
                            {format(parseISO(balance.period_end), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setSelectedUser(user); setShowAdjustModal(true); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Adjust Balance"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => { setSelectedUser(user); setShowAssignModal(true); }}
                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                            title="Assign Policy"
                          >
                            <Gift size={16} />
                          </button>
                          <button
                            onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="View History"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50 p-4">
                          <h4 className="font-medium text-slate-700 mb-3">Recent Transactions</h4>
                          {userTxns.length === 0 ? (
                            <p className="text-slate-500 text-sm">No transactions yet</p>
                          ) : (
                            <div className="space-y-2">
                              {userTxns.slice(0, 5).map(txn => (
                                <div key={txn.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                      txn.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                    }`}>
                                      {txn.amount > 0 ? <Plus size={16} /> : <Minus size={16} />}
                                    </div>
                                    <div>
                                      <p className="font-medium text-slate-700">{txn.description}</p>
                                      <p className="text-xs text-slate-500">{format(parseISO(txn.created_at), 'MMM d, yyyy h:mm a')}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className={`font-semibold ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {txn.amount > 0 ? '+' : ''}{txn.amount.toFixed(1)} days
                                    </p>
                                    <p className="text-xs text-slate-500">Balance: {txn.balance_after.toFixed(1)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Policies View */}
      {view === 'policies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map(policy => (
            <div key={policy.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">{policy.name}</h3>
                  <p className="text-sm text-slate-500">{policy.description}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingPolicy(policy); setShowPolicyModal(true); }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deletePolicy(policy.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Annual Days</span>
                  <span className="font-semibold text-green-600">{policy.annual_days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Accrual</span>
                  <span className="text-slate-800">{ACCRUAL_TYPES.find(t => t.id === policy.accrual_type)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Expires</span>
                  <span className={policy.expires ? 'text-amber-600' : 'text-green-600'}>
                    {policy.expires ? EXPIRATION_TYPES.find(t => t.id === policy.expiration_type)?.name : 'Never'}
                  </span>
                </div>
                {policy.allow_rollover && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Max Rollover</span>
                    <span className="text-slate-800">{policy.max_rollover_days} days</span>
                  </div>
                )}
                {policy.max_balance && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Max Balance</span>
                    <span className="text-slate-800">{policy.max_balance} days</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  {balances.filter(b => b.policy_id === policy.id).length} employees assigned
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transactions View */}
      {view === 'transactions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-700">Date</th>
                  <th className="text-left p-4 font-semibold text-slate-700">Employee</th>
                  <th className="text-left p-4 font-semibold text-slate-700">Type</th>
                  <th className="text-left p-4 font-semibold text-slate-700">Description</th>
                  <th className="text-right p-4 font-semibold text-slate-700">Amount</th>
                  <th className="text-right p-4 font-semibold text-slate-700">Balance After</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => (
                  <tr key={txn.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-sm text-slate-600">
                      {format(parseISO(txn.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="p-4 font-medium text-slate-800">{getUserName(txn.user_id)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        txn.transaction_type === 'accrual' ? 'bg-green-100 text-green-700' :
                        txn.transaction_type === 'used' ? 'bg-red-100 text-red-700' :
                        txn.transaction_type === 'adjustment' ? 'bg-blue-100 text-blue-700' :
                        txn.transaction_type === 'rollover' ? 'bg-purple-100 text-purple-700' :
                        txn.transaction_type === 'expired' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {txn.transaction_type}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{txn.description}</td>
                    <td className={`p-4 text-right font-semibold ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount.toFixed(1)}
                    </td>
                    <td className="p-4 text-right text-slate-600">{txn.balance_after.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <PolicyModal
          policy={editingPolicy}
          onClose={() => { setShowPolicyModal(false); setEditingPolicy(null); }}
          onSave={savePolicy}
        />
      )}

      {/* Adjust Balance Modal */}
      {showAdjustModal && selectedUser && (
        <AdjustBalanceModal
          user={selectedUser}
          currentBalance={getUserBalance(selectedUser.id)?.balance || 0}
          onClose={() => { setShowAdjustModal(false); setSelectedUser(null); }}
          onAdjust={adjustBalance}
        />
      )}

      {/* Assign Policy Modal */}
      {showAssignModal && selectedUser && (
        <AssignPolicyModal
          user={selectedUser}
          policies={policies}
          currentPolicy={getUserBalance(selectedUser.id)?.policy_id}
          onClose={() => { setShowAssignModal(false); setSelectedUser(null); }}
          onAssign={assignPolicy}
        />
      )}
    </div>
  );
}

// Policy Modal
function PolicyModal({ policy, onClose, onSave }) {
  const [name, setName] = useState(policy?.name || '');
  const [description, setDescription] = useState(policy?.description || '');
  const [annualDays, setAnnualDays] = useState(policy?.annual_days || 10);
  const [accrualType, setAccrualType] = useState(policy?.accrual_type || 'annual');
  const [expires, setExpires] = useState(policy?.expires ?? true);
  const [expirationType, setExpirationType] = useState(policy?.expiration_type || 'calendar_year');
  const [allowRollover, setAllowRollover] = useState(policy?.allow_rollover ?? true);
  const [maxRollover, setMaxRollover] = useState(policy?.max_rollover_days || 5);
  const [maxBalance, setMaxBalance] = useState(policy?.max_balance || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      description,
      annual_days: parseFloat(annualDays),
      accrual_type: accrualType,
      expires,
      expiration_type: expires ? expirationType : 'never',
      allow_rollover: allowRollover,
      max_rollover_days: allowRollover ? parseFloat(maxRollover) : 0,
      max_balance: maxBalance ? parseFloat(maxBalance) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{policy ? 'Edit Policy' : 'New PTO Policy'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Policy Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Annual PTO Days *</label>
            <input type="number" step="0.5" value={annualDays} onChange={(e) => setAnnualDays(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Accrual Type</label>
            <select value={accrualType} onChange={(e) => setAccrualType(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
              {ACCRUAL_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">{ACCRUAL_TYPES.find(t => t.id === accrualType)?.description}</p>
          </div>
          
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={expires} onChange={(e) => setExpires(e.target.checked)} className="rounded" />
              <span className="font-medium">PTO Expires</span>
            </label>
            {expires && (
              <div className="ml-6">
                <select value={expirationType} onChange={(e) => setExpirationType(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                  {EXPIRATION_TYPES.filter(t => t.id !== 'never').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={allowRollover} onChange={(e) => setAllowRollover(e.target.checked)} className="rounded" />
              <span className="font-medium">Allow Rollover</span>
            </label>
            {allowRollover && (
              <div className="ml-6">
                <label className="block text-sm text-slate-600 mb-1">Maximum Rollover Days</label>
                <input type="number" step="0.5" value={maxRollover} onChange={(e) => setMaxRollover(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Maximum Balance Cap (optional)</label>
            <input type="number" step="0.5" value={maxBalance} onChange={(e) => setMaxBalance(e.target.value)} placeholder="No cap" className="w-full px-4 py-2 border rounded-lg" />
            <p className="text-xs text-slate-500 mt-1">Leave empty for no cap</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{policy ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Adjust Balance Modal
function AdjustBalanceModal({ user, currentBalance, onClose, onAdjust }) {
  const [amount, setAmount] = useState('');
  const [isAdding, setIsAdding] = useState(true);
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const adjustAmount = isAdding ? parseFloat(amount) : -parseFloat(amount);
    onAdjust(user.id, adjustAmount, description || (isAdding ? 'Manual addition' : 'Manual deduction'));
  };

  const newBalance = currentBalance + (isAdding ? parseFloat(amount || 0) : -parseFloat(amount || 0));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Adjust PTO Balance</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-slate-600">{user.name}</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{currentBalance.toFixed(1)} days</p>
            <p className="text-sm text-slate-500">Current Balance</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className={`flex-1 py-2 rounded-lg font-medium ${isAdding ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              + Add Days
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className={`flex-1 py-2 rounded-lg font-medium ${!isAdding ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              - Subtract Days
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Days</label>
            <input type="number" step="0.5" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-lg" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Bonus PTO, Correction..." className="w-full px-4 py-2 border rounded-lg" />
          </div>

          {amount && (
            <div className={`text-center p-3 rounded-xl ${newBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-slate-600">New Balance</p>
              <p className={`text-2xl font-bold ${newBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {newBalance.toFixed(1)} days
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" className={`flex-1 px-4 py-2 text-white rounded-lg ${isAdding ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {isAdding ? 'Add' : 'Subtract'} Days
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Assign Policy Modal
function AssignPolicyModal({ user, policies, currentPolicy, onClose, onAssign }) {
  const [policyId, setPolicyId] = useState(currentPolicy || '');
  const [startingBalance, setStartingBalance] = useState('');

  const selectedPolicy = policies.find(p => p.id === policyId);

  useEffect(() => {
    if (selectedPolicy) {
      setStartingBalance(selectedPolicy.annual_days);
    }
  }, [policyId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAssign(user.id, policyId, parseFloat(startingBalance));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Assign PTO Policy</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="font-medium text-slate-800">{user.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PTO Policy *</label>
            <select value={policyId} onChange={(e) => setPolicyId(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required>
              <option value="">Select policy...</option>
              {policies.map(p => <option key={p.id} value={p.id}>{p.name} ({p.annual_days} days/year)</option>)}
            </select>
          </div>

          {selectedPolicy && (
            <>
              <div className="p-4 bg-green-50 rounded-xl space-y-2">
                <p className="font-medium text-green-800">{selectedPolicy.name}</p>
                <p className="text-sm text-green-700">{selectedPolicy.description}</p>
                <div className="text-sm text-green-600">
                  <p>• {selectedPolicy.annual_days} days per year</p>
                  <p>• {selectedPolicy.expires ? `Expires: ${selectedPolicy.expiration_type}` : 'Never expires'}</p>
                  {selectedPolicy.allow_rollover && <p>• Rollover up to {selectedPolicy.max_rollover_days} days</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Starting Balance (days)</label>
                <input type="number" step="0.5" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
                <p className="text-xs text-slate-500 mt-1">Usually the annual amount, or prorated for mid-year hires</p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={!policyId} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">Assign Policy</button>
          </div>
        </form>
      </div>
    </div>
  );
}
