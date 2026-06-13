import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function EnrollmentSurvey() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Pre-fill from URL params (from email link)
  const [formData, setFormData] = useState({
    client_name: searchParams.get('name') || '',
    client_email: searchParams.get('email') || '',
    client_phone: searchParams.get('phone') || '',
    consultant_id: searchParams.get('consultant_id') || '',
    consultant_name: searchParams.get('consultant') || '',
    pipedrive_person_id: searchParams.get('person_id') || '',
    pipedrive_deal_id: searchParams.get('deal_id') || '',
    
    // Survey responses
    initial_impression: 0,
    process_explained_clearly: null,
    consultant_rating: 0,
    consultant_explanation_quality: 0,
    nps_score: null,
    additional_comments: ''
  });

  const [consultants, setConsultants] = useState([]);

  useEffect(() => {
    // Load consultants for dropdown if not pre-filled
    loadConsultants();
  }, []);

  const loadConsultants = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('department', 'credit_consultants')
      .eq('is_active', true)
      .order('name');
    setConsultants(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Validation
    if (!formData.client_name || !formData.client_email) {
      setError('Please enter your name and email');
      setSubmitting(false);
      return;
    }

    if (formData.initial_impression === 0) {
      setError('Please rate your initial impression');
      setSubmitting(false);
      return;
    }

    if (formData.consultant_rating === 0) {
      setError('Please rate your credit consultant');
      setSubmitting(false);
      return;
    }

    if (formData.nps_score === null) {
      setError('Please tell us how likely you are to refer us');
      setSubmitting(false);
      return;
    }

    try {
      const { error: submitError } = await supabase
        .from('client_surveys')
        .insert({
          survey_type: 'enrollment',
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone,
          consultant_id: formData.consultant_id || null,
          consultant_name: formData.consultant_name,
          pipedrive_person_id: formData.pipedrive_person_id || null,
          pipedrive_deal_id: formData.pipedrive_deal_id || null,
          initial_impression: formData.initial_impression,
          process_explained_clearly: formData.process_explained_clearly,
          consultant_rating: formData.consultant_rating,
          consultant_explanation_quality: formData.consultant_explanation_quality,
          nps_score: formData.nps_score,
          additional_comments: formData.additional_comments
        });

      if (submitError) throw submitError;

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting survey:', err);
      setError('Failed to submit survey. Please try again.');
    }

    setSubmitting(false);
  };

  // Star Rating Component
  const StarRating = ({ value, onChange, max = 5, label }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        {[...Array(max)].map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`w-10 h-10 ${
                i < value
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        {value === 0 ? 'Click to rate' : `${value} out of ${max}`}
      </p>
    </div>
  );

  // Number Scale Component (0-10)
  const NumberScale = ({ value, onChange, label, description }) => (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {description && <p className="text-sm text-gray-500">{description}</p>}
      <div className="flex gap-1 flex-wrap">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`w-11 h-11 rounded-lg font-semibold transition-all ${
              value === num
                ? num <= 6
                  ? 'bg-red-500 text-white'
                  : num <= 8
                  ? 'bg-yellow-500 text-white'
                  : 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  );

  // Yes/No Component
  const YesNo = ({ value, onChange, label }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-8 py-3 rounded-lg font-medium transition-all ${
            value === true
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-8 py-3 rounded-lg font-medium transition-all ${
            value === false
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>
    </div>
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            We appreciate you taking the time to share your feedback. Your input helps us improve our services.
          </p>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-blue-800 font-medium">
              Welcome to ASAP Credit Repair!
            </p>
            <p className="text-blue-600 text-sm mt-1">
              Our team is excited to help you on your credit repair journey.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/logo.png" 
            alt="ASAP Credit Repair" 
            className="h-16 mx-auto mb-4"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-3xl font-bold text-gray-800">Welcome Survey</h1>
          <p className="text-gray-600 mt-2">
            Thank you for choosing ASAP Credit Repair! Please take a moment to share your initial experience.
          </p>
        </div>

        {/* Survey Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Client Info */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Your Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>

            {/* Consultant Selection (if not pre-filled) */}
            {!formData.consultant_name && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Who was your Credit Consultant?
                </label>
                <select
                  value={formData.consultant_id}
                  onChange={(e) => {
                    const consultant = consultants.find(c => c.id === e.target.value);
                    setFormData({
                      ...formData,
                      consultant_id: e.target.value,
                      consultant_name: consultant?.name || ''
                    });
                  }}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select your consultant...</option>
                  {consultants.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.consultant_name && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Your Consultant:</strong> {formData.consultant_name}
                </p>
              </div>
            )}
          </div>

          {/* Question 1: Initial Impression */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Your Experience</h2>
            
            <StarRating
              value={formData.initial_impression}
              onChange={(val) => setFormData({ ...formData, initial_impression: val })}
              label="1. How was your initial impression of our services? *"
            />
          </div>

          {/* Question 2: Process Explained */}
          <YesNo
            value={formData.process_explained_clearly}
            onChange={(val) => setFormData({ ...formData, process_explained_clearly: val })}
            label="2. Was the enrollment process explained clearly? *"
          />

          {/* Question 3: Consultant Rating */}
          <NumberScale
            value={formData.consultant_rating}
            onChange={(val) => setFormData({ ...formData, consultant_rating: val })}
            label="3. How would you rate your Credit Consultant? *"
            description="On a scale of 1-10, how would you rate your overall experience with your consultant?"
          />

          {/* Question 4: Explanation Quality */}
          <StarRating
            value={formData.consultant_explanation_quality}
            onChange={(val) => setFormData({ ...formData, consultant_explanation_quality: val })}
            label="4. How well did your Consultant explain our services and how we can help you? *"
          />

          {/* Question 5: NPS */}
          <NumberScale
            value={formData.nps_score}
            onChange={(val) => setFormData({ ...formData, nps_score: val })}
            label="5. How likely are you to refer us to a friend or family member? *"
          />

          {/* Question 6: Comments */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              6. Any additional comments? (Optional)
            </label>
            <textarea
              value={formData.additional_comments}
              onChange={(e) => setFormData({ ...formData, additional_comments: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Share any thoughts, suggestions, or feedback..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Feedback
              </>
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            Your feedback is confidential and helps us improve our services.
          </p>
        </form>
      </div>
    </div>
  );
}
