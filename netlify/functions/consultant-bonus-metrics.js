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
    // Only read a rolling window of history (not the full multi-year table).
    // Covers current-month sales plus the look-backs the bonus logic needs (90-day reactivation, prior-month qualified docs).
    const [wy, wm] = targetMonth.split('-').map(Number);
    const wd = new Date(wy, wm - 1 - 12, 1);
    const windowStart = `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, '0')}-01`;

    // Get consultants
    const consultants = await supaGet('users', 'department=eq.credit_consultants&select=id,name,email,is_va');

    // Get payments for the rolling window (paged past the 1000-row cap) for cross-referencing client journeys
    const allPayments = await supaGet('consultant_payments', `payment_date=gte.${windowStart}&select=pipedrive_deal_id,client_name,payment_type,payment_month,payment_date,amount,consultant_name,is_affiliate_deal,referrer_org`);

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

    // Get reviews
    const reviews = await supaGet('incoming_reviews', `created_at=gte.${monthStart}&select=*`);

    // Get already-awarded one-time bonuses
    let awardedBonuses = [];
    try {
      awardedBonuses = await supaGet('bonus_awards', `select=*`);
    } catch(e) {}
    const awardedOrgs = new Set(awardedBonuses.map(a => `${a.bonus_type}:${a.org_name}`));

    // Get refunds for refund rate
    let refunds = [];
    try {
      refunds = await supaGet('refund_tracking', `refund_date=gte.${monthStart}&select=*`);
    } catch(e) { /* table may not exist yet */ }

    // Get invoice data for collection metrics
    let invoiceData = [];
    try {
      invoiceData = await supaGet('consultant_invoices', `select=*`);
    } catch(e) {}
    // Monthly payments only (for commission calc)
    const payments = allPayments.filter(p => p.payment_month === targetMonth);

    // Consults for closing % — deals from Pipedrive filter 523803 (Ready to Quote this month)
    // Cross-referenced with Zoho payments to see which ones actually paid doc fee
    let consultsByOwner = {};  // owner -> { total, dealIds[] }
    const rtqDealIds = new Set();
    const dealMeta = {};       // dealId -> { name, value } for names + PIF payoff check
    try {
      let start = 0, more = true;
      while (more) {
        const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?filter_id=523803&start=${start}&limit=100&api_token=${PIPEDRIVE_API_KEY}`);
        if (res.ok) {
          const data = await res.json();
          const deals = data.data || [];
          deals.forEach(d => {
            const o = d.owner_name || 'Unknown';
            if (!consultsByOwner[o]) consultsByOwner[o] = { total: 0, dealIds: [] };
            consultsByOwner[o].total++;
            consultsByOwner[o].dealIds.push(d.id);
            rtqDealIds.add(d.id);
            dealMeta[d.id] = { name: d.person_name || d.title || `Deal #${d.id}`, value: parseFloat(d.value) || 0 };
          });
          more = data.additional_data?.pagination?.more_items_in_collection || false;
          start += 100;
          if (start > 1000) more = false;
        } else { more = false; }
      }
    } catch(e) { console.log('Consults error:', e.message); }

    // Build set of deal IDs that have doc_fee payments in Zoho, plus a name index
    // (some Zoho invoices have no deal ID on them, so we fall back to client name)
    const dealIdsWithDocFee = new Set();
    const docFeeNames = new Set();
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const p of allPayments) {
      if (p.payment_type === 'doc_fee') {
        if (p.pipedrive_deal_id) dealIdsWithDocFee.add(p.pipedrive_deal_id);
        else if (p.client_name) docFeeNames.add(norm(p.client_name)); // name fallback ONLY for orphan payments with no deal id, so a linked payment can't be borrowed by a same-named different deal
      }
    }

    // Cached lookup: org creation date (add_time) by org name — for New Affiliate Launch
    const orgAddTimeCache = {};
    async function getOrgAddTime(orgName) {
      if (orgName in orgAddTimeCache) return orgAddTimeCache[orgName];
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

    // Lost deals for closing % — get from all pipelines with lost status
    let lostByOwner = {};
    try {
      // Get lost deals from this month across all pipelines
      let start = 0;
      let moreLost = true;
      while (moreLost) {
        const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?status=lost&start=${start}&limit=100&api_token=${PIPEDRIVE_API_KEY}`);
        if (res.ok) {
          const data = await res.json();
          const deals = data.data || [];
          deals.filter(d => d.lost_time && d.lost_time >= monthStart).forEach(d => {
            const o = d.owner_name || 'Unknown';
            lostByOwner[o] = (lostByOwner[o] || 0) + 1;
          });
          moreLost = data.additional_data?.pagination?.more_items_in_collection || false;
          start += 100;
          if (start > 500) moreLost = false; // cap at 500 to avoid timeout
        } else { moreLost = false; }
      }
    } catch(e) { console.log('Lost deals error:', e.message); }

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
      if (docIdx === -1) { let min = Infinity; invs.forEach((inv, i) => { const t = parseFloat(inv.total) || 0; if (t < min) { min = t; docIdx = i; } }); }
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
      const reason = qualified ? null : `$${Math.round(owed)} of $${Math.round(billed)} balance still owed`;
      return { qualified, reason, paid: Math.round(billed - owed), owed: Math.round(owed) };
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
      const myPayments = payments.filter(p => {
        const pName = (p.consultant_name || '').toLowerCase().trim();
        // Exact first name match (word boundary): "cindy" in "cindy" or "cindy broadstreet"
        const pParts = pName.split(/\s+/);
        // Check if consultant first name matches user first name exactly
        if (pParts[0] === firstName) return true;
        // Check if last name appears in payment name (for "Carlos Danilo Salguera Balladares" matching "Carlos Salguera")  
        if (lastName.length > 3 && pParts.some(pp => pp === lastName)) return true;
        // Full name exact match
        if (pName === name.toLowerCase()) return true;
        return false;
      });

      // === SALES & COMMISSION (from Zoho) ===
      let totalSales = 0, affiliateSales = 0, organicSales = 0;
      let docFeeCount = 0, partialCount = 0, finalCount = 0, unknownCount = 0;
      
      for (const p of myPayments) {
        const amt = parseFloat(p.amount) || 0;
        totalSales += amt;
        // Commission rate: is_affiliate_deal = org has "Consultant Referral" label → higher rate
        if (p.is_affiliate_deal) { affiliateSales += amt; } else { organicSales += amt; }
        if (p.payment_type === 'doc_fee') docFeeCount++;
        else if (p.payment_type === 'partial') partialCount++;
        else if (p.payment_type === 'final' || p.payment_type === 'paid_in_full') finalCount++;
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
      
      // === QUALIFIED DOCS (invoice-amount rule) ===
      let qualifiedDocs = 0;
      let docFeeOnlyCount = 0;
      const qualifiedClients = [];
      const notQualifiedClients = [];

      for (const client of clients) {
        if (!client.hasDocFee) continue; // Only clients who paid a doc fee this month
        const q = qualifyClient(client);
        if (q.qualified) {
          qualifiedDocs++;
          qualifiedClients.push(client);
        } else {
          docFeeOnlyCount++;
          notQualifiedClients.push({ name: client.name, dealId: client.dealId, reason: q.reason, paid: q.paid, owed: q.owed });
        }
      }

      // Clients who paid partial/final this month without a doc fee this month (qualified in a prior month)
      const priorMonthQualified = clients.filter(c => !c.hasDocFee && (c.hasPartial || c.hasFinal));

      const docFeeOnlyClients = clients.filter(c => c.hasDocFee && !qualifiedClients.includes(c));

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
          // Count unique clients from this org
          const orgClients = new Set();
          for (const p of allPayments) {
            if (p.referrer_org === orgName && p.is_affiliate_deal) {
              orgClients.add(p.pipedrive_deal_id || p.client_name);
            }
          }
          if (orgClients.size >= 3) {
            if (!awardedOrgs.has(`new_affiliate_launch:${orgName}`)) {
              newAffiliateLaunchCount++;
              newAffiliateOrgs.push({ name: orgName, firstDate: allOrgPayments[0].date, orgCreated: addTime, clients: orgClients.size, daysSinceCreated });
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
        if (bizDays <= 5) {
          pifCount++;
          pifClients.push({ name: client.name, docDate: docPayment.payment_date, finalDate: finalPayment.payment_date, bizDays, docAmount: docPayment.amount, finalAmount: finalPayment.amount });
        }
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
        return {
          name: dealMeta[id]?.name || `Deal #${id}`,
          dealId: id,
          amount: dealMeta[id]?.value || 0,
          paidDocFee: byId || byName,
          matchBy: byId ? 'deal id' : (byName ? 'name (no deal id on invoice)' : null),
        };
      }).sort((a, b) => (b.paidDocFee === a.paidDocFee ? a.name.localeCompare(b.name) : (b.paidDocFee ? 1 : -1)));

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
      const refundAmount = myRefunds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

      // === WEEKLY SPRINT (all weeks in the month) ===
      const weeks = [];
      const mStart = new Date(monthStart);
      let wStart = new Date(mStart);
      // Find first Monday of the month (or use month start)
      while (wStart.getDay() !== 1 && wStart < now) wStart.setDate(wStart.getDate() + 1);
      if (wStart > mStart) { // partial first week
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() - 1);
        const weekDocs = myPayments.filter(p => p.payment_type === 'doc_fee' && p.payment_date >= monthStart && p.payment_date <= wEnd.toISOString().split('T')[0]).length;
        weeks.push({ week: 1, start: monthStart, end: wEnd.toISOString().split('T')[0], docs: weekDocs });
      }
      let weekNum = weeks.length + 1;
      while (wStart <= now && wStart.getMonth() === mStart.getMonth()) {
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
        const endStr = wEnd.toISOString().split('T')[0];
        const startStr = wStart.toISOString().split('T')[0];
        const weekDocs = myPayments.filter(p => p.payment_type === 'doc_fee' && p.payment_date >= startStr && p.payment_date <= endStr).length;
        weeks.push({ week: weekNum, start: startStr, end: endStr, docs: weekDocs });
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
      
      // Organic vs Affiliate closing %
      let organicConsults = 0, affiliateConsults = 0, organicDocsPaid = 0, affiliateDocsPaid = 0;
      for (const dealId of myConsultDealIds) {
        const payment = allPayments.find(p => p.pipedrive_deal_id === dealId && p.payment_type === 'doc_fee');
        if (payment?.is_affiliate_deal) { affiliateConsults++; if (dealIdsWithDocFee.has(dealId)) affiliateDocsPaid++; }
        else { organicConsults++; if (dealIdsWithDocFee.has(dealId)) organicDocsPaid++; }
      }
      const organicClosingPct = organicConsults > 0 ? Math.round((organicDocsPaid / organicConsults) * 100) : 0;
      const affiliateClosingPct = affiliateConsults > 0 ? Math.round((affiliateDocsPaid / affiliateConsults) * 100) : 0;

      // === INVOICE / COLLECTION METRICS ===
      // Match invoices to this consultant by deal ID overlap with their payments
      const myDealIds = new Set(myPayments.filter(p => p.pipedrive_deal_id).map(p => String(p.pipedrive_deal_id)));
      const myInvoices = invoiceData.filter(inv => inv.pipedrive_deal_id && myDealIds.has(String(inv.pipedrive_deal_id)));
      const overdueInvoices = myInvoices.filter(inv => inv.status === 'overdue');
      const partiallyPaidInvoices = myInvoices.filter(inv => inv.status === 'partially_paid');
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
        docFeeCount, partialCount, finalCount, unknownCount,
        // Qualified docs from payment data
        qualifiedDocs,
        docFeeOnlyCount: docFeeOnlyClients.length,
        totalClients: clients.length,
        accelerator, docClub, docClubBonus,
        pifCount, pifBonus, pifClients,
        reactivationCount, reactivationBonus, reactivatedOrgs,
        newAffiliateLaunchCount, newAffiliateLaunchBonus, newAffiliateOrgs,
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
        refundCount, refundAmount,
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
          mtdList: myPayments.map(p => ({ name: p.client_name, amount: p.amount, type: p.payment_type, date: p.payment_date, org: p.is_affiliate_deal ? p.referrer_org : null }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date))),
          affiliateOrgList: Object.entries(affiliateMap).map(([orgName, count]) => ({ name: orgName, clients: count, producing: count >= 3 }))
            .sort((a, b) => b.clients - a.clients),
          organicClients: myPayments.filter(p => !p.is_affiliate_deal).map(p => ({ name: p.client_name, amount: p.amount, type: p.payment_type, date: p.payment_date })),
          affiliateClients: myPayments.filter(p => p.is_affiliate_deal).map(p => ({ name: p.client_name, amount: p.amount, type: p.payment_type, date: p.payment_date, org: p.referrer_org })),
          docFeeList: myPayments.filter(p => p.payment_type === 'doc_fee').map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date })),
          partialList: myPayments.filter(p => p.payment_type === 'partial').map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date })),
          finalList: myPayments.filter(p => p.payment_type === 'final' || p.payment_type === 'paid_in_full').map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date })),
          qualifiedList: qualifiedClients.map(c => ({ name: c.name, totalPaid: c.totalPaid, org: c.orgName, isAffiliate: c.isAffiliate, payments: c.payments.map(p => ({ type: p.payment_type, amount: p.amount, date: p.payment_date })) })),
          docFeeOnlyList: docFeeOnlyClients.map(c => ({ name: c.name, totalPaid: c.totalPaid })),
          reviewList: myReviews.map(r => ({ reviewer: r.reviewer_name, rating: r.rating, date: r.review_date, location: r.location_name, text: (r.review_text || '').substring(0, 100) })),
          consultList: myConsultDealIds.map(id => {
            const paid = dealIdsWithDocFee.has(id);
            const payment = allPayments.find(p => p.pipedrive_deal_id === id && p.payment_type === 'doc_fee');
            return { dealId: id, paid, clientName: payment?.client_name || dealMeta[id]?.name || `Deal #${id}`, amount: payment?.amount || dealMeta[id]?.value || 0, date: payment?.payment_date || '' };
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

    // YTD data from allPayments (already loaded)
    const year = targetMonth.split('-')[0];
    const ytdPayments = allPayments.filter(p => (p.payment_month || '').startsWith(year));
    
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

    // Add today and YTD to each consultant result
    for (const [n, d] of Object.entries(results)) {
      d.today = todayByConsultant[n] || { sales: 0, docs: 0, partials: 0, finals: 0, payments: 0 };
      d.ytd = ytdByConsultant[n] || { sales: 0, docs: 0, partials: 0, finals: 0, payments: 0, affiliateSales: 0, monthsActive: 0 };
    }

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

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        month: monthLabel, monthKey: targetMonth,
        teamTotals: { todaySales, todayDocs, todayPartials, todayFinals, mtdSales, mtdDocs, mtdPartials, mtdFinals, mtdProjection, ytdSales, ytdDocs, totalPayments: payments.length,
          totalOverdue: invoiceData.filter(i => i.status === 'overdue').length,
          totalOverdueAmount: Math.round(invoiceData.filter(i => i.status === 'overdue').reduce((s, i) => s + (parseFloat(i.balance) || 0), 0)),
          totalInvoices: invoiceData.length
        },
        consultants: results,
        sprintWinner, sprintMaxDocs: sprintMax, weeklyWinners,
        consultantOfMonth: cotmCandidate,
        totalPayments: payments.length,
        dataSources: { payments: 'Zoho Invoice API (live)', milestones: 'Derived from payment data' },
        // Diagnostic
        affiliateFlaggedCount: payments.filter(p => p.is_affiliate_deal === true).length,
        orgEmailCount: payments.filter(p => p.org_has_email === true).length,
        sampleOrgs: [...new Set(payments.map(p => p.referrer_org).filter(Boolean))].slice(0, 10),
        updatedAt: now.toISOString()
      })
    };
  } catch (error) {
    console.error('Bonus metrics error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
