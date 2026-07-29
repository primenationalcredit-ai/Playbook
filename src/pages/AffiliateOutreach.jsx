import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import EngineDashboard from '../components/EngineDashboard';
import {
  Users, Search, Phone, Mail, MessageSquare, PhoneCall, Pause, Play,
  CheckCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Zap, ZapOff
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
const sbGet = async (q) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: sbHeaders }); return r.ok ? r.json() : []; };
const sbPatch = async (q, body) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
const sbPost = async (q, body) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(body) });

const AffiliateProfileModal = ({ data, onClose, fallbackName }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
      <div className="px-5 py-4 border-b flex items-start justify-between">
        <div>
          <div className="font-bold text-lg">{(data && data.org) || fallbackName}</div>
          {data && data.contact && (
            <div className="text-xs text-gray-600 mt-0.5">{data.contact.name || ''}{data.contact.email ? ` · ${data.contact.email}` : ''}{data.contact.phone ? ` · ${data.contact.phone}` : ''}</div>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">{'×'}</button>
      </div>
      <div className="p-5 overflow-y-auto space-y-4">
        {!data && <div className="text-sm text-gray-500">Loading profile{'…'}</div>}
        {data && data.error && <div className="text-sm text-red-600">{data.error}</div>}
        {data && data.profile && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><div className="text-gray-400 text-xs">Company</div><div>{data.profile.company || '—'}</div></div>
            <div><div className="text-gray-400 text-xs">Occupation</div><div>{data.profile.occupation || '—'}</div></div>
            <div><div className="text-gray-400 text-xs">Industry</div><div>{data.profile.industry || '—'}</div></div>
            <div><div className="text-gray-400 text-xs">Relationship owner</div><div>{data.profile.owner || '—'}</div></div>
            <div><div className="text-gray-400 text-xs">Came from (super affiliate)</div><div>{data.profile.is_super ? 'Is a super affiliate' : (data.profile.recruited_by_super || 'Direct / unknown')}</div></div>
          </div>
        )}
        {data && data.stats && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg bg-gray-100">Referred: <b>{data.stats.total_referred}</b></span>
            <span className="px-2 py-1 rounded-lg bg-green-100 text-green-800">Sold: <b>{data.stats.total_sold}</b></span>
            <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800">Open: <b>{data.stats.open_now}</b></span>
            {data.stats.last_referral && <span className="px-2 py-1 rounded-lg bg-gray-100">Last referral: <b>{data.stats.last_referral}</b></span>}
            {data.stats.last_sale && <span className="px-2 py-1 rounded-lg bg-gray-100">Last sale: <b>{data.stats.last_sale}</b></span>}
          </div>
        )}
        {data && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Previous call notes (Additional F/U Notes, live from Pipedrive)</div>
            {data.fu_notes
              ? <pre className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap font-sans text-gray-700 max-h-48 overflow-y-auto">{data.fu_notes}</pre>
              : <div className="text-xs text-gray-400">No previous notes on record.</div>}
          </div>
        )}
        {data && Array.isArray(data.deals) && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Referred clients</div>
            {data.deals.length === 0 && <div className="text-xs text-gray-400">No referred deals found.</div>}
            <div className="divide-y">
              {data.deals.map((d) => (
                <div key={d.deal_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.client}</div>
                    <div className="text-xs text-gray-400">added {d.added || '?'}{d.won ? ` · sold ${d.won}` : ''}{d.lost ? ` · lost ${d.lost}` : ''}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${d.sold ? 'bg-green-100 text-green-700' : d.status === 'lost' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{d.sold ? 'SOLD' : d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

const sbUpsertConfig = async (key, value) => fetch(`${SUPABASE_URL}/rest/v1/app_config?on_conflict=key`, {
  method: 'POST', headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ key, value: String(value) }])
});

// Client-side mirror of the engine's merge logic so previews match sends exactly
function firstNameOf(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }
function monthNameOf(dateStr) {
  if (!dateStr) return 'a while back';
  const d = new Date(dateStr + 'T12:00:00Z');
  return isNaN(d) ? 'a while back' : d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}
function mergePreview(text, aff) {
  const consultantName = firstNameOf(aff.owner_name || '') || 'Your ASAP team';
  return String(text || '')
    .replace(/\{first_name\}/g, firstNameOf(aff.contact_name || aff.org_name))
    .replace(/\{consultant_name\}/g, consultantName)
    .replace(/\{company\}/g, aff.company || aff.org_name || 'your company')
    .replace(/\{sold_clients\}/g, String(aff.sold_clients || 0))
    .replace(/\{client_word\}/g, (aff.sold_clients || 0) === 1 ? 'client' : 'clients')
    .replace(/\{consultant_phone\}/g, '281-545-5001')
    .replace(/\{referral_word\}/g, (aff.referred_deals || 0) === 1 ? 'referral' : 'referrals')
    .replace(/\{referred_deals\}/g, String(aff.referred_deals || 0))
    .replace(/\{last_referral_month\}/g, monthNameOf(aff.last_referral_date))
    .replace(/\{portal_link\}/g, aff.portal_link || 'https://affiliates.asapcreditrepairusa.com')
    .replace(/\{result_story\}/g, 'a client whose bankruptcy was removed and came out 94 points higher');
}

function daysAgo(d) {
  if (!d) return null;
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return n < 0 ? 0 : n;
}
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return isNaN(dt) ? '-' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SEGMENTS = [
  { id: 'new_never', label: 'New, never sent', color: 'bg-blue-100 text-blue-800', ring: 'ring-blue-400' },
  { id: 'referred_pending', label: 'Referred, not sold yet', color: 'bg-purple-100 text-purple-800', ring: 'ring-purple-400' },
  { id: 'producing', label: 'Producing', color: 'bg-green-100 text-green-800', ring: 'ring-green-400' },
  { id: 'slowing', label: 'Slowing', color: 'bg-yellow-100 text-yellow-800', ring: 'ring-yellow-400' },
  { id: 'dormant', label: 'Dormant', color: 'bg-orange-100 text-orange-800', ring: 'ring-orange-400' },
  { id: 'cold', label: 'Cold', color: 'bg-gray-100 text-gray-600', ring: 'ring-gray-300' },
];
const segMeta = (id) => SEGMENTS.find((s) => s.id === id) || { label: id || '?', color: 'bg-gray-100 text-gray-600' };
const chIcon = (c) => (c === 'email' ? Mail : c === 'sms' ? MessageSquare : PhoneCall);

export default function AffiliateOutreach() {
  const { currentUser } = useApp();
  const isLeadership = currentUser?.department === 'leadership';

  const [tab, setTab] = useState('book');
  const [counts, setCounts] = useState({});
  const [config, setConfig] = useState({});
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [segFilter, setSegFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [lastTouch, setLastTouch] = useState({});
  const [viewTouch, setViewTouch] = useState(null);
  const [calledToday, setCalledToday] = useState({});
  const [notCalledOnly, setNotCalledOnly] = useState(false);
  const [refOpen, setRefOpen] = useState(null);
  const [refData, setRefData] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const t = await sbGet(`affiliate_touches?channel=eq.call&created_at=gte.${start.toISOString()}&select=affiliate_org_id,subject,detail,created_at&order=created_at.desc&limit=500`);
        const m = {};
        for (const x of (Array.isArray(t) ? t : [])) if (!m[x.affiliate_org_id]) m[x.affiliate_org_id] = x;
        setCalledToday(m);
      } catch (e) {}
    })();
  }, []);
  const openReferred = async (a) => {
    setRefOpen(a.id);
    if (refData[a.id]) return;
    try {
      const r = await fetch(`/.netlify/functions/affiliate-referred-deals?id=${a.id}`);
      const d = await r.json();
      setRefData((p) => ({ ...p, [a.id]: d }));
    } catch (e) { setRefData((p) => ({ ...p, [a.id]: { error: 'load failed' } })); }
  };
  const touchPacket = (t) => { try { const p = JSON.parse(t.detail); return (p && typeof p === 'object') ? p : {}; } catch (e) { return {}; } };
  useEffect(() => {
    (async () => {
      try {
        const rows = await sbGet('affiliate_touches?select=affiliate_org_id,channel,step_number,created_at,status&order=created_at.desc&limit=1000');
        const m = {};
        for (const t of (Array.isArray(rows) ? rows : [])) if (!m[t.affiliate_org_id]) m[t.affiliate_org_id] = t;
        setLastTouch(m);
      } catch (e) { /* non-blocking */ }
    })();
  }, []);
  const [touches, setTouches] = useState({});
  const [callTasks, setCallTasks] = useState([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [callView, setCallView] = useState('open');
  const [completingTask, setCompletingTask] = useState(null);
  const [aiPreviews, setAiPreviews] = useState({});
  const [fuDrafts, setFuDrafts] = useState({});
  const [fuSaving, setFuSaving] = useState(null);
  const [fuMsg, setFuMsg] = useState({});
  const [aiLoading, setAiLoading] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [sendVmText, setSendVmText] = useState(true);
  const PAGE_SIZE = 50;

  const loadSummary = useCallback(async () => {
    const myFirst = String(currentUser?.name || '').trim().toLowerCase().split(/\s+/)[0];
    const ownerQ = (isLeadership || !myFirst) ? '' : `&owner_name=ilike.${encodeURIComponent(myFirst)}*`;
    const [orgs, cfg] = await Promise.all([
      sbGet(`affiliate_orgs?select=segment,paused,opted_out,super_affiliate,missing_contact${ownerQ}`),
      sbGet('app_config?select=key,value'),
    ]);
    const c = { total: orgs.length, paused: 0, opted_out: 0, supers: 0, missing: 0 };
    for (const s of SEGMENTS) c[s.id] = 0;
    for (const o of orgs) {
      if (c[o.segment] != null) c[o.segment]++;
      if (o.paused) c.paused++;
      if (o.opted_out) c.opted_out++;
      if (o.super_affiliate) c.supers++;
      if (o.missing_contact) c.missing++;
    }
    setCounts(c);
    const cf = {};
    for (const row of cfg) cf[row.key] = row.value;
    setConfig(cf);
  }, [isLeadership, currentUser]);

  const loadBook = useCallback(async () => {
    setLoading(true);
    let q = `affiliate_orgs?select=*&order=pipedrive_add_time.desc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const filters = [];
    const myFirst = String(currentUser?.name || '').trim().toLowerCase().split(/\s+/)[0];
    if (!isLeadership && myFirst) filters.push(`owner_name=ilike.${encodeURIComponent(myFirst)}*`);
    if (segFilter === 'paused') filters.push('paused=eq.true');
    else if (segFilter === 'opted_out') filters.push('opted_out=eq.true');
    else if (segFilter === 'supers') filters.push('super_affiliate=eq.true');
    else if (segFilter) filters.push(`segment=eq.${segFilter}`);
    if (search.trim()) filters.push(`or=(org_name.ilike.*${encodeURIComponent(search.trim())}*,contact_email.ilike.*${encodeURIComponent(search.trim())}*)`);
    if (filters.length) q += '&' + filters.join('&');
    const data = await sbGet(q);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [segFilter, search, page, isLeadership, currentUser]);

  const loadCalls = useCallback(async () => {
    const status = callView === 'open' ? 'eq.open' : 'not.in.(open,queued)';
    const data = await sbGet(`affiliate_call_tasks?status=${status}&select=*&order=created_at.${callView === 'open' ? 'asc' : 'desc'}&limit=200`);
    const all = Array.isArray(data) ? data : [];
    // Consultants see their own calls (matched on first name of the deal owner); leadership sees everything
    const myFirst = String(currentUser?.name || '').trim().toLowerCase().split(/\s+/)[0];
    const mine = (list) => (isLeadership || !myFirst ? list : list.filter((t) => String(t.assigned_to || '').trim().toLowerCase().startsWith(myFirst)));
    setCallTasks(mine(all));
    // backlog: queued tasks waiting for a free slot (max 20 active per consultant)
    const qd = await sbGet('affiliate_call_tasks?status=eq.queued&select=id,assigned_to&limit=1000');
    setQueuedCount(mine(Array.isArray(qd) ? qd : []).length);
  }, [callView, isLeadership, currentUser]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    sbGet('affiliate_templates?active=eq.true&select=*&order=segment,step_number').then((t) => setTemplates(Array.isArray(t) ? t : []));
  }, []);
  useEffect(() => { if (tab === 'book') loadBook(); }, [tab, loadBook]);
  useEffect(() => { if (tab === 'calls') loadCalls(); }, [tab, loadCalls]);

  const toggleExpand = async (aff) => {
    if (expanded === aff.id) { setExpanded(null); return; }
    setExpanded(aff.id);
    if (!aiPreviews[aff.id]) loadAiPreview(aff); // the AI version IS what sends - fetch it up front
    if (!touches[aff.id]) {
      const t = await sbGet(`affiliate_touches?affiliate_org_id=eq.${aff.id}&select=*&order=created_at.desc&limit=30`);
      setTouches((prev) => ({ ...prev, [aff.id]: Array.isArray(t) ? t : [] }));
    }
  };

  const togglePause = async (aff) => {
    await sbPatch(`affiliate_orgs?id=eq.${aff.id}`, { paused: !aff.paused });
    setRows((rs) => rs.map((r) => (r.id === aff.id ? { ...r, paused: !aff.paused } : r)));
    loadSummary();
  };

  const completeTask = async (task, status) => {
    await sbPatch(`affiliate_call_tasks?id=eq.${task.id}`, {
      status, outcome: outcome || null, notes: notes || null, completed_at: new Date().toISOString()
    });
    // resume the cadence: next run advances to the step after the call
    await sbPatch(`affiliate_orgs?id=eq.${task.affiliate_org_id}`, { next_touch_due: new Date().toISOString().slice(0, 10) });
    const caller = String(currentUser?.name || task.assigned_to || 'team').split(/\s+/)[0];
    // the call lands on the affiliate's timeline
    await sbPost('affiliate_touches', [{
      affiliate_org_id: task.affiliate_org_id, pipedrive_org_id: task.pipedrive_org_id, channel: 'call',
      segment: task.segment, step_number: task.step_number, subject: outcome || status,
      status: 'completed', detail: notes || null
    }]);
    // ...and on the Pipedrive org record
    const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
    fetch('/.netlify/functions/affiliate-update-fu-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.affiliate_org_id, append: `${today}: Call by ${caller} - ${outcome || status}${notes ? `: ${notes}` : ''}` })
    }).catch(() => {});
    // voicemail? offer went out as a text
    if (status === 'done' && outcome === 'Left voicemail' && sendVmText) {
      fetch('/.netlify/functions/affiliate-checkin-sms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.affiliate_org_id, consultant: currentUser?.name || task.assigned_to })
      }).catch(() => {});
    }
    setCompletingTask(null); setOutcome(''); setNotes(''); setSendVmText(true);
    loadCalls();
  };

  const saveFuNotes = async (aff) => {
    setFuSaving(aff.id);
    setFuMsg((m) => ({ ...m, [aff.id]: null }));
    try {
      const r = await fetch('/.netlify/functions/affiliate-update-fu-notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: aff.id, notes: fuDrafts[aff.id] ?? aff.pipedrive_fu_notes ?? '' })
      });
      const d = await r.json();
      if (d.success) {
        setRows((rs) => rs.map((x) => x.id === aff.id ? { ...x, pipedrive_fu_notes: (fuDrafts[aff.id] ?? aff.pipedrive_fu_notes ?? '') || null } : x));
        setFuMsg((m) => ({ ...m, [aff.id]: 'Saved to Pipedrive' }));
      } else {
        setFuMsg((m) => ({ ...m, [aff.id]: `Save failed: ${d.error || 'unknown'}` }));
      }
    } catch (e) {
      setFuMsg((m) => ({ ...m, [aff.id]: 'Save failed' }));
    }
    setFuSaving(null);
  };

  const loadAiPreview = async (aff) => {
    setAiLoading(aff.id);
    try {
      const r = await fetch(`/.netlify/functions/affiliate-preview-message?id=${aff.id}`);
      const d = await r.json();
      setAiPreviews((p) => ({ ...p, [aff.id]: d }));
    } catch (e) {
      setAiPreviews((p) => ({ ...p, [aff.id]: { error: 'preview failed' } }));
    }
    setAiLoading(null);
  };

  const setEngine = async (on) => {
    if (!isLeadership) return;
    if (on && !window.confirm('Enable the affiliate cadence engine? Real emails and texts will send on the next run (within 30 minutes).')) return;
    await sbUpsertConfig('affiliate_engine_enabled', on ? 'true' : 'false');
    setConfig((c) => ({ ...c, affiliate_engine_enabled: on ? 'true' : 'false' }));
  };
  const setCap = async (key, val) => {
    if (!isLeadership) return;
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 0) return;
    await sbUpsertConfig(key, n);
    setConfig((c) => ({ ...c, [key]: String(n) }));
  };

  const engineOn = config.affiliate_engine_enabled === 'true';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-7 h-7" /> Affiliate Outreach</h1>
          <p className="text-gray-500 text-sm mt-1">{counts.total || 0} affiliates in the book, synced hourly from Pipedrive</p>
        </div>
        <div className="flex items-center gap-3">
          {isLeadership && (
            <button onClick={() => setEngine(!engineOn)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm ${engineOn ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {engineOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              Engine {engineOn ? 'ON' : 'OFF'}
            </button>
          )}
          <button onClick={() => { loadSummary(); tab === 'book' ? loadBook() : loadCalls(); }} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <EngineDashboard />
      {/* Segment cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {SEGMENTS.map((s) => (
          <button key={s.id} onClick={() => { setSegFilter(segFilter === s.id ? '' : s.id); setPage(0); setTab('book'); }}
            className={`rounded-xl border p-4 text-left hover:shadow ${segFilter === s.id ? `ring-2 ${s.ring}` : ''}`}>
            <div className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${s.color}`}>{s.label}</div>
            <div className="text-2xl font-bold">{counts[s.id] ?? '-'}</div>
          </button>
        ))}
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-6">
        <button onClick={() => { setSegFilter('paused'); setPage(0); setTab('book'); }} className="hover:text-gray-800">Paused: {counts.paused ?? '-'}</button>
        <button onClick={() => { setSegFilter('opted_out'); setPage(0); setTab('book'); }} className="hover:text-gray-800">Opted out: {counts.opted_out ?? '-'}</button>
        <button onClick={() => { setSegFilter('supers'); setPage(0); setTab('book'); }} className="hover:text-gray-800">Super affiliates: {counts.supers ?? '-'}</button>
        <span>Missing contact: {counts.missing ?? '-'}</span>
        <span>Emails today: {config.affiliate_emails_sent_today ?? 0}/{config.affiliate_daily_email_cap ?? '-'}</span>
        <span>SMS today: {config.affiliate_sms_sent_today ?? 0}/{config.affiliate_daily_sms_cap ?? '-'}</span>
        {isLeadership && (
          <span className="flex items-center gap-2">
            caps:
            <input className="w-16 border rounded px-1 py-0.5" defaultValue={config.affiliate_daily_email_cap || 150}
              onBlur={(e) => setCap('affiliate_daily_email_cap', e.target.value)} title="daily email cap" />
            <input className="w-16 border rounded px-1 py-0.5" defaultValue={config.affiliate_daily_sms_cap || 100}
              onBlur={(e) => setCap('affiliate_daily_sms_cap', e.target.value)} title="daily sms cap" />
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('book')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'book' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>The Book</button>
        <button onClick={() => setTab('calls')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'calls' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>
          Call Queue
        </button>
        <button onClick={() => setTab('messages')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'messages' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>
          Messages ({templates.length})
        </button>
      </div>

      {tab === 'book' && (
        <>
          <div className="relative mb-4 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search name or email" className="w-full pl-9 pr-3 py-2 border rounded-lg" />
          </div>
                <button onClick={() => setNotCalledOnly((v) => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap ${notCalledOnly ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Not called today ({rows.filter((x) => !calledToday[x.id] && !x.opted_out).length})
                </button>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Affiliate</th>
                    <th className="px-4 py-2">Segment</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2">Referred</th>
                    <th className="px-4 py-2">Won</th>
                    <th className="px-4 py-2">Sold</th>
                    <th className="px-4 py-2">Last sold</th>
                    <th className="px-4 py-2">Cadence</th>
                    <th className="px-4 py-2" title="Most recent automated or manual outreach touch">Last touch</th>
                    <th className="px-4 py-2">Owner</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((a) => !notCalledOnly || (!calledToday[a.id] && !a.opted_out)).map((a) => (
                    <React.Fragment key={a.id}>
                      <tr className={`border-t hover:bg-gray-50 ${a.paused || a.opted_out || a.super_affiliate ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2">
                          <div className="font-medium">{a.org_name}</div>
                          <div className="text-xs text-gray-400">{a.contact_email || 'no email'}{a.contact_phone ? ` · ${a.contact_phone}` : ''}</div>
                          {calledToday[a.id]
                            ? <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700" title={calledToday[a.id].detail || ''}>{'\u2713'} called today{calledToday[a.id].subject ? ` · ${calledToday[a.id].subject}` : ''}</span>
                            : (!a.opted_out && <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">not called today</span>)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${segMeta(a.segment).color}`}>{segMeta(a.segment).label}</span>
                          {a.super_affiliate && <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">SUPER</span>}
                          {a.opted_out && <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">opted out</span>}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {fmtDate(a.pipedrive_add_time)}
                          <div className="text-gray-400">{daysAgo(a.pipedrive_add_time) != null ? `${daysAgo(a.pipedrive_add_time)}d ago` : ''}</div>
                        </td>
                        <td className="px-4 py-2">{a.referred_deals}</td>
                        <td className="px-4 py-2">{a.won_deals ?? 0}</td>
                        <td className="px-4 py-2 font-semibold">{a.sold_clients}</td>
                        <td className="px-4 py-2 text-xs">
                          {fmtDate(a.last_referral_date)}
                          <div className="text-gray-400">{a.last_referral_date ? `${daysAgo(a.last_referral_date)}d ago` : ''}</div>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          step {a.cadence_step || 0}{a.next_touch_due ? ` · next ${a.next_touch_due}` : ''}
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap">
                          {(() => { const t = lastTouch[a.id]; if (!t) return <span className="text-gray-300">{'\u2014'}</span>; const d = new Date(t.created_at); return <span title={`${t.channel} step ${t.step_number ?? ''} · ${t.status}`}>{t.channel === 'sms' ? '\uD83D\uDCAC' : '\uD83D\uDCE7'} {d.toLocaleDateString()}</span>; })()}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {a.owner_name || '-'}
                          {a.recruited_by_super && <div className="text-gray-400">via {a.recruited_by_super}</div>}
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {isLeadership && (
                          <button onClick={() => togglePause(a)} title={a.paused ? 'Resume cadence' : 'Pause cadence'}
                            className="p-1.5 rounded hover:bg-gray-200 mr-1">
                            {a.paused ? <Play className="w-4 h-4 text-green-600" /> : <Pause className="w-4 h-4 text-gray-500" />}
                          </button>
                          )}
                          <button onClick={() => openReferred(a)} title="Referred clients history" className="p-1.5 rounded hover:bg-gray-200 mr-1">
                            <Users className="w-4 h-4 text-blue-600" />
                          </button>
                          <button onClick={() => toggleExpand(a)} className="p-1.5 rounded hover:bg-gray-200">
                            {expanded === a.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {refOpen === a.id && (
                            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRefOpen(null)}>
                              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                                <div className="px-5 py-4 border-b flex items-center justify-between">
                                  <div>
                                    <div className="font-bold text-lg">{a.org_name}</div>
                                    <div className="text-xs text-gray-500">Referred clients {'\u00b7'} pulled live from Pipedrive</div>
                                    {refData[a.id] && refData[a.id].contact && (refData[a.id].contact.name || refData[a.id].contact.email || refData[a.id].contact.phone) && (
                                      <div className="text-xs text-gray-600 mt-1">{refData[a.id].contact.name || ''}{refData[a.id].contact.email ? ` \u00b7 ${refData[a.id].contact.email}` : ''}{refData[a.id].contact.phone ? ` \u00b7 ${refData[a.id].contact.phone}` : ''}</div>
                                    )}
                                  </div>
                                  <button onClick={() => setRefOpen(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">{'\u00d7'}</button>
                                </div>
                                <div className="p-5 overflow-y-auto">
                                  {!refData[a.id] && <div className="text-sm text-gray-500">Loading history{'\u2026'}</div>}
                                  {refData[a.id] && refData[a.id].error && <div className="text-sm text-red-600">{refData[a.id].error}</div>}
                                  {refData[a.id] && refData[a.id].stats && (
                                    <>
                                      <div className="flex flex-wrap gap-2 mb-4 text-xs">
                                        <span className="px-2 py-1 rounded-lg bg-gray-100">Referred: <b>{refData[a.id].stats.total_referred}</b></span>
                                        <span className="px-2 py-1 rounded-lg bg-green-100 text-green-800">Sold: <b>{refData[a.id].stats.total_sold}</b></span>
                                        <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800">Open: <b>{refData[a.id].stats.open_now}</b></span>
                                        {refData[a.id].stats.last_referral && <span className="px-2 py-1 rounded-lg bg-gray-100">Last referral: <b>{refData[a.id].stats.last_referral}</b></span>}
                                        {refData[a.id].stats.last_sale && <span className="px-2 py-1 rounded-lg bg-gray-100">Last sale: <b>{refData[a.id].stats.last_sale}</b></span>}
                                      </div>
                                      {refData[a.id].deals.length === 0 && <div className="text-sm text-gray-500">No referred deals found on this organization.</div>}
                                      <div className="divide-y">
                                        {refData[a.id].deals.map((d) => (
                                          <div key={d.deal_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                                            <div className="min-w-0">
                                              <div className="font-medium truncate">{d.client}</div>
                                              <div className="text-xs text-gray-400">added {d.added || '?'}{d.won ? ` · sold ${d.won}` : ''}{d.lost ? ` · lost ${d.lost}${d.lost_reason ? ` (${d.lost_reason})` : ''}` : ''}</div>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${d.sold ? 'bg-green-100 text-green-700' : d.status === 'lost' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{d.sold ? 'SOLD' : d.status}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expanded === a.id && (
                        <tr className="border-t bg-gray-50">
                          <td colSpan={11} className="px-6 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              <div className="bg-white border rounded-lg p-2">
                                <div className="text-[10px] uppercase text-gray-400">Became an affiliate</div>
                                <div className="text-sm font-semibold">{fmtDate(a.pipedrive_add_time)}</div>
                                <div className="text-xs text-gray-400">{daysAgo(a.pipedrive_add_time) != null ? `${daysAgo(a.pipedrive_add_time)} days ago` : ''}</div>
                              </div>
                              <div className="bg-white border rounded-lg p-2">
                                <div className="text-[10px] uppercase text-gray-400">Referral funnel</div>
                                <div className="text-sm font-semibold">{a.referred_deals} referred → {a.won_deals ?? 0} won → {a.sold_clients} sold</div>
                                <div className="text-xs text-gray-400">{a.conversion_pct}% referred-to-sold</div>
                              </div>
                              <div className="bg-white border rounded-lg p-2">
                                <div className="text-[10px] uppercase text-gray-400">Last client sold</div>
                                <div className="text-sm font-semibold">{fmtDate(a.last_referral_date)}</div>
                                <div className="text-xs text-gray-400">{a.last_referral_date ? `${daysAgo(a.last_referral_date)} days ago` : 'never'}</div>
                              </div>
                              <div className="bg-white border rounded-lg p-2">
                                <div className="text-[10px] uppercase text-gray-400">Relationship</div>
                                <div className="text-sm font-semibold">{a.owner_name || 'unassigned'}</div>
                                <div className="text-xs text-gray-400">{a.recruited_by_super ? `via ${a.recruited_by_super}` : 'direct signup'}{a.company ? ` · ${a.company}` : ''}{a.occupation ? ` · ${a.occupation}` : ''}</div>
                              </div>
                            </div>
                            <details className="mb-3" open={!!a.pipedrive_fu_notes}>
                              <summary className="text-xs font-semibold text-gray-600 cursor-pointer">Follow-up notes (edits save to the Pipedrive org record)</summary>
                              <textarea
                                className="w-full text-xs bg-yellow-50 border border-yellow-200 rounded p-3 font-sans text-gray-700 mt-1"
                                rows={5}
                                value={fuDrafts[a.id] ?? a.pipedrive_fu_notes ?? ''}
                                onChange={(e) => setFuDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                                placeholder="Notes from calls, context, history - lives on the Pipedrive organization"
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <button onClick={() => saveFuNotes(a)} disabled={fuSaving === a.id}
                                  className="px-3 py-1 rounded bg-yellow-600 text-white text-xs font-medium disabled:opacity-50">
                                  {fuSaving === a.id ? 'Saving…' : 'Save to Pipedrive'}
                                </button>
                                {fuMsg[a.id] && <span className={`text-xs ${String(fuMsg[a.id]).startsWith('Saved') ? 'text-green-600' : 'text-red-600'}`}>{fuMsg[a.id]}</span>}
                              </div>
                            </details>
                            {(() => {
                              const seg = a.cadence_segment && a.cadence_segment !== a.segment ? a.segment : (a.cadence_segment || a.segment);
                              const step = (a.cadence_segment && a.cadence_segment !== a.segment) ? 0 : (a.cadence_step || 0);
                              const seq = templates.filter((t) => t.segment === seg);
                              const rot = templates.filter((t) => t.segment === 'rotation');
                              const pfirst = templates.filter((t) => t.segment === 'producing_first');
                              let next = null, rotationMode = false;
                              if (seg === 'producing' && (a.sold_clients || 0) === 1 && step === 0 && pfirst[0]) {
                                next = pfirst[0];
                              } else if (step < 100) {
                                next = seq.find((t) => t.step_number === step + 1) || null;
                                if (!next && rot.length) { next = rot[0]; rotationMode = true; }
                              } else if (rot.length) {
                                const rotTouch = step - 100 + 1;
                                const rotCall = templates.filter((t) => t.segment === 'rotation_call')[0];
                                next = (rotTouch % 3 === 0 && rotCall) ? rotCall : rot[rotTouch % rot.length];
                                rotationMode = true;
                              }
                              const upcoming = step < 100 ? seq.filter((t) => t.step_number > step + 1) : [];
                              const blocked = a.paused ? 'PAUSED' : a.opted_out ? 'OPTED OUT' : a.super_affiliate ? 'SUPER AFFILIATE (never contacted)' : a.missing_contact ? 'MISSING CONTACT INFO' : null;
                              return (
                                <div className="mb-3 bg-white border rounded-lg p-3">
                                  <div className="text-xs font-semibold text-gray-700 mb-1">
                                    Next message this affiliate will receive{rotationMode ? ' (monthly value rotation)' : ''}{next && next.channel === 'email' ? ' - personalized to their history' : ''}:
                                  </div>
                                  {blocked ? (
                                    <div className="text-xs text-red-600 font-medium">{blocked} - the engine skips this affiliate entirely.</div>
                                  ) : !next ? (
                                    <div className="text-xs text-gray-400">No template found for segment "{seg}".</div>
                                  ) : (
                                    <>
                                      <div className="text-xs text-gray-500 mb-2">
                                        Channel: <span className="font-medium uppercase">{next.channel}</span>
                                        {a.next_touch_due ? ` · scheduled ${a.next_touch_due}` : ' · would send on the next engine run'}
                                      </div>
                                      {next.subject && <div className="text-sm font-semibold mb-1">Subject: {mergePreview(next.subject, a)}</div>}
                                      {next.channel === 'email' ? (
                                        aiLoading === a.id && !aiPreviews[a.id] ? (
                                          <div className="text-xs text-gray-400 py-6 text-center">Writing this affiliate's personalized email…</div>
                                        ) : aiPreviews[a.id] && aiPreviews[a.id].personalized ? (
                                          <pre className="text-xs bg-indigo-50 border border-indigo-200 rounded p-3 whitespace-pre-wrap font-sans text-gray-800 max-h-72 overflow-y-auto">{aiPreviews[a.id].personalized}</pre>
                                        ) : (
                                          <>
                                            {aiPreviews[a.id] && !aiPreviews[a.id].personalized && (
                                              <div className="text-xs text-red-600 mb-1">AI personalization unavailable right now{aiPreviews[a.id].ai_error ? `: ${aiPreviews[a.id].ai_error}` : ''} - the version below would send instead.</div>
                                            )}
                                            <pre className="text-xs bg-gray-50 rounded p-3 whitespace-pre-wrap font-sans text-gray-800 max-h-64 overflow-y-auto">{mergePreview(next.body, a)}</pre>
                                          </>
                                        )
                                      ) : (
                                        <pre className="text-xs bg-gray-50 rounded p-3 whitespace-pre-wrap font-sans text-gray-800 max-h-64 overflow-y-auto">{mergePreview(next.body, a)}</pre>
                                      )}
                                      {next.channel === 'email' && aiPreviews[a.id] && aiPreviews[a.id].personalized && (
                                        <details className="mt-2">
                                          <summary className="text-xs text-gray-400 cursor-pointer">Show raw template (before personalization)</summary>
                                          <pre className="text-xs bg-gray-50 rounded p-3 whitespace-pre-wrap font-sans text-gray-600 max-h-48 overflow-y-auto mt-1">{mergePreview(next.body, a)}</pre>
                                        </details>
                                      )}
                                      {upcoming.length > 0 && (
                                        <div className="text-xs text-gray-500 mt-2">
                                          Then: {upcoming.map((u) => `${u.channel.toUpperCase()} day ${u.day_offset}${u.subject ? ` (${u.subject})` : ''}`).join(' then ')}, then monthly value emails
                                        </div>
                                      )}
                                      {next.channel === 'email' && (
                                        <button onClick={() => loadAiPreview(a)} disabled={aiLoading === a.id}
                                          className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50">
                                          {aiLoading === a.id ? 'Personalizing…' : 'Regenerate personalized email'}
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                            {(touches[a.id] || []).length === 0 ? (
                              <div className="text-xs text-gray-400">No touches yet.</div>
                            ) : (
                              <div className="space-y-1">
                                {(touches[a.id] || []).map((t) => {
                                  const Icon = chIcon(t.channel);
                                  return (
                                    <div key={t.id} className="flex items-center gap-2 text-xs">
                                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                                      <span className="text-gray-600">{new Date(t.created_at).toLocaleString()}</span>
                                      <span className="font-medium">{t.channel}</span>
                                      {t.subject && <span className="text-gray-500">· {t.subject}</span>}
                                      <span className={`px-1.5 rounded-full ${['sent', 'opened', 'clicked'].includes(t.status) ? 'bg-green-100 text-green-700' : t.status === 'task_created' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span>
                                      {touchPacket(t).body && <button onClick={() => setViewTouch(t)} className="text-indigo-600 hover:underline">View</button>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {viewTouch && (
                              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewTouch(null)}>
                                <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-between px-5 py-3 border-b">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-slate-800 truncate">{viewTouch.channel === 'sms' ? 'SMS sent' : (viewTouch.subject || 'Email sent')}</div>
                                      <div className="text-xs text-slate-400">{new Date(viewTouch.created_at).toLocaleString()} {'\u00b7'} step {viewTouch.step_number ?? ''} {'\u00b7'} {viewTouch.status}</div>
                                    </div>
                                    <button onClick={() => setViewTouch(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">{'\u00D7'}</button>
                                  </div>
                                  <div className="overflow-y-auto p-5 text-sm text-slate-700 whitespace-pre-wrap">{touchPacket(viewTouch).body}</div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-gray-500">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="disabled:opacity-30">← Prev</button>
                <span>Page {page + 1}</span>
                <button disabled={rows.length < PAGE_SIZE} onClick={() => setPage(page + 1)} className="disabled:opacity-30">Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'calls' && (
        <>
          <div className="flex gap-2 mb-4 items-center">
            <button onClick={() => setCallView('open')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${callView === 'open' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>Open</button>
            <button onClick={() => setCallView('done')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${callView === 'done' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>Completed</button>
            {queuedCount > 0 && (
              <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg" title="Waiting in the background. New tasks surface as you complete open ones (max 20 active).">
                +{queuedCount} queued
              </span>
            )}
          </div>
          {callTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No {callView} call tasks.</div>
          ) : (
            <div className="space-y-3">
              {callTasks.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-blue-600" /> {t.org_name}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${segMeta(t.segment).color}`}>{segMeta(t.segment).label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t.contact_phone || 'no phone'} · {t.stats_line} · assigned to {t.assigned_to || 'anyone'} · due {t.due_date}
                      </div>
                      <button onClick={() => openReferred({ id: t.affiliate_org_id })} className="mt-1 text-xs text-blue-600 hover:underline font-medium">View affiliate profile {'→'}</button>
                      {refOpen === t.affiliate_org_id && <AffiliateProfileModal data={refData[t.affiliate_org_id]} onClose={() => setRefOpen(null)} fallbackName={t.org_name} />}
                    </div>
                    {t.status === 'open' ? (
                      <button onClick={() => setCompletingTask(completingTask === t.id ? null : t.id)}
                        className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium">Complete</button>
                    ) : (
                      <span className="text-xs text-gray-400 flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> {t.status}{t.outcome ? ` · ${t.outcome}` : ''}</span>
                    )}
                  </div>
                  {t.talking_points && (
                    <pre className="mt-3 text-xs bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans text-gray-700">{t.talking_points}</pre>
                  )}
                  {completingTask === t.id && (
                    <div className="mt-3 border-t pt-3 space-y-2">
                      <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm w-full max-w-xs block">
                        <option value="">Outcome…</option>
                        <option>Spoke - positive</option>
                        <option>Spoke - not interested</option>
                        <option>Left voicemail</option>
                        <option>No answer</option>
                        <option>Bad number</option>
                      </select>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (what did you learn?) - saves to the timeline AND the Pipedrive org record"
                        className="border rounded-lg px-2 py-1.5 text-sm w-full" rows={2} />
                      {outcome === 'Left voicemail' && (
                        <label className="flex items-center gap-2 text-xs text-gray-600">
                          <input type="checkbox" checked={sendVmText} onChange={(e) => setSendVmText(e.target.checked)} />
                          Also text them: "Just left you a voicemail, was calling to check in..." (from your name)
                        </label>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => completeTask(t, 'done')} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium">Mark done, resume cadence</button>
                        <button onClick={() => completeTask(t, 'skipped')} className="px-3 py-1.5 rounded-lg bg-gray-200 text-xs font-medium">Skip call, resume cadence</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'messages' && (
        <div className="space-y-6">
          <div className="text-sm text-gray-500">
            Every message the engine can ever send, grouped by segment. Fields in curly braces fill with each affiliate's real data. Expand any affiliate on The Book tab to see their exact merged copy.
          </div>
          {['new_never', 'dormant', 'slowing', 'producing', 'cold', 'rotation'].map((seg) => {
            const ts = templates.filter((t) => t.segment === seg);
            if (!ts.length) return null;
            const label = seg === 'rotation' ? 'Monthly value rotation (all segments after their sequence)' : (segMeta(seg).label || seg);
            return (
              <div key={seg}>
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  {seg !== 'rotation' && <span className={`text-xs px-2 py-0.5 rounded-full ${segMeta(seg).color}`}>{segMeta(seg).label}</span>}
                  {seg === 'rotation' && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Monthly rotation</span>}
                  <span className="text-sm text-gray-400 font-normal">{ts.length} steps</span>
                </h3>
                <div className="space-y-3">
                  {ts.map((t) => {
                    const Icon = chIcon(t.channel);
                    return (
                      <div key={t.id} className="bg-white border rounded-xl p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                          <Icon className="w-4 h-4 text-gray-400" />
                          Step {t.step_number} · {t.channel.toUpperCase()} · day {t.day_offset}
                          {t.subject && <span className="text-gray-600 font-normal">· {t.subject}</span>}
                        </div>
                        <pre className="text-xs bg-gray-50 rounded p-3 whitespace-pre-wrap font-sans text-gray-700 max-h-56 overflow-y-auto">{t.body}</pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLeadership && (
        <div className="mt-6 text-xs text-gray-400 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Engine controls are leadership only. You can browse the book, pause affiliates, and work the call queue.
        </div>
      )}
    </div>
  );
}
