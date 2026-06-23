import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import { Star, MapPin, MessageSquare, RefreshCw, Check, Clock, Hand } from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

// Embeddable review claim queue. Used standalone on the Claim Reviews page AND as a tab inside the
// AM and consultant bonus dashboards, so there is one source of truth for the claim flow.
export default function ReviewClaimQueue() {
  const { currentUser, supabaseFetch } = useApp();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [dealInputs, setDealInputs] = useState({});

  const myId = currentUser?.id;
  const myName = currentUser?.name || currentUser?.full_name || currentUser?.email || 'Me';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Only show reviews left on/after June 1, 2026 (launch). Undated rows use their created date.
      const data = await supabaseFetch('incoming_reviews', 'select=*&status=eq.pending&or=(review_date.gte.2026-06-01,and(review_date.is.null,created_at.gte.2026-06-01))&order=created_at.desc');
      setReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      setReviews([]);
    }
    setLoading(false);
  }, [supabaseFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const patch = async (id, body) => {
    await fetch(`${SUPABASE_URL}/rest/v1/incoming_reviews?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
  };

  const claim = async (review) => {
    const dealId = (dealInputs[review.id] || '').trim();
    if (!dealId) { alert('Please enter the Pipedrive deal ID for this client before claiming.'); return; }
    if (!/^\d+$/.test(dealId)) { alert('The deal ID should be just the numbers from the deal URL (e.g. 12345).'); return; }
    setBusyId(review.id);
    try {
      await patch(review.id, { claimed_by: myId, claimed_by_name: myName, claimed_at: new Date().toISOString(), pipedrive_deal_id: dealId });
      await loadData();
    } catch (e) { alert('Could not claim that review, please try again.'); }
    setBusyId(null);
  };

  const release = async (review) => {
    setBusyId(review.id);
    try {
      await patch(review.id, { claimed_by: null, claimed_by_name: null, claimed_at: null });
      await loadData();
    } catch (e) { alert('Could not release that claim, please try again.'); }
    setBusyId(null);
  };

  const available = reviews.filter(r => !r.claimed_by);
  const mine = reviews.filter(r => r.claimed_by === myId);
  const takenByOthers = reviews.filter(r => r.claimed_by && r.claimed_by !== myId).length;

  const stars = (n) => (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className={s <= (n || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'} />)}
    </span>
  );

  const Card = ({ review, children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-medium">
            {review.reviewer_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{review.reviewer_name || 'Anonymous'}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {stars(review.rating)}
              {review.review_date && <span className="text-xs text-slate-400">{format(parseISO(review.review_date), 'MMM d, yyyy')}</span>}
            </div>
          </div>
        </div>
      </div>
      {review.location_name && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2"><MapPin size={13} />{review.location_name}</div>
      )}
      {review.review_text && (
        <div className="bg-slate-50 rounded-xl p-3 mb-3">
          <MessageSquare size={13} className="text-slate-400 mb-1" />
          <p className="text-sm text-slate-700">{review.review_text}</p>
        </div>
      )}
      {children}
    </div>
  );

  if (loading) {
    return <div className="p-6 flex items-center justify-center min-h-[200px]"><RefreshCw className="animate-spin text-asap-blue" size={32} /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">See unassigned reviews and claim the ones you earned. A manager approves your claim and it counts toward your reviews.</p>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* My claims */}
      {mine.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Clock size={16} className="text-purple-500" /> Your claims, waiting for approval ({mine.length})</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {mine.map(review => (
              <Card key={review.id} review={review}>
                <div className="flex items-center justify-between pt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full"><Clock size={12} /> Awaiting approval</span>
                  <button onClick={() => release(review)} disabled={busyId === review.id} className="text-xs text-slate-500 hover:text-red-500 disabled:opacity-50">Release</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Hand size={16} className="text-asap-blue" /> Available to claim ({available.length})</h2>
        {available.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-500">
            No unclaimed reviews right now.{takenByOthers > 0 ? ` ${takenByOthers} are claimed by teammates and waiting for approval.` : ''}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {available.map(review => (
              <Card key={review.id} review={review}>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dealInputs[review.id] || ''}
                    onChange={e => setDealInputs(prev => ({ ...prev, [review.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                    placeholder="Pipedrive deal ID"
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asap-blue/30"
                  />
                  <button
                    onClick={() => claim(review)}
                    disabled={busyId === review.id}
                    className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Check size={16} /> Claim
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Add the client's deal ID so we can log the review on their Pipedrive file.</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
