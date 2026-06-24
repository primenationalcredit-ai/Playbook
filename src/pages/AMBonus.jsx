import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import ReviewClaimQueue from '../components/ReviewClaimQueue';
import { supabase } from '../lib/supabase';
import { Trophy, Star, RefreshCw, Plus, Check, X, ShieldCheck, Users, Repeat, MessageSquare, Award, TrendingUp, Clock, Image as ImageIcon, ExternalLink, Upload, AlertTriangle, Mail, DollarSign } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
const DEAL_URL = (id) => `https://asapcreditrepair.pipedrive.com/deal/${id}`;
const PERSON_URL = (id) => `https://asapcreditrepair.pipedrive.com/person/${id}`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); if (!y || !m || !d) return s; return `${MONTHS[parseInt(m,10)-1]} ${parseInt(d,10)}`; };

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
  const [paymentsData, setPaymentsData] = useState(null);
  const [csatData, setCsatData] = useState(null);
  const [surveyResponses, setSurveyResponses] = useState([]);
  const [surveySends, setSurveySends] = useState([]);
  const [resendingId, setResendingId] = useState(null);
  const [csatOpen, setCsatOpen] = useState(false);
  const [openCsatResp, setOpenCsatResp] = useState(null);
  const [openResponseId, setOpenResponseId] = useState(null);
  const [agreementData, setAgreementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [breakdown, setBreakdown] = useState(null); // {amName, metric, m}
  const [uploading, setUploading] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [formData, setFormData] = useState({ client_name: '', pipedrive_deal_id: '', product_name: '', proof_description: '', account_manager_id: '' });
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

      // Reviews. Credit follows the month the review was LEFT (review_date), not when it was claimed
      // or approved. Reviews with no review_date fall back to the month the row was created.
      try {
        const [ry, rm] = selectedMonth.split('-').map(Number);
        const nm = new Date(ry, rm, 1);
        const nextMonthStart = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}-01`;
        const revFilter = `or=(and(review_date.gte.${monthStart},review_date.lt.${nextMonthStart}),and(review_date.is.null,created_at.gte.${monthStart},created_at.lt.${nextMonthStart}))`;
        const revRes = await fetch(`${SUPABASE_URL}/rest/v1/incoming_reviews?${revFilter}&select=*`, { headers: supaHeaders });
        if (revRes.ok) setReviews(await revRes.json());
      } catch(e) {}

      // Stall rate from Pipedrive — load separately, don't block page
      fetch('/.netlify/functions/am-stall-rate').then(r => r.ok ? r.json() : null).then(d => { if (d) setStallData(d); }).catch(() => {});

      // Additional rounds (paid $299) per AM — non-blocking
      fetch(`/.netlify/functions/am-additional-rounds?month=${selectedMonth}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setRoundsData(d); }).catch(() => {});

      // Referrals per AM — non-blocking (returns needsConfig until field is set)
      fetch(`/.netlify/functions/am-referrals?month=${selectedMonth}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setReferralData(d); }).catch(() => {});
      fetch(`/.netlify/functions/am-payments-summary?month=${selectedMonth}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setPaymentsData(d); }).catch(() => {});
      fetch(`/.netlify/functions/am-csat?month=${selectedMonth}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setCsatData(d); }).catch(() => {});
      // Raw Round 2 survey responses (for the per-client survey view)
      fetch(`${SUPABASE_URL}/rest/v1/client_surveys?survey_type=eq.round2_am&order=created_at.desc&select=*`, { headers: supaHeaders })
        .then(r => r.ok ? r.json() : null).then(d => { if (d) setSurveyResponses(d); }).catch(() => {});
      // Actual sends (exclude backlog_seed dedupe markers) — powers the sent list + resend
      fetch(`${SUPABASE_URL}/rest/v1/survey_sends?source=neq.backlog_seed&order=sent_at.desc&select=*`, { headers: supaHeaders })
        .then(r => r.ok ? r.json() : null).then(d => { if (d) setSurveySends(d); }).catch(() => {});

      // Agreement dates kept — visibility only, non-blocking (data starts at autobilling launch)
      fetch('/.netlify/functions/am-agreement-dates').then(r => r.ok ? r.json() : null).then(d => { if (d) setAgreementData(d); }).catch(() => {});

      if (!selectedAM) {
        if (isAdmin) setSelectedAM('ALL');
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
        account_manager_id: formData.account_manager_id || selectedAM || currentUser?.id,
        submission_month: selectedMonth,
        status: 'pending'
      };
      await fetch(`${SUPABASE_URL}/rest/v1/credit_building_submissions`, {
        method: 'POST', headers: { ...supaHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(body)
      });
      setFormData({ client_name: '', pipedrive_deal_id: '', product_name: '', proof_description: '', account_manager_id: '' });
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
    const amSubs = submissions.filter(s => (s.account_manager_id || s.submitted_by) === amId);
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
    
    let stallRate = null, stallCount = 0, stallTotal = 0, stalledClients = [], healthyInWindow = [];
    let paymentStallRate = null, paymentStallCount = 0;
    let pastDueRate = null, pastDueCount = 0, crsBook = 0, pastDueClients = [], crsHealthy = [], overallRate = null;
    if (stallData?.accountManagers) {
      // Match AM name to Pipedrive data
      const match = Object.entries(stallData.accountManagers).find(([key]) => 
        amName && (key.toLowerCase().includes(amName.split(' ')[0].toLowerCase()) || amName.toLowerCase().includes(key.split(' ')[0].toLowerCase()))
      );
      if (match) {
        const [, sd] = match;
        stallRate = sd.reportStallRateNull ? null : sd.reportStallRate;
        stallCount = sd.reportStalled;
        stallTotal = sd.totalClients;
        stalledClients = sd.stalledClients || [];
        healthyInWindow = sd.healthyInWindow || [];
        paymentStallRate = sd.paymentStallRate;
        paymentStallCount = sd.paymentStalled;
        pastDueRate = sd.paymentPastDueRateNull ? null : (sd.paymentPastDueRate ?? null);
        pastDueCount = sd.paymentPastDue || 0;
        crsBook = sd.crsBook || 0;
        pastDueClients = sd.pastDueClients || [];
        crsHealthy = sd.crsHealthy || [];
        overallRate = sd.overallNull ? null : (sd.overall ?? null);
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

    // Referrals — organization-based, live once an Org ID is set per AM
    let referrals = null, referralPaid = null, referralBonus = 0, referralNeedsConfig = false, referralTopProducer = false, referralDeals = [];
    if (referralData) {
      if (referralData.needsConfig) {
        referralNeedsConfig = true;
      } else if (referralData.byAM) {
        const fMatch = Object.entries(referralData.byAM).find(([key]) =>
          amName && (key.toLowerCase().includes(amName.split(' ')[0].toLowerCase()) || amName.toLowerCase().includes(key.split(' ')[0].toLowerCase()))
        );
        if (fMatch) {
          referrals = fMatch[1].referrals;
          referralPaid = fMatch[1].paid;
          referralBonus = fMatch[1].bonus;
          referralTopProducer = fMatch[1].isTopProducer;
          referralDeals = fMatch[1].deals || [];
        } else { referrals = 0; referralPaid = 0; }
      }
    }

    // Agreement dates kept — VISIBILITY ONLY, never added to totalBonus
    let agreementPctKept = null, agreementKept = null, agreementTotal = null, agreementNeedsData = false;
    if (agreementData) {
      if (agreementData.needsData) {
        agreementNeedsData = true;
      } else if (agreementData.byAM) {
        const aMatch = Object.entries(agreementData.byAM).find(([key]) =>
          amName && (key.toLowerCase().includes(amName.split(' ')[0].toLowerCase()) || amName.toLowerCase().includes(key.split(' ')[0].toLowerCase()))
        );
        if (aMatch) { agreementPctKept = aMatch[1].pctKept; agreementKept = aMatch[1].kept; agreementTotal = aMatch[1].total; }
      }
    }

    // Stall rate bonus
    // Stall rate bonus — Ladder B (aspirational). Lower stall = higher bonus.
    // Requires at least 15 evaluated (in-window) clients to qualify.
    let stallBonus = 0;
    const stallEligible = stallTotal >= 15;
    if (stallRate !== null && stallEligible) {
      if (stallRate <= 20) stallBonus = 250;
      else if (stallRate <= 30) stallBonus = 150;
      else if (stallRate <= 40) stallBonus = 75;
    }

    // CSAT (Round 2 survey) — score only, no bonus until tiers are calibrated
    let csatAvg = null, csatResponses = 0, csatEligible = false, csatOverall = null;
    if (csatData?.byAM) {
      const cMatch = Object.entries(csatData.byAM).find(([key]) =>
        amName && (key.toLowerCase().includes(amName.split(' ')[0].toLowerCase()) || amName.toLowerCase().includes(key.split(' ')[0].toLowerCase()))
      );
      if (cMatch) { csatAvg = cMatch[1].avgRating; csatResponses = cMatch[1].responses; csatEligible = cMatch[1].eligible; csatOverall = cMatch[1].avgOverall; }
    }
    // Additional-round invoices that are past due, for this AM to follow up on.
    let pastDueRounds = [];
    if (roundsData?.pastDueRounds && amName) {
      const fn = amName.split(' ')[0].toLowerCase();
      pastDueRounds = roundsData.pastDueRounds.filter(r => {
        const k = (r.am || '').toLowerCase();
        return k.includes(fn) || amName.toLowerCase().includes((k.split(' ')[0] || '\0'));
      });
    }
    const totalBonus = creditBonus + reviewBonus + stallBonus + roundsBonus + referralBonus;

    return {
      approvedCount, pending: pending.length, rejected: rejected.length,
      creditBonus, submissions: amSubs, approvedSubs: approved,
      reviewCount, bbbReviews, reviewBonus,
      reviewList: amReviews.map(r => ({ reviewer: r.reviewer_name, location: r.location_name, rating: r.rating, text: r.review_text, dealId: r.pipedrive_deal_id || null, date: r.review_date || r.created_at })),
      stallRate, stallCount, stallTotal, stalledClients, healthyInWindow, stallBonus,
      additionalRounds, roundsBonus, roundDeals, pastDueRounds,
      referrals, referralPaid, referralBonus, referralNeedsConfig, referralTopProducer, referralDeals,
      csatAvg, csatResponses, csatEligible, csatOverall,
      agreementPctKept, agreementKept, agreementTotal, agreementNeedsData,
      paymentStallRate, paymentStallCount,
      pastDueRate, pastDueCount, crsBook, pastDueClients, crsHealthy, overallRate,
      totalBonus
    };
    } catch(e) {
      console.error('getAMMetrics error:', e);
      return { approvedCount: 0, pending: 0, rejected: 0, creditBonus: 0, submissions: [], approvedSubs: [], reviewCount: 0, bbbReviews: 0, reviewBonus: 0, reviewList: [], stallRate: null, stallCount: 0, stallTotal: 0, stalledClients: [], healthyInWindow: [], stallBonus: 0, additionalRounds: null, roundsBonus: 0, roundDeals: [], referrals: null, referralPaid: null, referralBonus: 0, referralNeedsConfig: false, referralTopProducer: false, referralDeals: [], csatAvg: null, csatResponses: 0, csatEligible: false, csatOverall: null, agreementPctKept: null, agreementKept: null, agreementTotal: null, agreementNeedsData: false, paymentStallRate: null, paymentStallCount: 0, pastDueRate: null, pastDueCount: 0, crsBook: 0, pastDueClients: [], crsHealthy: [], overallRate: null, totalBonus: 0 };
    }
  };

  const currentAMMetrics = selectedAM ? getAMMetrics(selectedAM) : null;
  const currentAMName = (users || []).find(u => u.id === selectedAM)?.name || 'Unknown';
  const myResponses = (surveyResponses || []).filter(r => {
    const key = (r.am_name || '').toLowerCase();
    const nm = (currentAMName || '').toLowerCase();
    if (!key || !nm || nm === 'unknown') return false;
    return key.includes(nm.split(' ')[0]) || nm.includes(key.split(' ')[0]);
  });
  const isBad = (r) => (r.am_rating != null && r.am_rating <= 6) || (r.overall_satisfaction != null && r.overall_satisfaction <= 6);

  // Actual sends for this AM (latest per client), and which of those haven't responded
  const matchesAM = (name) => {
    const key = (name || '').toLowerCase();
    const nm = (currentAMName || '').toLowerCase();
    if (!key || !nm || nm === 'unknown') return false;
    return key.includes(nm.split(' ')[0]) || nm.includes(key.split(' ')[0]);
  };
  const mySendsMap = {};
  (surveySends || []).forEach(s => {
    if (!matchesAM(s.am_name)) return;
    const pid = String(s.person_id);
    if (!mySendsMap[pid] || new Date(s.sent_at) > new Date(mySendsMap[pid].sent_at)) mySendsMap[pid] = s;
  });
  const respondedPersonIds = new Set((surveyResponses || []).map(r => String(r.pipedrive_person_id)).filter(Boolean));
  const pendingSends = Object.values(mySendsMap)
    .filter(s => !respondedPersonIds.has(String(s.person_id)))
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

  // Unified per-AM survey list: every send + every response, merged by person.
  // Each row is either completed (has a response, shows scores) or awaiting (Resend).
  const responsesByPerson = {};
  const responsesNoPerson = [];
  (myResponses || []).forEach(r => {
    const pid = r.pipedrive_person_id ? String(r.pipedrive_person_id) : null;
    if (pid) responsesByPerson[pid] = r; else responsesNoPerson.push(r);
  });
  const usedRespPids = new Set();
  const unifiedSurveys = [];
  Object.values(mySendsMap).forEach(s => {
    const pid = String(s.person_id);
    const resp = responsesByPerson[pid] || null;
    if (resp) usedRespPids.add(pid);
    unifiedSurveys.push({ key: 's-' + s.id, client_name: s.client_name || (resp && resp.client_name) || 'Client', sent_at: s.sent_at, send: s, response: resp });
  });
  Object.entries(responsesByPerson).forEach(([pid, r]) => {
    if (usedRespPids.has(pid)) return;
    unifiedSurveys.push({ key: 'r-' + r.id, client_name: r.client_name || 'Client', sent_at: null, send: null, response: r });
  });
  responsesNoPerson.forEach(r => {
    unifiedSurveys.push({ key: 'rn-' + r.id, client_name: r.client_name || 'Client', sent_at: null, send: null, response: r });
  });
  unifiedSurveys.sort((a, b) => new Date(b.sent_at || b.response?.created_at || 0) - new Date(a.sent_at || a.response?.created_at || 0));
  const sentCount = unifiedSurveys.length;
  const completedCount = unifiedSurveys.filter(u => u.response).length;
  const awaitingCount = sentCount - completedCount;

  const handleResend = async (send, channel) => {
    setResendingId(send.id + (channel ? ':' + channel : ''));
    try {
      await fetch('/.netlify/functions/resend-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ send_id: send.id, channel: channel || undefined }) });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/survey_sends?source=neq.backlog_seed&order=sent_at.desc&select=*`, { headers: supaHeaders });
      if (r.ok) setSurveySends(await r.json());
    } catch (e) {}
    setResendingId(null);
  };

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
          {isAM && amList.length > 0 && (
            <select value={selectedAM || ''} onChange={e => setSelectedAM(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm font-medium">
              <option value="ALL">All Account Managers</option>
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
        <button onClick={() => setTab('surveys')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'surveys' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          <MessageSquare size={16} /> Surveys
        </button>
        <button onClick={() => setTab('payments')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'payments' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          <DollarSign size={16} /> Payments
        </button>
        <button onClick={() => setTab('reviews')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'reviews' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          <Star size={16} /> Reviews
        </button>
        {isAdmin && (
          <button onClick={() => setTab('approvals')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'approvals' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
            <ShieldCheck size={16} /> Approvals {submissions.filter(s => s.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{submissions.filter(s => s.status === 'pending').length}</span>
            )}
          </button>
        )}
      </div>

      {/* All Account Managers overview (admins) */}
      {tab === 'dashboard' && selectedAM === 'ALL' && (() => {
        const rows = (amList || []).map(am => ({ am, m: getAMMetrics(am.id) }));
        const sum = (f) => rows.reduce((t, r) => t + (Number(r.m?.[f]) || 0), 0);
        const fmtPct = (v) => v == null ? '—' : `${Math.round(v)}%`;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <Users size={18} className="text-blue-500 mb-2" />
                <p className="text-3xl font-bold text-slate-800">{rows.length}</p>
                <p className="text-sm text-slate-500">Account Managers</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <TrendingUp size={18} className="text-blue-500 mb-2" />
                <p className="text-3xl font-bold text-slate-800">{sum('approvedCount')}</p>
                <p className="text-sm text-slate-500">Credit Building Signups</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <Repeat size={18} className="text-purple-500 mb-2" />
                <p className="text-3xl font-bold text-slate-800">{sum('additionalRounds')}</p>
                <p className="text-sm text-slate-500">Additional Rounds</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <Award size={18} className="text-green-600 mb-2" />
                <p className="text-3xl font-bold text-green-600">{fmt(sum('totalBonus'))}</p>
                <p className="text-sm text-slate-500">Total Bonus (all AMs)</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">All Account Managers — {selectedMonth === new Date().toISOString().slice(0, 7) ? 'this month' : selectedMonth}</h3>
                <p className="text-xs text-slate-500">Every AM's numbers at a glance. Click a name to open their full dashboard.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Account Manager</th>
                      <th className="px-4 py-2 font-medium text-center">Credit Signups</th>
                      <th className="px-4 py-2 font-medium text-center">Stall Rate</th>
                      <th className="px-4 py-2 font-medium text-center">Past Due</th>
                      <th className="px-4 py-2 font-medium text-center">Overall</th>
                      <th className="px-4 py-2 font-medium text-center">Add'l Rounds</th>
                      <th className="px-4 py-2 font-medium text-center">Referrals</th>
                      <th className="px-4 py-2 font-medium text-center">Reviews</th>
                      <th className="px-4 py-2 font-medium text-center">CSAT</th>
                      <th className="px-4 py-2 font-medium text-right">Total Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(({ am, m }) => (
                      <tr key={am.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedAM(am.id)} className="font-medium text-asap-blue hover:underline">{am.name}</button>
                        </td>
                        <td className="px-4 py-3 text-center">{m?.approvedCount ?? 0}</td>
                        <td className="px-4 py-3 text-center">{m?.stallRate == null ? '—' : (
                          <button onClick={() => setBreakdown({ amName: am.name, metric: 'stall', m })} className="text-asap-blue hover:underline font-medium">{fmtPct(m.stallRate)}</button>
                        )}</td>
                        <td className="px-4 py-3 text-center">{m?.pastDueRate == null ? '—' : (
                          <button onClick={() => setBreakdown({ amName: am.name, metric: 'pastdue', m })} className="text-asap-blue hover:underline font-medium">{fmtPct(m.pastDueRate)}</button>
                        )}</td>
                        <td className="px-4 py-3 text-center">{m?.overallRate == null ? '—' : (
                          <button onClick={() => setBreakdown({ amName: am.name, metric: 'overall', m })} className="text-asap-blue hover:underline font-medium">{fmtPct(m.overallRate)}</button>
                        )}</td>
                        <td className="px-4 py-3 text-center">{m?.additionalRounds ?? 0}</td>
                        <td className="px-4 py-3 text-center">{m?.referrals ?? 0}{m?.referralPaid != null ? ` (${m.referralPaid} paid)` : ''}</td>
                        <td className="px-4 py-3 text-center">{m?.reviewCount ?? 0}</td>
                        <td className="px-4 py-3 text-center">{m?.csatResponses ? `${m.csatAvg ?? '—'}/10` : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(m?.totalBonus || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-4 py-3">Totals</td>
                      <td className="px-4 py-3 text-center">{sum('approvedCount')}</td>
                      <td className="px-4 py-3 text-center">—</td>
                      <td className="px-4 py-3 text-center">—</td>
                      <td className="px-4 py-3 text-center">—</td>
                      <td className="px-4 py-3 text-center">{sum('additionalRounds')}</td>
                      <td className="px-4 py-3 text-center">{sum('referrals')}</td>
                      <td className="px-4 py-3 text-center">{sum('reviewCount')}</td>
                      <td className="px-4 py-3 text-center">—</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt(sum('totalBonus'))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dashboard Tab */}
      {tab === 'dashboard' && selectedAM !== 'ALL' && !currentAMMetrics && (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
          <p className="text-slate-500">Select an Account Manager to view their bonus dashboard.</p>
        </div>
      )}
      {tab === 'dashboard' && selectedAM !== 'ALL' && currentAMMetrics && (
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
              <Clock size={18} className={currentAMMetrics.stallRate !== null ? (currentAMMetrics.stallRate <= 40 ? 'text-green-500 mb-2' : 'text-red-500 mb-2') : 'text-amber-500 mb-2'} />
              <p className="text-3xl font-bold">{currentAMMetrics.stallRate !== null ? currentAMMetrics.stallRate + '%' : '--'}</p>
              <p className="text-sm text-slate-500"><Tip text="Clients still in Logins Not Ready 14 or more days after their latest round ended, among clients who started a round in the last 90 days. Lower is better. Bonus tiers: 40% or below earns $75, 30% earns $150, 20% earns $250. Needs at least 15 in-window clients to qualify.">Report Stall Rate</Tip></p>
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
                {currentAMMetrics.submissions && currentAMMetrics.submissions.length > 0 && (
                  <details className="mt-2 ml-8">
                    <summary className="text-xs text-blue-500 cursor-pointer">View {currentAMMetrics.submissions.length} signup{currentAMMetrics.submissions.length === 1 ? '' : 's'} ({currentAMMetrics.approvedCount} approved · {currentAMMetrics.pending} pending)</summary>
                    <div className="mt-1 max-h-48 overflow-y-auto">
                      {currentAMMetrics.submissions.map((s, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100 gap-2">
                          <span className="text-slate-700">{s.client_name || s.client || 'Client'}{(s.product_name || s.product) ? <span className="text-slate-400"> · {s.product_name || s.product}</span> : ''}</span>
                          <span className={s.status === 'approved' ? 'text-green-600' : s.status === 'rejected' ? 'text-red-500' : 'text-amber-600'}>{s.status}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* 2. Stall Rate */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className={currentAMMetrics.stallRate !== null ? (currentAMMetrics.stallRate <= 40 ? 'text-green-500' : 'text-red-500') : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Among clients who started a round (1, 2, or 3) in the last 90 days, this is the share still sitting in Logins Not Ready 14 or more days after their latest round ended. Check Logins and payment statuses do not count. Lower is better. Bonus tiers: 40% or below earns $75, 30% or below earns $150, 20% or below earns $250. Needs at least 15 in-window clients to qualify.">Report Stall Rate (Bonus)</Tip></p>
                      <p className="text-xs text-slate-500 mt-0.5">Clients still in Logins Not Ready 14+ days past their round end, among clients who started a round in the last 90 days. Lower wins. Earns $75 at 40% or below, $150 at 30%, $250 at 20%.</p>
                      <p className="text-sm text-slate-500 mt-1">{currentAMMetrics.stallRate !== null ? <>{currentAMMetrics.stallRate}% — <span className="text-red-600 font-medium">{currentAMMetrics.stallCount} stalled</span> of {currentAMMetrics.stallTotal} in-window clients</> : 'Loading from Pipedrive...'}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.stallBonus > 0 ? 'text-green-600' : 'text-slate-300'}`}>{fmt(currentAMMetrics.stallBonus)}</p>
                </div>
                {currentAMMetrics.stallRate !== null && (() => {
                  const r = currentAMMetrics.stallRate;
                  const eligible = currentAMMetrics.stallTotal >= 15;
                  const tiers = [{ thr: 40, amt: 75 }, { thr: 30, amt: 150 }, { thr: 20, amt: 250 }];
                  return (
                    <div className="mt-3 ml-8">
                      <p className="text-xs text-slate-600 mb-2">
                        {!eligible ? (
                          <>Needs 15+ in-window clients to qualify. Currently <span className="font-semibold text-slate-700">{currentAMMetrics.stallTotal}</span>.</>
                        ) : currentAMMetrics.stallBonus > 0 ? (
                          <>At <span className="font-semibold text-slate-800">{r}%</span> you're earning <span className="font-semibold text-green-600">+{fmt(currentAMMetrics.stallBonus)}</span>
                          {r > 30 ? <> · drop to 30% for +$150</> : r > 20 ? <> · drop to 20% for +$250</> : <> · top tier reached</>}</>
                        ) : (
                          <>At <span className="font-semibold text-slate-800">{r}%</span>, no stall bonus yet · get to 40% or below for +$75</>
                        )}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs text-center">
                        {tiers.map(t => {
                          const earned = eligible && currentAMMetrics.stallBonus === t.amt;
                          return (
                            <div key={t.thr} className={earned
                              ? 'p-2 rounded-lg border-2 border-green-500 bg-green-50 ring-2 ring-green-200'
                              : 'p-2 rounded-lg border border-slate-200 bg-slate-50'}>
                              <p className={`font-bold ${earned ? 'text-green-700' : 'text-slate-500'}`}>{'\u2264'}{t.thr}%</p>
                              <p className={earned ? 'text-green-600 font-semibold' : 'text-slate-400'}>+${t.amt}</p>
                              {earned && <p className="text-[10px] text-green-600 font-semibold mt-0.5">You're here</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {currentAMMetrics.stallTotal > 0 && (
                  <details className="mt-3 ml-8">
                    <summary className="text-xs text-blue-600 cursor-pointer hover:underline">View breakdown · {currentAMMetrics.stallCount} stalled and {Math.max(0, currentAMMetrics.stallTotal - currentAMMetrics.stallCount)} on time</summary>
                    <div className="mt-2 space-y-3">
                      {(currentAMMetrics.stalledClients || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1">Stalled ({(currentAMMetrics.stalledClients || []).length})</p>
                          <div className="max-h-48 overflow-y-auto border border-red-100 rounded">
                            {(currentAMMetrics.stalledClients || []).map((c, i) => (
                              <div key={i} className="flex justify-between text-xs py-1 px-2 border-b border-slate-100 gap-2 last:border-b-0">
                                <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                                <span className="text-red-500 text-right">{c.roundEndDate ? `Round ended ${fmtDate(c.roundEndDate)} · ${c.daysSinceRoundEnd}d behind` : (c.daysSinceRoundEnd != null ? `${c.daysSinceRoundEnd}d past round end` : (c.reason || ''))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(currentAMMetrics.healthyInWindow || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wide mb-1">On time ({(currentAMMetrics.healthyInWindow || []).length})</p>
                          <div className="max-h-48 overflow-y-auto border border-green-100 rounded">
                            {(currentAMMetrics.healthyInWindow || []).map((c, i) => (
                              <div key={i} className="flex justify-between text-xs py-1 px-2 border-b border-slate-100 gap-2 last:border-b-0">
                                <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                                <span className="text-slate-500 text-right">{!c.roundEnded ? 'Round still open' : (c.roundEndDate ? `Round ended ${fmtDate(c.roundEndDate)}` : (c.daysSinceRoundEnd != null ? `${c.daysSinceRoundEnd}d past round end` : ''))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {/* 2b. Payment Past Due (separate health metric, not a bonus) */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign size={20} className={currentAMMetrics.pastDueRate !== null ? (currentAMMetrics.pastDueRate <= 20 ? 'text-green-500' : 'text-red-500') : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Active CRS clients with an invoice 5 to 30 days past its original due date and still owing, divided by the AM's active CRS book. The 5 day grace ignores payments in transit. Anything past 30 days drops off, since that client is a non-payer, not a collection miss. Tracked for health, not tied to a bonus.">Payment Past Due</Tip></p>
                      <p className="text-xs text-slate-500 mt-0.5">Active CRS clients with an invoice 5 to 30 days past its original due date. The 5 day grace ignores payments in transit. Past 30 days the client is a non-payer and drops off. Tracked for health, no bonus.</p>
                      <p className="text-sm text-slate-500 mt-1">{currentAMMetrics.pastDueRate !== null ? <>{currentAMMetrics.pastDueRate}% · <span className="text-red-600 font-medium">{currentAMMetrics.pastDueCount} past due</span> of {currentAMMetrics.crsBook} CRS clients</> : 'Loading from Pipedrive...'}</p>
                    </div>
                  </div>
                </div>
                {currentAMMetrics.crsBook > 0 && (
                  <details className="mt-3 ml-8">
                    <summary className="text-xs text-blue-600 cursor-pointer hover:underline">View breakdown · {currentAMMetrics.pastDueCount} past due and {Math.max(0, currentAMMetrics.crsBook - currentAMMetrics.pastDueCount)} current</summary>
                    <div className="mt-2 space-y-3">
                      {(currentAMMetrics.pastDueClients || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1">Past due ({(currentAMMetrics.pastDueClients || []).length})</p>
                          <div className="max-h-48 overflow-y-auto border border-red-100 rounded">
                            {(currentAMMetrics.pastDueClients || []).map((c, i) => (
                              <div key={i} className="flex justify-between text-xs py-1 px-2 border-b border-slate-100 gap-2 last:border-b-0">
                                <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                                <span className="text-red-500 text-right">{c.dueDate ? `Due ${fmtDate(c.dueDate)} · ${c.daysPastDue}d late${c.balance ? ` · $${c.balance}` : ''}` : 'past due'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(currentAMMetrics.crsHealthy || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wide mb-1">Current ({(currentAMMetrics.crsHealthy || []).length})</p>
                          <div className="max-h-48 overflow-y-auto border border-green-100 rounded">
                            {(currentAMMetrics.crsHealthy || []).map((c, i) => (
                              <div key={i} className="flex justify-between text-xs py-1 px-2 border-b border-slate-100 gap-2 last:border-b-0">
                                <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                                <span className="text-slate-500 text-right">paid or within 5 day grace</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {/* 2c. Overall health = average of report stall and payment past due */}
              <div className="p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={20} className={currentAMMetrics.overallRate !== null ? (currentAMMetrics.overallRate <= 30 ? 'text-green-500' : 'text-red-500') : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="The simple average of the Report Stall Rate and the Payment Past Due rate. Each rate is measured over its own group of clients, so the average blends both without bending either number. Lower is better. Tracked for health, not tied to a bonus.">Overall (stall + past due)</Tip></p>
                      <p className="text-xs text-slate-500 mt-0.5">Simple average of your Report Stall Rate and Payment Past Due rate. Lower wins. Tracked for health, no bonus.</p>
                      <p className="text-sm text-slate-500 mt-1">{currentAMMetrics.overallRate !== null ? <>Report stall {currentAMMetrics.stallRate ?? 0}% + past due {currentAMMetrics.pastDueRate ?? 0}%</> : 'Loading from Pipedrive...'}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.overallRate !== null ? (currentAMMetrics.overallRate <= 30 ? 'text-green-600' : 'text-red-500') : 'text-slate-300'}`}>{currentAMMetrics.overallRate !== null ? `${currentAMMetrics.overallRate}%` : '--'}</p>
                </div>
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
                          <span className="text-slate-700">{d.client} {d.deal_id && <a href={DEAL_URL(d.deal_id)} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">#{d.deal_id} ↗</a>}</span>
                          <span className="text-slate-500">{fmt(d.amount)} — {d.date}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {currentAMMetrics.pastDueRounds && currentAMMetrics.pastDueRounds.length > 0 && (
                  <details className="mt-2 ml-8" open>
                    <summary className="text-xs text-rose-500 cursor-pointer font-medium">{currentAMMetrics.pastDueRounds.length} additional round{currentAMMetrics.pastDueRounds.length === 1 ? '' : 's'} past due — follow up</summary>
                    <div className="mt-1 max-h-48 overflow-y-auto">
                      {currentAMMetrics.pastDueRounds.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-700">{d.client} {d.dealId && <a href={DEAL_URL(d.dealId)} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">↗</a>}</span>
                          <span className="text-rose-500">${d.balance} · {d.daysOverdue}d overdue ({d.dueDate})</span>
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
                      <p className="font-medium text-slate-800"><Tip text="Referred clients are placed under the AM's Pipedrive organization. $20 per referral that pays its doc fee this month; once 8 are paid, all paid that month count at $30. Top producer (most paid) gets +$100 if they also have 15+ referrals. The 15 minimum is the monthly standard.">Referrals {currentAMMetrics.referralTopProducer ? <span className="text-xs text-indigo-600 font-semibold">★ Top Producer</span> : ''}</Tip></p>
                      <p className="text-sm text-slate-500">{currentAMMetrics.referralNeedsConfig ? 'Set this AM\u2019s Pipedrive Org ID in Admin > Users' : (currentAMMetrics.referrals !== null ? `${currentAMMetrics.referrals} referrals \u00b7 ${currentAMMetrics.referralPaid} paid doc fee${currentAMMetrics.referrals < 15 ? ` \u00b7 ${15 - currentAMMetrics.referrals} to standard` : ''}` : 'Loading...')}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.referralBonus > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{(!currentAMMetrics.referralNeedsConfig && currentAMMetrics.referrals !== null) ? fmt(currentAMMetrics.referralBonus) : '--'}</p>
                </div>
                {currentAMMetrics.referralDeals && currentAMMetrics.referralDeals.length > 0 && (
                  <details className="mt-2 ml-8">
                    <summary className="text-xs text-indigo-500 cursor-pointer">View {currentAMMetrics.referralDeals.length} referred client{currentAMMetrics.referralDeals.length === 1 ? '' : 's'}</summary>
                    <div className="mt-1 max-h-48 overflow-y-auto">
                      {currentAMMetrics.referralDeals.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100 gap-2">
                          <span className="text-slate-700">{d.id ? <a href={DEAL_URL(d.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{d.title} ↗</a> : d.title}{d.added ? <span className="text-slate-400"> · {d.added}</span> : ''}</span>
                          <span className={d.paid ? 'text-green-600 font-medium' : 'text-slate-400'}>{d.paid ? 'paid doc fee' : 'not yet paid'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
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
                {currentAMMetrics.reviewList && currentAMMetrics.reviewList.length > 0 && (
                  <details className="mt-2 ml-8">
                    <summary className="text-xs text-yellow-600 cursor-pointer">View {currentAMMetrics.reviewList.length} review{currentAMMetrics.reviewList.length === 1 ? '' : 's'}</summary>
                    <div className="mt-1 max-h-56 overflow-y-auto space-y-1">
                      {currentAMMetrics.reviewList.map((rv, i) => (
                        <div key={i} className="text-xs py-1 border-b border-slate-100">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-700 font-medium">
                              {rv.dealId
                                ? <a href={DEAL_URL(rv.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{rv.reviewer || 'Anonymous'} ↗</a>
                                : (rv.reviewer || 'Anonymous')}
                              {rv.location ? <span className="text-slate-400 font-normal"> · {rv.location}</span> : ''}
                            </span>
                            <span className="text-amber-500">{rv.rating != null ? `${rv.rating}★` : ''}{rv.date ? <span className="text-slate-400 ml-1">{new Date(rv.date).toLocaleDateString()}</span> : ''}</span>
                          </div>
                          {rv.text && <p className="text-slate-500 italic mt-0.5">"{rv.text}"</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* 6. CSAT */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className={currentAMMetrics.csatAvg != null ? 'text-blue-500' : 'text-slate-300'} />
                    <div>
                      <p className="font-medium text-slate-800"><Tip text="Average of the 'rate your account manager' score (1-10) from the Round 2 client survey this month. Needs at least 5 responses to be eligible. Score only for now — bonus tiers get set once we have real data to calibrate against.">CSAT (Account Manager Rating)</Tip> <span className="text-xs font-normal text-slate-400">(score only — tiers TBD)</span></p>
                      <p className="text-sm text-slate-500">
                        {currentAMMetrics.csatAvg != null
                          ? `${currentAMMetrics.csatResponses} response${currentAMMetrics.csatResponses === 1 ? '' : 's'}${currentAMMetrics.csatEligible ? '' : ` — need ${5 - currentAMMetrics.csatResponses} more to qualify`}${currentAMMetrics.csatOverall != null ? ` · overall satisfaction ${currentAMMetrics.csatOverall}/10` : ''}`
                          : 'No survey responses yet this month'}
                      </p>
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${currentAMMetrics.csatEligible ? 'text-blue-600' : 'text-slate-300'}`}>{currentAMMetrics.csatAvg != null ? `${currentAMMetrics.csatAvg}/10` : '--'}</p>
                </div>
                {unifiedSurveys.length > 0 && (
                  <div className="mt-3 ml-8">
                    <button onClick={() => setCsatOpen(o => !o)} className="text-xs text-blue-500 hover:underline">
                      {csatOpen ? 'Hide surveys' : `View ${sentCount} survey${sentCount === 1 ? '' : 's'} · resend & responses`}
                    </button>
                    {csatOpen && (
                      <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {unifiedSurveys.map((u) => {
                          const r = u.response;
                          const bad = r ? isBad(r) : false;
                          return (
                            <div key={u.key} className={`px-3 py-2 ${bad ? 'bg-red-50' : ''}`}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <button onClick={() => r && setOpenCsatResp(openCsatResp === r.id ? null : r.id)} className={`text-left flex-1 ${r ? 'hover:opacity-70' : 'cursor-default'}`}>
                                  <p className="text-sm font-medium text-slate-800">{u.client_name}{r && <span className="text-xs text-blue-500 ml-1">{openCsatResp === r.id ? '▲' : '▼'}</span>}</p>
                                  <p className="text-xs text-slate-500">
                                    {u.sent_at ? `Sent ${new Date(u.sent_at).toLocaleDateString()}` : (r?.created_at ? `Completed ${new Date(r.created_at).toLocaleDateString()}` : '')}
                                    {u.send?.client_email ? ` · ${u.send.client_email}` : ''}
                                  </p>
                                </button>
                                {r ? (
                                  <div className="text-xs text-slate-600 flex items-center gap-3">
                                    <span>AM <span className={`font-bold ${bad ? 'text-red-600' : 'text-slate-800'}`}>{r.am_rating ?? '--'}/10</span></span>
                                    <span>Overall <span className="font-bold text-slate-800">{r.overall_satisfaction ?? '--'}/10</span></span>
                                    {r.what_could_improve && <MessageSquare size={12} className="text-slate-400" title="Has a comment" />}
                                    <span className="text-green-600 font-medium">Completed</span>
                                  </div>
                                ) : u.send ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-amber-600">Awaiting</span>
                                    {u.send.client_email && (
                                      <button onClick={() => handleResend(u.send, 'email')} disabled={resendingId === u.send.id + ':email'} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                                        <Mail size={12} className={resendingId === u.send.id + ':email' ? 'animate-spin' : ''} /> {resendingId === u.send.id + ':email' ? 'Sending' : 'Email'}
                                      </button>
                                    )}
                                    {u.send.client_phone && (
                                      <button onClick={() => handleResend(u.send, 'sms')} disabled={resendingId === u.send.id + ':sms'} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                                        <MessageSquare size={12} className={resendingId === u.send.id + ':sms' ? 'animate-spin' : ''} /> {resendingId === u.send.id + ':sms' ? 'Sending' : 'Text'}
                                      </button>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                              {r && openCsatResp === r.id && (
                                <div className="mt-2 bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                                  <p>Overall satisfaction: <span className="font-semibold">{r.overall_satisfaction ?? 'n/a'}/10</span></p>
                                  <p>Account manager rating: <span className="font-semibold">{r.am_rating ?? 'n/a'}/10</span></p>
                                  <p>Work explained clearly: <span className="font-semibold">{r.met_expectations === true ? 'Yes' : r.met_expectations === false ? 'No' : 'n/a'}</span></p>
                                  <p>Likely to refer (NPS): <span className="font-semibold">{r.nps_score != null ? `${r.nps_score}/10` : 'n/a'}</span></p>
                                  {r.client_phone && <p>Phone: <span className="font-semibold">{r.client_phone}</span></p>}
                                  {r.what_could_improve
                                    ? <p className="pt-1">Comment: <span className="italic">"{r.what_could_improve}"</span></p>
                                    : <p className="pt-1 text-slate-400 italic">No comment left</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
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

            {/* Visibility-only retention watch stat (does NOT affect bonus) — management only */}
            {isAdmin && (
            <div className="mt-4 bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-800"><Tip text="Share of this AM's clients whose payment dates were never changed in the autobilling system. Visibility only. This does not add to or reduce the bonus. Management view only — used for coaching, not a public team metric. Number starts low and rises as auto-pay takes over.">Agreement Dates Kept</Tip> <span className="text-xs font-normal text-slate-400">(management view · coaching only)</span></p>
                    <p className="text-sm text-slate-500">
                      {currentAMMetrics.agreementNeedsData
                        ? 'Tracking begins at autobilling launch'
                        : (currentAMMetrics.agreementPctKept !== null
                          ? `${currentAMMetrics.agreementKept} of ${currentAMMetrics.agreementTotal} clients kept their dates`
                          : 'No data yet')}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-slate-400">
                  {currentAMMetrics.agreementPctKept !== null ? `${currentAMMetrics.agreementPctKept}%` : '--'}
                </p>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Surveys Tab — unified: every survey sent for this AM, completed + awaiting, with resend */}
      {tab === 'surveys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Round 2 Surveys {currentAMName !== 'Unknown' ? `— ${currentAMName}` : ''}</h3>
            <span className="text-sm text-slate-500">{sentCount} sent · {completedCount} completed · {awaitingCount} awaiting</span>
          </div>

          {sentCount === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-500">
              No surveys yet. They appear here once a survey is sent or a client completes one.
            </div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm divide-y divide-slate-100">
              {unifiedSurveys.map((u) => {
                const r = u.response;
                const bad = r ? isBad(r) : false;
                const open = r && openResponseId === r.id;
                return (
                  <div key={u.key} className={bad ? 'bg-red-50' : ''}>
                    <div className="w-full flex items-center justify-between px-4 py-3">
                      <button
                        onClick={() => r && setOpenResponseId(open ? null : r.id)}
                        className={`flex items-center gap-3 text-left flex-1 ${r ? 'hover:opacity-70' : 'cursor-default'}`}
                      >
                        {bad && <AlertTriangle size={16} className="text-red-500 shrink-0" />}
                        <div>
                          <p className="font-medium text-slate-800">{u.client_name}</p>
                          <p className="text-xs text-slate-500">
                            {u.sent_at ? `Sent ${new Date(u.sent_at).toLocaleDateString()}` : (r?.created_at ? `Completed ${new Date(r.created_at).toLocaleDateString()}` : '')}
                            {u.send?.client_email ? ` · ${u.send.client_email}` : ''}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-4">
                        {r ? (
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-500">AM <span className={`font-bold ${bad ? 'text-red-600' : 'text-slate-800'}`}>{r.am_rating ?? '--'}/10</span></span>
                            <span className="text-slate-500">Overall <span className="font-bold text-slate-800">{r.overall_satisfaction ?? '--'}/10</span></span>
                            <span className="text-xs font-medium text-green-600">Completed</span>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-medium text-amber-600">Awaiting response</span>
                            {u.send && (
                              <button
                                onClick={() => handleResend(u.send)}
                                disabled={resendingId === u.send.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-asap-blue text-asap-blue hover:bg-blue-50 disabled:opacity-50"
                              >
                                <RefreshCw size={14} className={resendingId === u.send.id ? 'animate-spin' : ''} /> {resendingId === u.send.id ? 'Sending...' : 'Resend'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {open && (
                      <div className="px-4 pb-4 text-sm text-slate-700 space-y-1">
                        <p>Overall satisfaction: <span className="font-semibold">{r.overall_satisfaction ?? 'n/a'}/10</span></p>
                        <p>Account manager rating: <span className="font-semibold">{r.am_rating ?? 'n/a'}/10</span></p>
                        <p>Work explained clearly: <span className="font-semibold">{r.met_expectations === true ? 'Yes' : r.met_expectations === false ? 'No' : 'n/a'}</span></p>
                        <p>Likely to refer: <span className="font-semibold">{r.nps_score != null ? `${r.nps_score}/10` : 'n/a'}</span></p>
                        {r.what_could_improve && <p className="pt-1">Comment: <span className="italic">"{r.what_could_improve}"</span></p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="space-y-4">
          {!paymentsData ? (
            <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-500">Loading payments...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Doc Fees', key: 'docs', color: 'text-blue-600' },
                  { label: 'Partials', key: 'partials', color: 'text-amber-600' },
                  { label: 'Finals', key: 'finals', color: 'text-green-600' },
                  { label: 'Additional Rounds', key: 'rounds', color: 'text-purple-600' },
                ].map(c => (
                  <div key={c.key} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.color}`}>{paymentsData.totals?.[c.key] ?? 0}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-600">{paymentsData.totalPayments} payments collected in {paymentsData.month} · <span className="font-bold text-slate-800">{fmt(paymentsData.totals?.amount || 0)}</span></span>
                <span className="text-xs text-slate-400">AM-attributed: {paymentsData.attributionCoverage}% of payments</span>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100"><h3 className="font-bold text-slate-800">By Consultant</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-left">
                      <tr><th className="px-4 py-2 font-medium">Consultant</th><th className="px-4 py-2 font-medium text-center">Docs</th><th className="px-4 py-2 font-medium text-center">Partials</th><th className="px-4 py-2 font-medium text-center">Finals</th><th className="px-4 py-2 font-medium text-center">Rounds</th><th className="px-4 py-2 font-medium text-right">Collected</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paymentsData.byConsultant?.map((c, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{c.name}</td>
                          <td className="px-4 py-2.5 text-center">{c.docs}</td>
                          <td className="px-4 py-2.5 text-center">{c.partials}</td>
                          <td className="px-4 py-2.5 text-center">{c.finals}</td>
                          <td className="px-4 py-2.5 text-center text-slate-500">{c.rounds}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{fmt(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">Attributed to Account Manager</h3>
                  <p className="text-xs text-slate-500">Which AM the paying client belongs to. Coverage grows as deals get mapped; unmapped ones show as Unattributed.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-left">
                      <tr><th className="px-4 py-2 font-medium">Account Manager</th><th className="px-4 py-2 font-medium text-center">Docs</th><th className="px-4 py-2 font-medium text-center">Partials</th><th className="px-4 py-2 font-medium text-center">Finals</th><th className="px-4 py-2 font-medium text-center">Rounds</th><th className="px-4 py-2 font-medium text-right">Collected</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paymentsData.byAM?.map((c, i) => (
                        <tr key={i} className={c.name === 'Unattributed' ? 'text-slate-400' : ''}>
                          <td className="px-4 py-2.5 font-medium">{c.name}</td>
                          <td className="px-4 py-2.5 text-center">{c.docs}</td>
                          <td className="px-4 py-2.5 text-center">{c.partials}</td>
                          <td className="px-4 py-2.5 text-center">{c.finals}</td>
                          <td className="px-4 py-2.5 text-center">{c.rounds}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{fmt(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Credit Building Tab */}
      {tab === 'reviews' && (
        <div className="mt-2"><ReviewClaimQueue /></div>
      )}

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
                  <label className="text-xs text-slate-500 mb-1 block">Account Manager *</label>
                  <select value={formData.account_manager_id || selectedAM || ''} onChange={e => setFormData({...formData, account_manager_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="">Select account manager...</option>
                    {amList.map(am => (
                      <option key={am.id} value={am.id}>{am.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Who gets credit for this signup. Defaults to the AM shown on the dashboard.</p>
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
                      {s.pipedrive_deal_id && <a href={DEAL_URL(s.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Deal #{s.pipedrive_deal_id} ↗</a>}
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
                        {s.pipedrive_deal_id && <a href={DEAL_URL(s.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Deal #{s.pipedrive_deal_id} ↗</a>}
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
      {breakdown && (() => {
        const { amName, metric, m } = breakdown;
        const isStall = metric === 'stall';
        const isPastDue = metric === 'pastdue';
        const isOverall = metric === 'overall';
        const title = isStall ? 'Report Stall Rate' : isPastDue ? 'Payment Past Due' : 'Overall Health';
        const rate = isStall ? m.stallRate : isPastDue ? m.pastDueRate : m.overallRate;
        const description = isStall
          ? 'Clients still in Logins Not Ready 14 or more days after their latest round ended, among those who started a round (1, 2, or 3) in the last 90 days. Check Logins and payment statuses do not count. Bonus tiers: 40% or below earns $75, 30% or below earns $150, 20% or below earns $250. Needs at least 15 in-window clients to qualify.'
          : isPastDue
          ? 'Active CRS clients with an invoice 5 to 30 days past its original due date and still owing, divided by this AM\u2019s active CRS book. The 5 day grace ignores payments in transit. Past 30 days drops off, since that client is a non-payer, not a collection miss. Tracked for health, no bonus.'
          : 'The simple average of the Report Stall Rate and the Payment Past Due rate. Each rate is measured over its own group of clients, so the average blends both without bending either number. Lower is better. Tracked for health, no bonus.';
        const stalled = m.stalledClients || [];
        const healthy = m.healthyInWindow || [];
        const pastDueList = m.pastDueClients || [];
        const current = m.crsHealthy || [];
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setBreakdown(null)}>
            <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
              <button onClick={() => setBreakdown(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"><X size={20} /></button>
              <div className="p-5 border-b border-slate-100">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{amName}</p>
                <h2 className="text-xl font-bold text-slate-800 mt-0.5">{title} <span className={`ml-2 ${rate <= 30 ? 'text-green-600' : 'text-red-600'}`}>{rate}%</span></h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{description}</p>
                {isStall && (
                  <p className="text-sm text-slate-700 mt-3"><span className="font-semibold text-red-600">{m.stallCount} stalled</span> of {m.stallTotal} in-window clients</p>
                )}
                {isPastDue && (
                  <p className="text-sm text-slate-700 mt-3"><span className="font-semibold text-red-600">{m.pastDueCount} past due</span> of {m.crsBook} active CRS clients</p>
                )}
                {isOverall && (
                  <p className="text-sm text-slate-700 mt-3">Report stall {m.stallRate ?? 0}% + past due {m.pastDueRate ?? 0}%, averaged</p>
                )}
              </div>
              <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                {isStall && (
                  <>
                    {stalled.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Stalled ({stalled.length})</p>
                        <div className="border border-red-100 rounded">
                          {stalled.map((c, i) => (
                            <div key={i} className="flex justify-between text-sm py-1.5 px-3 border-b border-slate-100 gap-2 last:border-b-0">
                              <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                              <span className="text-red-500 text-right whitespace-nowrap">{c.roundEndDate ? `Round ended ${fmtDate(c.roundEndDate)} · ${c.daysSinceRoundEnd}d behind` : (c.daysSinceRoundEnd != null ? `${c.daysSinceRoundEnd}d past round end` : (c.reason || ''))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-sm text-slate-500 italic">No stalled clients. Nice work.</p>}
                    {healthy.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">On time ({healthy.length})</p>
                        <div className="border border-green-100 rounded">
                          {healthy.map((c, i) => (
                            <div key={i} className="flex justify-between text-sm py-1.5 px-3 border-b border-slate-100 gap-2 last:border-b-0">
                              <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                              <span className="text-slate-500 text-right whitespace-nowrap">{!c.roundEnded ? 'Round still open' : (c.roundEndDate ? `Round ended ${fmtDate(c.roundEndDate)}` : '')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {isPastDue && (
                  <>
                    {pastDueList.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Past due ({pastDueList.length})</p>
                        <div className="border border-red-100 rounded">
                          {pastDueList.map((c, i) => (
                            <div key={i} className="flex justify-between text-sm py-1.5 px-3 border-b border-slate-100 gap-2 last:border-b-0">
                              <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                              <span className="text-red-500 text-right whitespace-nowrap">{c.dueDate ? `Due ${fmtDate(c.dueDate)} · ${c.daysPastDue}d late${c.balance ? ` · $${c.balance}` : ''}` : 'past due'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-sm text-slate-500 italic">No past due clients. Nice work.</p>}
                    {current.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Current ({current.length})</p>
                        <div className="border border-green-100 rounded">
                          {current.map((c, i) => (
                            <div key={i} className="flex justify-between text-sm py-1.5 px-3 border-b border-slate-100 gap-2 last:border-b-0">
                              <span className="text-slate-700">{c.dealId ? <a href={DEAL_URL(c.dealId)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : (c.id ? <a href={PERSON_URL(c.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.name} ↗</a> : c.name)}</span>
                              <span className="text-slate-500 text-right whitespace-nowrap">paid or within 5 day grace</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {isOverall && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-3 bg-slate-50 rounded">
                      <button onClick={() => setBreakdown({ amName, metric: 'stall', m })} className="text-blue-600 hover:underline">Open Report Stall Rate breakdown</button>
                      <span className="font-medium">{m.stallRate ?? 0}%</span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 rounded">
                      <button onClick={() => setBreakdown({ amName, metric: 'pastdue', m })} className="text-blue-600 hover:underline">Open Payment Past Due breakdown</button>
                      <span className="font-medium">{m.pastDueRate ?? 0}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
