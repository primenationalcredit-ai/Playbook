import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
  DollarSign,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  Calendar,
  FileText,
  TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';

export default function RefundTracking() {
  const { currentUser, users } = useApp();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterConsultant, setFilterConsultant] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [summary, setSummary] = useState({ total: 0, pending: 0, processed: 0, deductions: 0 });

  // Form state
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    pipedrive_deal_id: '',
    consultant_id: '',
    consultant_name: '',
    consultant_type: 'regular',
    refund_amount: '',
    original_payment_amount: '',
    refund_reason: '',
    notes: ''
  });

  // Get consultants from users
  const consultants = (users || [])
    .filter(u => u.is_active !== false)
    .map(u => ({
      id: u.id,
      full_name: u.name,
      consultant_type: u.department === 'credit_consultants' ? (u.is_va ? 'va' : 'regular') : 'none'
    }))
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));

  useEffect(() => {
    fetchRefunds();
  }, [selectedMonth, filterStatus, filterConsultant]);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('refunds')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by month
      if (selectedMonth) {
        const startDate = `${selectedMonth}-01`;
        const endDate = `${selectedMonth}-31`;
        query = query.gte('refund_date', startDate).lte('refund_date', endDate);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterConsultant !== 'all') {
        query = query.eq('consultant_id', filterConsultant);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRefunds(data || []);

      // Calculate summary
      const total = data?.reduce((sum, r) => sum + parseFloat(r.refund_amount || 0), 0) || 0;
      const pending = data?.filter(r => r.status === 'pending').reduce((sum, r) => sum + parseFloat(r.refund_amount || 0), 0) || 0;
      const processed = data?.filter(r => r.status === 'processed').reduce((sum, r) => sum + parseFloat(r.refund_amount || 0), 0) || 0;
      const deductions = data?.reduce((sum, r) => sum + parseFloat(r.deduction_amount || 0), 0) || 0;

      setSummary({ total, pending, processed, deductions });

    } catch (error) {
      console.error('Error fetching refunds:', error);
      // Use mock data for demo
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConsultantChange = (consultantId) => {
    const consultant = consultants.find(c => c.id === consultantId);
    if (consultant) {
      setFormData(prev => ({
        ...prev,
        consultant_id: consultantId,
        consultant_name: consultant.full_name,
        consultant_type: consultant.consultant_type || 'regular'
      }));
    }
  };

  const calculateDeduction = (amount, type) => {
    if (type === 'none') return { percentage: 0, amount: '0.00' };
    const percentage = type === 'va' ? 10 : 14;
    return {
      percentage,
      amount: (parseFloat(amount) * percentage / 100).toFixed(2)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const deduction = calculateDeduction(formData.refund_amount, formData.consultant_type);
    
    const refundData = {
      ...formData,
      refund_amount: parseFloat(formData.refund_amount),
      original_payment_amount: formData.original_payment_amount ? parseFloat(formData.original_payment_amount) : null,
      deduction_percentage: deduction.percentage,
      deduction_amount: parseFloat(deduction.amount),
      payroll_period: selectedMonth,
      status: 'pending',
      created_by: currentUser?.id
    };

    try {
      const resp = await fetch('/.netlify/functions/record-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refundData)
      });
      const result = await resp.json();
      if (!resp.ok || result.error) throw new Error(result.error || 'Record refund failed');

      setShowModal(false);
      setFormData({
        client_name: '',
        client_email: '',
        pipedrive_deal_id: '',
        consultant_id: '',
        consultant_name: '',
        consultant_type: 'regular',
        refund_amount: '',
        original_payment_amount: '',
        refund_reason: '',
        notes: ''
      });
      fetchRefunds();
    } catch (error) {
      console.error('Error creating refund:', error);
      alert('Error creating refund. Please try again.');
    }
  };

  const updateRefundStatus = async (refundId, newStatus) => {
    try {
      const updateData = { status: newStatus };
      
      if (newStatus === 'approved') {
        updateData.approved_by = currentUser?.id;
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === 'processed') {
        updateData.processed_at = new Date().toISOString();
        updateData.deducted_from_payroll = true;
      }

      const { error } = await supabase
        .from('refunds')
        .update(updateData)
        .eq('id', refundId);

      if (error) throw error;
      fetchRefunds();
    } catch (error) {
      console.error('Error updating refund:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-blue-100 text-blue-700',
      processed: 'bg-green-100 text-green-700',
      disputed: 'bg-red-100 text-red-700'
    };
    
    const icons = {
      pending: <Clock className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      processed: <CheckCircle className="w-3 h-3" />,
      disputed: <AlertTriangle className="w-3 h-3" />
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredRefunds = refunds.filter(r => 
    r.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.consultant_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refund Tracking</h1>
          <p className="text-gray-600">Track refunds and consultant payroll deductions</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Refund
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Refunds</p>
              <p className="text-2xl font-bold text-red-600">${summary.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-amber-600">${summary.pending.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Processed</p>
              <p className="text-2xl font-bold text-green-600">${summary.processed.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Deductions</p>
              <p className="text-2xl font-bold text-purple-600">${summary.deductions.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client or consultant name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="processed">Processed</option>
            <option value="disputed">Disputed</option>
          </select>
          
          <select
            value={filterConsultant}
            onChange={(e) => setFilterConsultant(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="all">All Consultants</option>
            {consultants.map(c => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
          
          <button
            onClick={fetchRefunds}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Refunds Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <DollarSign className="w-12 h-12 mb-3 text-gray-300" />
            <p>No refunds recorded for this period</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-red-500 hover:text-red-600 text-sm"
            >
              Record a refund
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Consultant</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Refund Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Deduction</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Reason</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.map((refund) => (
                  <tr key={refund.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{refund.client_name}</p>
                        {refund.client_email && (
                          <p className="text-xs text-gray-500">{refund.client_email}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-gray-900">{refund.consultant_name}</p>
                        <p className="text-xs text-gray-500">
                          {refund.consultant_type === 'va' ? 'VA (10%)' : 'Regular (14%)'}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-red-600 font-semibold">
                        ${parseFloat(refund.refund_amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-purple-600 font-medium">
                        -${parseFloat(refund.deduction_amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate" title={refund.refund_reason}>
                        {refund.refund_reason}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {refund.refund_date && format(new Date(refund.refund_date), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(refund.status)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {refund.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateRefundStatus(refund.id, 'approved')}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateRefundStatus(refund.id, 'disputed')}
                              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Dispute
                            </button>
                          </>
                        )}
                        {refund.status === 'approved' && (
                          <button
                            onClick={() => updateRefundStatus(refund.id, 'processed')}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Mark Processed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deductions by Consultant Summary */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Deductions by Consultant - {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {consultants.map(consultant => {
            const consultantRefunds = refunds.filter(r => r.consultant_id === consultant.id || r.consultant_name === consultant.full_name);
            const totalDeduction = consultantRefunds.reduce((sum, r) => sum + parseFloat(r.deduction_amount || 0), 0);
            const refundCount = consultantRefunds.length;
            
            return (
              <div key={consultant.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium">{consultant.full_name}</p>
                    <p className="text-xs text-gray-500">{refundCount} refund{refundCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  -${totalDeduction.toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Refund Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Record Refund</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Client Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
                <input
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              {/* Pipedrive Deal ID - enables payment matching + deal note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pipedrive Deal ID *</label>
                <input
                  type="text"
                  value={formData.pipedrive_deal_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, pipedrive_deal_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  placeholder="e.g. 267682"
                  required
                />
              </div>

              {/* Consultant Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultant *</label>
                <select
                  value={formData.consultant_id}
                  onChange={(e) => handleConsultantChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  required
                >
                  <option value="">Select consultant...</option>
                  {consultants.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}{c.consultant_type === 'none' ? '' : c.consultant_type === 'va' ? ' (10% VA)' : ' (14% Regular)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refund Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.refund_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, refund_amount: e.target.value }))}
                      className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Original Payment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.original_payment_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, original_payment_amount: e.target.value }))}
                      className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Deduction Preview */}
              {formData.refund_amount && formData.consultant_type && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-700">
                    <strong>Payroll Deduction:</strong> {formData.consultant_type === 'none' ? '0% (not a consultant)' : formData.consultant_type === 'va' ? '10%' : '14%'} =
                    <span className="text-lg font-bold ml-2">
                      ${calculateDeduction(formData.refund_amount, formData.consultant_type).amount}
                    </span>
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Reason *</label>
                <textarea
                  value={formData.refund_reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, refund_reason: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  rows={3}
                  required
                  placeholder="Enter the reason for the refund..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  rows={2}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Record Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
