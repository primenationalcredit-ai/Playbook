import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Star,
  Shuffle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MapPin,
  Info,
  Mail,
  MessageSquare,
  Send,
} from 'lucide-react';

// GMB Locations with review links (corrected against master list, suspended removed)
const GMB_LOCATIONS = [
  { name: 'ASAP Credit Repair Detroit', city: 'Detroit', state: 'MI', url: 'https://g.page/r/CZrybhIaaO76EBM/review' },
  { name: 'ASAP Credit Repair Houston', city: 'Houston', state: 'TX', url: 'https://g.page/r/CS-Fsp5yDQ_qEBM/review' },
  { name: 'ASAP Credit Repair San Antonio', city: 'San Antonio', state: 'TX', url: 'https://g.page/r/CVRZTOVqU2jrEBM/review' },
  { name: 'ASAP Credit Repair El Paso', city: 'El Paso', state: 'TX', url: 'https://g.page/r/Cdm3DFpEFp7UEBM/review' },
  { name: 'ASAP Credit Repair Albuquerque', city: 'Albuquerque', state: 'NM', url: 'https://g.page/r/CVY4fwJ1D-s-EBM/review' },
  { name: 'ASAP Credit Repair Pasadena', city: 'Pasadena', state: 'TX', url: 'https://g.page/r/CdnkLE7YB9pbEBM/review' },
  { name: 'ASAP Credit Repair Fort Myers', city: 'Fort Myers', state: 'FL', url: 'https://g.page/r/CdnAcOlmMPQnEBM/review' },
  { name: 'ASAP Credit Repair San Jose', city: 'San Jose', state: 'CA', url: 'https://g.page/r/CYQ9TCWDaaH2EBM/review' },
  { name: 'ASAP Credit Repair & Financial Education Columbus', city: 'Columbus', state: 'OH', url: 'https://g.page/r/CXNK7Li4tkzAEBM/review' },
  { name: 'ASAP Credit Repair Birmingham', city: 'Birmingham', state: 'AL', url: 'https://g.page/r/CR1_2xeSuAmHEBM/review' },
  { name: 'ASAP Credit Repair Phoenix', city: 'Phoenix', state: 'AZ', url: 'https://g.page/r/Ca0JFHboHmElEBM/review' },
  { name: 'ASAP Credit Repair Victoria', city: 'Victoria', state: 'TX', url: 'https://g.page/r/CefMoYjyXxjtEBM/review' },
  { name: 'ASAP Credit Repair Lafayette', city: 'Lafayette', state: 'LA', url: 'https://g.page/r/CZYKdTCOgqnoEBM/review' },
  { name: 'ASAP Credit Repair Fort Washington', city: 'Fort Washington', state: 'MD', url: 'https://g.page/r/CbwZS10T_h7EEBM/review' },
  { name: 'ASAP Credit Repair Tyler', city: 'Tyler', state: 'TX', url: 'https://g.page/r/CZNpORf21Bw5EBM/review' },
  { name: 'ASAP Credit Repair Las Cruces', city: 'Las Cruces', state: 'NM', url: 'https://g.page/r/Ca--BID9bBlOEBM/review' },
  { name: 'ASAP Credit Repair West Valley Utah', city: 'West Valley', state: 'UT', url: 'https://g.page/r/CY5zmMsEJsUWEBM/review' },
  { name: 'ASAP Credit Repair McAllen', city: 'McAllen', state: 'TX', url: 'https://g.page/r/CUJ_5njlAzcZEBM/review' },
];

function ReviewRandomizer() {
  const { supabaseFetch } = useApp();
  
  const [locationStats, setLocationStats] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dealId, setDealId] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendText, setSendText] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [timeframe, setTimeframe] = useState('month'); // week, month, all

  useEffect(() => {
    loadReviewStats();
  }, [timeframe]);

  const loadReviewStats = async () => {
    setLoading(true);
    try {
      // Calculate date range
      let dateFilter = '';
      const now = new Date();
      if (timeframe === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = `&review_date=gte.${weekAgo.toISOString().split('T')[0]}`;
      } else if (timeframe === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = `&review_date=gte.${monthAgo.toISOString().split('T')[0]}`;
      }

      // Fetch incoming reviews to count by location
      const reviews = await supabaseFetch('incoming_reviews', `select=location_name,review_date${dateFilter}`);
      
      // Count reviews per location
      const reviewCounts = {};
      if (reviews && Array.isArray(reviews)) {
        reviews.forEach(r => {
          const loc = r.location_name;
          reviewCounts[loc] = (reviewCounts[loc] || 0) + 1;
        });
      }

      // Calculate stats for each location
      const stats = GMB_LOCATIONS.map(loc => {
        const count = reviewCounts[loc.name] || 0;
        return {
          ...loc,
          reviewCount: count,
        };
      });

      // Calculate weights (inverse of review count)
      const maxCount = Math.max(...stats.map(s => s.reviewCount), 1);
      const totalLocations = stats.length;
      
      stats.forEach(s => {
        // Locations with fewer reviews get higher weight
        // Weight = (maxCount - reviewCount + 1) to ensure minimum weight of 1
        s.weight = maxCount - s.reviewCount + 1;
      });

      // Normalize weights to percentages
      const totalWeight = stats.reduce((sum, s) => sum + s.weight, 0);
      stats.forEach(s => {
        s.probability = ((s.weight / totalWeight) * 100).toFixed(1);
      });

      // Sort by review count (ascending) to show which need more reviews
      stats.sort((a, b) => a.reviewCount - b.reviewCount);

      setLocationStats(stats);
    } catch (err) {
      console.error('Error loading stats:', err);
      // If no data, just set equal weights
      const stats = GMB_LOCATIONS.map(loc => ({
        ...loc,
        reviewCount: 0,
        weight: 1,
        probability: (100 / GMB_LOCATIONS.length).toFixed(1),
      }));
      setLocationStats(stats);
    } finally {
      setLoading(false);
    }
  };

  const getRandomLocation = () => {
    if (locationStats.length === 0) return null;

    // Weighted random selection
    const totalWeight = locationStats.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const loc of locationStats) {
      random -= loc.weight;
      if (random <= 0) {
        return loc;
      }
    }
    
    return locationStats[0]; // Fallback
  };

  const handleRandomize = () => {
    const location = getRandomLocation();
    setSelectedLocation(location);
    setCopied(false);
  };

  const handleCopyLink = async () => {
    if (!selectedLocation) return;
    try {
      await navigator.clipboard.writeText(selectedLocation.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenLink = () => {
    if (!selectedLocation) return;
    window.open(selectedLocation.url, '_blank');
  };

  const SENDER_URL = 'https://asap-payment-processor.netlify.app/.netlify/functions/send-review-link';
  const handleSendReviewLink = async () => {
    if (!selectedLocation || !dealId.trim()) { setSendResult({ ok: false, msg: 'Enter a Deal ID first.' }); return; }
    if (!sendEmail && !sendText) { setSendResult({ ok: false, msg: 'Pick email, text, or both.' }); return; }
    setSending(true); setSendResult(null);
    try {
      const res = await fetch(SENDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId.trim(),
          channels: { email: sendEmail, text: sendText },
          review_url: selectedLocation.url,
          location_name: selectedLocation.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const sent = [];
        const failed = [];
        if (sendEmail) { if (data.email === 'sent') sent.push('email'); else if (data.email) failed.push(`email (${data.email})`); }
        if (sendText) { if (data.sms === 'sent') sent.push('text'); else if (data.sms) failed.push(`text (${data.sms})`); }
        if (sent.length && !failed.length) {
          setSendResult({ ok: true, msg: `Review link sent by ${sent.join(' and ')} to ${data.client_name || 'client'}.` });
          setDealId('');
        } else if (sent.length) {
          setSendResult({ ok: false, msg: `Sent by ${sent.join(' and ')} to ${data.client_name || 'client'}. Did not send ${failed.join(', ')}.` });
        } else {
          setSendResult({ ok: false, msg: data.error || `Nothing sent: ${failed.join(', ') || 'no contact info on the deal'}.` });
        }
      } else {
        setSendResult({ ok: false, msg: `${data.error || 'Send failed'} (status ${res.status}).` });
      }
    } catch (e) {
      setSendResult({ ok: false, msg: 'Could not reach the sender service. The send-review-link function is most likely not deployed on the payment-processor project yet.' });
    }
    setSending(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2">Review Link Generator</h1>
        <p className="text-slate-500">
          Get a weighted random Google review link to share with clients. 
          Locations with fewer recent reviews are more likely to be selected.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 mb-6">
        {/* Stars decoration */}
        <div className="flex justify-center gap-1 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} size={32} className="text-yellow-400 fill-yellow-400" />
          ))}
        </div>

        <h2 className="text-xl font-semibold text-center text-slate-800 mb-2">
          Help Us Get More Google Reviews!
        </h2>
        <p className="text-center text-slate-500 mb-8">
          Click the button below to get a review link to share with your client
        </p>

        {/* Randomize Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleRandomize}
            disabled={loading}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-asap-blue to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50"
          >
            <Shuffle size={24} />
            Get Review Link
          </button>
        </div>

        {/* Selected Location */}
        {selectedLocation && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 mb-3">
              <MapPin size={20} />
              <span className="font-semibold">Selected Location</span>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-1">
              {selectedLocation.city}, {selectedLocation.state}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{selectedLocation.name}</p>

            {/* Link and Actions */}
            <div className="bg-white rounded-lg p-3 border border-slate-200 mb-4">
              <code className="text-sm text-blue-600 break-all">{selectedLocation.url}</code>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyLink}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  copied 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              
              <button
                onClick={handleOpenLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-asap-blue text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                <ExternalLink size={18} />
                Open Link
              </button>
            </div>

            {/* Send to client by email / text */}
            <div className="mt-4 pt-4 border-t border-blue-100">
              <p className="text-sm font-semibold text-slate-700 mb-2">Send this link to a client</p>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="text"
                  value={dealId}
                  onChange={e => setDealId(e.target.value)}
                  placeholder="Pipedrive Deal ID"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} /> <Mail size={14} /> Email
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={sendText} onChange={e => setSendText(e.target.checked)} /> <MessageSquare size={14} /> Text
                </label>
                <button
                  onClick={handleSendReviewLink}
                  disabled={sending}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  <Send size={16} className={sending ? 'animate-pulse' : ''} /> {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
              {sendResult && (
                <p className={`text-sm mt-2 ${sendResult.ok ? 'text-green-600' : 'text-red-600'}`}>{sendResult.msg}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">Pulls the client's email and phone from the deal. Defaults to both channels.</p>
            </div>

            {/* Stats for this location */}
            <div className="mt-4 pt-4 border-t border-blue-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Reviews this {timeframe}: <strong className="text-slate-700">{selectedLocation.reviewCount}</strong>
              </span>
              <span className="text-slate-500">
                Selection chance: <strong className="text-blue-600">{selectedLocation.probability}%</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Toggle */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowStats(!showStats)}
          className="flex items-center gap-2 text-slate-600 hover:text-asap-blue transition-colors"
        >
          <BarChart3 size={18} />
          {showStats ? 'Hide' : 'Show'} Location Stats
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Timeframe:</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-asap-blue"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={loadReviewStats}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            title="Refresh stats"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Location Stats Table */}
      {showStats && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-blue-500" />
              <span className="text-sm text-slate-600">
                Locations with fewer reviews have higher selection probability to balance distribution
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Location</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Reviews ({timeframe})</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Selection %</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {locationStats.map((loc, idx) => {
                  const avgCount = locationStats.reduce((sum, l) => sum + l.reviewCount, 0) / locationStats.length;
                  const isBelowAvg = loc.reviewCount < avgCount;
                  const isAboveAvg = loc.reviewCount > avgCount * 1.5;
                  
                  return (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{loc.city}, {loc.state}</div>
                        <div className="text-xs text-slate-400">{loc.name}</div>
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className={`font-semibold ${
                          loc.reviewCount === 0 ? 'text-red-500' :
                          isBelowAvg ? 'text-amber-500' :
                          isAboveAvg ? 'text-green-500' : 'text-slate-700'
                        }`}>
                          {loc.reviewCount}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-asap-blue rounded-full"
                              style={{ width: `${Math.min(parseFloat(loc.probability) * 2, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600">{loc.probability}%</span>
                        </div>
                      </td>
                      <td className="text-center px-4 py-3">
                        {isBelowAvg ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                            <TrendingDown size={12} />
                            Needs Reviews
                          </span>
                        ) : isAboveAvg ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            <TrendingUp size={12} />
                            Above Average
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                            On Track
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Script */}
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h4 className="font-semibold text-blue-800 mb-4">📞 Review Request Script</h4>
        <div className="space-y-4 text-sm">
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-medium text-blue-700 mb-1">Step 1: The Big Ask</div>
            <p className="text-slate-700 italic">"Can I ask a HUUUUUUGGGEE favor from you?"</p>
            <p className="text-slate-500 text-xs mt-1">⏸️ Wait for them to say yes...</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-medium text-blue-700 mb-1">Step 2: Set the Stage</div>
            <p className="text-slate-700 italic">"The way I'm graded on my professionalism and level of customer service is by providing a 5-star experience. Do you feel I have been able to do this today?"</p>
            <p className="text-slate-500 text-xs mt-1">⏸️ Wait for them to respond yes...</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-medium text-blue-700 mb-1">Step 3: Make the Request</div>
            <p className="text-slate-700 italic">"It would mean the WORLD to me... if you could do me a HUGEEEE favor and leave me a 5-star review today. Would you be willing to do that for me?"</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-medium text-blue-700 mb-1">Step 4: Send & Verify</div>
            <p className="text-slate-700">Send them the link while on the phone, then say:</p>
            <p className="text-slate-700 italic mt-1">"Sometimes the link doesn't work. Can you click on it and tell me if it works?"</p>
            <p className="text-slate-500 text-xs mt-1">⏸️ Wait for them to confirm it works...</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-medium text-blue-700 mb-1">Step 5: Close It Out</div>
            <p className="text-slate-700 italic">"Awesome! If you don't mind doing it really quickly, that would be amazing!"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewRandomizer;
