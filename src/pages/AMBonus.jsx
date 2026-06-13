import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Trophy, Star, RefreshCw, Plus, Check, X, ShieldCheck, Users, Repeat, MessageSquare, Award, TrendingUp, Clock, Image as ImageIcon, ExternalLink, Upload } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

function Tip({ text, children }) {
  const [show, setShow] = React.useState(false);
  return (
    <span className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
      <span className="border-b border-dotted border-slate-400 cursor-help">{children}</span>
      {show && (
        <span className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl z-[200] leading-relaxed"
          style={{minWidth:'200px', maxWidth:'300px', whiteSpace:'normal'}}>
          {text}
          <span className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></span>
        </span>
      )}
    </span>
  );
}

const fmt = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AMBonus() {
  const { currentUser, users } = useApp();
  const [tab, setTab] = useState('dashboard');
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stallData, setStallData] = useState(null);
  const [roundsData, setRoundsData] = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [formData, setFormData] = useState({ client_name: '', pipedrive_deal_id: '', product_name: '', proof_description: '' });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';
  const isAM = currentUser?.department === 'account_managers' || isAdmin;

  // Get all AMs from users — fall back to current user if none found
  const accountManagers = (users || []).filter(u => 
    u.department === 'account_managers' || u.role === 'account_manager'
  );
  // If no AMs found, let admin see all users
  const amList = accountManagers.length > 0 ? accountManagers : (isAdmin ? (users || []) : [currentUser].filter(Boolean));

  const [selectedAM, setSelectedAM] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const monthStart = `${selectedMonth}-01`;
      // Credit building submissions — handle table not existing
      try {
        const subRes = await fetch(`${SUPABASE_URL}/rest/v1/credit_building_submissions?submission_month=eq.${selectedMonth}&select=*`, { headers: supaHeaders });
        if (subRes.ok) setSubmissions(await subRes.json());
      } catch(e) {}

      // Reviews
      try {
        const revRes = await fetch(`${SUPABASE_URL}/rest/v1/incoming_reviews?created_at=gte.${monthStart}&select=*`, { headers: supaHeaders });
        if (revRes.ok) setReviews(await revRes.json());
      } catch(e) {}

      // Stall rate from Pipedrive — load separately, don't block page
      fetch('/.netlify/functions/am-stall-rate').then(r => r.ok ? r.json() : null).then(d => { if (d) setStallData(d); }).catch(() => {});

      // Additional rounds (paid $299) per AM — non-blocking
      fetch(`/.netlify/functions/am-additional-rounds?month=${selectedMonth}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setRoundsData(d); }).catch(() => {});

      // Referrals per AM — non-blocking (returns needsConfig until field is set)
      fetch(`/.netlify/functions/am-referrals?month=${selectedMonth}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setReferralData(d); }).catch(() => {});

      if (!selectedAM) {
        if (isAdmin && amList.length > 0) setSelectedAM(amList[0]?.id);
        else if (currentUser?.id) setSelectedAM(currentUser.id);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedMonth]);

  const submitCreditBuilding = async () => {
    if (!formData.client_name || !formData.product_name) return;
    setUploading(true);
    try {
      let proofUrl = null;
      if (proofFile) {
        const ext = (proofFile.name.split('.').pop() || 'png').toLowerCase();
        const path = `${currentUser?.id || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('credit-proofs').upload(path, proofFile, { upsert: false, contentType: proofFile.type || 'image/png' });
        if (upErr) { setError('Image upload failed: ' + upErr.message); setUploading(false); return; }
        const { data: pub } = supabase.storage.from('credit-proofs').getPublicUrl(path);
        proofUrl = pub?.publicUrl || null;
      }
      const body = {
        ...formData,
        proof_image_url: proofUrl,
        submitted_by: currentUser?.id,
        submission_month: selectedMonth,
        status: 'pending'
      };
      await fetch(`${SUPABASE_URL}/rest/v1/credit_building_submissions`, {
        method: 'POST', headers: { ...supaHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(body)
      });
      setFormData({ client_name: '', pipedrive_deal_id: '', product_name: '', proof_description: '' });
      setProofFile(null);
      setShowForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  };

  // Approval/rejection routes through the server function so the Pipedrive note
  // is posted with the API token kept server-side. One product = one note.
  const reviewSubmission = async (id, action) => {
    setProcessingId(id);
    try {
      const res = await fetch('/.netlify/functions/approve-credit-submission', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: id, action, reviewed_by: currentUser?.id })
      });
      if (!res.ok) {
        // Fallback: at least update the status directly so the queue clears
        await fetch(`${SUPABASE_URL}/rest/v1/credit_building_submissions?id=eq.${id}`, {
          method: 'PATCH', headers: { ...supaHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        });
      }
    } catch (e) {
      console.error('review error', e);
    }
    setProcessingId(null);
    loadData();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-700">Error: {error}</p>
      </div>
    </div>
  );

  // Calculate metrics per AM
  const getAMMetrics = (amId) => {
    try {
    const amSubs = submissions.filter(s => s.submitted_by === amId);
    const approved = amSubs.filter(s => s.status === 'approved');
    const pending = amSubs.filter(s => s.status === 'pending');
    const rejected = amSubs.filter(s => s.status === 'rejected');

    // Credit-building bonus calc
    const approvedCount = approved.length;
    let creditBonus = 0;
    if (approvedCount > 50) creditBonus = (approvedCount - 50) * 10 + 15 * 8 + 15 * 6;
    else if (approvedCount > 35) creditBonus = (approvedCount - 35) * 8 + 15 * 6;
    else if (approvedCount > 20) creditBonus = (approvedCount - 20) * 6;

    // Reviews
    const amReviews = reviews.filter(r => r.assigned_to === amId);
    const reviewCount = amReviews.length;
    const bbbReviews = amReviews.filter(r => (r.location_name || '').toLowerCase().includes('bbb')).length;
    const reviewBonus = Math.max(0, reviewCount - 10) * 5 + bbbReviews * 50;

    // Placeholders for API-driven metrics
    const amUser = (users || []).find(u => u.id === amId);
    const amName = amUser?.name || '';
    
    // Stall rate from Pipedrive
    let stallRate = null, stallCount = 0, stallTotal = 0, stalledClients = [];
    let paymentStallRate = null, paymentStallCount = 0;
    if (stallData?.accountManagers) {
      // Match AM name to Pipedrive data
      const match = Object.entries(stallData.accountManagers).find(([key]) => 
        amName && (key.toLowerCase().includes(amName.split(' ')[0].toLowerCase()) || amName.toLowerCase().includes(key.split(' ')[0].toLowerCase()))
      );
      if (match) {
        const [, sd] = match;
        stallRate = sd.reportStallRate;
        stallCount = sd.reportStalled;
        stallTotal = sd.totalClients;
        stalledClients = sd.stalledClients || [];
        paymentStallRate = sd.paymentStallRate;
        paymentStallCount = sd.paymentStalled;
      }
    }

    // Additional rounds (paid $299) — live from Zoho + Pipedrive attribution
    let additionalRounds = null, roundsBonus = 0, roundDeals = [];
    if (roundsData?.byAM) {
      const rMatch = Object.entries(roundsData.byAM).find(([key]) =>
        amName && (key.toLowerCase().includes(amName.split(' ')[0].toLowerCase()) || amName.toLowerCase().includes(key.split(' ')[0].toLowerCase()))
      );
      if (rMatch) {
        additionalRounds = rMatch[1].count;
        roundDeals = rMatch[1].deals || [];
      } else {
        additionalRounds = 0;
      }
      // Tiers: standard 5/mo. 6-10 = $25, 11-15 = $35, 16+ = $50 each.
      const c = additionalRounds || 0;
      if (c > 15) roundsBonus = 5 * 25 + 5 * 35 + (c - 15) * 50;
      else if (c > 10) roundsBonus = 5 * 25 + (c - 10) * 35;
      else if (c > 5) roundsBonus = (c - 5) * 25;
    }

    // Referrals — live once the referral field is configured
    let referrals = null, referralBonus = 0, referralNeedsConfig = false;
    if (referralData) {
      if (referralData.needsConfig) {
        referralNeedsConfig = true;
      } else if (referralData.byAM) {
        const fMatch = Object.entries(referralData.byAM).find(([key]) =>
          amName && (key.toLowerCase().includes(amName.split(' ')[0].toLowerCase()) || amName.toLowerCase().includes(key.split(' ')[0].toLowerCase()))
        );
        referrals = fMatch ? fMatch[1].count : 0;
        // Standard 15/mo. $20 each through 8 qualified, $30 each above 8.
        const q = referrals || 0;
        if (q > 8) referralBonus = 8 * 20 + (q - 8) * 30;
        else referralBonus = q * 20;
      }
    }

    // Stall rate bonus
    let stallBonus = 0;
    if (stallRate !== null) {
      if (stallRate <= 5) stallBonus = 250;
      else if (stallRate <= 10) stallBonus = 150;
      else if (stallRate <= 18) stallBonus = 75;
    }

    const totalBonus = creditBonus + reviewBonus + stallBonus + roundsBonus + referralBonus;

    return {
      approvedCount, pending: pending.length, rejected: rejected.length,
      creditBonus, submissions: amSubs, approvedSubs: approved,
      reviewCount, bbbReviews, reviewBonus,
      stallRate, stallCount, stallTotal, stalledClients, stallBonus,
      additionalRounds, roundsBonus, roundDeals,
      referrals, referralBonus, referralNeedsConfig,
      paymentStallRate, paymentStallCount,
      totalBonus
    };
    } catch(e) {
      console.error('getAMMetrics error:', e);
      return { approvedCount: 0, pending: 0, rejected: 0, creditBonus: 0, submissions: [], approvedSubs: [], reviewCount: 0, bbbReviews: 0, reviewBonus: 0, stallRate: null, stallCount: 0, stallTotal: 0, stalledClients: [], stallBonus: 0, additionalRounds: null, roundsBonus: 0, roundDeals: [], referrals: null, referralBonus: 0, referralNeedsConfig: false, paymentStallRate: null, paymentStallCount: 0, totalBonus: 0 };
    }
  };

  const currentAMMetrics = selectedAM ? getAMMetrics(selectedAM) : null;
  const currentAMName = (users || []).find(u => u.id === selectedAM)?.name || 'Unknown';

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Account Manager Bonus Tracker</h1>
          <p className="text-sm text-slate-500">{selectedMonth === new Date().toISOString().slice(0, 7) ? 'Current Month' : selectedMonth} — Effective July 1, 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm text-slate-700 bg-white" />
          {isAdmin && amList.length > 0 && (
            <select value={selectedAM || ''} onChange={e => setSelectedAM(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm font-medium">
              {amList.map(am => (
                <option key={am.id} value={am.id}>{am.name}</option>
              ))}
            </select>
          )}
          <button onClick={loadData} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-100 rounded-lg p-1 flex gap-1">
        <button onClick={() => setTab('dashboard')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'dashboard' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          <Trophy size={16} /> Dashboard
        </button>
        <button onClick={() => setTab('credit-building')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'credit-building' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          <TrendingUp size={16} /> Credit Building
        </button>
        {isAdmin && (
          <button onClick={() => setTab('approvals')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'approvals' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
            <ShieldCheck size={16} /> Approvals {submissions.filter(s => s.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{submissions.filter(s => s.status === 'pending').length}</span>
            )}
          </button>
        )}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && !currentAMMetrics && (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
          <p className="text-slate-500">Select an Account Manager to view their bonus dashboard.</p>
        </div>
      )}
      {tab === 'dashboard' && currentAMMetrics && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <TrendingUp size={18} className="text-blue-500 mb-2" />
              <p className="text-3xl font-bold text-slate-800">{currentAMMetrics.approvedCount}</p>
              <p className="text-sm text-slate-500"><Tip text="Approved credit-building product signups this month. Standard: 20. Bonus starts at 21+.">Credit Building Signups</Tip></p>
              {currentAMMetrics.approvedCount < 20 && <p className="text-xs text-blue-500 mt-1">{20 - currentAMMetrics.approvedCount} to meet standard</p>}
              {currentAMMetrics.approvedCount >= 20 && <p className="text-xs text-green-500 mt-1">Standard met! {currentAMMetrics.approvedCount - 20} earning bonus</p>}
            </div>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <Clock size={18} className={currentAMMetrics.stallRate !== null ? (currentAMMetrics.stallRate <= 30 ? 'text-green-500 mb-2' : 'text-red-500 mb-2') : 'text-amber-500 mb-2'} />
              <p className="text-3xl font-bold">{currentAMMetrics.stallRate !== null ? currentAMMetrics.stallRate + '%' : '--'}</p>
              <p className="text-sm text-slate-500"><Tip text="Percentage of clients waiting 14+ days for action (reports not pulled after round end). Under 30% through August, under 20% starting September. Qualifies all bonuses.">Report Stall Rate</Tip></p>
              {currentAMMetrics.stallRate !== null && <p className="text-xs mt-1">{currentAMMetrics.stallCount} of {currentAMMetrics.stallTotal} clients stalled</p>}
              {currentAMMetrics.stallRate === null && <p className="text-xs text-slate-400 mt-1">Loading from Pipedrive...</p>}
            </div>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <Repeat size={18} className={currentAMMetrics.additionalRounds !== null ? 'text-purple-500 mb-2' : 'text-slate-300 mb-2'} />
              <p className="text-3xl font-bold text-slate-800">{currentAMMetrics.additionalRounds !== null ? currentAMMetrics.additionalRounds : '--'}</p>
              <p className="text-sm text-slate-500"><Tip text="Additional rounds ($299) sold to in-service clients, counted from paid Zoho payments. Standard: 5/month. Bonus at 6+: $25/$35/$50 per sale.">Additional Rounds</Tip></p>
              {currentAMMetrics.additionalRounds === null && <p className="text-xs text-slate-400 mt-1">Loading...</p>}
              {currentAMMetrics.additionalRounds !== null && currentAMMetrics.additionalRounds < 5 && <p className="text-xs text-purple-500 mt-1">{5 - currentAMMetrics.additionalRounds} to standard</p>}
              {currentAMMetrics.additionalRounds !== null && currentAMMetrics.additionalRounds >= 5 && <p className="text-xs text-green-500 mt-1">Standard met</p>}
            </div>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <Star size={18} className="text-yellow-500 mb-2" />
              <p className="text-3xl font-bold text-slate-800">{currentAMMetrics.reviewCount}</p>
              <p className="text-sm text-slate-500"><Tip text="Client reviews assigned this month. Standard: 10. $5 per review above 10. BBB reviews earn $50 each.">Client Reviews</Tip></p>
              {currentAMMetrics.reviewCount < 10 && <p className="text-xs text-amber-500 mt-1">{10 - currentAMMetrics.reviewCount} to meet standard</p>}
            </div>
          </div>

          {/* Bonus Breakdown */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-bold text-slate-800">Bonus Breakdown — {currentAMName}</h3>
              <p className="text-sm text-slate-500">Base Pay: $1,500/month + bonuses below</p>
            </div>
            <div className="divide-y">

              {/* 1. Credit Building */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={20} className={currentAMMetrics.creditBonus > 0 ? 'text-blue-500' : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Getting clients into secured cards, builder loans, etc. No cap. 21-35: $6/signup, 36-50: $8/signup, 51+: $10/signup. Self-funding — company earns $15-$25 per approved signup.">Credit-Building Products</Tip></p>
                      <p className="text-sm text-slate-500">{currentAMMetrics.approvedCount} approved ({currentAMMetrics.pending} pending)</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.creditBonus > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{fmt(currentAMMetrics.creditBonus)}</p>
                </div>
                {currentAMMetrics.approvedCount > 20 && (
                  <div className="mt-2 ml-8 text-sm text-slate-600">
                    {currentAMMetrics.approvedCount > 20 && currentAMMetrics.approvedCount <= 35 && <p>{currentAMMetrics.approvedCount - 20} signups at $6 = {fmt((currentAMMetrics.approvedCount - 20) * 6)}</p>}
                    {currentAMMetrics.approvedCount > 35 && currentAMMetrics.approvedCount <= 50 && <p>15 at $6 + {currentAMMetrics.approvedCount - 35} at $8 = {fmt(15 * 6 + (currentAMMetrics.approvedCount - 35) * 8)}</p>}
                    {currentAMMetrics.approvedCount > 50 && <p>15 at $6 + 15 at $8 + {currentAMMetrics.approvedCount - 50} at $10 = {fmt(currentAMMetrics.creditBonus)}</p>}
                  </div>
                )}
              </div>

              {/* 2. Stall Rate */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className={currentAMMetrics.stallRate !== null ? (currentAMMetrics.stallRate <= 30 ? 'text-green-500' : 'text-red-500') : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Clients waiting 14+ days for action divided by total active clients. Under 30% (through Aug) or 20% (Sep+) required to receive ALL bonuses. Tiers: 25%=full, 18%=+$75, 10%=+$150, 5%=+$250.">Report Stall Rate (Qualification + Bonus)</Tip></p>
                      <p className="text-sm text-slate-500">{currentAMMetrics.stallRate !== null ? `${currentAMMetrics.stallRate}% — ${currentAMMetrics.stallCount} of ${currentAMMetrics.stallTotal} clients` : 'Loading from Pipedrive...'}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.stallBonus > 0 ? 'text-green-600' : 'text-slate-300'}`}>{fmt(currentAMMetrics.stallBonus)}</p>
                </div>
                <div className="mt-2 ml-8 grid grid-cols-4 gap-2 text-xs text-center">
                  <div className={`p-2 rounded border ${currentAMMetrics.stallRate !== null && currentAMMetrics.stallRate <= 25 ? 'bg-green-100 border-green-300 font-bold' : 'bg-green-50 border-green-200'}`}><p className="font-bold">25%</p><p>Full bonuses</p></div>
                  <div className={`p-2 rounded border ${currentAMMetrics.stallRate !== null && currentAMMetrics.stallRate <= 18 ? 'bg-green-100 border-green-300 font-bold' : 'bg-green-50 border-green-200'}`}><p className="font-bold">18%</p><p>+$75</p></div>
                  <div className={`p-2 rounded border ${currentAMMetrics.stallRate !== null && currentAMMetrics.stallRate <= 10 ? 'bg-emerald-100 border-emerald-300 font-bold' : 'bg-emerald-50 border-emerald-200'}`}><p className="font-bold">10%</p><p>+$150</p></div>
                  <div className={`p-2 rounded border ${currentAMMetrics.stallRate !== null && currentAMMetrics.stallRate <= 5 ? 'bg-emerald-100 border-emerald-300 font-bold' : 'bg-emerald-50 border-emerald-200'}`}><p className="font-bold">5%</p><p>+$250</p></div>
                </div>
                {currentAMMetrics.stalledClients && currentAMMetrics.stalledClients.length > 0 && (
                  <details className="mt-2 ml-8">
                    <summary className="text-xs text-blue-500 cursor-pointer">View {currentAMMetrics.stallCount} stalled clients</summary>
                    <div className="mt-1 max-h-48 overflow-y-auto">
                      {currentAMMetrics.stalledClients.map((c, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-700">{c.name}</span>
                          <span className="text-red-500">{c.daysSince} days — {c.updateStatus}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* 3. Additional Rounds */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Repeat size={20} className={currentAMMetrics.roundsBonus > 0 ? 'text-purple-500' : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Two more rounds of credit repair ($299) sold to in-service clients, counted from paid Zoho payments and attributed to the assigned AM. Standard: 5/month. 6-10: $25 each, 11-15: $35 each, 16+: $50 each.">Additional Rounds ($299)</Tip></p>
                      <p className="text-sm text-slate-500">{currentAMMetrics.additionalRounds !== null ? `${currentAMMetrics.additionalRounds} paid (${currentAMMetrics.additionalRounds > 5 ? `${currentAMMetrics.additionalRounds - 5} earning bonus` : `${5 - currentAMMetrics.additionalRounds} to standard`})` : 'Loading from Zoho...'}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.roundsBonus > 0 ? 'text-purple-600' : 'text-slate-300'}`}>{currentAMMetrics.additionalRounds !== null ? fmt(currentAMMetrics.roundsBonus) : '--'}</p>
                </div>
                {currentAMMetrics.roundDeals && currentAMMetrics.roundDeals.length > 0 && (
                  <details className="mt-2 ml-8">
                    <summary className="text-xs text-purple-500 cursor-pointer">View {currentAMMetrics.roundDeals.length} paid rounds</summary>
                    <div className="mt-1 max-h-48 overflow-y-auto">
                      {currentAMMetrics.roundDeals.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-700">{d.client} <span className="text-slate-400">#{d.deal_id}</span></span>
                          <span className="text-slate-500">{fmt(d.amount)} — {d.date}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* 4. Referrals */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users size={20} className={currentAMMetrics.referralBonus > 0 ? 'text-indigo-500' : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Standard: 15 referrals/month. Referral signs up + pays doc fee = $20. Above 8 qualified = $30 each. Monthly top producer = extra $100.">Referrals</Tip></p>
                      <p className="text-sm text-slate-500">{currentAMMetrics.referralNeedsConfig ? 'Awaiting referral field setup' : (currentAMMetrics.referrals !== null ? `${currentAMMetrics.referrals} qualified (paid doc fee)` : 'Loading...')}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.referralBonus > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{(!currentAMMetrics.referralNeedsConfig && currentAMMetrics.referrals !== null) ? fmt(currentAMMetrics.referralBonus) : '--'}</p>
                </div>
              </div>

              {/* 5. Reviews */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Star size={20} className={currentAMMetrics.reviewBonus > 0 ? 'text-yellow-500' : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="10 reviews = meets standard. $5 per review above 10. BBB reviews that post publicly earn $50 each.">Client Reviews</Tip></p>
                      <p className="text-sm text-slate-500">{currentAMMetrics.reviewCount} reviews ({currentAMMetrics.reviewCount >= 10 ? `${currentAMMetrics.reviewCount - 10} earning bonus` : `${10 - currentAMMetrics.reviewCount} to standard`}){currentAMMetrics.bbbReviews > 0 ? ` + ${currentAMMetrics.bbbReviews} BBB` : ''}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.reviewBonus > 0 ? 'text-yellow-600' : 'text-slate-300'}`}>{fmt(currentAMMetrics.reviewBonus)}</p>
                </div>
              </div>

              {/* 6. CSAT */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className="text-slate-300" />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Post-service survey measuring client satisfaction. 90%+ required. Implementation delayed until 90 days after full program launch.">CSAT (Client Satisfaction)</Tip></p>
                      <p className="text-sm text-slate-500">Delayed — begins 90 days after full implementation</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-slate-300">--</p>
                </div>
              </div>

              {/* 7. All-Star */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award size={20} className="text-slate-300" />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="$100 to the AM who finishes as top performer across Engine (credit building, stall rate, rounds) and Quality (referrals, reviews) categories while maintaining strong CSAT and CRM accuracy.">All-Star Performance Bonus</Tip></p>
                      <p className="text-sm text-slate-500">Top performer across all categories</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-slate-300">$100.00</p>
                </div>
              </div>

              {/* Total */}
              <div className="p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800 text-lg">Total Bonus (so far)</p>
                    <p className="text-sm text-slate-500">Live: credit building, stall rate, rounds, reviews. Referrals add once the referral field is configured.</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{fmt(currentAMMetrics.totalBonus)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Base Pay + Bonus</span>
                  <span className="font-bold">{fmt(1500 + currentAMMetrics.totalBonus)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Building Tab */}
      {tab === 'credit-building' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Credit-Building Product Submissions</h3>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={16} /> Submit New Signup
            </button>
          </div>

          {/* Submission Form */}
          {showForm && (
            <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
              <div>
                <h4 className="font-medium text-slate-800">New Credit-Building Submission</h4>
                <p className="text-xs text-slate-500">One product per submission. Submit each approved product separately so each gets its own proof and its own Pipedrive note.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Client Name *</label>
                  <input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="John Smith" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Pipedrive Deal ID</label>
                  <input type="text" value={formData.pipedrive_deal_id} onChange={e => setFormData({...formData, pipedrive_deal_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="123456" />
                  <p className="text-[11px] text-slate-400 mt-1">Needed to post the approval note to the deal.</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Product Name *</label>
                  <input type="text" value={formData.product_name} onChange={e => setFormData({...formData, product_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Self Secured Card, Builder Loan, etc." />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Proof Description</label>
                  <input type="text" value={formData.proof_description} onChange={e => setFormData({...formData, proof_description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Screenshot shows approval confirmation" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Proof Screenshot</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                    <Upload size={16} /> {proofFile ? 'Change image' : 'Choose image'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                  </label>
                  {proofFile && <span className="text-xs text-slate-500 truncate max-w-[200px]">{proofFile.name}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submitCreditBuilding} disabled={!formData.client_name || !formData.product_name || uploading}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">{uploading ? 'Uploading...' : 'Submit'}</button>
                <button onClick={() => { setShowForm(false); setProofFile(null); }} className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300">Cancel</button>
              </div>
            </div>
          )}

          {/* Submissions List */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Proof</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {submissions.filter(s => !isAdmin ? s.submitted_by === currentUser?.id : true).map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.client_name}</p>
                      {s.pipedrive_deal_id && <p className="text-xs text-slate-400">Deal #{s.pipedrive_deal_id}</p>}
                    </td>
                    <td className="px-4 py-3">{s.product_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      <div className="flex items-center gap-2">
                        {s.proof_image_url ? (
                          <img src={s.proof_image_url} alt="proof" onClick={() => setViewerUrl(s.proof_image_url)}
                            className="w-10 h-10 object-cover rounded border cursor-pointer hover:opacity-80" />
                        ) : <span className="text-slate-300"><ImageIcon size={16} /></span>}
                        <span>{s.proof_description || '--'}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        s.status === 'approved' ? 'bg-green-100 text-green-700' :
                        s.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No submissions yet this month</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Approvals Tab */}
      {tab === 'approvals' && isAdmin && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800">Pending Approvals ({submissions.filter(s => s.status === 'pending').length})</h3>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3">Submitted By</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Proof</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {submissions.filter(s => s.status === 'pending').map(s => {
                  const submitter = (users || []).find(u => u.id === s.submitted_by);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{submitter?.name || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <p>{s.client_name}</p>
                        {s.pipedrive_deal_id && <p className="text-xs text-slate-400">Deal #{s.pipedrive_deal_id}</p>}
                      </td>
                      <td className="px-4 py-3">{s.product_name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          {s.proof_image_url ? (
                            <img src={s.proof_image_url} alt="proof" onClick={() => setViewerUrl(s.proof_image_url)}
                              className="w-14 h-14 object-cover rounded border cursor-pointer hover:opacity-80" />
                          ) : <span className="text-slate-300 flex items-center gap-1"><ImageIcon size={16} /> none</span>}
                          <span>{s.proof_description || ''}</span>
                        </div>
                      </td>
                      <td className="text-center px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => reviewSubmission(s.id, 'approve')} disabled={processingId === s.id}
                            className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs disabled:opacity-50">
                            <Check size={14} /> {processingId === s.id ? 'Working...' : 'Approve'}
                          </button>
                          <button onClick={() => reviewSubmission(s.id, 'reject')} disabled={processingId === s.id}
                            className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs disabled:opacity-50">
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {submissions.filter(s => s.status === 'pending').length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No pending approvals</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Proof image viewer */}
      {viewerUrl && (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4" onClick={() => setViewerUrl(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewerUrl(null)} className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg"><X size={18} /></button>
            <img src={viewerUrl} alt="proof full" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            <a href={viewerUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-white text-sm hover:underline"><ExternalLink size={14} /> Open original</a>
          </div>
        </div>
      )}
    </div>
  );
}
