// Consultant Bonus Metrics v4 — Derives ALL metrics from Zoho payments
// Qualified docs = unique clients with doc_fee AND (partial OR final) payments
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';

const AFFILIATE_TIERS = [
  { min: 11, bonus: 200, label: '11+ clients' },
  { min: 6, bonus: 110, label: '6-10 clients' },
  { min: 3, bonus: 50, label: '3-5 clients' }
];
const DOC_CLUBS = [
  { min: 90, bonus: 350, label: '90 Doc Club' },
  { min: 75, bonus: 200, label: '75 Doc Club' },
  { min: 60, bonus: 100, label: '60 Doc Club' }
];

function calcAccelerator(qd) {
  let total = 0; const bands = [];
  if (qd > 50) { const n = Math.min(qd, 60) - 50; bands.push({ tier: '51-60', docs: n, perDoc: 10, amount: n * 10 }); total += n * 10; }
  if (qd > 60) { const n = Math.min(qd, 70) - 60; bands.push({ tier: '61-70', docs: n, perDoc: 20, amount: n * 20 }); total += n * 20; }
  if (qd > 70) { const n = Math.min(qd, 80) - 70; bands.push({ tier: '71-80', docs: n, perDoc: 30, amount: n * 30 }); total += n * 30; }
  if (qd > 80) { const n = qd - 80; bands.push({ tier: '81+', docs: n, perDoc: 45, amount: n * 45 }); total += n * 45; }
  return { total, breakdown: bands };
}

async function supaGet(table, query) {
  const sep = query ? '&' : '';
  const pageSize = 1000; // Supabase caps each request, so page through all rows
  let all = [], offset = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}${sep}limit=${pageSize}&offset=${offset}`, {
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Range-Unit': 'items', 'Range': `${offset}-${offset + pageSize - 1}`,
      },
    });
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset > 200000) break; // safety
  }
  return all;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = params.month || currentMonth;
    const monthLabel = new Date(targetMonth + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const monthStart = `${targetMonth}-01`;

    // ===== PAYSHEET MIRROR (shared) =====
    // The Payment Dashboard reads the Google Sheet (paysheet-live) and is the source of truth for MTD
    // sales. This rewrites each consultant's totalSales (MTD) and today.sales to match the paysheet,
    // so the leaderboard equals the Payment Dashboard. Applied to BOTH fresh and cached responses.
    const mirrorTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    let paysheetTotals = null; // { mtdSales, todaySales, mtdDocs, mtdPartials, mtdFinals } from the paysheet
    const applyPaysheetMirror = async (consultantsObj) => {
      try {
        const siteBase = process.env.URL || process.env.DEPLOY_URL || 'https://cute-cat-d9631c.netlify.app';
        const psRes = await fetch(`${siteBase}/.netlify/functions/paysheet-live?months=${targetMonth}`);
        if (!psRes.ok) return false;
        const ps = await psRes.json();
        const psRows = (ps && ps.months && ps.months[targetMonth] && ps.months[targetMonth].rows) ? ps.months[targetMonth].rows : [];
        // Company totals straight from the paysheet (matches the Payment Dashboard's company MTD).
        let coSales = 0, coToday = 0, coDocs = 0, coPartials = 0, coFinals = 0;
        const psAgg = {};
        for (const row of psRows) {
          const amtAll = parseFloat(row.fee_paid) || 0;
          coSales += amtAll;
          if (row.date_paid === mirrorTodayStr) coToday += amtAll;
          const codeAll = (row.code || '').toLowerCase();
          const ftAll = (row.fee_type || '').toLowerCase();
          let catAll = 'other';
          if (codeAll.includes('doc')) catAll = 'doc';
          else if (codeAll.includes('par')) catAll = 'partial';
          else if (codeAll.includes('fin')) catAll = 'final';
          else if (ftAll.includes('doc')) catAll = 'doc';
          else if (ftAll.includes('partial')) catAll = 'partial';
          else if (ftAll.includes('final')) catAll = 'final';
          if (catAll === 'doc') coDocs++;
          else if (catAll === 'partial') coPartials++;
          else if (catAll === 'final') coFinals++;

          const nm = row.consultant;
          if (!nm) continue;
          if (!psAgg[nm]) psAgg[nm] = { sales: 0, today: 0, count: 0, docs: 0, partials: 0, finals: 0 };
          // Consultant tiles show COMMISSIONABLE sales only (doc/partial/final).
          // Additional rounds etc. stay in the company MTD above, not personal numbers.
          if (catAll !== 'other') {
            psAgg[nm].sales += amtAll;
            psAgg[nm].count++;
            if (row.date_paid === mirrorTodayStr) psAgg[nm].today += amtAll;
          }
          if (catAll === 'doc') psAgg[nm].docs++;
          else if (catAll === 'partial') psAgg[nm].partials++;
          else if (catAll === 'final') psAgg[nm].finals++;
        }
        paysheetTotals = {
          mtdSales: Math.round(coSales * 100) / 100,
          todaySales: Math.round(coToday * 100) / 100,
          mtdDocs: coDocs, mtdPartials: coPartials, mtdFinals: coFinals
        };
        const psNames = Object.keys(psAgg);
        const firstWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/)[0];
        const PS_ALIASES = { 'cindy broadstreet': 'Cindy', 'rose benitez': 'Rose' };
        const findPs = (cName) => {
          if (!cName) return null;
          const lower = cName.toLowerCase().trim();
          if (PS_ALIASES[lower] && psAgg[PS_ALIASES[lower]]) return psAgg[PS_ALIASES[lower]];
          if (psAgg[cName]) return psAgg[cName];
          const cf = firstWord(cName);
          if (cf.length > 1) { const fm = psNames.filter(pn => firstWord(pn) === cf); if (fm.length === 1) return psAgg[fm[0]]; }
          const cWords = lower.split(/\s+/).filter(Boolean);
          const cm = psNames.filter(pn => { const pw = pn.toLowerCase().split(/\s+/).filter(Boolean); return cWords.every(w => pw.includes(w)) || pw.every(w => cWords.includes(w)); });
          if (cm.length === 1) return psAgg[cm[0]];
          return null;
        };
        for (const [n, d] of Object.entries(consultantsObj || {})) {
          const match = findPs(d.name || n);
          if (match) {
            d.totalSales = Math.round(match.sales);
            d.mtdDocs = match.docs;
            d.mtdPartials = match.partials;
            d.mtdFinals = match.finals;
            d.thisMonthClientCount = match.count;
            if (!d.today) d.today = {};
            d.today.sales = Math.round(match.today);
            d.paysheetMirrored = true;
          }
        }
        return true;
      } catch (e) { console.error('[paysheet-mirror] failed:', e.message); return false; }
    };
    // ===== END PAYSHEET MIRROR (shared) =====

    // Response cache: this function does a lot of live Pipedrive work, so we serve a cached result
    // (per month) and only recompute when it's older than the TTL or ?refresh=1 is passed. Keeps the
    // page loading instantly for the team and avoids the timeout.
    const CACHE_KEY = `consultant_bonus_${targetMonth}`;
    const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes (warmed every 10 min in business hours)
    const forceRefresh = params.refresh === '1' || params.refresh === 'true';
    // Read the existing cache once. On a normal load we serve it immediately. On a recompute we KEEP
    // it as a fallback so a failed Pipedrive fetch can never wipe out good closing-rate data.
    let priorCacheBody = null, priorConsultTotal = null;
    try {
      const cacheRows = await supaGet('app_cache', `cache_key=eq.${CACHE_KEY}&select=cache_value,updated_at`);
      if (cacheRows && cacheRows[0] && cacheRows[0].cache_value) {
        priorCacheBody = cacheRows[0].cache_value;
        try { priorConsultTotal = JSON.parse(priorCacheBody)?.companyConsultTotal ?? null; } catch(_) {}
        if (!forceRefresh && !params.duedebug) {
          // Always serve cache on the live page load, even if a little stale. The scheduled warm
          // function (and ?refresh=1) do the slow recompute, so the team never blocks on it and the
          // page never fails to load. Freshness comes from the every-10-min warm.
          // Still apply the paysheet mirror to the cached body so MTD always matches the Payment Dashboard.
          try {
            const cachedObj = JSON.parse(priorCacheBody);
            if (cachedObj && cachedObj.consultants) {
              await applyPaysheetMirror(cachedObj.consultants);
              if (paysheetTotals && cachedObj.teamTotals) {
                cachedObj.teamTotals.mtdSales = paysheetTotals.mtdSales;
                cachedObj.teamTotals.todaySales = paysheetTotals.todaySales;
                cachedObj.teamTotals.mtdDocs = paysheetTotals.mtdDocs;
                cachedObj.teamTotals.mtdPartials = paysheetTotals.mtdPartials;
                cachedObj.teamTotals.mtdFinals = paysheetTotals.mtdFinals;
              }
              return { statusCode: 200, headers, body: JSON.stringify(cachedObj) };
            }
          } catch (_) { /* fall through to raw cache if parse/mirror fails */ }
          return { statusCode: 200, headers, body: priorCacheBody };
        }
      }
    } catch(e) { /* no cache yet -> compute fresh below */ }
    // Only read a rolling window of history (not the full multi-year table).
    // Covers current-month sales plus the look-backs the bonus logic needs (90-day reactivation, prior-month qualified docs).
    const [wy, wm] = targetMonth.split('-').map(Number);
    const wd = new Date(wy, wm - 1 - 12, 1);
    const windowStart = `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, '0')}-01`;

    // Get consultants
    const consultants = await supaGet('users', 'department=eq.credit_consultants&select=id,name,email,is_va');

    // Get payments for the rolling window (paged past the 1000-row cap) for cross-referencing client journeys
    const allPayments = await supaGet('consultant_payments', `payment_date=gte.${windowStart}&excluded_from_bonus=not.is.true&select=pipedrive_deal_id,client_name,payment_type,payment_month,payment_date,amount,consultant_name,is_affiliate_deal,referrer_org`);

    // Full affiliate payment history (all time, small subset, few columns) so the reactivation kicker
    // and new-affiliate-launch can measure dormancy beyond the rolling window.
    const affiliateHistory = await supaGet('consultant_payments', `is_affiliate_deal=eq.true&select=referrer_org,payment_date,payment_month,consultant_name&order=payment_date.asc`);

    // Build a master client map: deal_id → all payment types ever
    const masterClientMap = {};
    for (const p of allPayments) {
      const key = p.pipedrive_deal_id || p.client_name;
      if (!masterClientMap[key]) masterClientMap[key] = { types: new Set(), months: new Set(), consultant: p.consultant_name, isAffiliate: p.is_affiliate_deal, orgName: p.referrer_org };
      masterClientMap[key].types.add(p.payment_type);
      masterClientMap[key].months.add(p.payment_month);
    }

    // deal_id -> client_name (invoices store deal-id-prefixed customer names, so resolve real names here)
    const nameByDeal = {};
    for (const p of allPayments) {
      const did = p.pipedrive_deal_id ? String(p.pipedrive_deal_id) : null;
      if (did && p.client_name && !nameByDeal[did]) nameByDeal[did] = p.client_name;
    }

    // Orgs that carry the affiliate (Consultant Referral) label, so a consult can be classified as
    // affiliate by its org even if that lead never converted (the doc-fee flag only exists once they pay).
    const affiliateOrgNames = new Set(
      allPayments.filter(p => p.is_affiliate_deal && p.referrer_org).map(p => String(p.referrer_org).toLowerCase().trim())
    );

    // Get reviews. Credit follows the month the review was LEFT (review_date), not when it was claimed
    // or approved. So a March review approved in June counts toward March. Reviews with no review_date
    // fall back to the month the row was created.
    const [rvy, rvm] = targetMonth.split('-').map(Number);
    const nextMonthStart = `${new Date(rvy, rvm, 1).getFullYear()}-${String(new Date(rvy, rvm, 1).getMonth() + 1).padStart(2, '0')}-01`;
    const reviews = await supaGet('incoming_reviews', `or=(and(review_date.gte.${monthStart},review_date.lt.${nextMonthStart}),and(review_date.is.null,created_at.gte.${monthStart},created_at.lt.${nextMonthStart}))&delisted_at=is.null&select=*`);

    // Get already-awarded one-time bonuses
    let awardedBonuses = [];
    try {
      awardedBonuses = await supaGet('bonus_awards', `select=*`);
    } catch(e) {}
    const awardedOrgs = new Set(awardedBonuses.map(a => `${a.bonus_type}:${a.org_name}`));

    // Get refunds for refund rate
    let refunds = [];
    try {
      refunds = await supaGet('refunds', `refund_date=gte.${monthStart}&select=*`);
    } catch(e) { /* table may not exist yet */ }

    // Get invoice data for collection metrics
    let invoiceData = [];
    try {
      invoiceData = await supaGet('consultant_invoices', `select=*`);
    } catch(e) {}
    // Monthly payments only (for commission calc)
    const payments = allPayments.filter(p => p.payment_month === targetMonth);

    // Consults for closing % — read from our OWN consult_deals table (kept current by the background
    // sync-consult-deals job). No Pipedrive call at request time, so rate limits / filter hiccups can
    // never break the closing rate. Worst case the stored snapshot is a few minutes stale.
    let consultsByOwner = {};  // owner -> { total, dealIds[] }
    const rtqDealIds = new Set();
    const dealMeta = {};       // dealId -> { name, value } for names + PIF payoff check
    let rtqOk = true;
    try {
      const rows = await supaGet('consult_deals', `in_rtq=eq.true&rtq_month=eq.${targetMonth}&select=deal_id,owner_name,person_name,title,value,org_name`);
      if (!Array.isArray(rows)) throw new Error('consult_deals read returned no array');
      for (const d of rows) {
        const o = d.owner_name || 'Unknown';
        if (!consultsByOwner[o]) consultsByOwner[o] = { total: 0, dealIds: [] };
        consultsByOwner[o].total++;
        consultsByOwner[o].dealIds.push(d.deal_id);
        rtqDealIds.add(d.deal_id);
        dealMeta[d.deal_id] = { name: d.person_name || d.title || `Deal #${d.deal_id}`, value: parseFloat(d.value) || 0, orgName: d.org_name || null };
      }
    } catch(e) { rtqOk = false; console.log('Consult read error:', e.message); }
    const companyConsultTotal = Object.values(consultsByOwner).reduce((s, v) => s + v.total, 0);
    // Trust the run only if the read succeeded and we didn't suddenly drop to zero when a prior good
    // run had consults (that would mean the sync table got emptied) — otherwise fall back to last good.
    const rtqReliable = rtqOk && !(companyConsultTotal === 0 && (priorConsultTotal || 0) > 0);

    // Build set of deal IDs that have doc_fee payments in Zoho, plus a name index
    // (some Zoho invoices have no deal ID on them, so we fall back to client name)
    const dealIdsWithDocFee = new Set();
    const docFeeNames = new Set();
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    // Resolve a deal id for a payment row even when the row itself has no pipedrive_deal_id (Zoho
    // payments often store only the client name). Backfill by client name from any payment that does
    // carry an id, then from the consult deal metadata, so every client list can link to its deal.
    // RESOLUTION RULE (root fix for returning clients): collect EVERY deal id
    // seen for a name, then resolve to the OPEN deal first (returning clients
    // get a fresh open file - their old won/lost file must not claim their
    // payments), tie-broken by newest. Statuses come from cs_deals in batch.
    const nameDealCandidates = {};
    for (const p of allPayments) {
      if (p.pipedrive_deal_id && p.client_name) {
        const k = norm(p.client_name);
        if (k) (nameDealCandidates[k] = nameDealCandidates[k] || new Set()).add(String(p.pipedrive_deal_id));
      }
    }
    for (const id in dealMeta) {
      const nm = norm(dealMeta[id]?.name || '');
      if (nm) (nameDealCandidates[nm] = nameDealCandidates[nm] || new Set()).add(String(id));
    }
    const nameToDealId = {};
    {
      const _SU = process.env.SUPABASE_URL, _SK = process.env.SUPABASE_SERVICE_KEY;
      const statusById = {};
      const allIds = new Set();
      for (const k in nameDealCandidates) { if (nameDealCandidates[k].size > 1) { for (const id of nameDealCandidates[k]) allIds.add(id); } }
      const idArr = [...allIds];
      for (let i = 0; i < idArr.length && _SU && _SK; i += 200) {
        const chunk = idArr.slice(i, i + 200);
        try {
          const rows = await fetch(`${_SU}/rest/v1/cs_deals?deal_id=in.(${chunk.join(',')})&select=deal_id,deal_status,deal_created_at`, { headers: { apikey: _SK, Authorization: `Bearer ${_SK}` } }).then(r => r.json());
          for (const r of (Array.isArray(rows) ? rows : [])) statusById[String(r.deal_id)] = r;
        } catch (e) {}
      }
      const rank = (id) => {
        const r = statusById[id];
        return [(r && r.deal_status === 'open') ? 2 : (r ? 1 : 0), r && r.deal_created_at ? new Date(r.deal_created_at).getTime() : 0];
      };
      for (const k in nameDealCandidates) {
        const ids = [...nameDealCandidates[k]];
        if (ids.length > 1) ids.sort((a, b) => { const ra = rank(a), rb = rank(b); return (rb[0] - ra[0]) || (rb[1] - ra[1]); });
        nameToDealId[k] = ids[0];
      }
    }
    const resolveDealId = (p) => p.pipedrive_deal_id || nameToDealId[norm(p.client_name || p.name)] || null;

    // Earliest still-owed invoice due date for a deal, so a client who needs a partial/final shows
    // when their next payment is due and whether it is already past due (follow up).
    const dueTodayStr = new Date().toISOString().slice(0, 10);
    const nextDueForDeal = (dealId, clientName) => {
      const nm = norm(clientName);
      const owing = invoiceData.filter(inv => {
        if ((parseFloat(inv.balance) || 0) <= 1 || !inv.due_date) return false;
        if (dealId && String(inv.pipedrive_deal_id) === String(dealId)) return true;
        // Invoices frequently carry no deal id. Resolve one from the invoice customer name via the
        // payment-derived maps and match that, so a client links to its invoice even when the invoice
        // row itself has no deal id.
        if (dealId) {
          const cn = norm(inv.customer_name);
          const resolved = dealByClientName[cn] || nameToDealId[cn];
          if (resolved && String(resolved) === String(dealId)) return true;
        }
        // Last resort: the client's real name appears in the invoice customer name (deal-id-prefixed names included).
        if (nm && nm.length > 4 && norm(inv.customer_name).includes(nm)) return true;
        return false;
      }).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
      if (!owing.length) return null;
      const due = String(owing[0].due_date).slice(0, 10);
      return { dueDate: due, overdue: due < dueTodayStr };
    };
    // Invoices store only the client name (no deal id). This map now INHERITS
    // the open-first/newest-first resolution from nameToDealId above, so a
    // returning client's dead won/lost file can never claim their invoices.
    const dealByClientName = {};
    for (const k in nameToDealId) dealByClientName[k] = String(nameToDealId[k]);
    // Total actually collected per deal (excluding additional rounds). Payments are the accurate
    // source of truth, so we reconcile invoices against this instead of trusting stale invoice balances.
    const paidByDeal = {};
    for (const p of allPayments) {
      if (!p.pipedrive_deal_id || p.payment_type === 'additional_round') continue;
      const k = String(p.pipedrive_deal_id);
      paidByDeal[k] = (paidByDeal[k] || 0) + (parseFloat(p.amount) || 0);
    }
    for (const p of allPayments) {
      if (p.payment_type === 'doc_fee') {
        if (p.pipedrive_deal_id) dealIdsWithDocFee.add(p.pipedrive_deal_id);
        else if (p.client_name) docFeeNames.add(norm(p.client_name)); // name fallback ONLY for orphan payments with no deal id, so a linked payment can't be borrowed by a same-named different deal
      }
    }

    // Total still-owed balance per deal, resolved from the invoice's deal id or its customer name.
    // Used as a fallback in the rosters so a client who owes but has no dated invoice still shows the
    // amount owed, instead of a bare status, so the consultant knows to call them.
    const owedByDeal = {};
    for (const inv of invoiceData) {
      const bal = parseFloat(inv.balance) || 0;
      if (bal <= 1) continue;
      const cn = norm(inv.customer_name);
      const did = inv.pipedrive_deal_id ? String(inv.pipedrive_deal_id) : (dealByClientName[cn] || nameToDealId[cn] || null);
      if (!did) continue;
      owedByDeal[did] = (owedByDeal[did] || 0) + bal;
    }

    // Order-insensitive client to invoice matcher. An invoice belongs to the client when the deal id
    // matches, when the invoice customer name resolves to that deal id, or when every word of the client
    // name appears in the invoice customer name (catches "Last, First" ordering and deal-id-prefixed names).
    const nameTokens = (s) => norm(s).split(' ').filter(t => t.length > 1);
    const clientMatchesInvoice = (dealId, name, inv) => {
      if (dealId && String(inv.pipedrive_deal_id) === String(dealId)) return true;
      const cn = norm(inv.customer_name);
      if (dealId) {
        const resolved = dealByClientName[cn] || nameToDealId[cn];
        if (resolved && String(resolved) === String(dealId)) return true;
      }
      const cTok = nameTokens(name);
      if (cTok.length >= 2) {
        const invSet = new Set(nameTokens(inv.customer_name));
        if (cTok.every(t => invSet.has(t))) return true;
      }
      return false;
    };
    const invoicesForClient = (dealId, name) => invoiceData.filter(inv => clientMatchesInvoice(dealId, name, inv));
    // Resolve the next owed invoice, the total still owed, and, when no dated invoice exists, the precise
    // reason, so a roster row always shows a date, an amount owed, or an explicit reason, never a bare status.
    const resolveDue = (dealId, name) => {
      const invs = invoicesForClient(dealId, name);
      const owing = invs.filter(i => (parseFloat(i.balance) || 0) > 1);
      const owed = Math.round(owing.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0));
      const dated = owing.filter(i => i.due_date).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
      if (dated.length) {
        const due = String(dated[0].due_date).slice(0, 10);
        return { dueDate: due, overdue: due < dueTodayStr, owed, dueReason: null };
      }
      let dueReason;
      if (owing.length) dueReason = 'invoice on file has no due date';
      else if (invs.length) dueReason = 'invoice paid in full';
      else dueReason = 'no invoice on file yet';
      return { dueDate: null, overdue: false, owed, dueReason };
    };

    // === DUE-DATE DIAGNOSTIC (read-only) ===
    // ?duedebug=<consultant name> returns each affiliate-referred client for that consultant with the
    // due-date match attempt and, when no date is found, the reason: no open invoice on file, an invoice
    // exists but has no due_date, or its balance is already cleared. Lets us see exactly why a date is missing.
    if (params.duedebug) {
      const want = norm(params.duedebug);
      const isDoc = (dealId, name) => (dealId && dealIdsWithDocFee.has(dealId)) || docFeeNames.has(norm(name));
      const roster = {};
      for (const p of allPayments) {
        if (!p.is_affiliate_deal) continue;
        if (!norm(p.consultant_name).includes(want)) continue;
        const key = p.pipedrive_deal_id || p.client_name;
        if (!roster[key]) roster[key] = { name: p.client_name, dealId: p.pipedrive_deal_id || null, org: p.referrer_org, hasDoc: false, hasAdvanced: false };
        if (p.payment_type === 'doc_fee') roster[key].hasDoc = true;
        else if (['partial', 'final', 'paid_in_full'].includes(p.payment_type)) roster[key].hasAdvanced = true;
      }
      const explain = (dealId, name) => {
        const linked = invoicesForClient(dealId, name);
        const r = resolveDue(dealId, name);
        if (r.dueDate) return { matched: true, dueDate: r.dueDate, overdue: r.overdue, owed: r.owed, invoices_linked: linked.length };
        return { matched: false, reason: r.dueReason, owed: r.owed, invoices_linked: linked.length };
      };
      const out = Object.values(roster).map(c => {
        const status = (c.hasDoc && c.hasAdvanced) ? 'qualified' : (c.hasDoc ? 'needs_advance' : 'needs_doc');
        return { name: c.name, dealId: c.dealId, org: c.org, status, due: status === 'qualified' ? null : explain(c.dealId, c.name) };
      }).sort((a, b) => a.org.localeCompare(b.org) || a.name.localeCompare(b.name));
      return { statusCode: 200, headers, body: JSON.stringify({
        success: true, duedebug: params.duedebug,
        clients: out.length, with_due_date: out.filter(c => c.due?.matched).length,
        rows: out
      }, null, 2) };
    }

    // Cached lookup: org creation date (add_time) by org name — for New Affiliate Launch
    const orgAddTimeCache = {};
    // Org creation dates rarely change, so cache them in the DB. Without this we'd do 2 live Pipedrive
    // calls per affiliate org on every load, which is what was timing the function out.
    let orgAddTimePersist = {};
    try {
      const rows = await supaGet('app_cache', 'cache_key=eq.org_add_times&select=cache_value');
      if (rows && rows[0] && rows[0].cache_value) orgAddTimePersist = JSON.parse(rows[0].cache_value) || {};
    } catch (e) {}
    let orgAddTimeNewFetches = 0;
    let orgAddTimeDirty = false;
    const ORG_FETCH_CAP = 20; // bound live lookups per run; the rest fill in over subsequent runs
    async function getOrgAddTime(orgName) {
      if (orgName in orgAddTimeCache) return orgAddTimeCache[orgName];
      if (orgName in orgAddTimePersist) { orgAddTimeCache[orgName] = orgAddTimePersist[orgName]; return orgAddTimeCache[orgName]; }
      if (orgAddTimeNewFetches >= ORG_FETCH_CAP) return null; // defer to a later run, don't block this one
      orgAddTimeNewFetches++;
      let result = null;
      try {
        const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/search?term=${encodeURIComponent(orgName)}&exact_match=true&fields=name&api_token=${PIPEDRIVE_API_KEY}`);
        if (r.ok) {
          const j = await r.json();
          const item = j.data?.items?.[0]?.item;
          if (item?.id) {
            const dr = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${item.id}?api_token=${PIPEDRIVE_API_KEY}`);
            if (dr.ok) { const dj = await dr.json(); result = dj.data?.add_time || null; }
          }
        }
      } catch (e) {}
      orgAddTimeCache[orgName] = result;
      orgAddTimePersist[orgName] = result;
      orgAddTimeDirty = true;
      return result;
    }
    // Cached lookup: deal total value by id — for PIF paid-in-full check
    const dealValueCache = {};
    async function getDealValue(dealId) {
      if (!dealId) return 0;
      if (dealId in dealValueCache) return dealValueCache[dealId];
      if (dealMeta[dealId]) { dealValueCache[dealId] = dealMeta[dealId].value || 0; return dealValueCache[dealId]; }
      let v = 0;
      try {
        const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_KEY}`);
        if (r.ok) { const j = await r.json(); v = parseFloat(j.data?.value) || 0; }
      } catch (e) {}
      dealValueCache[dealId] = v;
      return v;
    }

    // (Removed the live "lost deals" Pipedrive fetch — its result was never used in any metric and it
    //  was one more request-time Pipedrive call that could rate-limit. Closing % uses consults + paid
    //  doc fees only. If lost-deal counts are needed later, sync them into a table like consult_deals.)



    // Week range
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const weekStartStr = monday.toISOString().split('T')[0];

    // --- Qualified-doc rule (invoice amounts) ---
    // A client qualifies if they paid a doc fee this month AND, across their NON-doc invoices,
    // the invoices paid in full cover at least what is still owed. That captures: a partial paid
    // in full and >= the final, or the final/full balance paid in full. A token partial payment
    // against a still-open balance does NOT qualify. If no invoices are on file for the deal we
    // fall back to the older "has a partial/final ever" check so synced-late clients aren't dropped.
    const EPS = 1; // balances under $1 count as paid in full
    const invoicesForDeal = (dealId) => (!dealId ? [] : invoiceData.filter((inv) => String(inv.pipedrive_deal_id) === String(dealId)));
    function qualifyClient(client) {
      const invs = invoicesForDeal(client.dealId);
      const docPay = (client.payments || []).find((p) => p.payment_type === 'doc_fee');
      const docAmt = docPay ? parseFloat(docPay.amount) || 0 : 0;

      if (invs.length === 0) {
        const key = client.dealId || client.name;
        const mr = masterClientMap[key];
        const adv = mr && (mr.types.has('partial') || mr.types.has('final') || mr.types.has('paid_in_full'));
        return { qualified: !!adv, reason: adv ? null : 'no partial or final payment on file', paid: 0, owed: 0 };
      }

      // Drop the doc-fee invoice (closest total to the doc payment; else the smallest invoice)
      let docIdx = -1, best = Infinity;
      invs.forEach((inv, i) => {
        const t = parseFloat(inv.total) || 0;
        const diff = Math.abs(t - docAmt);
        if (docAmt > 0 && diff <= 1 && diff < best) { best = diff; docIdx = i; }
      });
      // A lone invoice that doesn't match the doc payment is a BALANCE invoice - don't discard it.
      if (docIdx === -1 && !(invs.length === 1 && docAmt > 0)) { let min = Infinity; invs.forEach((inv, i) => { const t = parseFloat(inv.total) || 0; if (t < min) { min = t; docIdx = i; } }); }
      const nonDoc = invs.filter((_, i) => i !== docIdx);

      if (nonDoc.length === 0) return { qualified: false, reason: 'doc fee only, no balance invoice yet', paid: 0, owed: 0 };

      let paidInFull = 0, owed = 0, billed = 0;
      for (const inv of nonDoc) {
        const total = parseFloat(inv.total) || 0;
        const bal = parseFloat(inv.balance) || 0;
        billed += total; owed += bal;
        if (bal <= EPS) paidInFull += total;
      }
      const qualified = owed <= EPS ? true : paidInFull >= owed;
      // Reason text credits the doc fee that was actually received. Without this, a client
      // who paid $149 against a $550 deal shows as "$550 of $550 balance still owed" because
      // we silently dropped one of the duplicate invoices as "the doc fee invoice" and the
      // other untouched $550 is what's in nonDoc. Surfacing the doc fee makes it clear the
      // client did pay something and only the balance is open.
      const reason = qualified ? null : (
        docAmt > 0
          ? `Doc fee paid ($${Math.round(docAmt)}). $${Math.round(owed)} balance still open.`
          : `$${Math.round(owed)} of $${Math.round(billed)} balance still owed`
      );
      return { qualified, reason, paid: Math.round(docAmt + (billed - owed)), owed: Math.round(owed) };
    }

    const results = {};

    for (const consultant of consultants) {
      const name = consultant.name;
      const isVA = consultant.is_va || false;
      const baseRate = isVA ? 0.10 : 0.14;
      const affiliateRate = isVA ? 0.14 : 0.21;

      // Match payments to consultant
      // Strict matching: payment consultant name must contain a significant part of the user's name
      // Avoid: "Rosa" in "De La Rosa" matching "Rosalia"
      const firstName = name.split(' ')[0].toLowerCase();
      const lastName = name.split(' ').slice(-1)[0].toLowerCase();
      const matchesConsultant = (p) => {
        const pName = (p.consultant_name || '').toLowerCase().trim();
        // Exact first name match (word boundary): "cindy" in "cindy" or "cindy broadstreet"
        const pParts = pName.split(/\s+/);
        if (pParts[0] === firstName) return true;
        // Last name appears in payment name ("Carlos Danilo Salguera Balladares" matches "Carlos Salguera")
        if (lastName.length > 3 && pParts.some(pp => pp === lastName)) return true;
        if (pName === name.toLowerCase()) return true;
        return false;
      };
      const myPayments = payments.filter(matchesConsultant).filter(p =>
        // Consultants are credited only on new-client acquisition payments. Additional rounds ($299)
        // belong to Account Managers, never consultants, and unclassified ("unknown") rows are not
        // creditable consultant sales. Excluding both here keeps them out of sales, commission, counts,
        // qualified docs, and every client list at once.
        p.payment_type === 'doc_fee' || p.payment_type === 'partial' ||
        p.payment_type === 'final' || p.payment_type === 'paid_in_full'
      );

      // Full-window payments for this consultant. Qualified-doc month attribution
      // (policy 7/10): a doc counts toward the month of the client's FIRST
      // balance-side payment, so cross-month doc fee -> partial must be visible.
      const myWindowPayments = allPayments.filter(matchesConsultant).filter(p =>
        p.payment_type === 'doc_fee' || p.payment_type === 'partial' ||
        p.payment_type === 'final' || p.payment_type === 'paid_in_full'
      );
      const windowClientMap = {};
      for (const p of myWindowPayments) {
        const key = p.pipedrive_deal_id || p.client_name;
        if (!windowClientMap[key]) windowClientMap[key] = {
          key, name: p.client_name, dealId: p.pipedrive_deal_id,
          hasDocFee: false, hasPartial: false, hasFinal: false,
          totalPaid: 0, orgName: p.referrer_org, isAffiliate: p.is_affiliate_deal,
          payments: [], firstPaymentDate: p.payment_date, firstAdvanceDate: null
        };
        const wc = windowClientMap[key];
        wc.totalPaid += parseFloat(p.amount) || 0;
        wc.payments.push(p);
        if (p.payment_type === 'doc_fee') wc.hasDocFee = true;
        if (p.payment_type === 'partial') wc.hasPartial = true;
        if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') wc.hasFinal = true;
        if (p.payment_date < wc.firstPaymentDate) wc.firstPaymentDate = p.payment_date;
        if (p.payment_type !== 'doc_fee' && (!wc.firstAdvanceDate || p.payment_date < wc.firstAdvanceDate)) {
          wc.firstAdvanceDate = p.payment_date;
        }
      }
      for (const wc of Object.values(windowClientMap)) {
        wc.firstAdvanceMonth = wc.firstAdvanceDate ? String(wc.firstAdvanceDate).slice(0, 7) : null;
      }

      // === SALES & COMMISSION (from Zoho) ===
      let totalSales = 0, affiliateSales = 0, organicSales = 0;
      let docFeeCount = 0, partialCount = 0, finalCount = 0, paidInFullCount = 0, unknownCount = 0;
      
      for (const p of myPayments) {
        const amt = parseFloat(p.amount) || 0;
        totalSales += amt;
        // Commission rate: is_affiliate_deal = org has "Consultant Referral" label → higher rate
        if (p.is_affiliate_deal) { affiliateSales += amt; } else { organicSales += amt; }
        if (p.payment_type === 'doc_fee') docFeeCount++;
        else if (p.payment_type === 'partial') partialCount++;
        else if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') { finalCount++; const wcF = windowClientMap[p.pipedrive_deal_id || p.client_name]; if (p.payment_type === 'paid_in_full' || !(wcF && wcF.hasPartial)) paidInFullCount++; }
        else unknownCount++;
      }

      const baseCommission = organicSales * baseRate;
      const affiliateCommission = affiliateSales * affiliateRate;
      const totalCommission = baseCommission + affiliateCommission;

      // === QUALIFIED DOCS (derived from payments) ===
      // Group payments by client (using pipedrive_deal_id as unique identifier, fallback to client_name)
      const clientMap = {};
      for (const p of myPayments) {
        const key = p.pipedrive_deal_id || p.client_name;
        if (!clientMap[key]) clientMap[key] = { 
          name: p.client_name, dealId: p.pipedrive_deal_id,
          hasDocFee: false, hasPartial: false, hasFinal: false,
          totalPaid: 0, orgName: p.referrer_org, 
          isAffiliate: p.is_affiliate_deal,  // Consultant Referral label = affiliate for both commission + bonus
          payments: [], firstPaymentDate: p.payment_date
        };
        clientMap[key].totalPaid += parseFloat(p.amount) || 0;
        clientMap[key].payments.push(p);
        if (p.payment_type === 'doc_fee') clientMap[key].hasDocFee = true;
        if (p.payment_type === 'partial') clientMap[key].hasPartial = true;
        if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') clientMap[key].hasFinal = true;
        if (p.payment_date < clientMap[key].firstPaymentDate) clientMap[key].firstPaymentDate = p.payment_date;
      }

      const clients = Object.values(clientMap);
      
      // === QUALIFIED DOCS (invoice-amount rule; month = first balance-side payment) ===
      // Policy (7/10, Joe): a doc counts toward the month the client's FIRST partial/
      // final clears, regardless of the doc fee's month, with no time window between
      // them. The balance qualification test (qualifyClient) is unchanged.
      let qualifiedDocs = 0;
      let docFeeOnlyCount = 0;
      const qualifiedClients = [];
      const notQualifiedClients = [];
      const qualifiedKeySet = new Set();

      for (const wc of Object.values(windowClientMap)) {
        if (!wc.hasDocFee) continue;
        if (wc.firstAdvanceMonth !== targetMonth) continue; // belongs to the first advance's month
        const q = qualifyClient(wc);
        if (q.qualified) {
          qualifiedDocs++;
          qualifiedClients.push(wc);
          qualifiedKeySet.add(wc.key);
        }
      }

      // Chase list: this month's doc-fee clients not counted this month. If their first
      // advance landed in a different month, say so instead of a balance complaint.
      for (const client of clients) {
        if (!client.hasDocFee) continue;
        const key = client.dealId || client.name;
        if (qualifiedKeySet.has(key)) continue;
        const wc = windowClientMap[key];
        docFeeOnlyCount++;
        if (wc && wc.firstAdvanceMonth && wc.firstAdvanceMonth !== targetMonth) {
          const q2 = qualifyClient(wc);
          notQualifiedClients.push({ name: client.name, dealId: client.dealId, reason: q2.qualified ? `Counts in ${wc.firstAdvanceMonth} (first partial landed that month)` : q2.reason, paid: q2.paid, owed: q2.owed });
        } else {
          const q = qualifyClient(wc || client);
          notQualifiedClients.push({ name: client.name, dealId: client.dealId, reason: q.reason, paid: q.paid, owed: q.owed });
        }
      }

      // Advance-this-month clients whose doc fee was in an earlier month (these now COUNT
      // this month via the window map; kept for the response payload)
      const priorMonthQualified = clients.filter(c => !c.hasDocFee && (c.hasPartial || c.hasFinal));

      const docFeeOnlyClients = clients.filter(c => c.hasDocFee && !qualifiedKeySet.has(c.dealId || c.name));

      // === ACCELERATOR ===
      const accelerator = calcAccelerator(qualifiedDocs);

      // === DOC CLUB ===
      let docClub = null;
      for (const club of DOC_CLUBS) { if (qualifiedDocs >= club.min) { docClub = { ...club }; break; } }
      const docClubBonus = docClub ? docClub.bonus : 0;

      // === AFFILIATE BOOK (orgs with Consultant Referral label) ===
      const affiliateMap = {};
      for (const client of qualifiedClients) {
        if (client.isAffiliate && client.orgName) {
          if (!affiliateMap[client.orgName]) affiliateMap[client.orgName] = 0;
          affiliateMap[client.orgName]++;
        }
      }
      const producingAffiliates = Object.entries(affiliateMap)
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1]);

      let affiliateBonus = 0;
      const affiliateBonusDetail = [];
      producingAffiliates.forEach(([affName, count], idx) => {
        if (idx >= 5) {
          let tierBonus = 0, tierLabel = '';
          for (const tier of AFFILIATE_TIERS) { if (count >= tier.min) { tierBonus = tier.bonus; tierLabel = tier.label; break; } }
          affiliateBonus += tierBonus;
          affiliateBonusDetail.push({ name: affName, clients: count, bonus: tierBonus, tier: tierLabel });
        }
      });

      // Affiliate clients grouped by their referring org, so the bonus view shows each affiliate and
      // which ones qualified (3+ qualified clients = producing), instead of one flat client list.
      // Affiliate clients this month, grouped by affiliate org. Only clients who paid their DOC FEE this
      // month are shown (the cohort that can qualify), each flagged qualified or not-yet, so the list
      // matches the "X of 3 qualified" count and the not-yet ones are visible to chase for a partial.
      const qualifiedSet = qualifiedKeySet;
      const affGroupMap = {};
      for (const client of clients) {
        if (!client.isAffiliate || !client.orgName || !client.hasDocFee) continue;
        if (!affGroupMap[client.orgName]) affGroupMap[client.orgName] = [];
        affGroupMap[client.orgName].push({ name: client.name, dealId: client.dealId || null, qualified: qualifiedSet.has(client.dealId || client.name) });
      }
      const affiliateGroups = Object.entries(affGroupMap).map(([org, cls]) => {
        const qualifiedCount = cls.filter(c => c.qualified).length;
        return { org, clientCount: cls.length, qualifiedCount, producing: qualifiedCount >= 3, clients: cls.sort((a, b) => Number(b.qualified) - Number(a.qualified)) };
      }).sort((a, b) => (Number(b.producing) - Number(a.producing)) || (b.qualifiedCount - a.qualifiedCount) || (b.clientCount - a.clientCount));

      // === REACTIVATION KICKER ($75 one-time for reviving dormant affiliate) ===
      // Dormant = affiliate org with no clients for 90+ days, then sends a new one this month
      let reactivationCount = 0;
      const reactivatedOrgs = [];
      
      // Build affiliate org payment history from FULL affiliate history (not just the rolling window)
      const orgPaymentHistory = {};
      for (const p of affiliateHistory) {
        if (!p.referrer_org) continue;
        // Match to this consultant
        const pFirst = (p.consultant_name || '').split(' ')[0].toLowerCase();
        if (pFirst !== firstName && !(lastName.length > 3 && (p.consultant_name || '').toLowerCase().includes(lastName))) continue;

        if (!orgPaymentHistory[p.referrer_org]) orgPaymentHistory[p.referrer_org] = [];
        orgPaymentHistory[p.referrer_org].push({ date: p.payment_date, month: p.payment_month });
      }

      for (const [orgName, payments] of Object.entries(orgPaymentHistory)) {
        const thisMonthPayments = payments.filter(p => p.month === targetMonth).sort((a, b) => a.date.localeCompare(b.date));
        const priorPayments = payments.filter(p => p.month < targetMonth).sort((a, b) => b.date.localeCompare(a.date));
        
        if (thisMonthPayments.length > 0 && priorPayments.length > 0) {
          const lastPriorDate = new Date(priorPayments[0].date);
          const firstThisMonth = new Date(thisMonthPayments[0].date);
          const daysDiff = Math.floor((firstThisMonth - lastPriorDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff >= 90) {
            // Check if already awarded
            if (!awardedOrgs.has(`reactivation_kicker:${orgName}`)) {
              reactivationCount++;
              reactivatedOrgs.push({ name: orgName, lastActive: priorPayments[0].date, reactivatedOn: thisMonthPayments[0].date, daysDormant: daysDiff });
            }
          }
        }
      }
      const reactivationBonus = reactivationCount * 75;

      // === NEW AFFILIATE LAUNCH ($75 one-time for new affiliate with 3+ clients in first 60 days) ===
      let newAffiliateLaunchCount = 0;
      const newAffiliateOrgs = [];
      const newAffiliateAllOrgs = []; // every new affiliate (org created <=60 days) with 1+ client, qualifying or not

      for (const [orgName, payments] of Object.entries(orgPaymentHistory)) {
        const allOrgPayments = payments.sort((a, b) => a.date.localeCompare(b.date));
        // "New" = the affiliate's Pipedrive ORG was created within the last 60 days.
        // (Not first-payment date — an old org sending its first client recently is an
        // active affiliate, not a new launch.)
        const addTime = await getOrgAddTime(orgName);
        if (!addTime) continue; // can't confirm a recent org creation → treat as existing/active
        const orgCreated = new Date(String(addTime).replace(' ', 'T') + (String(addTime).includes('Z') ? '' : 'Z'));
        const daysSinceCreated = Math.floor((new Date() - orgCreated) / (1000 * 60 * 60 * 24));

        if (daysSinceCreated <= 60) {
          // Count unique clients from this org, and how many are QUALIFIED (paid a doc fee AND advanced
          // to a partial/final). The $75 is earned on 3 qualified clients, not just 3 who paid anything.
          const orgClientKeys = new Set();
          for (const p of allPayments) {
            if (p.referrer_org === orgName && p.is_affiliate_deal) {
              orgClientKeys.add(p.pipedrive_deal_id || p.client_name);
            }
          }
          const count = orgClientKeys.size;
          let qualifiedCount = 0;
          for (const key of orgClientKeys) {
            const hasDoc = allPayments.some(ap => (ap.pipedrive_deal_id || ap.client_name) === key && ap.payment_type === 'doc_fee');
            const hasAdvanced = allPayments.some(ap => (ap.pipedrive_deal_id || ap.client_name) === key && ['partial', 'final', 'paid_in_full'].includes(ap.payment_type));
            if (hasDoc && hasAdvanced) qualifiedCount++;
          }
          if (count >= 1) {
            const qualifies = qualifiedCount >= 3;
            newAffiliateAllOrgs.push({ name: orgName, clients: count, qualifiedClients: qualifiedCount, daysSinceCreated, firstDate: allOrgPayments[0].date, qualifies });
            if (qualifies && !awardedOrgs.has(`new_affiliate_launch:${orgName}`)) {
              newAffiliateLaunchCount++;
              newAffiliateOrgs.push({ name: orgName, firstDate: allOrgPayments[0].date, orgCreated: addTime, clients: count, daysSinceCreated });
            }
          }
        }
      }
      const newAffiliateLaunchBonus = newAffiliateLaunchCount * 75;
      // PIF = client paid Doc Fee AND Final (no Partial) within 5 business days
      let pifCount = 0;
      const pifClients = [];
      for (const client of clients) {
        if (!client.hasDocFee || !client.hasFinal || client.hasPartial) continue;
        // Find doc fee date and final date
        const docPayment = client.payments.find(p => p.payment_type === 'doc_fee');
        const finalPayment = client.payments.find(p => p.payment_type === 'final' || p.payment_type === 'paid_in_full');
        if (!docPayment || !finalPayment) continue;
        // Only count if the client actually paid their fee in full. Compare what they
        // paid against the deal's total value in Pipedrive. A token "final" (e.g. $1)
        // leaves a balance owed and does NOT qualify. Falls back to a doc-fee floor
        // only if the deal value can't be read.
        const dealValue = await getDealValue(client.dealId);
        const paidInFull = dealValue > 0
          ? (Number(client.totalPaid) >= dealValue * 0.95)
          : (Number(finalPayment.amount) >= Number(docPayment.amount));
        if (!paidInFull) continue;
        // Count business days between doc fee and final
        const docDate = new Date(docPayment.payment_date);
        const finalDate = new Date(finalPayment.payment_date);
        let bizDays = 0;
        let d = new Date(docDate);
        d.setDate(d.getDate() + 1); // start counting from next day
        while (d <= finalDate) {
          if (d.getDay() !== 0 && d.getDay() !== 6) bizDays++;
          d.setDate(d.getDate() + 1);
        }
        const qualified = bizDays <= 5;
        if (qualified) pifCount++;
        // Keep clients who paid in full but missed the 5 business day window in the list, with the
        // reason, so consultants can see why they did not qualify instead of the client just vanishing.
        pifClients.push({
          name: client.name, dealId: client.dealId || nameToDealId[norm(client.name)] || null,
          docDate: docPayment.payment_date, finalDate: finalPayment.payment_date, bizDays,
          docAmount: docPayment.amount, finalAmount: finalPayment.amount, qualified,
          reason: qualified ? null : `Paid in full on business day ${bizDays} (must be within 5 to qualify)`
        });
      }
      const pifBonus = pifCount * 25;

      // === REVIEWS ===
      const myReviews = reviews.filter(r => r.assigned_to === consultant.id);
      const reviewCount = myReviews.length;
      const bbbReviews = myReviews.filter(r => (r.location_name || '').toLowerCase().includes('bbb')).length;
      const reviewBonus = Math.max(0, reviewCount - 10) * 5 + bbbReviews * 50;

      // === CLOSING % ===
      // Closing % = RTQ deals that paid doc fee (Zoho) / total RTQ consults (Pipedrive filter 523803)
      const myConsultData = Object.entries(consultsByOwner).filter(([k]) => {
        const kFirst = k.split(' ')[0].toLowerCase();
        return kFirst === firstName || (lastName.length > 3 && k.toLowerCase().includes(lastName));
      });
      const myConsultCount = myConsultData.reduce((sum, [_, v]) => sum + v.total, 0);
      const myConsultDealIds = myConsultData.flatMap(([_, v]) => v.dealIds);
      const isPaid = (id) => dealIdsWithDocFee.has(id) || docFeeNames.has(norm(dealMeta[id]?.name));
      const myDocsPaid = myConsultDealIds.filter(isPaid).length;
      const closingPct = myConsultCount > 0 ? Math.round((myDocsPaid / myConsultCount) * 100) : 0;

      // Per-deal breakdown behind the closing % — which quoted deals paid a doc fee, and how they matched
      const closeDetail = myConsultDealIds.map(id => {
        const byId = dealIdsWithDocFee.has(id);
        const byName = !byId && docFeeNames.has(norm(dealMeta[id]?.name));
        const paidDocFee = byId || byName;
        // Show the doc fee actually paid. If no doc fee was paid, show 0, never the Pipedrive quote
        // value, which would read as a payment that never happened.
        const docPay = paidDocFee
          ? allPayments.find(p => p.payment_type === 'doc_fee' && (String(p.pipedrive_deal_id) === String(id) || norm(p.client_name) === norm(dealMeta[id]?.name)))
          : null;
        return {
          name: dealMeta[id]?.name || `Deal #${id}`,
          dealId: id,
          amount: paidDocFee ? (parseFloat(docPay?.amount) || 0) : 0,
          paidDocFee,
          matchBy: byId ? 'deal id' : (byName ? 'name (no deal id on invoice)' : null),
        };
      }).sort((a, b) => (b.paidDocFee === a.paidDocFee ? a.name.localeCompare(b.name) : (b.paidDocFee ? 1 : -1)));

      // New-affiliate roster: for each new affiliate, the actual referred clients (from payment history
      // plus this month's consults), each flagged with what they have paid and what they still need to
      // become a qualified client (doc fee + a partial/final). This is what counts toward the 3.
      const newAffiliateProgress = newAffiliateAllOrgs.map(o => {
        const roster = {};
        for (const p of allPayments) {
          if (p.referrer_org === o.name && p.is_affiliate_deal) {
            const key = p.pipedrive_deal_id || p.client_name;
            if (!roster[key]) roster[key] = { name: p.client_name, dealId: p.pipedrive_deal_id || null, hasDoc: false, hasAdvanced: false };
            if (p.payment_type === 'doc_fee') roster[key].hasDoc = true;
            else if (['partial', 'final', 'paid_in_full'].includes(p.payment_type)) roster[key].hasAdvanced = true;
          }
        }
        // Referred deals in this month's consults that may not have paid yet
        for (const id of myConsultDealIds) {
          if (dealMeta[id]?.orgName === o.name) {
            if (!roster[id]) roster[id] = { name: dealMeta[id]?.name || `Deal #${id}`, dealId: id, hasDoc: isPaid(id), hasAdvanced: false };
          }
        }
        const clients = Object.values(roster).map(c => {
          const qualified = c.hasDoc && c.hasAdvanced;
          const status = qualified ? 'qualified' : (c.hasDoc ? 'needs_advance' : 'needs_doc');
          // Show the next owed invoice and its due date for anyone who still owes, whether that is the
          // doc fee (needs_doc) or a partial/final (needs_advance), so the consultant knows who to call.
          const due = status !== 'qualified' ? resolveDue(c.dealId, c.name) : null;
          return { name: c.name, dealId: c.dealId, qualified, status, dueDate: due?.dueDate || null, overdue: due?.overdue || false, owed: due?.owed || 0, dueReason: due?.dueReason || null };
        }).sort((a, b) => Number(b.qualified) - Number(a.qualified) || a.name.localeCompare(b.name));
        return {
          name: o.name, daysSinceCreated: o.daysSinceCreated, qualifies: o.qualifies,
          paidClients: o.clients,
          qualifiedClients: o.qualifiedClients || 0,
          alreadyAwarded: awardedOrgs.has(`new_affiliate_launch:${o.name}`),
          clients
        };
      }).sort((a, b) => (b.qualifiedClients - a.qualifiedClients) || (b.clients.length - a.clients.length));

      // === REACTIVATION ROSTER ===
      // A push list, parallel to newAffiliateProgress. Shows affiliate orgs the consultant can revive:
      //  - dormant   = a real prior payment, then 90+ days quiet, and nothing yet this month (push target)
      //  - reactivated = sent a fresh client this month after a 90+ day gap (earns the $75)
      // Each org carries the same per-client roster shape as the new-affiliate panel so the consultant
      // can see where every referred client stands.
      const nowTs = new Date();
      const reactivationProgress = [];
      for (const [orgName, payments] of Object.entries(orgPaymentHistory)) {
        const sorted = payments.slice().sort((a, b) => a.date.localeCompare(b.date));
        const thisMonthPays = sorted.filter(p => p.month === targetMonth);
        const priorPays = sorted.filter(p => p.month < targetMonth);
        if (priorPays.length === 0) continue; // brand-new affiliate, not a reactivation candidate
        const lastPrior = priorPays[priorPays.length - 1].date;
        let kind = null, daysDormant = 0;
        if (thisMonthPays.length > 0) {
          const gap = Math.floor((new Date(thisMonthPays[0].date) - new Date(lastPrior)) / (1000 * 60 * 60 * 24));
          if (gap >= 90) { kind = 'reactivated'; daysDormant = gap; }
        } else {
          const quiet = Math.floor((nowTs - new Date(lastPrior)) / (1000 * 60 * 60 * 24));
          if (quiet >= 90) { kind = 'dormant'; daysDormant = quiet; }
        }
        if (!kind) continue;
        const roster = {};
        for (const p of allPayments) {
          if (p.referrer_org === orgName && p.is_affiliate_deal) {
            const key = p.pipedrive_deal_id || p.client_name;
            if (!roster[key]) roster[key] = { name: p.client_name, dealId: p.pipedrive_deal_id || null, hasDoc: false, hasAdvanced: false };
            if (p.payment_type === 'doc_fee') roster[key].hasDoc = true;
            else if (['partial', 'final', 'paid_in_full'].includes(p.payment_type)) roster[key].hasAdvanced = true;
          }
        }
        for (const id of myConsultDealIds) {
          if (dealMeta[id]?.orgName === orgName && !roster[id]) {
            roster[id] = { name: dealMeta[id]?.name || `Deal #${id}`, dealId: id, hasDoc: isPaid(id), hasAdvanced: false };
          }
        }
        const rosterClients = Object.values(roster).map(c => {
          const qualified = c.hasDoc && c.hasAdvanced;
          const status = qualified ? 'qualified' : (c.hasDoc ? 'needs_advance' : 'needs_doc');
          const due = status !== 'qualified' ? resolveDue(c.dealId, c.name) : null;
          return { name: c.name, dealId: c.dealId, qualified, status, dueDate: due?.dueDate || null, overdue: due?.overdue || false, owed: due?.owed || 0, dueReason: due?.dueReason || null };
        }).sort((a, b) => Number(b.qualified) - Number(a.qualified) || a.name.localeCompare(b.name));
        reactivationProgress.push({
          name: orgName, kind, daysDormant, lastActive: lastPrior,
          reactivatedOn: kind === 'reactivated' ? thisMonthPays[0].date : null,
          alreadyAwarded: awardedOrgs.has(`reactivation_kicker:${orgName}`),
          clients: rosterClients
        });
      }
      // Reactivated first, then the longest-dormant orgs at the top of the push list.
      reactivationProgress.sort((a, b) =>
        (a.kind === b.kind ? 0 : (a.kind === 'reactivated' ? -1 : 1)) || (b.daysDormant - a.daysDormant)
      );
      const dormantReactivationCount = reactivationProgress.filter(o => o.kind === 'dormant').length;

      // === PAY-PAST-DOC-FEE RATE ===
      // Of clients who paid doc fee THIS month, how many also paid partial/final?
      const docFeeClientKeys = new Set(myPayments.filter(p => p.payment_type === 'doc_fee').map(p => p.pipedrive_deal_id || p.client_name));
      let paidPastDocCount = 0;
      for (const key of docFeeClientKeys) {
        // Check if this same client has a partial/final in ANY month in our database
        const hasMore = allPayments.some(p => 
          (p.pipedrive_deal_id || p.client_name) === key && 
          ['partial', 'final', 'paid_in_full'].includes(p.payment_type)
        );
        if (hasMore) paidPastDocCount++;
      }
      const payPastDocRate = docFeeClientKeys.size > 0 ? Math.round((paidPastDocCount / docFeeClientKeys.size) * 100) : 0;

      // === REFUND RATE ===
      const myRefunds = refunds.filter(r => {
        const rOwner = (r.consultant_name || r.owner_name || '').toLowerCase();
        return rOwner.includes(firstName) || (lastName.length > 3 && rOwner.includes(lastName));
      });
      const refundCount = myRefunds.length;
      const refundAmount = myRefunds.reduce((sum, r) => sum + (parseFloat(r.refund_amount) || parseFloat(r.amount) || 0), 0);
      const refundDeduction = myRefunds.reduce((sum, r) => sum + (parseFloat(r.deduction_amount) || 0), 0);

      // === WEEKLY SPRINT (all weeks in the month) ===
      const weeks = [];
      const mStart = new Date(monthStart);
      let wStart = new Date(mStart);
      // Find first Monday of the month (or use month start)
      while (wStart.getDay() !== 1 && wStart < now) wStart.setDate(wStart.getDate() + 1);
      if (wStart > mStart) { // partial first week
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() - 1);
        const wEndStr = wEnd.toISOString().split('T')[0];
        const weekPays = myPayments.filter(p => p.payment_type === 'doc_fee' && p.payment_date >= monthStart && p.payment_date <= wEndStr);
        weeks.push({ week: 1, start: monthStart, end: wEndStr, docs: weekPays.length, clients: weekPays.map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date, dealId: p.pipedrive_deal_id })) });
      }
      let weekNum = weeks.length + 1;
      while (wStart <= now && wStart.getMonth() === mStart.getMonth()) {
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
        const endStr = wEnd.toISOString().split('T')[0];
        const startStr = wStart.toISOString().split('T')[0];
        const weekPays = myPayments.filter(p => p.payment_type === 'doc_fee' && p.payment_date >= startStr && p.payment_date <= endStr);
        weeks.push({ week: weekNum, start: startStr, end: endStr, docs: weekPays.length, clients: weekPays.map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date, dealId: p.pipedrive_deal_id })) });
        weekNum++;
        wStart.setDate(wStart.getDate() + 7);
      }
      const currentWeekDocs = weeks.length > 0 ? weeks[weeks.length - 1].docs : 0;

      // === ADDITIONAL KPIs ===
      const onboardedClients = docFeeCount; // clients who paid doc fee this month = new signups
      const affiliateClientsAdded = myPayments.filter(p => p.payment_type === 'doc_fee' && p.is_affiliate_deal).length;
      const organicClientsAdded = docFeeCount - affiliateClientsAdded;
      
      // Average deal value (total sales / unique clients with payments)
      const avgDealValue = clients.length > 0 ? Math.round(totalSales / clients.length) : 0;
      
      // Revenue per consult
      const revenuePerConsult = myConsultCount > 0 ? Math.round(totalSales / myConsultCount) : 0;
      
      // Projected month end (based on business days elapsed vs remaining)
      const monthStartDate = new Date(monthStart);
      const today = new Date();
      let bizDaysElapsed = 0, totalBizDaysInMonth = 0;
      for (let d = new Date(monthStartDate); d.getMonth() === monthStartDate.getMonth(); d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0 && d.getDay() !== 6) {
          totalBizDaysInMonth++;
          if (d <= today) bizDaysElapsed++;
        }
      }
      const projectedSales = bizDaysElapsed > 0 ? Math.round((totalSales / bizDaysElapsed) * totalBizDaysInMonth) : 0;
      const dailyAvgSales = bizDaysElapsed > 0 ? Math.round(totalSales / bizDaysElapsed) : 0;
      
      // Clients past due — paid doc fee 14+ days ago but no partial/final yet
      const pastDueClients = [];
      for (const client of docFeeOnlyClients) {
        const docPayment = client.payments.find(p => p.payment_type === 'doc_fee');
        if (docPayment) {
          const daysSinceDoc = Math.floor((today - new Date(docPayment.payment_date)) / (1000 * 60 * 60 * 24));
          if (daysSinceDoc >= 14) {
            pastDueClients.push({ name: client.name, docDate: docPayment.payment_date, daysSinceDoc, amount: docPayment.amount });
          }
        }
      }
      
      // Stale clients — paid doc fee 30+ days ago, no further payment
      const staleClients = pastDueClients.filter(c => c.daysSinceDoc >= 30);

      // This month's clients vs prior month clients
      const thisMonthClients = clients.filter(c => c.hasDocFee);
      const priorMonthClients = clients.filter(c => !c.hasDocFee && (c.hasPartial || c.hasFinal));
      const thisMonthRevenue = thisMonthClients.reduce((s, c) => s + c.totalPaid, 0);
      const priorMonthRevenue = priorMonthClients.reduce((s, c) => s + c.totalPaid, 0);
      
      // Pending Payments — clients who have NOT paid in full (no final payment yet)
      const pendingClients30 = [];
      const pendingClients90 = [];
      for (const p of allPayments) {
        const pFirst = (p.consultant_name || '').split(' ')[0].toLowerCase();
        if (pFirst !== firstName && !(lastName.length > 3 && (p.consultant_name || '').toLowerCase().includes(lastName))) continue;
        if (p.payment_type !== 'doc_fee') continue;
        const key = p.pipedrive_deal_id || p.client_name;
        const daysSince = Math.floor((today - new Date(p.payment_date)) / (1000 * 60 * 60 * 24));
        const hasFinalPmt = allPayments.some(ap => (ap.pipedrive_deal_id || ap.client_name) === key && (ap.payment_type === 'final' || ap.payment_type === 'paid_in_full'));
        if (!hasFinalPmt) {
          const hasPartialPmt = allPayments.some(ap => (ap.pipedrive_deal_id || ap.client_name) === key && ap.payment_type === 'partial');
          const entry = { name: p.client_name, docDate: p.payment_date, daysSinceDoc: daysSince, hasPaidPartial: hasPartialPmt };
          if (daysSince >= 30) pendingClients30.push(entry);
          if (daysSince >= 90) pendingClients90.push(entry);
        }
      }
      
      // Organic vs Affiliate closing % — classify each consult by its org's affiliate label, NOT by
      // whether it converted. (The doc-fee flag only exists after they pay, which forced affiliate to 100%.)
      let organicConsults = 0, affiliateConsults = 0, organicDocsPaid = 0, affiliateDocsPaid = 0;
      for (const dealId of myConsultDealIds) {
        const org = (dealMeta[dealId]?.orgName || '').toLowerCase().trim();
        const isAff = !!org && affiliateOrgNames.has(org);
        const paid = isPaid(dealId);
        if (isAff) { affiliateConsults++; if (paid) affiliateDocsPaid++; }
        else { organicConsults++; if (paid) organicDocsPaid++; }
      }
      const organicClosingPct = organicConsults > 0 ? Math.round((organicDocsPaid / organicConsults) * 100) : 0;
      const affiliateClosingPct = affiliateConsults > 0 ? Math.round((affiliateDocsPaid / affiliateConsults) * 100) : 0;

      // === INVOICE / COLLECTION METRICS ===
      // Match invoices to this consultant by ALL their deals (any month) AND by client name, since
      // invoices store only the client name with a null deal id.
      const myAllPayments = allPayments.filter(p => {
        const pName = (p.consultant_name || '').toLowerCase().trim();
        const pParts = pName.split(/\s+/);
        if (pParts[0] === firstName) return true;
        if (lastName.length > 3 && pParts.some(pp => pp === lastName)) return true;
        if (pName === name.toLowerCase()) return true;
        return false;
      });
      const myDealIds = new Set(myAllPayments.filter(p => p.pipedrive_deal_id).map(p => String(p.pipedrive_deal_id)));
      const myClientNames = new Set(myAllPayments.filter(p => p.client_name).map(p => norm(p.client_name)));
      const myInvoices = invoiceData.filter(inv => {
        const did = inv.pipedrive_deal_id ? String(inv.pipedrive_deal_id) : null;
        if (did && myDealIds.has(did)) return true;
        return myClientNames.has(norm(inv.customer_name));
      });
      const overdueInvoices = myInvoices.filter(inv => inv.status === 'overdue');
      const partiallyPaidInvoices = myInvoices.filter(inv => inv.status === 'partially_paid');

      // Past due, reconciled against PAYMENTS so stale invoice balances can't create false past-dues.
      // For each deal we take the billed invoices (excluding additional rounds), allocate the deal's
      // collected payments oldest-invoice-first, and only what's left unpaid past its due date counts.
      const todayStr = now.toISOString().slice(0, 10);
      const isARtotal = (t) => { const n = Math.round(parseFloat(t) || 0); return n === 249 || n === 299; };
      const invByDeal = {};
      for (const inv of myInvoices) {
        if (isARtotal(inv.total)) continue;                       // additional rounds -> AM dashboard
        const did = inv.pipedrive_deal_id ? String(inv.pipedrive_deal_id) : (dealByClientName[norm(inv.customer_name)] || null);
        const k = did || norm(inv.customer_name);
        if (!invByDeal[k]) invByDeal[k] = { did, name: inv.customer_name, invoices: [] };
        invByDeal[k].invoices.push(inv);
      }
      const pastDueClientMap = {};
      for (const grp of Object.values(invByDeal)) {
        // de-dupe identical invoice rows (same due date + total), then oldest first
        const seen = new Set();
        const invs = grp.invoices.filter(inv => {
          const key = `${String(inv.due_date || '').slice(0, 10)}|${Math.round(parseFloat(inv.total) || 0)}`;
          if (seen.has(key)) return false; seen.add(key); return true;
        }).sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
        let paid = grp.did ? (paidByDeal[grp.did] || 0) : 0;   // collected so far on this deal
        const pastInvs = [];
        for (const inv of invs) {
          const total = Math.round(parseFloat(inv.total) || 0);
          let remaining;
          if (paid >= total) { paid -= total; remaining = 0; }   // this invoice is covered by payments
          else { remaining = total - paid; paid = 0; }
          const due = inv.due_date ? String(inv.due_date).slice(0, 10) : null;
          if (remaining > 1 && due && due < todayStr) {
            pastInvs.push({ balance: Math.round(remaining), dueDate: inv.due_date, daysOverdue: Math.floor((now - new Date(due)) / 86400000) });
          }
        }
        if (pastInvs.length === 0) continue;                      // fully paid (per payments) -> not past due
        const did = grp.did;
        const name = (did && nameByDeal[did]) || grp.name || `Deal ${did}`;
        pastInvs.sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || ''))); // newest first
        pastDueClientMap[did || grp.name] = { name, dealId: did, totalOwed: pastInvs.reduce((s, i) => s + i.balance, 0), invoices: pastInvs, newestDue: pastInvs[0].dueDate };
      }
      const pastDueList = Object.values(pastDueClientMap)
        .sort((a, b) => String(b.newestDue || '').localeCompare(String(a.newestDue || ''))); // newest-due client first
      const pastDueOwed = pastDueList.reduce((s, c) => s + c.totalOwed, 0);
      const overdueAmount = overdueInvoices.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);
      const totalInvoiced = myInvoices.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
      const totalCollected = myInvoices.reduce((s, i) => s + (parseFloat(i.total) - parseFloat(i.balance) || 0), 0);
      const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;
      
      // Invoices due this week
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
      const wkStart = weekStart.toISOString().split('T')[0];
      const wkEnd = weekEnd.toISOString().split('T')[0];
      const dueThisWeek = myInvoices.filter(inv => inv.due_date >= wkStart && inv.due_date <= wkEnd && parseFloat(inv.balance) > 0);
      const dueThisWeekAmount = dueThisWeek.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);

      // === TOTALS ===
      const totalBonus = accelerator.total + docClubBonus + pifBonus + affiliateBonus + reviewBonus + reactivationBonus + newAffiliateLaunchBonus;
      const totalEarnings = totalCommission + totalBonus;

      results[name] = {
        name, isVA,
        baseRate: (baseRate * 100).toFixed(0) + '%',
        affiliateRate: (affiliateRate * 100).toFixed(0) + '%',
        totalSales: Math.round(totalSales * 100) / 100,
        organicSales: Math.round(organicSales * 100) / 100,
        affiliateSales: Math.round(affiliateSales * 100) / 100,
        baseCommission: Math.round(baseCommission * 100) / 100,
        affiliateCommission: Math.round(affiliateCommission * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        paymentCount: myPayments.length,
        docFeeCount, partialCount, finalCount, paidInFullCount, unknownCount,
        // Qualified docs from payment data
        qualifiedDocs,
        docFeeOnlyCount: docFeeOnlyClients.length,
        totalClients: clients.length,
        accelerator, docClub, docClubBonus,
        pifCount, pifBonus, pifClients,
        reactivationCount, reactivationBonus, reactivatedOrgs, dormantReactivationCount,
        newAffiliateLaunchCount, newAffiliateLaunchBonus, newAffiliateOrgs, newAffiliateAllOrgs,
        producingAffiliates: producingAffiliates.length,
        affiliateDetail: producingAffiliates.map(([n, c]) => ({ name: n, clients: c })),
        affiliateBonus, affiliateBonusDetail,
        reviewCount, bbbReviews, reviewBonus,
        closingPct, consultCount: myConsultCount, docsPaid: myDocsPaid, closeDetail,
        weeklyDocs: currentWeekDocs, weeks,
        payPastDocRate,
        docFeeClients: docFeeClientKeys.size,
        paidPastDocClients: paidPastDocCount,
        meetsPayPastDocStandard: payPastDocRate >= 84,
        refundCount, refundAmount, refundDeduction,
        refundClients: myRefunds.map(r => ({ name: r.client_name || 'Unknown', amount: parseFloat(r.refund_amount) || parseFloat(r.amount) || 0, deduction: parseFloat(r.deduction_amount) || 0, pct: parseFloat(r.deduction_percentage) || 0, date: r.refund_date || null, dealId: r.pipedrive_deal_id || null })),
        // KPIs
        onboardedClients, affiliateClientsAdded, organicClientsAdded,
        avgDealValue, revenuePerConsult, projectedSales, dailyAvgSales,
        pastDueCount: pastDueClients.length, pastDueClients,
        staleCount: staleClients.length, staleClients,
        pendingCount30: pendingClients30.length, pendingClients30,
        pendingCount90: pendingClients90.length, pendingClients90,
        thisMonthClientCount: thisMonthClients.length, thisMonthRevenue: Math.round(thisMonthRevenue),
        priorMonthClientCount: priorMonthClients.length, priorMonthRevenue: Math.round(priorMonthRevenue),
        organicClosingPct, affiliateClosingPct,
        organicConsults, affiliateConsults, organicDocsPaid, affiliateDocsPaid,
        // Invoice / Collection
        overdueCount: overdueInvoices.length, overdueAmount: Math.round(overdueAmount),
        pastDueInvoiceCount: pastDueList.length, pastDueOwed: Math.round(pastDueOwed),
        partiallyPaidCount: partiallyPaidInvoices.length,
        collectionRate, totalInvoiced: Math.round(totalInvoiced), totalCollected: Math.round(totalCollected),
        dueThisWeekCount: dueThisWeek.length, dueThisWeekAmount: Math.round(dueThisWeekAmount),
        bizDaysElapsed, totalBizDaysInMonth,
        totalBonus: Math.round(totalBonus * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        meetsClosingStandard: closingPct >= 40,
        meetsReviewStandard: reviewCount >= 10,
        // CLIENT DETAIL for drill-down
        clientDetail: {
          notQualifiedList: notQualifiedClients.map(c => ({ name: c.name, dealId: c.dealId, reason: c.reason, paid: c.paid, owed: c.owed })),
          pastDueList,
          mtdList: myPayments.map(p => ({ name: p.client_name, dealId: resolveDealId(p), amount: p.amount, type: p.payment_type, date: p.payment_date, org: p.is_affiliate_deal ? p.referrer_org : null }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date))),
          affiliateOrgList: Object.entries(affiliateMap).map(([orgName, count]) => ({ name: orgName, clients: count, producing: count >= 3 }))
            .sort((a, b) => b.clients - a.clients),
          affiliateGroups,
          newAffiliateProgress,
          reactivationProgress,
          organicClients: myPayments.filter(p => !p.is_affiliate_deal).map(p => ({ name: p.client_name, dealId: resolveDealId(p), amount: p.amount, type: p.payment_type, date: p.payment_date, org: p.referrer_org || null, orgLabel: 'Org' })),
          affiliateClients: myPayments.filter(p => p.is_affiliate_deal).map(p => ({ name: p.client_name, dealId: resolveDealId(p), amount: p.amount, type: p.payment_type, date: p.payment_date, org: p.referrer_org })),
          docFeeList: myPayments.filter(p => p.payment_type === 'doc_fee').map(p => ({ name: p.client_name, dealId: resolveDealId(p), amount: p.amount, date: p.payment_date })),
          partialList: myPayments.filter(p => p.payment_type === 'partial').map(p => ({ name: p.client_name, dealId: resolveDealId(p), amount: p.amount, date: p.payment_date })),
          finalList: myPayments.filter(p => p.payment_type === 'final' || p.payment_type === 'paid_in_full').map(p => ({ name: p.client_name, dealId: resolveDealId(p), amount: p.amount, date: p.payment_date, type: (p.payment_type === 'paid_in_full' || !((windowClientMap[p.pipedrive_deal_id || p.client_name] || {}).hasPartial)) ? '\uD83D\uDCB0 Full Payment' : 'Final (payment plan)' })),
          qualifiedList: qualifiedClients.map(c => ({ name: c.name, dealId: c.dealId, totalPaid: c.totalPaid, org: c.orgName, isAffiliate: c.isAffiliate, payments: c.payments.map(p => ({ type: p.payment_type, amount: p.amount, date: p.payment_date })) })),
          docFeeOnlyList: docFeeOnlyClients.map(c => ({ name: c.name, dealId: c.dealId, totalPaid: c.totalPaid })),
          reviewList: myReviews.map(r => ({ reviewer: r.reviewer_name, rating: r.rating, date: r.review_date, location: r.location_name, dealId: r.pipedrive_deal_id || null, text: (r.review_text || '').substring(0, 100) })),
          consultList: myConsultDealIds.map(id => {
            const paid = dealIdsWithDocFee.has(id);
            const payment = allPayments.find(p => p.pipedrive_deal_id === id && p.payment_type === 'doc_fee');
            // Show the doc fee actually paid. If they have not paid, show 0, never the Pipedrive
            // quote value, which would read as a payment that never happened.
            return { dealId: id, paid, clientName: payment?.client_name || dealMeta[id]?.name || `Deal #${id}`, amount: paid ? (payment?.amount || 0) : 0, date: payment?.payment_date || '' };
          }).sort((a, b) => b.paid - a.paid),
        }
      };
    }

    // Sprint
    let sprintWinner = null, sprintMax = 0;
    for (const [n, d] of Object.entries(results)) { if (d.weeklyDocs > sprintMax) { sprintMax = d.weeklyDocs; sprintWinner = n; } }

    // Weekly sprint winners — only for COMPLETED weeks (Sunday has passed)
    const weeklyWinners = [];
    const allWeeks = Object.values(results)[0]?.weeks || [];
    const todayStr = new Date().toISOString().split('T')[0];
    for (const week of allWeeks) {
      const weekComplete = week.end < todayStr; // week end (Sunday) is before today
      let bestName = null, bestDocs = 0;
      for (const [n, d] of Object.entries(results)) {
        const w = (d.weeks || []).find(wk => wk.week === week.week);
        if (w && w.docs > bestDocs) { bestDocs = w.docs; bestName = n; }
      }
      weeklyWinners.push({ week: week.week, start: week.start, end: week.end, winner: weekComplete ? bestName : null, leader: bestName, docs: bestDocs, complete: weekComplete });
    }

    // COTM
    let cotmCandidate = null, cotmMaxDocs = 0;
    for (const [n, d] of Object.entries(results)) {
      if (d.qualifiedDocs > cotmMaxDocs && d.producingAffiliates >= 5 && d.meetsReviewStandard) { cotmMaxDocs = d.qualifiedDocs; cotmCandidate = n; }
    }

    // Second pass: add sprint bonus (needs weeklyWinners computed above)
    for (const [n, d] of Object.entries(results)) {
      const weeksWon = weeklyWinners.filter(w => w.complete && w.winner === n).length;
      d.sprintBonus = weeksWon * 150;
      d.weeksWon = weeksWon;
      d.totalBonus = Math.round((d.totalBonus + d.sprintBonus) * 100) / 100;
      d.totalEarnings = Math.round((d.totalCommission + d.totalBonus) * 100) / 100;
    }

    // Team-wide totals
    const todayPayments = payments.filter(p => p.payment_date === todayStr);
    const todaySales = todayPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const todayDocs = todayPayments.filter(p => p.payment_type === 'doc_fee').length;
    const todayPartials = todayPayments.filter(p => p.payment_type === 'partial').length;
    const todayFinals = todayPayments.filter(p => p.payment_type === 'final' || p.payment_type === 'paid_in_full').length;
    const mtdSales = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const mtdDocs = payments.filter(p => p.payment_type === 'doc_fee').length;
    const mtdPartials = payments.filter(p => p.payment_type === 'partial').length;
    const mtdFinals = payments.filter(p => p.payment_type === 'final' || p.payment_type === 'paid_in_full').length;
    const firstCon = Object.values(results)[0] || {};
    const mtdProjection = (firstCon.bizDaysElapsed || 1) > 0 ? Math.round((mtdSales / (firstCon.bizDaysElapsed || 1)) * (firstCon.totalBizDaysInMonth || 22)) : 0;

    // Per-consultant today totals
    const todayByConsultant = {};
    for (const p of todayPayments) {
      const cName = p.consultant_name || 'Unknown';
      if (!todayByConsultant[cName]) todayByConsultant[cName] = { sales: 0, docs: 0, partials: 0, finals: 0, payments: 0 };
      todayByConsultant[cName].sales += parseFloat(p.amount) || 0;
      todayByConsultant[cName].payments++;
      if (p.payment_type === 'doc_fee') todayByConsultant[cName].docs++;
      if (p.payment_type === 'partial') todayByConsultant[cName].partials++;
      if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') todayByConsultant[cName].finals++;
    }

    // YTD pulled straight from the table by payment_month (the field every row reliably carries and the
    // same one MTD uses), instead of filtering the date-windowed set. That window keys off payment_date,
    // so any 2026 payment with a blank/odd date was being dropped and the YTD total came up short.
    const year = targetMonth.split('-')[0];
    const ytdPayments = await supaGet('consultant_payments', `payment_month=like.${year}-*&excluded_from_bonus=not.is.true&select=pipedrive_deal_id,client_name,payment_type,payment_month,payment_date,amount,consultant_name,is_affiliate_deal,referrer_org`);

    const ytdSales = ytdPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const ytdDocs = ytdPayments.filter(p => p.payment_type === 'doc_fee').length;
    
    // YTD per consultant
    const ytdByConsultant = {};
    for (const p of ytdPayments) {
      const cName = p.consultant_name || 'Unknown';
      if (!ytdByConsultant[cName]) ytdByConsultant[cName] = { sales: 0, docs: 0, partials: 0, finals: 0, payments: 0, affiliateSales: 0, months: new Set() };
      ytdByConsultant[cName].sales += parseFloat(p.amount) || 0;
      ytdByConsultant[cName].payments++;
      ytdByConsultant[cName].months.add(p.payment_month);
      if (p.payment_type === 'doc_fee') ytdByConsultant[cName].docs++;
      if (p.payment_type === 'partial') ytdByConsultant[cName].partials++;
      if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') ytdByConsultant[cName].finals++;
      if (p.is_affiliate_deal) ytdByConsultant[cName].affiliateSales += parseFloat(p.amount) || 0;
    }
    // Convert Sets to counts
    for (const c of Object.values(ytdByConsultant)) { c.monthsActive = c.months.size; delete c.months; }

    // Add today and YTD to each consultant result.
    // Match payments by the SAME fuzzy first/last-name logic the main loop uses, so consultants whose
    // payment consultant_name differs from their user name (e.g. extra middle names) still aggregate.
    const matchPay = (p, fn, ln, full) => {
      const pName = (p.consultant_name || '').toLowerCase().trim();
      const pParts = pName.split(/\s+/);
      if (pParts[0] === fn) return true;
      if (ln.length > 3 && pParts.some(pp => pp === ln)) return true;
      if (pName === full) return true;
      return false;
    };
    for (const [n, d] of Object.entries(results)) {
      const fn = n.split(' ')[0].toLowerCase();
      const ln = n.split(' ').slice(-1)[0].toLowerCase();
      const full = n.toLowerCase();
      const myYtd = ytdPayments.filter(p => matchPay(p, fn, ln, full));
      const myToday = todayPayments.filter(p => matchPay(p, fn, ln, full));
      let yS = 0, yAff = 0, yD = 0, yP = 0, yF = 0; const yMonths = new Set();
      for (const p of myYtd) {
        const amt = parseFloat(p.amount) || 0;
        yS += amt; yMonths.add(p.payment_month);
        if (p.payment_type === 'doc_fee') yD++;
        else if (p.payment_type === 'partial') yP++;
        else if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') yF++;
        if (p.is_affiliate_deal) yAff += amt;
      }
      d.ytd = { sales: Math.round(yS), affiliateSales: Math.round(yAff), docs: yD, partials: yP, finals: yF, payments: myYtd.length, monthsActive: yMonths.size };
      let tS = 0, tD = 0, tP = 0, tF = 0;
      for (const p of myToday) {
        tS += parseFloat(p.amount) || 0;
        if (p.payment_type === 'doc_fee') tD++;
        else if (p.payment_type === 'partial') tP++;
        else if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') tF++;
      }
      d.today = { sales: Math.round(tS), docs: tD, partials: tP, finals: tF, payments: myToday.length };
    }

    // Apply the paysheet mirror to the freshly computed results before caching/returning.
    await applyPaysheetMirror(results);
    // Override company totals from the paysheet so the leaderboard's company MTD matches the
    // Payment Dashboard exactly (the per-consultant numbers were mirrored inside the function).
    const teamMtdSales = paysheetTotals ? paysheetTotals.mtdSales : mtdSales;
    const teamTodaySales = paysheetTotals ? paysheetTotals.todaySales : todaySales;
    const teamMtdDocs = paysheetTotals ? paysheetTotals.mtdDocs : mtdDocs;
    const teamMtdPartials = paysheetTotals ? paysheetTotals.mtdPartials : mtdPartials;
    const teamMtdFinals = paysheetTotals ? paysheetTotals.mtdFinals : mtdFinals;

    // Auto-save newly detected one-time bonuses
    for (const [n, d] of Object.entries(results)) {
      for (const org of (d.reactivatedOrgs || [])) {
        if (!awardedOrgs.has(`reactivation_kicker:${org.name}`)) {
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/bonus_awards`, {
              method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ consultant_name: n, bonus_type: 'reactivation_kicker', org_name: org.name, amount: 75, awarded_month: targetMonth })
            });
          } catch(e) {}
        }
      }
      for (const org of (d.newAffiliateOrgs || [])) {
        if (!awardedOrgs.has(`new_affiliate_launch:${org.name}`)) {
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/bonus_awards`, {
              method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ consultant_name: n, bonus_type: 'new_affiliate_launch', org_name: org.name, amount: 75, awarded_month: targetMonth })
            });
          } catch(e) {}
        }
      }
    }

    const responseBody = JSON.stringify({
        month: monthLabel, monthKey: targetMonth,
        teamTotals: { todaySales: teamTodaySales, todayDocs, todayPartials, todayFinals, mtdSales: teamMtdSales, mtdDocs: teamMtdDocs, mtdPartials: teamMtdPartials, mtdFinals: teamMtdFinals, mtdProjection, ytdSales, ytdDocs, totalPayments: payments.length,
          totalOverdue: invoiceData.filter(i => i.status === 'overdue').length,
          totalOverdueAmount: Math.round(invoiceData.filter(i => i.status === 'overdue').reduce((s, i) => s + (parseFloat(i.balance) || 0), 0)),
          totalInvoices: invoiceData.length
        },
        consultants: results,
        sprintWinner, sprintMaxDocs: sprintMax, weeklyWinners,
        consultantOfMonth: cotmCandidate,
        totalPayments: payments.length,
        companyConsultTotal,
        closingDataOk: rtqReliable,
        dataSources: { payments: 'Zoho Invoice API (live)', milestones: 'Derived from payment data' },
        // Diagnostic
        affiliateFlaggedCount: payments.filter(p => p.is_affiliate_deal === true).length,
        orgEmailCount: payments.filter(p => p.org_has_email === true).length,
        sampleOrgs: [...new Set(payments.map(p => p.referrer_org).filter(Boolean))].slice(0, 10),
        buildTag: 'v286fh',
        updatedAt: now.toISOString()
      });

    // Save to cache so subsequent loads are instant until the TTL expires — but ONLY if the RTQ fetch
    // was reliable this run. A failed/partial fetch must never overwrite good closing-rate data.
    if (rtqReliable) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ cache_key: CACHE_KEY, cache_value: responseBody, updated_at: new Date().toISOString() })
        });
      } catch(e) { /* caching is best-effort */ }
    }

    // Persist any org creation dates we looked up this run so future runs never re-fetch them.
    if (orgAddTimeDirty) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ cache_key: 'org_add_times', cache_value: JSON.stringify(orgAddTimePersist), updated_at: new Date().toISOString() })
        });
      } catch(e) { /* best-effort */ }
    }

    // If this run's RTQ data was unreliable but we have a last-good cache, serve that instead so the
    // team keeps seeing real closing rates rather than a blip of zeros.
    if (!rtqReliable && priorCacheBody) {
      return { statusCode: 200, headers, body: priorCacheBody };
    }

    return { statusCode: 200, headers, body: responseBody };
  } catch (error) {
    console.error('Bonus metrics error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
