import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// GMB review links (kept in sync with ReviewRandomizer). Satisfied clients are
// distributed across locations so reviews spread instead of piling on one profile.
const REVIEW_LOCATIONS = [
  { name: 'Detroit', url: 'https://g.page/r/CZrybhlaaO76EBM/review' },
  { name: 'Houston', url: 'https://g.page/r/CS-Fsp5yDQ_gEBM/review' },
  { name: 'San Antonio', url: 'https://g.page/r/CVRZTOVqU2rEBM/review' },
  { name: 'El Paso', url: 'https://g.page/r/Cdm3DFpEFp7UEBM/review' },
  { name: 'Albuquerque', url: 'https://g.page/r/CVY4fwJ1D-s-EBM/review' },
  { name: 'Fort Myers', url: 'https://g.page/r/CdnAcOlmMPOnEBM/review' },
  { name: 'San Jose', url: 'https://g.page/r/CYQ9TCWDaaH2EBM/review' },
  { name: 'Columbus', url: 'https://g.page/r/CXNK7Li4tlzAEBM/review' },
  { name: 'Birmingham', url: 'https://g.page/r/CR1_2xeSuAmHEBM/review' },
  { name: 'Phoenix', url: 'https://g.page/r/Ca0UFHboHmEiEBM/review' },
  { name: 'Victoria', url: 'https://g.page/r/CeMoYiyXxjlEBM/review' },
  { name: 'Lafayette', url: 'https://g.page/r/CZYKdTCOqgnoEBM/review' },
  { name: 'Fort Washington', url: 'https://g.page/r/CbwZS10T_h7EEBM/review' },
  { name: 'Tyler', url: 'https://g.page/r/CZNpORf21Bw5EBM/review' },
  { name: 'Laurel', url: 'https://g.page/r/CWxMCitTPMEEEBM/review' },
  { name: 'West Valley Utah', url: 'https://g.page/r/CY5zmMsEJsUWEBM/review' },
];

const SATISFIED_THRESHOLD = 9; // 9-10 overall = route to review ask

function NumberScale({ value, onChange, max = 10 }) {
  return (
    <div className="grid grid-cols-10 gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-10 rounded-lg border text-sm font-semibold transition ${
            value === n ? 'bg-asap-blue text-white border-asap-blue' : 'bg-white text-slate-700 border-slate-200 hover:border-asap-blue'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Round2Survey() {
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { satisfied, reviewUrl }

  const [form, setForm] = useState({
    client_name: searchParams.get('name') || '',
    client_email: searchParams.get('email') || '',
    client_phone: searchParams.get('phone') || '',
    am_name: searchParams.get('am') || searchParams.get('consultant') || '',
    pipedrive_person_id: searchParams.get('person_id') || '',
    pipedrive_deal_id: searchParams.get('deal_id') || '',
    overall_satisfaction: 0,
    am_rating: 0,
    explained_clearly: null,
    nps_score: null,
    what_could_improve: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.client_name) { setError('Please enter your name.'); return; }
    if (!form.overall_satisfaction) { setError('Please rate your overall satisfaction.'); return; }
    if (!form.am_rating) { setError('Please rate your account manager.'); return; }
    if (form.explained_clearly === null) { setError('Please answer whether the work was explained clearly.'); return; }

    setSubmitting(true);
    try {
      const { error: submitError } = await supabase.from('client_surveys').insert({
        survey_type: 'round2_am',
        client_name: form.client_name,
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        am_name: form.am_name || null,
        consultant_name: form.am_name || null,
        pipedrive_person_id: form.pipedrive_person_id || null,
        pipedrive_deal_id: form.pipedrive_deal_id || null,
        overall_satisfaction: form.overall_satisfaction,
        am_rating: form.am_rating,
        met_expectations: form.explained_clearly,
        nps_score: form.nps_score,
        what_could_improve: form.what_could_improve || null,
      });
      if (submitError) throw submitError;

      const satisfied = form.overall_satisfaction >= SATISFIED_THRESHOLD;
      const loc = REVIEW_LOCATIONS[Math.floor(Math.random() * REVIEW_LOCATIONS.length)];
      setResult({ satisfied, reviewUrl: satisfied ? loc.url : null });
    } catch (err) {
      console.error('Survey submit error:', err);
      setError('Something went wrong submitting your survey. Please try again.');
    }
    setSubmitting(false);
  };

  // Thank-you / review ask screen
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 max-w-lg w-full p-8 text-center">
          {result.satisfied ? (
            <>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Thank you{form.client_name ? `, ${form.client_name}` : ''}!</h1>
              <p className="text-slate-600 mb-6">
                {form.am_name
                  ? `We are so glad ${form.am_name} has been taking good care of you. A quick review would mean the world to ${form.am_name}, and it helps other people find the same help you did. It only takes a minute.`
                  : 'We are so glad you have had a great experience. A quick review would mean the world to our team, and it helps other people find the same help you did. It only takes a minute.'}
              </p>
              <a
                href={result.reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-asap-blue text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90"
              >
                {form.am_name ? `Leave ${form.am_name} a Review` : 'Leave a Review'}
              </a>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Thank you for your feedback</h1>
              <p className="text-slate-600">
                We appreciate you taking the time. Your account manager will follow up to make sure everything is on track.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">How are we doing?</h1>
        <p className="text-slate-500 mb-6">A few quick questions about your progress so far. Takes under a minute.</p>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!searchParams.get('name') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
              <input type="text" value={form.client_name} onChange={(e) => set('client_name', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Overall, how satisfied are you with ASAP so far? (1 = not at all, 10 = extremely)</label>
            <NumberScale value={form.overall_satisfaction} onChange={(v) => set('overall_satisfaction', v)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              How would you rate your account manager{form.am_name ? `, ${form.am_name}` : ''}?
            </label>
            <NumberScale value={form.am_rating} onChange={(v) => set('am_rating', v)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Has the work been explained in a way you understood?</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => set('explained_clearly', true)}
                className={`px-5 py-2 rounded-xl border font-medium ${form.explained_clearly === true ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-700 border-slate-200'}`}>Yes</button>
              <button type="button" onClick={() => set('explained_clearly', false)}
                className={`px-5 py-2 rounded-xl border font-medium ${form.explained_clearly === false ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-700 border-slate-200'}`}>No</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">How likely are you to refer a friend or family member to us? (optional)</label>
            <NumberScale value={form.nps_score || 0} onChange={(v) => set('nps_score', v)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Anything we could have done better? (optional)</label>
            <textarea value={form.what_could_improve} onChange={(e) => set('what_could_improve', e.target.value)} rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-asap-blue" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-asap-blue text-white font-semibold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
