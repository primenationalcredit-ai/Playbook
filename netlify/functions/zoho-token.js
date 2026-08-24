// zoho-token.js - ONE shared Zoho access token for the whole company (Joe 8/21,
// rate-limit killer). Zoho keeps a small pool of live access tokens per refresh
// token; every raw mint invalidates someone else's cached token mid-flight (the
// code-57 / "could not obtain token" error emails). Canonical cache = PROCESSOR
// supabase app_cache row 'zoho_access_token_shared' - already read by ar-offer,
// warmable from console. Everything in both repos reads cache-first and only
// mints on a true miss: ~hundreds of mints/day collapses to ~1/hour.
const PROC_URL = process.env.PROCESSOR_SUPABASE_URL || 'https://rdsxfzdthcsndlcjgfcu.supabase.co';
const PROC_KEY = process.env.PROCESSOR_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc3hmemR0aGNzbmRsY2pnZmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI4NTYxMSwiZXhwIjoyMDk0ODYxNjExfQ.2_Lx2lpSvogcN4W3nDsl8ZIEa_WgpKQJLwM9T9mANx0';
const H = { apikey: PROC_KEY, Authorization: `Bearer ${PROC_KEY}`, 'Content-Type': 'application/json' };
async function get(force) {
  if (force) await clear();
  if (!force) {
    try {
      const r = await fetch(`${PROC_URL}/rest/v1/app_cache?cache_key=eq.zoho_access_token_shared&select=cache_value,updated_at`, { headers: H });
      if (r.ok) {
        const rows = await r.json();
        if (rows[0]) {
          const v = JSON.parse(rows[0].cache_value || '{}');
          const freshByExpiry = v.expiresAt && v.expiresAt > Date.now() + 60000;
          const freshByAge = !v.expiresAt && rows[0].updated_at && (Date.now() - new Date(rows[0].updated_at).getTime()) < 50 * 60 * 1000;
          if (v.token && (freshByExpiry || freshByAge)) return v.token;
        }
      }
    } catch (e) {}
  }
  let tok = null, expiresIn = 3600;
  for (let a = 1; a <= 3 && !tok; a++) {
    try {
      const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: process.env.ZOHO_CLIENT_ID, client_secret: process.env.ZOHO_CLIENT_SECRET, refresh_token: process.env.ZOHO_REFRESH_TOKEN });
      const res = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: params });
      const data = await res.json().catch(() => ({}));
      if (data.access_token) { tok = data.access_token; if (data.expires_in) expiresIn = data.expires_in; }
    } catch (e) {}
    if (!tok && a < 3) await new Promise(res => setTimeout(res, a * 800));
  }
  if (!tok) throw new Error('Token failed: could not obtain Zoho access token (shared)');
  try {
    await fetch(`${PROC_URL}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: 'zoho_access_token_shared', cache_value: JSON.stringify({ token: tok, expiresAt: Date.now() + expiresIn * 1000 - 300000 }), updated_at: new Date().toISOString() }) });
  } catch (e) {}
  return tok;
}
async function clear() {
  try { await fetch(`${PROC_URL}/rest/v1/app_cache?cache_key=eq.zoho_access_token_shared`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } }); } catch (e) {}
}
export { get, clear };
export const getZohoToken = get;
export const clearZohoTokenCache = clear;

