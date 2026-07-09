// CSR Bonus Metrics — computes the CSR Performance & Bonus Plan from cs_deals.
// Phase 1: Report Bonus (fully from cs_deals) + a debug block reporting the data shape
// (distinct monitoring sites + pipeline/stage names) so the gate can be locked precisely.
// Conversion / Review / Spotlight bonuses are wired in once the gate names are confirmed.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const MOVED_TO_QUOTED_FILTER = 523848; // "deals moved to Quoted 2.0 this month"

// Fetch the set of deal IDs returned by a Pipedrive filter.
async function fetchFilterDealIds(filterId) {
  const ids = new Set();
  let start = 0;
  for (let i = 0; i < 20; i++) {
    const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?api_token=${PIPEDRIVE_API_KEY}&filter_id=${filterId}&start=${start}&limit=500`;
    const r = await fetch(url);
    if (!r.ok) break;
    const d = await r.json();
    for (const deal of (d.data || [])) ids.add(String(deal.id));
    if (!(d.additional_data && d.additional_data.pagination && d.additional_data.pagination.more_items_in_collection)) break;
    start += 500;
  }
  return ids;
}

const CSR_STAFF = ['Kenneth Larios', 'Vic Baltodano', 'Reni Reyes', 'Araceli Carrion', 'Jenifer Venegas', 'Cesar Cardona', 'Ethel Gatdula', 'CJ'];

// ---- CONFIG: pipelines that count a report (early pipelines, before later CRS rounds) ----
// Matched (case-insensitive, exact) against the PIPELINE the deal was in WHEN the monitoring site was set.
const REPORT_PIPELINE_GATE = ['new leads', 'reports', 'quoted 2.0'];

// ---- Report Bonus rules ----
const FIRST_PAID_REPORT = 35;        // first 35 IDIQ reports don't pay
const TOTAL_REPORTS_QUALIFIER = 50;  // must hit 50 TOTAL reports (any site) to be eligible
function reportTierRate(idiq) {
  if (idiq >= 81) return 7;
  if (idiq >= 66) return 5;
  if (idiq >= FIRST_PAID_REPORT) return 3;
  return 0;
}
function computeReportBonus(idiqCount, totalReports) {
  const qualified = totalReports >= TOTAL_REPORTS_QUALIFIER;
  const paidReports = Math.max(0, idiqCount - FIRST_PAID_REPORT); // reports past #35
  const rate = reportTierRate(idiqCount);
  const bonus = qualified ? paidReports * rate : 0;
  return { qualified, paidReports, rate, bonus };
}

// ---- Base pay (config) ----
const BASE_PAY = { month1: 1000, ongoing: 1280 };

// ---- Conversion Bonus rules ----
// Pipeline progression order. A report "reached quote" at Quoted 2.0+, "reached docs" at SOLD+.
const PIPELINE_RANK = { 'new leads': 1, 'reports': 2, 'quoted 2.0': 3, 'sold': 4, 'c.r.s.': 5, 'additional c.r.s.': 6 };
const QUOTE_RANK = 3;   // Quoted 2.0
const DOCS_RANK = 4;    // SOLD (Agreement SENT)
const REPORTS_RANK = 2; // Reports pipeline
const CONVERSION_BONUS = 50;
const RPTS_TO_QUOTE_TARGET = 0.50;
const QUOTE_TO_DOCS_TARGET = 0.40;
function pipelineRank(name) { return PIPELINE_RANK[(name || '').trim().toLowerCase()] || 0; }

// ---- Spotlight ----
const SPOTLIGHT_TOP_CONVERTER = 50;   // highest IDIQ enrollment rate among qualified CSRs
const SPOTLIGHT_ALL_STAR = 100;       // manual award

async function pdGetDealOwner(dealId) {
  // Returns the Pipedrive deal owner's name (user_id.name), or null. Used to attribute a report
  // that has no Call Center Rep to whoever owns the deal, for tracking only.
  try {
    const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const o = j && j.data ? j.data.user_id : null;
    if (!o) return null;
    if (typeof o === 'object') return o.name || null;
    return null;
  } catch (e) { return null; }
}

async function supaGet(table, query) {
  // Paginate past the 1000-row cap
  const out = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function monthOf(row) {
  // Date a report by when the monitoring site was set (when it was pulled).
  // Fallback: if that date is missing (older/backfilled deals where Pipedrive did not
  // record a set-date), use the deal creation date so the report still counts toward
  // its month instead of being silently dropped.
  const d = row.monitoring_site_set_at || row.deal_created_at || null;
  return d ? String(d).slice(0, 7) : null;
}
function dayOf(row) {
  // Full date (yyyy-MM-dd) a report was pulled, same source as monthOf.
  const d = row.monitoring_site_set_at || row.deal_created_at || null;
  return d ? String(d).slice(0, 10) : null;
}
function gatePass(row) {
  // Prefer the pipeline recorded when the monitoring site was set.
  // If that is missing (older/backfilled deals), the report was pulled before set-pipeline
  // tracking existed; since it has a monitoring site, treat it as a valid report rather than
  // gating it out by its CURRENT (later) pipeline.
  const setPipeline = (row.monitoring_site_set_pipeline || '').trim().toLowerCase();
  if (!setPipeline) return true;  // backfilled: no set-pipeline recorded -> count it
  return REPORT_PIPELINE_GATE.includes(setPipeline);
}
function classify(ms) {
  const s = (ms || '').toLowerCase();
  if (!s) return null;
  if (s.includes('smart')) return 'smart';                          // Smart Credit, incl. "Smart Credit (Client Sent Reports)"
  if (s.includes('identity') || s.includes('idiq')) return 'idiq'; // Identity IQ, incl. "Identity Iq (Client Sent Reports)". Generic "client sent"/Experian fall through to other.
  return 'other';                                                   // Experian.com, My Score IQ, CreditBuilder IQ — count toward the 45 only
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const month = params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // "Today" in US Central time (business timezone), so the daily count matches the team's day.
    // Allow override via ?today=YYYY-MM-DD for testing.
    const todayStr = params.today || new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
    // Only show a "today" count when viewing the current month (today is meaningless for past months).
    const viewingCurrentMonth = month === todayStr.slice(0, 7);

    const rows = await supaGet('cs_deals', 'select=deal_id,deal_title,call_center_rep_name,account_manager_name,monitoring_site,monitoring_site_set_at,monitoring_site_set_stage,monitoring_site_set_pipeline,deal_created_at,pipeline_name,stage_name');

    // Review data: reviews are assigned to a user (assigned_to = user id) in the IncomingReviews page.
    // Map each CSR name to their user id, then count this month's assigned reviews. BBB = location name contains "bbb".
    const monthStart = `${month}-01`;
    // Credit follows the month the review was LEFT (review_date), not when it was claimed/approved.
    const [rvy, rvm] = month.split('-').map(Number);
    const nextMonthStart = `${new Date(rvy, rvm, 1).getFullYear()}-${String(new Date(rvy, rvm, 1).getMonth() + 1).padStart(2, '0')}-01`;
    let csrUsers = [];
    let reviews = [];
    try { csrUsers = await supaGet('users', 'department=eq.customer_support&select=id,name,hire_date'); } catch (e) {}
    try { reviews = await supaGet('incoming_reviews', `or=(and(review_date.gte.${monthStart},review_date.lt.${nextMonthStart}),and(review_date.is.null,created_at.gte.${monthStart},created_at.lt.${nextMonthStart}))&select=assigned_to,location_name,reviewer_name,rating,review_date`); } catch (e) {}
    const nameToUserId = {};
    const nameToHire = {};
    for (const u of csrUsers) if (u.name) { nameToUserId[u.name.trim().toLowerCase()] = u.id; nameToHire[u.name.trim().toLowerCase()] = u.hire_date || null; }

    // Live staff roster: the curated names (which match Pipedrive owner spellings and nicknames) PLUS any
    // customer_support user in the database who is not already represented, so a newly added CSR shows up
    // automatically. A database name is treated as the same person as a curated name when one's word set is
    // contained in the other (e.g. "Reni" vs "Reni Reyes", "Araceli Carrion" vs "Araceli Carrion Garcia"),
    // so nickname and full-name variants collapse to a single row instead of doubling up.
    const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const toks = s => new Set(normName(s).split(' ').filter(Boolean));
    const subsetOf = (a, b) => { if (!a.size) return false; for (const t of a) if (!b.has(t)) return false; return true; };
    const staff = CSR_STAFF.slice();
    const staffSeen = new Set(staff.map(n => normName(n)));
    const staffToks = staff.map(toks);
    for (const u of csrUsers) {
      const nm = (u.name || '').trim();
      if (!nm) continue;
      const key = normName(nm);
      if (staffSeen.has(key)) continue;
      const t = toks(nm);
      if (staffToks.some(st => subsetOf(t, st) || subsetOf(st, t))) continue; // same person, different spelling
      staff.push(nm); staffSeen.add(key); staffToks.push(t);
    }

    // Doc fee conversions: which of these CS deals have a paid doc fee (from consultant_payments)
    const dealIds = rows.map(r => r.deal_id).filter(Boolean);
    const docFeeDealIds = new Set();
    const docFeeDateByDeal = {}; // deal_id -> earliest doc fee payment_date (yyyy-MM-dd)
    for (let i = 0; i < dealIds.length; i += 100) {
      const chunk = dealIds.slice(i, i + 100);
      try {
        const pays = await supaGet('consultant_payments', `payment_type=eq.doc_fee&excluded_from_bonus=not.is.true&pipedrive_deal_id=in.(${chunk.join(',')})&select=pipedrive_deal_id,payment_date`);
        for (const p of pays) {
          if (p.pipedrive_deal_id == null) continue;
          const id = String(p.pipedrive_deal_id);
          docFeeDealIds.add(id);
          const d = p.payment_date ? String(p.payment_date).slice(0, 10) : null;
          if (d && (!docFeeDateByDeal[id] || d < docFeeDateByDeal[id])) docFeeDateByDeal[id] = d;
        }
      } catch (e) {}
    }

    // Reports-to-Quoted: deals that moved to Quoted 2.0 this month (Pipedrive filter). Falls back to current pipeline if unavailable.
    let movedToQuoted = new Set();
    try { movedToQuoted = await fetchFilterDealIds(MOVED_TO_QUOTED_FILTER); } catch (e) {}
    const useQuotedFilter = movedToQuoted.size > 0;

    // Per-CSR tallies for the requested month
    const tally = {};
    const ops = {};
    const dist = {};
    for (const name of staff) {
      tally[name] = { idiq: 0, smart: 0, other: 0, total: 0, convTotal: 0, reachedQuote: 0, reachedDocs: 0, outOfMonth: 0, gatedOut: 0, reportList: [], quoteList: [], docsList: [], todayTotal: 0, todayIdiq: 0, todaySmart: 0, todayOther: 0, todayList: [], todayDocFees: 0, todayDocFeeList: [] };
      ops[name] = { newDeals: 0, reachedReports: 0, reachedQuoted: 0, docFeeCollected: 0, monthDealList: [] };
      dist[name] = { total: 0, byStage: {}, allDeals: [] };
    }

    // Owner-based tracking: reports with NO Call Center Rep get attributed to the deal OWNER
    // (mapped to an employee/user name when we can), tracked for visibility only (no bonus).
    const ownerTally = {};   // ownerName -> { idiq, smart, other, total, reportList, ownerBased:true }
    // Pipedrive owner names are already the employee names (e.g. "Cindy", "Eric De La Rosa"), so we
    // use them directly. No frontend `users` variable exists in this function.
    const mapOwnerToEmployee = (ownerName) => {
      const n = (ownerName || '').trim();
      return n || null;
    };

    // Debug: what the data actually looks like
    const msSeen = {};            // distinct monitoring_site -> count
    const stageSeen = {};         // "pipeline | stage" -> count

    // Targeted rep-name aliases: explicit Pipedrive spelling variants -> canonical roster name.
    const REP_ALIASES = { 'Cj': 'CJ', 'cj': 'CJ', 'Evereth': 'CJ' };
    // Build a lookup so a short Pipedrive rep name ("Cesar") resolves to the full roster name
    // ("Cesar Cardona") without needing a manual alias for every person. Exact match wins; then
    // first-name match (unique); then token-subset match (unique).
    const staffByExact = {};
    const staffByFirst = {};
    for (const sname of staff) {
      staffByExact[normName(sname)] = sname;
      const fw = (sname.trim().split(/\s+/)[0] || '').toLowerCase();
      if (fw) { (staffByFirst[fw] = staffByFirst[fw] || []).push(sname); }
    }
    const resolveRep = (raw) => {
      if (!raw) return null;
      const r = raw.trim();
      if (REP_ALIASES[r]) return REP_ALIASES[r];
      // exact roster match
      if (staffByExact[normName(r)]) return staffByExact[normName(r)];
      // unique first-name match ("Cesar" -> "Cesar Cardona")
      const fw = (r.split(/\s+/)[0] || '').toLowerCase();
      if (fw && staffByFirst[fw] && staffByFirst[fw].length === 1) return staffByFirst[fw][0];
      // unique token-subset match (one name's words are a subset of the other)
      const rt = toks(r);
      const subsetMatches = staff.filter(sn => { const st = toks(sn); return subsetOf(rt, st) || subsetOf(st, rt); });
      if (subsetMatches.length === 1) return subsetMatches[0];
      return r;
    };

    for (const r of rows) {
      const ms = r.monitoring_site;
      if (ms) msSeen[ms] = (msSeen[ms] || 0) + 1;
      const stageKey = `${r.pipeline_name || '(none)'} | ${r.stage_name || '(none)'}`;
      stageSeen[stageKey] = (stageSeen[stageKey] || 0) + 1;

      // Every deal in the CS filter counts as a report for its rep. A deal with a recognized
      // monitoring site is split into idiq/smart; a deal with no/blank site still counts, as "other".
      const cls = classify(ms) || 'other';
      const rep = resolveRep(r.call_center_rep_name);

      // Current stage distribution: where ALL of a known CSR's deals sit right now
      if (rep && dist[rep]) {
        const stageKey = `${r.pipeline_name || 'Unknown'}${r.stage_name ? ' | ' + r.stage_name : ''}`;
        dist[rep].total++;
        dist[rep].byStage[stageKey] = (dist[rep].byStage[stageKey] || 0) + 1;
        dist[rep].allDeals.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, pipeline: r.pipeline_name || 'Unknown', stage: r.stage_name || null, stageKey });
      }

      // Operational KPIs: funnel over THIS MONTH's deals for a known CSR (created this month)
      if (rep && ops[rep] && String(r.deal_created_at || '').slice(0, 7) === month) {
        const dealRank = pipelineRank(r.pipeline_name);
        const hasDocFee = docFeeDealIds.has(String(r.deal_id));
        ops[rep].newDeals++;
        if (dealRank >= REPORTS_RANK) ops[rep].reachedReports++;
        if (dealRank >= QUOTE_RANK) ops[rep].reachedQuoted++;
        if (hasDocFee) ops[rep].docFeeCollected++;
        ops[rep].monthDealList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, pipeline: r.pipeline_name || 'Unknown', stage: r.stage_name || null, rank: dealRank, docFee: hasDocFee, created: r.deal_created_at || null });
      }

      // No Call Center Rep who is a known CSR: instead of dropping the report, attribute it to the
      // deal OWNER for tracking only (flagged ownerBased, excluded from bonus). Only for in-month,
      // gate-passing, sited reports so we do not fan out Pipedrive lookups over the whole history.
      if (!rep || !tally[rep]) {
        if (ms && monthOf(r) === month && gatePass(r)) {
          const ownerRaw = await pdGetDealOwner(r.deal_id);
          const ownerName = mapOwnerToEmployee(ownerRaw);
          if (ownerName) {
            if (!ownerTally[ownerName]) ownerTally[ownerName] = { idiq: 0, smart: 0, other: 0, total: 0, reportList: [], ownerBased: true };
            ownerTally[ownerName][cls]++;
            ownerTally[ownerName].total++;
            ownerTally[ownerName].reportList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, site: r.monitoring_site, type: cls });
          }
        }
        continue;
      }

      if (monthOf(r) !== month) { tally[rep].outOfMonth++; continue; }

      // Conversion tracking runs for ALL of the rep's report deals this month, BEFORE the
      // pipeline gate. A conversion means the deal moved FORWARD (to quote / paid a doc fee),
      // so gating it by "must still be in an early pipeline" would wrongly drop the very deals
      // that converted. (The gate below only limits which reports COUNT toward the report bonus.)
      {
        const rankC = pipelineRank(r.pipeline_name);
        const reachedQuoteC = useQuotedFilter ? movedToQuoted.has(String(r.deal_id)) : (rankC >= QUOTE_RANK);
        const paidDocFeeC = docFeeDealIds.has(String(r.deal_id));
        tally[rep].convTotal++;                       // all of the rep's month report-deals (ungated) = conversion denominator
        if (reachedQuoteC) {
          tally[rep].reachedQuote++;
          tally[rep].quoteList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, site: r.monitoring_site, type: cls });
        }
        if (paidDocFeeC) {
          tally[rep].reachedDocs++;
          tally[rep].docsList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, site: r.monitoring_site, type: cls });
        }
        if (viewingCurrentMonth && docFeeDateByDeal[String(r.deal_id)] === todayStr) {
          tally[rep].todayDocFees++;
          tally[rep].todayDocFeeList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, site: r.monitoring_site });
        }
      }

      // No pipeline gate: every report with a monitoring site counts, even if the deal has since
      // advanced to SOLD / C.R.S. A report converting must never make it stop counting. (Joe's rule.)

      tally[rep][cls]++;
      tally[rep].total++;

      // Today's pulls (same gate/month rules already passed): track separately for daily tracking.
      if (viewingCurrentMonth && dayOf(r) === todayStr) {
        tally[rep].todayTotal++;
        if (cls === 'idiq') tally[rep].todayIdiq++;
        else if (cls === 'smart') tally[rep].todaySmart++;
        else tally[rep].todayOther++;
        tally[rep].todayList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, site: r.monitoring_site, type: cls });
      }

      // reportList carries the per-report quote/doc flags for the drill views.
      const rank = pipelineRank(r.pipeline_name);
      const reachedQuote = useQuotedFilter ? movedToQuoted.has(String(r.deal_id)) : (rank >= QUOTE_RANK);
      const paidDocFee = docFeeDealIds.has(String(r.deal_id));
      tally[rep].reportList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, site: r.monitoring_site, type: cls, reachedQuote, paidDocFee });
    }

    // Build per-CSR bonus result
    const csrs = {};
    for (const name of staff) {
      const t = tally[name];
      const report = computeReportBonus(t.idiq, t.total);

      // Conversion bonus (uses ungated denominator: all of the rep's month report-deals)
      const convDenom = t.convTotal > 0 ? t.convTotal : t.total;
      const rptsToQuoteRate = convDenom > 0 ? t.reachedQuote / convDenom : 0;
      const quoteToDocsRate = t.reachedQuote > 0 ? t.reachedDocs / t.reachedQuote : 0;
      const conversionQualified = rptsToQuoteRate >= RPTS_TO_QUOTE_TARGET && quoteToDocsRate >= QUOTE_TO_DOCS_TARGET;
      const conversion = {
        qualified: conversionQualified,
        bonus: conversionQualified ? CONVERSION_BONUS : 0,
        reachedQuote: t.reachedQuote,
        reachedDocs: t.reachedDocs,
        convTotal: t.convTotal,
        rptsToQuoteRate: Math.round(rptsToQuoteRate * 100),
        quoteToDocsRate: Math.round(quoteToDocsRate * 100)
      };

      // IDIQ enrollment rate (for spotlight selection)
      const idiqRate = t.total > 0 ? t.idiq / t.total : 0;

      // Review bonus: assigned reviews this month, +$5 each past 10, +$50 per BBB review
      const uid = nameToUserId[name.trim().toLowerCase()];
      const myReviews = uid ? reviews.filter(r => r.assigned_to === uid) : [];
      const reviewCount = myReviews.length;
      const bbbReviews = myReviews.filter(r => (r.location_name || '').toLowerCase().includes('bbb')).length;
      const review = {
        count: reviewCount,
        bbb: bbbReviews,
        bonus: Math.max(0, reviewCount - 10) * 5 + bbbReviews * 50,
        meetsStandard: reviewCount >= 10,
        today: (viewingCurrentMonth ? myReviews.filter(r => String(r.review_date || '').slice(0, 10) === todayStr).length : 0)
      };
      const reviewDetails = myReviews.map(r => ({
        reviewer: r.reviewer_name || 'Anonymous',
        rating: r.rating || null,
        location: r.location_name || '',
        date: r.review_date || null,
        bbb: (r.location_name || '').toLowerCase().includes('bbb')
      }));

      csrs[name] = {
        month,
        reports: { idiq: t.idiq, smartcredit: t.smart, other: t.other, total: t.total },
        today: { total: t.todayTotal, idiq: t.todayIdiq, smartcredit: t.todaySmart, other: t.todayOther, docFees: t.todayDocFees, date: todayStr },
        reportBonus: report,
        conversionBonus: conversion,
        reviewBonus: review,
        spotlight: { idiqTopConverter: false, allStar: false, bonus: 0 },
        idiqRate: Math.round(idiqRate * 100),
        closingRate: t.total ? Math.round((t.reachedDocs / t.total) * 100) : 0,
        kpis: {
          newDeals: ops[name].newDeals,
          reachedReports: ops[name].reachedReports,
          reachedQuoted: ops[name].reachedQuoted,
          docFeeCollected: ops[name].docFeeCollected
        },
        stageDistribution: {
          total: dist[name].total,
          stages: Object.entries(dist[name].byStage)
            .map(([stage, count]) => ({ stage, count, pct: dist[name].total ? Math.round((count / dist[name].total) * 100) : 0 }))
            .sort((a, b) => b.count - a.count)
        },
        details: {
          reports: t.reportList,
          quoteDeals: t.quoteList,
          docsDeals: t.docsList,
          todayReports: t.todayList,
          todayDocFees: t.todayDocFeeList,
          monthDeals: ops[name].monthDealList,
          allDeals: dist[name].allDeals,
          reviews: reviewDetails
        },
        excluded: { outOfMonth: t.outOfMonth, gatedOut: t.gatedOut },
        basePay: (() => {
          const hire = nameToHire[name.trim().toLowerCase()] || null;
          const isMonth1 = hire ? String(hire).slice(0, 7) === month : false;
          return { amount: isMonth1 ? BASE_PAY.month1 : BASE_PAY.ongoing, isMonth1, hireDate: hire, month1: BASE_PAY.month1, ongoing: BASE_PAY.ongoing };
        })()
      };
    }

    // Spotlight: IDIQ Top Converter = highest IDIQ enrollment rate among qualified CSRs (>=50 total)
    let topConverter = null, topRate = -1;
    for (const name of staff) {
      const c = csrs[name];
      if (c.reportBonus.qualified && c.idiqRate > topRate) { topRate = c.idiqRate; topConverter = name; }
    }
    if (topConverter) {
      csrs[topConverter].spotlight.idiqTopConverter = true;
      csrs[topConverter].spotlight.bonus += SPOTLIGHT_TOP_CONVERTER;
    }

    // Spotlight: All-Star CSR = top performer across volume (reports + docs + reviews), conversion, and reviews.
    // During the current (in-progress) month it's a running leader ("in the hunt"); it finalizes at month-end.
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const provisional = month === currentMonthStr;
    const arr = staff.map(n => csrs[n]);
    const volOf = (c) => c.reports.total + c.conversionBonus.reachedDocs + c.reviewBonus.count;
    const convOf = (c) => (c.conversionBonus.rptsToQuoteRate + c.conversionBonus.quoteToDocsRate) / 2;
    const revOf = (c) => c.reviewBonus.count;
    const maxVol = Math.max(1, ...arr.map(volOf));
    const maxConv = Math.max(1, ...arr.map(convOf));
    const maxRev = Math.max(1, ...arr.map(revOf));
    for (const name of staff) {
      const c = csrs[name];
      const volume = volOf(c), conv = convOf(c), rev = revOf(c);
      c.spotlight.allStarScore = Math.round(((volume / maxVol) + (conv / maxConv) + (rev / maxRev)) / 3 * 100);
      c.spotlight.allStarParts = { volume, conversion: Math.round(conv), reviews: rev };
    }
    let leader = null, bestScore = -1;
    for (const name of staff) {
      const c = csrs[name];
      if (c.spotlight.allStarParts.volume > 0 && c.spotlight.allStarScore > bestScore) { bestScore = c.spotlight.allStarScore; leader = name; }
    }
    if (leader) {
      if (provisional) {
        // running leader only — not won yet, no bonus added
        csrs[leader].spotlight.inTheHunt = true;
      } else {
        csrs[leader].spotlight.allStar = true;
        csrs[leader].spotlight.bonus += SPOTLIGHT_ALL_STAR;
      }
    }

    // Total each CSR's bonus
    for (const name of staff) {
      const c = csrs[name];
      c.totalBonus = (c.reportBonus.bonus || 0) + (c.conversionBonus.bonus || 0) + (c.spotlight.bonus || 0) + (c.reviewBonus?.bonus || 0);
    }

    // Sort debug maps into arrays (desc by count)
    const distinctMonitoringSites = Object.entries(msSeen).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
    const distinctStages = Object.entries(stageSeen).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        month,
        payout: 'Calculated at month-end, paid on the 15th of the following month',
        gateConfig: REPORT_PIPELINE_GATE,
        csrs,
        ownerBasedReports: ownerTally,
        debug: {
          totalDeals: rows.length,
          movedToQuotedFilter: MOVED_TO_QUOTED_FILTER,
          movedToQuotedCount: movedToQuoted.size,
          usingQuotedFilter: useQuotedFilter,
          distinctMonitoringSites,
          distinctStages
        }
      }, null, 2)
    };
  } catch (error) {
    console.error('CSR Bonus Metrics Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
