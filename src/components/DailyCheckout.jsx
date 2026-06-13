import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  CheckCircle,
  Upload,
  Camera,
  ClipboardCheck,
  User,
  Phone,
  Mail,
  MessageSquare,
  Target,
  Users,
  FileText,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

// Helper components moved outside to prevent re-creation on each render
const SectionHeader = ({ title, section, icon: Icon, expandedSections, toggleSection }) => (
  <button
    onClick={() => toggleSection(section)}
    className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
  >
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-asap-blue" />
      <span className="font-semibold text-slate-800">{title}</span>
    </div>
    {expandedSections[section] ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
  </button>
);

const YesNoField = ({ label, field, required, formData, updateField }) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => updateField(field, true)}
        className={`flex-1 py-2 px-4 rounded-lg border ${
          formData[field] === true 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => updateField(field, false)}
        className={`flex-1 py-2 px-4 rounded-lg border ${
          formData[field] === false 
            ? 'bg-red-100 border-red-500 text-red-700' 
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        No
      </button>
    </div>
  </div>
);

const NumberField = ({ label, field, required, formData, updateField }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="number"
      min="0"
      value={formData[field] || ''}
      onChange={(e) => updateField(field, e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
      placeholder="0"
    />
  </div>
);

const TextField = ({ label, field, required, multiline, placeholder, formData, updateField }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {multiline ? (
      <textarea
        value={formData[field] || ''}
        onChange={(e) => updateField(field, e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue resize-none"
        rows={3}
        placeholder={placeholder}
      />
    ) : (
      <input
        type="text"
        value={formData[field] || ''}
        onChange={(e) => updateField(field, e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
        placeholder={placeholder}
      />
    )}
  </div>
);

function DailyCheckout({ isOpen, onClose, onCheckoutComplete }) {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  
  // Form state - we'll use a flexible object
  const [formData, setFormData] = useState({});

  const department = currentUser?.department || 'credit_consultants';

  useEffect(() => {
    if (isOpen) {
      // Initialize form with defaults based on department
      initializeForm();
    }
  }, [isOpen, department]);

  const initializeForm = () => {
    const defaults = {
      role_play_partner: '',
      role_play_script: '',
    };

    if (department === 'credit_consultants') {
      setFormData({
        ...defaults,
        personal_cleared: null,
        needs_bonus_submission: null,
        new_leads: '',
        consultations: '',
        doc_fees: '',
        referrers_affiliates: '',
        facebook_friend_requests: '',
        facebook_friends: '',
        new_referrer_calls: '',
      });
    } else if (department === 'account_managers') {
      setFormData({
        ...defaults,
        signed_out_all_apps: null,
        no_activity_filter_cleared: null,
        am_filters_completed: null,
        three_way_text_filter_cleared: null,
        payment_filter_count: '',
        payments_made_count: '',
        lnr_deals_count: '',
        results_deals_count: '',
        reviews_asked_deals: '',
        referrals_asked_deals: '',
      });
    } else if (department === 'customer_support') {
      setFormData({
        ...defaults,
        reports_count: '',
        doc_fees_mtd_percentage: '',
        review_links_sent: '',
        pipeline_view_clear_new_leads: null,
        pipeline_view_clear_reports: null,
        d1_d6_filters_cleared: null,
        d1_d6_not_cleared_reason: '',
        referrals_asked_deals: '',
        duties_confirmed: [],
      });
    } else if (department === 'credit_team') {
      setFormData({
        rd1_disputes_left: '',
        rd2_3_4_disputes_left: '',
        results_filter_left: '',
        communicate_tasks_cleared: null,
        personal_team_tasks_cleared: null,
        disputes_sent_out: null,
        id_filter_cleared: null,
        processing_team_clear: null,
        did_not_print_names: '',
      });
    }
    
    setExpandedSections({ main: true });
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Prepare data for submission
      const checkoutData = {
        user_id: currentUser.id,
        checkout_date: today,
        department: department,
        role_play_partner: formData.role_play_partner,
        role_play_script: formData.role_play_script,
        form_data: formData, // Store entire form as JSON for flexibility
        completed_at: new Date().toISOString(),
      };

      // Add department-specific fields
      if (department === 'credit_consultants') {
        checkoutData.new_leads = parseInt(formData.new_leads) || 0;
        checkoutData.consultations = parseInt(formData.consultations) || 0;
        checkoutData.doc_fees = parseInt(formData.doc_fees) || 0;
        checkoutData.referrers_affiliates = parseInt(formData.referrers_affiliates) || 0;
        checkoutData.facebook_friend_requests = parseInt(formData.facebook_friend_requests) || 0;
        checkoutData.facebook_friends = parseInt(formData.facebook_friends) || 0;
        checkoutData.new_referrer_calls = parseInt(formData.new_referrer_calls) || 0;
      } else if (department === 'account_managers') {
        checkoutData.payment_filter_count = parseInt(formData.payment_filter_count) || 0;
        checkoutData.payments_made_count = parseInt(formData.payments_made_count) || 0;
        checkoutData.lnr_deals_count = parseInt(formData.lnr_deals_count) || 0;
        checkoutData.results_deals_count = parseInt(formData.results_deals_count) || 0;
      } else if (department === 'customer_support') {
        checkoutData.reports_count = parseInt(formData.reports_count) || 0;
        checkoutData.doc_fees_mtd_percentage = formData.doc_fees_mtd_percentage;
        checkoutData.review_links_sent = parseInt(formData.review_links_sent) || 0;
      } else if (department === 'credit_team') {
        checkoutData.rd1_disputes_left = parseInt(formData.rd1_disputes_left) || 0;
        checkoutData.rd2_3_4_disputes_left = parseInt(formData.rd2_3_4_disputes_left) || 0;
        checkoutData.results_filter_left = parseInt(formData.results_filter_left) || 0;
      }

      // Submit to Supabase
      const response = await fetch(`${SUPABASE_URL}/rest/v1/daily_checkouts`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to submit checkout');
      }

      setSuccess(true);
      setTimeout(() => {
        onCheckoutComplete();
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to submit checkout. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Common props to pass to field components
  const fieldProps = { formData, updateField };
  const sectionProps = { expandedSections, toggleSection };

  const getDepartmentTitle = () => {
    switch (department) {
      case 'credit_consultants': return 'Consultant';
      case 'account_managers': return 'Account Manager';
      case 'customer_support': return 'Customer Support';
      case 'credit_team': return 'Credit Team';
      default: return 'Employee';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-asap-blue to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Daily Checkout</h2>
                <p className="text-blue-100 text-sm">{getDepartmentTitle()} • {format(new Date(), 'MMMM d, yyyy')}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success State */}
        {success ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Checkout Complete!</h3>
              <p className="text-slate-600">You're all set for today. Great work!</p>
            </div>
          </div>
        ) : (
          <>
            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Role Play Section - Common to most departments */}
              {department !== 'credit_team' && (
                <div className="space-y-3">
                  <SectionHeader {...sectionProps} title="Role Play" section="roleplay" icon={Users} />
                  {expandedSections.roleplay !== false && (
                    <div className="pl-4 space-y-3">
                      <TextField {...fieldProps} 
                        label="Who did you role play with today?" 
                        field="role_play_partner" 
                        required 
                        placeholder="Enter team member name"
                      />
                      <TextField {...fieldProps} 
                        label="What script did you practice?" 
                        field="role_play_script" 
                        required 
                        placeholder="e.g., Initial Consultation, Objection Handling"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Department-specific sections */}
              {department === 'credit_consultants' && (
                <>
                  {/* Trackables */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="Today's Trackables" section="trackables" icon={Target} />
                    {expandedSections.trackables !== false && (
                      <div className="pl-4 grid grid-cols-2 gap-3">
                        <NumberField {...fieldProps} label="New Leads" field="new_leads" required />
                        <NumberField {...fieldProps} label="Consultations" field="consultations" required />
                        <NumberField {...fieldProps} label="Doc Fees" field="doc_fees" required />
                        <NumberField {...fieldProps} label="Referrers/Affiliates" field="referrers_affiliates" required />
                        <NumberField {...fieldProps} label="FB Friend Requests" field="facebook_friend_requests" required />
                        <NumberField {...fieldProps} label="FB Friends" field="facebook_friends" required />
                        <NumberField {...fieldProps} label="New Referrer Calls" field="new_referrer_calls" required />
                      </div>
                    )}
                  </div>

                  {/* Confirmations */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="End of Day Confirmations" section="confirmations" icon={CheckCircle} />
                    {expandedSections.confirmations !== false && (
                      <div className="pl-4 space-y-4">
                        <YesNoField {...fieldProps} label="Personal Emails and Personal RC Cleared?" field="personal_cleared" required />
                        <YesNoField {...fieldProps} label="Do you need to submit a bonus?" field="needs_bonus_submission" />
                      </div>
                    )}
                  </div>
                </>
              )}

              {department === 'account_managers' && (
                <>
                  {/* Numbers */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="Filter & Payment Stats" section="stats" icon={Target} />
                    {expandedSections.stats !== false && (
                      <div className="pl-4 grid grid-cols-2 gap-3">
                        <NumberField {...fieldProps} label="Payment Filter Count" field="payment_filter_count" required />
                        <NumberField {...fieldProps} label="Payments Made" field="payments_made_count" required />
                        <NumberField {...fieldProps} label="Deals in LNR" field="lnr_deals_count" />
                        <NumberField {...fieldProps} label="Deals in Results" field="results_deals_count" />
                      </div>
                    )}
                  </div>

                  {/* Text fields */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="Reviews & Referrals" section="reviews" icon={MessageSquare} />
                    {expandedSections.reviews !== false && (
                      <div className="pl-4 space-y-3">
                        <TextField {...fieldProps} 
                          label="Deals you asked for reviews from" 
                          field="reviews_asked_deals" 
                          required 
                          multiline
                          placeholder="List client names..."
                        />
                        <TextField {...fieldProps} 
                          label="Deals you asked for referrals on (Minimum 3)" 
                          field="referrals_asked_deals" 
                          required 
                          multiline
                          placeholder="List at least 3 client names..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Confirmations */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="End of Day Confirmations" section="confirmations" icon={CheckCircle} />
                    {expandedSections.confirmations !== false && (
                      <div className="pl-4 space-y-4">
                        <YesNoField {...fieldProps} label="Signed out from all applications?" field="signed_out_all_apps" />
                        <YesNoField {...fieldProps} label="No Activity Filter Cleared?" field="no_activity_filter_cleared" />
                        <YesNoField {...fieldProps} label="Account Manager Filters Completed?" field="am_filters_completed" />
                        <YesNoField {...fieldProps} label="3-Way Text Filter Cleared?" field="three_way_text_filter_cleared" required />
                      </div>
                    )}
                  </div>
                </>
              )}

              {department === 'customer_support' && (
                <>
                  {/* KPIs */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="KPI Totals" section="kpis" icon={Target} />
                    {expandedSections.kpis !== false && (
                      <div className="pl-4 grid grid-cols-2 gap-3">
                        <NumberField {...fieldProps} label="Reports (Clients with logins)" field="reports_count" required />
                        <TextField {...fieldProps} label="Total Doc Fees % MTD" field="doc_fees_mtd_percentage" required placeholder="e.g., 85%" />
                        <NumberField {...fieldProps} label="Review Links Sent" field="review_links_sent" required />
                      </div>
                    )}
                  </div>

                  {/* Pipeline Status */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="Pipeline Status" section="pipeline" icon={FileText} />
                    {expandedSections.pipeline !== false && (
                      <div className="pl-4 space-y-4">
                        <YesNoField {...fieldProps} label="Pipeline view clear in New Leads?" field="pipeline_view_clear_new_leads" />
                        <YesNoField {...fieldProps} label="Pipeline view clear in Reports?" field="pipeline_view_clear_reports" />
                        <YesNoField {...fieldProps} label="D1-D6 Filters Cleared?" field="d1_d6_filters_cleared" />
                        {formData.d1_d6_filters_cleared === false && (
                          <TextField {...fieldProps} 
                            label="Why weren't D1-D6 filters cleared?" 
                            field="d1_d6_not_cleared_reason" 
                            required 
                            multiline 
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Referrals */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="Referrals" section="referrals" icon={Users} />
                    {expandedSections.referrals !== false && (
                      <div className="pl-4">
                        <TextField {...fieldProps} 
                          label="Deals you asked for referrals on (Minimum 3)" 
                          field="referrals_asked_deals" 
                          required 
                          multiline
                          placeholder="List at least 3 client names..."
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {department === 'credit_team' && (
                <>
                  {/* Filter Numbers */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="Filter Status" section="filters" icon={Target} />
                    {expandedSections.filters !== false && (
                      <div className="pl-4 grid grid-cols-2 gap-3">
                        <NumberField {...fieldProps} label="Rd 1 Disputes Left" field="rd1_disputes_left" />
                        <NumberField {...fieldProps} label="Rd 2,3,4 Disputes Left" field="rd2_3_4_disputes_left" />
                        <NumberField {...fieldProps} label="Results Filter Left" field="results_filter_left" />
                      </div>
                    )}
                  </div>

                  {/* Confirmations */}
                  <div className="space-y-3">
                    <SectionHeader {...sectionProps} title="End of Day Confirmations" section="confirmations" icon={CheckCircle} />
                    {expandedSections.confirmations !== false && (
                      <div className="pl-4 space-y-4">
                        <YesNoField {...fieldProps} label="Communicate to Credit Team tasks cleared?" field="communicate_tasks_cleared" />
                        <YesNoField {...fieldProps} label="Personal Team tasks cleared?" field="personal_team_tasks_cleared" />
                        <YesNoField {...fieldProps} label="Today's disputes sent out?" field="disputes_sent_out" />
                        <YesNoField {...fieldProps} label="ID Filter cleared?" field="id_filter_cleared" />
                        <YesNoField {...fieldProps} label="Processing Team clear?" field="processing_team_clear" />
                        <TextField {...fieldProps} 
                          label="Names of people who did not print" 
                          field="did_not_print_names"
                          multiline
                          placeholder="Leave blank if none"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Complete Checkout
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DailyCheckout;
