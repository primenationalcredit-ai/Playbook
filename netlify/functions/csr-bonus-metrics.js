// CSR Bonus Metrics — computes the CSR Performance & Bonus Plan from cs_deals.
// Phase 1: Report Bonus (fully from cs_deals) + a debug block reporting the data shape
// (distinct monitoring sites + pipeline/stage names) so the gate can be locked precisely.
// Conversion / Review / Spotlight bonuses are wired in once the gate names are confirmed.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CSR_STAFF = ['Kenneth Larios', 'Vic Baltodano', 'Reni', 'Araceli Carrion Garcia', 'Jenifer Venegas', 'CJ'];

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
  // Date a report strictly by when the monitoring site was set (when it was pulled).
  // Backfilled deals have no set-date and intentionally do not count — tracking starts fresh.
  const d = row.monitoring_site_set_at || null;
  return d ? String(d).slice(0, 7) : null;
}
function gatePass(row) {
  // Prefer the pipeline recorded when the monitoring site was set; fall back to current pipeline.
  const pipeline = (row.monitoring_site_set_pipeline || row.pipeline_name || '').trim().toLowerCase();
  return REPORT_PIPELINE_GATE.includes(pipeline);
}
function classify(ms) {
  const s = (ms || '').toLowerCase();
  if (!s) return null;
  if (s.includes('smart')) return 'smart';                          // Smart Credit, incl. "Smart Credit (Client Sent Reports)"
  if (s.includes('identity') || s.includes('client sent')) return 'idiq'; // Identity IQ, "Identity Iq (Client Sent Reports)", and "Client sent credit reports to us"
  return 'other';                                                   // Experian.com, My Score IQ, CreditBuilder IQ — count toward the 50 only
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

    const rows = await supaGet('cs_deals', 'select=deal_id,deal_title,call_center_rep_name,account_manager_name,monitoring_site,monitoring_site_set_at,monitoring_site_set_stage,monitoring_site_set_pipeline,deal_created_at,pipeline_name,stage_name');

    // Review data: reviews are assigned to a user (assigned_to = user id) in the IncomingReviews page.
    // Map each CSR name to their user id, then count this month's assigned reviews. BBB = location name contains "bbb".
    const monthStart = `${month}-01`;
    let csrUsers = [];
    let reviews = [];
    try { csrUsers = await supaGet('users', 'department=eq.customer_support&select=id,name'); } catch (e) {}
    try { reviews = await supaGet('incoming_reviews', `created_at=gte.${monthStart}&select=assigned_to,location_name,reviewer_name,rating,review_date`); } catch (e) {}
    const nameToUserId = {};
    for (const u of csrUsers) if (u.name) nameToUserId[u.name.trim().toLowerCase()] = u.id;

    // Doc fee conversions: which of these CS deals have a paid doc fee (from consultant_payments)
    const dealIds = rows.map(r => r.deal_id).filter(Boolean);
    const docFeeDealIds = new Set();
    for (let i = 0; i < dealIds.length; i += 100) {
      const chunk = dealIds.slice(i, i + 100);
      try {
        const pays = await supaGet('consultant_payments', `payment_type=eq.doc_fee&pipedrive_deal_id=in.(${chunk.join(',')})&select=pipedrive_deal_id`);
        for (const p of pays) if (p.pipedrive_deal_id != null) docFeeDealIds.add(String(p.pipedrive_deal_id));
      } catch (e) {}
    }

    // Per-CSR tallies for the requested month
    const tally = {};
    const ops = {};
    for (const name of CSR_STAFF) {
      tally[name] = { idiq: 0, smart: 0, other: 0, total: 0, reachedQuote: 0, reachedDocs: 0, outOfMonth: 0, gatedOut: 0, reportList: [] };
      ops[name] = { newDeals: 0, reachedReports: 0, reachedQuoted: 0, docFeeCollected: 0, monthDealList: [] };
    }

    // Debug: what the data actually looks like
    const msSeen = {};            // distinct monitoring_site -> count
    const stageSeen = {};         // "pipeline | stage" -> count

    for (const r of rows) {
      const ms = r.monitoring_site;
      if (ms) msSeen[ms] = (msSeen[ms] || 0) + 1;
      const stageKey = `${r.pipeline_name || '(none)'} | ${r.stage_name || '(none)'}`;
      stageSeen[stageKey] = (stageSeen[stageKey] || 0) + 1;

      const cls = classify(ms);
      const rep = r.call_center_rep_name;

      // Operational KPIs: funnel over THIS MONTH's deals for a known CSR (created this month)
      if (rep && ops[rep] && String(r.deal_created_at || '').slice(0, 7) === month) {
        const dealRank = pipelineRank(r.pipeline_name);
        const hasDocFee = docFeeDealIds.has(String(r.deal_id));
        ops[rep].newDeals++;
        if (dealRank >= REPORTS_RANK) ops[rep].reachedReports++;
        if (dealRank >= QUOTE_RANK) ops[rep].reachedQuoted++;
        if (hasDocFee) ops[rep].docFeeCollected++;
        ops[rep].monthDealList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, pipeline: r.pipeline_name || 'Unknown', stage: r.stage_name || null, rank: dealRank, docFee: hasDocFee });
      }

      if (!cls) continue;                       // no report value -> not a report
      if (!rep || !tally[rep]) continue;        // must have a Call Center Rep who is a known CSR

      if (monthOf(r) !== month) { tally[rep].outOfMonth++; continue; }
      if (!gatePass(r)) { tally[rep].gatedOut++; continue; }          // must be in an early pipeline at pull-time

      tally[rep][cls]++;
      tally[rep].total++;

      // Conversion: reached quote by pipeline; reached docs = doc fee actually paid
      const rank = pipelineRank(r.pipeline_name);
      const reachedQuote = rank >= QUOTE_RANK;
      const paidDocFee = docFeeDealIds.has(String(r.deal_id));
      if (reachedQuote) tally[rep].reachedQuote++;
      if (paidDocFee) tally[rep].reachedDocs++;
      tally[rep].reportList.push({ dealId: r.deal_id, title: r.deal_title || `Deal #${r.deal_id}`, site: r.monitoring_site, type: cls, reachedQuote, paidDocFee });
    }

    // Build per-CSR bonus result
    const csrs = {};
    for (const name of CSR_STAFF) {
      const t = tally[name];
      const report = computeReportBonus(t.idiq, t.total);

      // Conversion bonus
      const rptsToQuoteRate = t.total > 0 ? t.reachedQuote / t.total : 0;
      const quoteToDocsRate = t.reachedQuote > 0 ? t.reachedDocs / t.reachedQuote : 0;
      const conversionQualified = rptsToQuoteRate >= RPTS_TO_QUOTE_TARGET && quoteToDocsRate >= QUOTE_TO_DOCS_TARGET;
      const conversion = {
        qualified: conversionQualified,
        bonus: conversionQualified ? CONVERSION_BONUS : 0,
        reachedQuote: t.reachedQuote,
        reachedDocs: t.reachedDocs,
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
        meetsStandard: reviewCount >= 10
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
        reportBonus: report,
        conversionBonus: conversion,
        reviewBonus: review,
        spotlight: { idiqTopConverter: false, allStar: false, bonus: 0 },
        idiqRate: Math.round(idiqRate * 100),
        kpis: {
          newDeals: ops[name].newDeals,
          reachedReports: ops[name].reachedReports,
          reachedQuoted: ops[name].reachedQuoted,
          docFeeCollected: ops[name].docFeeCollected
        },
        details: {
          reports: t.reportList,
          monthDeals: ops[name].monthDealList,
          reviews: reviewDetails
        },
        excluded: { outOfMonth: t.outOfMonth, gatedOut: t.gatedOut },
        basePay: BASE_PAY
      };
    }

    // Spotlight: IDIQ Top Converter = highest IDIQ enrollment rate among qualified CSRs (>=50 total)
    let topConverter = null, topRate = -1;
    for (const name of CSR_STAFF) {
      const c = csrs[name];
      if (c.reportBonus.qualified && c.idiqRate > topRate) { topRate = c.idiqRate; topConverter = name; }
    }
    if (topConverter) {
      csrs[topConverter].spotlight.idiqTopConverter = true;
      csrs[topConverter].spotlight.bonus += SPOTLIGHT_TOP_CONVERTER;
    }

    // Total each CSR's bonus
    for (const name of CSR_STAFF) {
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
        debug: {
          totalDeals: rows.length,
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
