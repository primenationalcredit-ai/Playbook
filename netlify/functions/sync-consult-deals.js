// sync-consult-deals.js
// Pulls the "Ready to Quote this month" consult deals from Pipedrive (filter 523803) and stores them
// in our own consult_deals table. This is the ONLY place that touches the Pipedrive filter. The bonus
// dashboard reads from consult_deals, so a rate limit or a filter hiccup here just means the stored
// data is a few minutes stale, never broken, and a failed run never wipes good data.
//
// Runs on a schedule (see netlify.toml) and can be hit manually:
//   /.netlify/functions/sync-consult-deals            -> current month
//   /.netlify/functions/sync-consult-deals?month=2026-06

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RTQ_FILTER_ID = 523803;

const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

exports.handler = async (event) => {
  try {
    const params = (event && event.queryStringParameters) || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const runIso = new Date().toISOString();

    // 1. Pull every page of the RTQ filter, with retries. If any page ultimately fails, we abort the
    //    whole sync WITHOUT writing anything, so the stored snapshot is never left half-updated.
    const deals = [];
    let start = 0, more = true, ok = true;
    while (more) {
      let data = null, pageOk = false;
      for (let attempt = 0; attempt < 4 && !pageOk; attempt++) {
        try {
          const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?filter_id=${RTQ_FILTER_ID}&start=${start}&limit=100&api_token=${PIPEDRIVE_TOKEN}`);
          if (res.ok) { data = await res.json(); pageOk = true; }
          else if (res.status === 429 || res.status >= 500) { await sleep(600 * (attempt + 1)); }
          else { break; }
        } catch (e) { await sleep(600 * (attempt + 1)); }
      }
      if (!pageOk) { ok = false; break; }
      (data.data || []).forEach(d => deals.push(d));
      more = data.additional_data?.pagination?.more_items_in_collection || false;
      start += 100;
      if (start > 5000) more = false;
    }

    if (!ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false, reason: 'pipedrive_fetch_failed', month, note: 'kept existing data, will retry next run' }) };
    }

    // 2. Upsert the current set as in_rtq=true for this month's snapshot.
    const rows = deals.map(d => ({
      deal_id: d.id,
      rtq_month: month,
      owner_name: d.owner_name || 'Unknown',
      person_name: d.person_name || null,
      title: d.title || null,
      value: parseFloat(d.value) || 0,
      org_name: d.org_name || (d.org_id && d.org_id.name) || null,
      status: d.status || null,
      add_time: d.add_time ? String(d.add_time).replace(' ', 'T') + 'Z' : null,
      in_rtq: true,
      synced_at: runIso,
      updated_at: runIso,
    }));

    // Chunked upsert (merge on the composite PK).
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/consult_deals`, {
        method: 'POST',
        headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      });
      if (!r.ok) {
        const txt = await r.text();
        return { statusCode: 200, headers, body: JSON.stringify({ ok: false, reason: 'upsert_failed', detail: txt.slice(0, 300), month }) };
      }
    }

    // 3. Anything in THIS month's snapshot we didn't just see has dropped out of the filter -> mark
    //    in_rtq=false. This only touches the current month; prior months stay frozen as history.
    await fetch(`${SUPABASE_URL}/rest/v1/consult_deals?rtq_month=eq.${month}&synced_at=lt.${encodeURIComponent(runIso)}&in_rtq=eq.true`, {
      method: 'PATCH',
      headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ in_rtq: false, updated_at: runIso }),
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, month, synced: rows.length, syncedAt: runIso }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
