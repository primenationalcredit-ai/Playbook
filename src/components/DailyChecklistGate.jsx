import React, { useState, useEffect } from 'react';

// DAILY BONUS VISIBILITY GATE - shared engine (Astrid spec #2, 8/6).
// One table (role_daily_checklist, jsonb items) serves AM / Consultant / VA
// checklists; each page passes its role + item list. Company day boundary =
// America/Chicago, same as the CSR gate. Admins/leadership see through.
const SB = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

export function useDailyGate(currentUser, role, items, applies) {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';
  const skip = isAdmin || !applies || !currentUser;
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const who = currentUser?.email || currentUser?.name || '';
  const [checked, setChecked] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (skip || !who) { setChecked({}); return; }
    fetch(`${SB}/rest/v1/role_daily_checklist?user_key=eq.${encodeURIComponent(who)}&day=eq.${day}&select=checked`, { headers: H })
      .then((r) => r.json()).then((rows) => setChecked((rows[0] && rows[0].checked) || {}))
      .catch(() => setChecked({}));
  }, []);
  const toggle = async (key) => {
    if (busy) return;
    setBusy(true);
    const next = { ...(checked || {}) };
    if (next[key]) delete next[key]; else next[key] = new Date().toISOString();
    try {
      await fetch(`${SB}/rest/v1/role_daily_checklist?on_conflict=user_key,day`, {
        method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_key: who, role, day, checked: next, updated_at: new Date().toISOString() }),
      });
      setChecked(next);
    } catch (e) { alert('Could not save - try again'); }
    setBusy(false);
  };
  const unlocked = skip || (checked && items.every(([k]) => checked[k]));
  const panel = (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="relative">
        <div className="grid grid-cols-3 gap-4 blur-md select-none pointer-events-none opacity-60" aria-hidden="true">
          {[...Array(6)].map((_, i) => (<div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24" />))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Complete today's check-in checklist to view your bonus.</h2>
            <p className="text-xs text-slate-500 mb-4">Resets every day. Check every item to unlock instantly.</p>
            <div className="space-y-2.5">
              {items.map(([k, label]) => (
                <label key={k} className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer">
                  <input type="checkbox" checked={!!(checked && checked[k])} onChange={() => toggle(k)} disabled={busy} className="mt-0.5 w-4 h-4 accent-indigo-600" />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return { ready: checked !== null, unlocked, panel };
}

export const CONSULTANT_CHECKLIST = [
  ['c1', 'Check into Everyone (chat)'],
  ['c2', 'Post check-in on Consultant Chat'],
  ['c3', 'Prep for the day: write down all time-sensitive calls for the day'],
  ['c4', 'Check for any scheduled consultations and claim the consultation'],
];
export const AM_CHECKLIST = [
  ['a1', 'Check into Everyone (chat)'],
  ['a2', 'Send update in Account Managers chat'],
  ['a3', "Cover missed calls (today's assigned rotation)"],
  ['a4', 'Joined the daily Google Meet'],
  ['a5', 'Unmuted with camera on during the Meet'],
  ['a6', 'Logged into Insightful'],
];
