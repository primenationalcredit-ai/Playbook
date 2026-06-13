import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Send, CheckCircle, AlertCircle, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CompletionSurvey() {
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
    overall_satisfaction: 0,
    met_expectations: null,
    nps_score: null,
    what_could_improve: '',
    additional_comments: ''
  });

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

    if (formData.overall_satisfaction === 0) {
      setError('Please rate your overall satisfaction');
      setSubmitting(false);
      return;
    }

    if (formData.met_expectations === null) {
      setError('Please tell us if we met your expectations');
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
          survey_type: 'completion',
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone,
          consultant_id: formData.consultant_id || null,
          consultant_name: formData.consultant_name,
          pipedrive_person_id: formData.pipedrive_person_id || null,
          pipedrive_deal_id: formData.pipedrive_deal_id || null,
          overall_satisfaction: formData.overall_satisfaction,
          met_expectations: formData.met_expectations,
          nps_score: formData.nps_score,
          what_could_improve: formData.what_could_improve,
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
              className={`w-12 h-12 ${
                i < value
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        {value === 0 ? 'Click to rate' : 
         value === 1 ? 'Poor' :
         value === 2 ? 'Fair' :
         value === 3 ? 'Good' :
         value === 4 ? 'Very Good' :
         'Excellent'}
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-12 h-12 text-green-500 fill-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Congratulations on completing your credit repair journey with us! We truly appreciate your feedback.
          </p>
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              Your success is our success!
            </p>
            <p className="text-green-600 text-sm mt-1">
              We're proud to have been part of your financial improvement.
            </p>
          </div>
          
          {/* Review Request */}
          <div className="border-t pt-6 mt-6">
            <p className="text-gray-700 font-medium mb-4">
              Would you mind leaving us a Google review?
            </p>
            <a
              href="https://g.page/r/CYLuVnvYqXAzEBM/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              ⭐ Leave a Review
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/logo.png" 
            alt="ASAP Credit Repair" 
            className="h-16 mx-auto mb-4"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-3xl font-bold text-gray-800">Completion Survey</h1>
          <p className="text-gray-600 mt-2">
            Congratulations on completing your credit repair journey! Please share your final thoughts.
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
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* Question 1: Overall Satisfaction */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Your Results</h2>
            
            <StarRating
              value={formData.overall_satisfaction}
              onChange={(val) => setFormData({ ...formData, overall_satisfaction: val })}
              label="1. Overall, how satisfied are you with your results? *"
            />
          </div>

          {/* Question 2: Met Expectations */}
          <YesNo
            value={formData.met_expectations}
            onChange={(val) => setFormData({ ...formData, met_expectations: val })}
            label="2. Did we meet your expectations? *"
          />

          {/* Question 3: NPS */}
          <NumberScale
            value={formData.nps_score}
            onChange={(val) => setFormData({ ...formData, nps_score: val })}
            label="3. How likely are you to refer us to a friend or family member? *"
          />

          {/* Question 4: What Could Improve */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              4. What could we have done better? (Optional)
            </label>
            <textarea
              value={formData.what_could_improve}
              onChange={(e) => setFormData({ ...formData, what_could_improve: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="Share any suggestions for improvement..."
            />
          </div>

          {/* Question 5: Comments */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              5. Any additional comments? (Optional)
            </label>
            <textarea
              value={formData.additional_comments}
              onChange={(e) => setFormData({ ...formData, additional_comments: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={4}
              placeholder="Share your experience, testimonial, or any final thoughts..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            Your feedback helps us serve future clients better. Thank you!
          </p>
        </form>
      </div>
    </div>
  );
}
