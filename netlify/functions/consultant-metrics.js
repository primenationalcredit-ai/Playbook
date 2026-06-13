// Consultant Metrics Function - Uses Pipedrive FILTERS for accurate data
// Lead Conversion now uses Pipedrive filters (not Supabase tracking columns which get corrupted by bulk updates)
// Filter 178770 = Moved to Quoted this month
// Filter 178773 = Moved to Sold this month
// Filter 134900 = Overdue Follow-ups

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';

// CRITICAL: Pipedrive Filter IDs (from VAULT.md)
const FILTERS = {
  QUOTED_THIS_MONTH: 178770,  // Moved to Quoted this month - denominator for lead conversion
  SOLD_THIS_MONTH: 178773,    // Moved to Sold this month - numerator for lead conversion
  SOLD_CURRENT: 181300,       // Deals currently in SOLD pipeline - for building SOLD date lookup
  CRS_THIS_MONTH: 179572,     // Moved into CRS this month - for onboarding speed
  OVERDUE_FOLLOWUPS: 134900   // Consultant overdue activities
};

// Custom field key for "Moved into Pipeline" date
const MOVED_INTO_PIPELINE_FIELD = '505f65efbe301acd3c0d59f5523f4c738df85491';

// Consultant display name mapping
const CONSULTANT_DISPLAY_NAMES = {
  'Eric De La Rosa': 'Eric De La Rosa',
  'Carlos Danilo Salguera Balladares': 'Carlos Salguera',
  'Carlos Salguera': 'Carlos Salguera',
  'Cindy': 'Cindy',
  'Kimberly Sanchez': 'Kimberly Sanchez'
};

// All possible Pipedrive names for each consultant
const CONSULTANT_PIPEDRIVE_NAMES = {
  'Eric De La Rosa': ['Eric De La Rosa', 'Eric', 'eric'],
  'Carlos Salguera': ['Carlos Danilo Salguera Balladares', 'Carlos Salguera', 'Carlos', 'carlos'],
  'Cindy': ['Cindy', 'cindy'],
  'Kimberly Sanchez': ['Kimberly Sanchez', 'Kimberly', 'Kim', 'kimberly', 'kim']
};

// User email patterns for each consultant (for matching Supabase users)
const CONSULTANT_EMAIL_PATTERNS = {
  'Eric De La Rosa': ['eric'],
  'Carlos Salguera': ['carlos'],
  'Cindy': ['cindy'],
  'Kimberly Sanchez': ['kimberly', 'kim']
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const supabaseHeaders = SUPABASE_URL && SUPABASE_KEY ? {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    } : null;

    // ===========================================
    // FETCH FROM PIPEDRIVE FILTERS (ACCURATE DATA)
    // ===========================================
    
    console.log('Fetching from Pipedrive filters...');
    
    // Get deals from "Moved to Quoted this month" filter
    const quotedDeals = await fetchDealsFromFilter(FILTERS.QUOTED_THIS_MONTH);
    console.log(`Quoted filter returned ${quotedDeals.length} deals`);
    
    // Get deals from "Moved to Sold this month" filter  
    const soldDeals = await fetchDealsFromFilter(FILTERS.SOLD_THIS_MONTH);
    console.log(`Sold filter returned ${soldDeals.length} deals`);
    
    // Get deals from "Moved into CRS this month" filter (for onboarding speed)
    const crsDeals = await fetchDealsFromFilter(FILTERS.CRS_THIS_MONTH);
    console.log(`CRS filter returned ${crsDeals.length} deals`);
    
    // Build SOLD date lookup from Supabase (where webhook stored "Sold Pipeline Changed At")
    let soldDateLookup = {};
    if (supabaseHeaders) {
      try {
        const dealsResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/deals?select=deal_id,"Sold Pipeline Changed At"&"Sold Pipeline Changed At"=not.is.null`,
          { headers: supabaseHeaders }
        );
        const supabaseDeals = await dealsResponse.json();
        if (Array.isArray(supabaseDeals)) {
          supabaseDeals.forEach(d => {
            if (d["Sold Pipeline Changed At"]) {
              soldDateLookup[d.deal_id] = d["Sold Pipeline Changed At"];
            }
          });
        }
        console.log(`Built SOLD date lookup with ${Object.keys(soldDateLookup).length} entries from Supabase`);
      } catch (e) {
        console.log('Failed to build SOLD date lookup:', e.message);
      }
    }
    
    // Get overdue activities
    const overdueActivities = await fetchActivitiesFromFilter(FILTERS.OVERDUE_FOLLOWUPS);
    console.log(`Overdue filter returned ${overdueActivities.length} activities`);
    
    // Fetch Supabase deals to get "Sold Pipeline Changed At" timestamps
    let supabaseDeals = [];
    if (supabaseHeaders) {
      try {
        const dealsResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/deals?select=deal_id,"Sold Pipeline Changed At","Deal - Owner"`,
          { headers: supabaseHeaders }
        );
        supabaseDeals = await dealsResponse.json();
        if (!Array.isArray(supabaseDeals)) supabaseDeals = [];
        console.log(`Loaded ${supabaseDeals.length} deals from Supabase for timestamp lookup`);
      } catch (e) {
        console.log('Supabase deals fetch failed:', e.message);
      }
    }

    // ===========================================
    // GROUP BY CONSULTANT
    // ===========================================
    
    const consultantNames = Object.keys(CONSULTANT_PIPEDRIVE_NAMES);
    const metricsByConsultant = {};
    const dealListsByConsultant = {}; // For drill-down
    const debugInfo = {};

    // Count overdue by consultant
    const overdueByConsultant = {};
    overdueActivities.forEach(activity => {
      const ownerName = activity.owner_name || activity.user_id?.name;
      if (ownerName) {
        overdueByConsultant[ownerName] = (overdueByConsultant[ownerName] || 0) + 1;
      }
    });

    // Department totals
    const departmentMetrics = {
      leadConversion: { value: 0, trend: 0 },
      refundRate: { value: 0, trend: 0 },
      onboardingSpeed: { value: 0, trend: 0 },
      consultationTime: { value: 0, trend: 0 },
      followUpCompletion: { value: 0, trend: 0 },
      clientRetention: { value: 0, trend: 0 },
      revenueGenerated: { value: 0, trend: 0 },
      reviewsCollected: { value: 0, trend: 0 },
      affiliatesSigned: { value: 0, trend: 0 }
    };

    // ===========================================
    // PRE-FETCH ALL SUPABASE DATA (once, outside consultant loop)
    // ===========================================
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    let allRefunds = [];
    let allRetentionDeals = [];
    let allConsultationDeals = [];
    let allSales = [];
    let allCompletedReviews = [];
    let allAffiliates = [];
    let allOrganizations = []; // Pipedrive orgs for Affiliates Signed
    let allUsers = [];
    
    if (supabaseHeaders) {
      // Fetch all data in parallel for speed
      const [refundsRes, retentionRes, consultRes, salesRes, reviewsRes, affiliatesRes, usersRes] = await Promise.allSettled([
        fetch(`${SUPABASE_URL}/rest/v1/refunds?select=*&refund_date=gte.${startOfMonth}&refund_date=lte.${endOfMonth}`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/deals?select=deal_id,"Deal - Title","Deal - Owner","Person - CURRENT STATUS","Deal - Moved into Pipeline"&"Deal - Pipeline"=eq.C.R.S.&"Deal - Moved into Pipeline"=lt.${new Date(Date.now() - 50*24*60*60*1000).toISOString()}`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/deals?select=deal_id,"Deal - Title","Deal - Owner","Quoted Pipeline Changed At","Consultant Intro Text Sent At"&"Quoted Pipeline Changed At"=not.is.null&"Consultant Intro Text Sent At"=not.is.null`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/sales?select=consultant,fee_paid,client_name,date_paid,fee_type&date_paid=gte.${startOfMonth}&date_paid=lte.${endOfMonth}`, { headers: supabaseHeaders }),
        // Get ALL reviews to debug status values
        fetch(`${SUPABASE_URL}/rest/v1/incoming_reviews?select=id,assigned_to,reviewer_name,created_at,updated_at,status`, { headers: supabaseHeaders }),
        // Affiliates - get all
        fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=id,consultant_id,name,organization_name,created_at,acquired_date`, { headers: supabaseHeaders }),
        // Users for ID to name mapping
        fetch(`${SUPABASE_URL}/rest/v1/users?select=id,name,email`, { headers: supabaseHeaders })
      ]);
      
      if (refundsRes.status === 'fulfilled') {
        const data = await refundsRes.value.json();
        allRefunds = Array.isArray(data) ? data : [];
      }
      if (retentionRes.status === 'fulfilled') {
        const data = await retentionRes.value.json();
        allRetentionDeals = Array.isArray(data) ? data : [];
      }
      if (consultRes.status === 'fulfilled') {
        const data = await consultRes.value.json();
        allConsultationDeals = Array.isArray(data) ? data : [];
      }
      if (salesRes.status === 'fulfilled') {
        const data = await salesRes.value.json();
        allSales = Array.isArray(data) ? data : [];
      }
      if (reviewsRes.status === 'fulfilled') {
        const data = await reviewsRes.value.json();
        allCompletedReviews = Array.isArray(data) ? data : [];
      }
      if (affiliatesRes.status === 'fulfilled') {
        const data = await affiliatesRes.value.json();
        allAffiliates = Array.isArray(data) ? data : [];
      }
      if (usersRes.status === 'fulfilled') {
        const data = await usersRes.value.json();
        allUsers = Array.isArray(data) ? data : [];
      }
      
      console.log(`Pre-fetched: ${allRefunds.length} refunds, ${allRetentionDeals.length} retention deals, ${allConsultationDeals.length} consultation deals, ${allSales.length} sales, ${allCompletedReviews.length} reviews total, ${allAffiliates.length} affiliates, ${allUsers.length} users`);
      
      // Debug: Log users for troubleshooting
      console.log('Users loaded:', allUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));
      
      // Debug: Log ALL reviews with their status
      if (allCompletedReviews.length > 0) {
        console.log('ALL reviews in database:', allCompletedReviews.map(r => ({ 
          id: r.id, 
          status: r.status,
          assigned_to: r.assigned_to, 
          reviewer: r.reviewer_name 
        })));
        
        // Count by status
        const statusCounts = allCompletedReviews.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {});
        console.log('Reviews by status:', statusCounts);
      }
      
      // Debug: Log ALL affiliates
      if (allAffiliates.length > 0) {
        console.log('ALL affiliates in database:', allAffiliates.map(a => ({ 
          id: a.id, 
          name: a.name,
          organization: a.organization_name,
          consultant_id: a.consultant_id,
          created_at: a.created_at
        })));
      } else {
        console.log('No affiliates found in database');
      }
      
      // Filter to just completed reviews
      allCompletedReviews = allCompletedReviews.filter(r => r.status === 'completed');
      console.log(`Completed reviews after filtering: ${allCompletedReviews.length}`);
    }

    // ===========================================
    // FETCH PIPEDRIVE ORGANIZATIONS (for Affiliates Signed)
    // Affiliates = Organizations created this month, grouped by owner
    // ===========================================
    if (PIPEDRIVE_API_KEY) {
      try {
        const monthPrefix = startOfMonth.substring(0, 7); // e.g. "2026-02"
        let orgStart = 0;
        let orgHasMore = true;
        while (orgHasMore) {
          const orgUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations?start=${orgStart}&limit=500&sort=add_time DESC&api_token=${PIPEDRIVE_API_KEY}`;
          const orgResp = await fetch(orgUrl);
          const orgData = await orgResp.json();
          if (orgData.success && orgData.data) {
            for (const o of orgData.data) {
              if (o.add_time && o.add_time.startsWith(monthPrefix)) {
                allOrganizations.push({
                  id: o.id,
                  name: o.name,
                  owner_name: o.owner_name || (o.owner_id && o.owner_id.name) || 'Unknown',
                  add_time: o.add_time
                });
              } else if (o.add_time && o.add_time < monthPrefix) {
                // Past this month, stop paginating
                orgHasMore = false;
                break;
              }
            }
            if (orgHasMore) {
              orgHasMore = orgData.additional_data?.pagination?.more_items_in_collection || false;
              orgStart += 500;
            }
          } else {
            orgHasMore = false;
          }
          if (orgStart > 5000) orgHasMore = false;
        }
        console.log(`Fetched ${allOrganizations.length} Pipedrive organizations created this month`);
        allOrganizations.forEach(o => {
          console.log(`  Org: "${o.name}" owner: "${o.owner_name}" added: ${o.add_time}`);
        });
      } catch (e) {
        console.error('Error fetching Pipedrive organizations:', e.message);
      }
    }
    
    // ===========================================
    // REVENUE DEBUG: Log sales data to diagnose mismatch
    // ===========================================
    if (allSales.length > 0) {
      const salesByConsultant = {};
      allSales.forEach(s => {
        const c = s.consultant || 'Unknown';
        if (!salesByConsultant[c]) salesByConsultant[c] = { count: 0, total: 0 };
        salesByConsultant[c].count++;
        salesByConsultant[c].total += parseFloat(s.fee_paid) || 0;
      });
      console.log('REVENUE DEBUG - Sales by consultant:', JSON.stringify(salesByConsultant));
      console.log(`REVENUE DEBUG - Total sales rows: ${allSales.length}, date range: ${startOfMonth} to ${endOfMonth}`);
    } else {
      console.log('REVENUE DEBUG - No sales found in database for this month!');
    }
    
    // Build user ID to name mapping
    const userIdToName = {};
    allUsers.forEach(u => {
      if (u.id && u.name) {
        userIdToName[u.id] = u.name;
      }
    });
    
    // Success statuses for retention
    const successStatuses = [
      '2nd RD Submitted/Results Call', '2ND RD SUBMITTED', 'RD 1 REPORTS RECEIVED',
      '2ND RD DONE', '3RD RD SUBMITTED', '3RD RD DONE', '4TH RD SUBMITTED', '4TH RD DONE'
    ];

    for (const displayName of consultantNames) {
      const pipedriveNames = CONSULTANT_PIPEDRIVE_NAMES[displayName];
      
      // Helper to check if a name matches this consultant
      const matchesConsultant = (name) => {
        if (!name) return false;
        return pipedriveNames.some(pn => 
          name.toLowerCase().includes(pn.toLowerCase()) ||
          pn.toLowerCase().includes(name.toLowerCase())
        );
      };

      // Filter deals for this consultant
      const myQuotedDeals = quotedDeals.filter(d => matchesConsultant(d.owner_name));
      const mySoldDeals = soldDeals.filter(d => matchesConsultant(d.owner_name));

      // ===========================================
      // LEAD CONVERSION (from Pipedrive filters)
      // ===========================================
      const quotedCount = myQuotedDeals.length;
      const soldCount = mySoldDeals.length;
      const leadConversion = quotedCount > 0 
        ? Math.round((soldCount / quotedCount) * 100) 
        : 0;
      
      console.log(`${displayName}: ${soldCount} sold / ${quotedCount} quoted = ${leadConversion}%`);

      // ===========================================
      // OVERDUE FOLLOW-UPS
      // ===========================================
      let myOverdueCount = 0;
      pipedriveNames.forEach(name => {
        myOverdueCount += overdueByConsultant[name] || 0;
      });

      // ===========================================
      // ONBOARDING SPEED (from Supabase SOLD date + CRS custom field)
      // ===========================================
      // Get this consultant's CRS deals
      const myCrsDeals = crsDeals.filter(d => matchesConsultant(d.owner_name));
      let onboardingSpeed = 0;
      let withinFiveDays = 0;
      let totalWithValidDates = 0;
      const onboardingDetails = [];
      
      for (const crsDeal of myCrsDeals) {
        // Look up SOLD date from Supabase (webhook stored "Sold Pipeline Changed At")
        const soldDate = soldDateLookup[crsDeal.id];
        // CRS date from custom field "Moved into Pipeline" (505f65efbe301acd3c0d59f5523f4c738df85491)
        const crsDate = crsDeal.moved_into_pipeline;
        
        if (soldDate && crsDate) {
          // Normalize to date-only (strip time) for comparison
          const soldDateOnly = new Date(soldDate).toISOString().split('T')[0];
          const crsDateOnly = new Date(crsDate).toISOString().split('T')[0];
          
          const soldTime = new Date(soldDateOnly).getTime();
          const crsTime = new Date(crsDateOnly).getTime();
          const daysDiff = (crsTime - soldTime) / (1000 * 60 * 60 * 24);
          
          totalWithValidDates++;
          if (daysDiff >= 0 && daysDiff <= 5) {
            withinFiveDays++;
          }
          onboardingDetails.push({ title: crsDeal.title, days: daysDiff.toFixed(1), soldDate: soldDateOnly, crsDate: crsDateOnly });
          console.log(`  ${crsDeal.title}: ${daysDiff.toFixed(1)} days (sold: ${soldDateOnly}, crs: ${crsDateOnly})`);
        } else {
          onboardingDetails.push({ 
            title: crsDeal.title, 
            days: 'N/A', 
            soldDate: soldDate || 'not in Supabase', 
            crsDate: crsDate || 'missing from custom field' 
          });
        }
      }
      
      onboardingSpeed = totalWithValidDates > 0 
        ? Math.round((withinFiveDays / totalWithValidDates) * 100) 
        : 0;
      
      console.log(`${displayName}: ${myCrsDeals.length} CRS deals, ${withinFiveDays}/${totalWithValidDates} started within 5 days = ${onboardingSpeed}%`);

      // ===========================================
      // REFUND RATE (from pre-fetched data)
      // ===========================================
      const myRefunds = allRefunds.filter(r => matchesConsultant(r.consultant_name));
      const myRefundsList = myRefunds.map(r => ({
        clientName: r.client_name,
        amount: r.amount || r.refund_amount,
        date: r.refund_date,
        reason: r.reason
      }));
      const refundRate = soldCount > 0 ? Math.round((myRefunds.length / soldCount) * 100) : 0;
      console.log(`${displayName}: ${myRefunds.length} refunds this month / ${soldCount} sold = ${refundRate}%`);

      // ===========================================
      // CLIENT RETENTION (from pre-fetched data)
      // ===========================================
      const myRetentionDeals = allRetentionDeals.filter(d => matchesConsultant(d["Deal - Owner"]));
      const retentionDetailsList = myRetentionDeals.map(d => {
        const status = d["Person - CURRENT STATUS"] || 'Unknown';
        const isRetained = successStatuses.some(s => s.toUpperCase() === status.toUpperCase());
        const startDate = d["Deal - Moved into Pipeline"];
        const daysIn = startDate ? Math.round((Date.now() - new Date(startDate).getTime()) / (1000*60*60*24)) : 0;
        return { id: d.deal_id, title: d["Deal - Title"], status, retained: isRetained, daysInProgram: daysIn, startDate };
      });
      const retained = retentionDetailsList.filter(d => d.retained);
      const clientRetention = myRetentionDeals.length > 0 
        ? Math.round((retained.length / myRetentionDeals.length) * 100) : 0;
      console.log(`${displayName}: ${retained.length}/${myRetentionDeals.length} clients retained after 50 days = ${clientRetention}%`);

      // ===========================================
      // CONSULTATION RESPONSE (from pre-fetched data)
      // ===========================================
      const myConsultDeals = allConsultationDeals.filter(d => matchesConsultant(d["Deal - Owner"]));
      let consultationWithin2Hours = 0;
      let consultationTotalValid = 0;
      for (const deal of myConsultDeals) {
        const quotedAt = new Date(deal["Quoted Pipeline Changed At"]).getTime();
        const introSentAt = new Date(deal["Consultant Intro Text Sent At"]).getTime();
        const hoursDiff = (introSentAt - quotedAt) / (1000 * 60 * 60);
        if (hoursDiff >= 0) {
          consultationTotalValid++;
          if (hoursDiff <= 2) consultationWithin2Hours++;
        }
      }
      const consultationTime = consultationTotalValid > 0 
        ? Math.round((consultationWithin2Hours / consultationTotalValid) * 100) : 0;
      console.log(`${displayName}: ${consultationWithin2Hours}/${consultationTotalValid} consultations within 2 hours = ${consultationTime}%`);

      // ===========================================
      // REVENUE GENERATED (from pre-fetched data)
      // ===========================================
      const mySales = allSales.filter(s => matchesConsultant(s.consultant));
      const mySalesList = mySales.map(s => ({
        clientName: s.client_name,
        amount: parseFloat(s.fee_paid) || 0,
        date: s.date_paid,
        type: s.fee_type
      }));
      const revenueGenerated = Math.round(mySales.reduce((sum, s) => sum + (parseFloat(s.fee_paid) || 0), 0));
      console.log(`${displayName}: $${revenueGenerated} revenue from ${mySales.length} sales this month`);

      // ===========================================
      // REVIEWS COLLECTED (from incoming_reviews)
      // ===========================================
      // Find user IDs that match this consultant's name OR email
      const emailPatterns = CONSULTANT_EMAIL_PATTERNS[displayName] || [];
      const consultantUserIds = allUsers
        .filter(u => {
          // Match by name
          if (matchesConsultant(u.name)) return true;
          // Match by email pattern
          if (u.email) {
            const emailLower = u.email.toLowerCase();
            for (const pattern of emailPatterns) {
              if (emailLower.includes(pattern.toLowerCase())) return true;
            }
          }
          return false;
        })
        .map(u => u.id);
      
      // Count completed reviews assigned to this consultant
      const myReviews = allCompletedReviews.filter(r => consultantUserIds.includes(r.assigned_to));
      const reviewsCollected = myReviews.length;
      console.log(`${displayName}: ${reviewsCollected} reviews collected (matched user IDs: ${consultantUserIds.join(', ') || 'none found'})`);

      // ===========================================
      // AFFILIATES SIGNED (from Pipedrive Organizations created this month)
      // ===========================================
      const myOrgs = allOrganizations.filter(o => matchesConsultant(o.owner_name));
      const affiliatesSigned = myOrgs.length;
      console.log(`${displayName}: ${affiliatesSigned} affiliates (orgs created this month owned by them)`);
      if (affiliatesSigned > 0) {
        myOrgs.forEach(o => console.log(`  -> "${o.name}" added ${o.add_time}`));
      }
      
      // Also check Supabase affiliates as fallback
      const mySupabaseAffiliates = allAffiliates.filter(a => consultantUserIds.includes(a.consultant_id));
      if (mySupabaseAffiliates.length > 0 && affiliatesSigned === 0) {
        console.log(`  (Supabase affiliates found: ${mySupabaseAffiliates.length} but using Pipedrive orgs as primary)`);
      }

      // Store metrics
      metricsByConsultant[displayName] = {
        leadConversion: { value: leadConversion, trend: 0 },
        refundRate: { value: refundRate, trend: 0 },
        onboardingSpeed: { value: onboardingSpeed, trend: 0 },
        consultationTime: { value: consultationTime, trend: 0 },
        followUpCompletion: { value: myOverdueCount, trend: 0 },
        clientRetention: { value: clientRetention, trend: 0 },
        revenueGenerated: { value: revenueGenerated, trend: 0 },
        reviewsCollected: { value: reviewsCollected, trend: 0 },
        affiliatesSigned: { value: affiliatesSigned, trend: 0 }
      };

      // Store deal lists for drill-down
      dealListsByConsultant[displayName] = {
        quotedDeals: myQuotedDeals.map(d => ({
          id: d.id,
          title: d.title,
          value: d.value,
          status: d.status,
          addTime: d.add_time,
          personName: d.person_name
        })),
        soldDeals: mySoldDeals.map(d => ({
          id: d.id,
          title: d.title,
          value: d.value,
          status: d.status,
          addTime: d.add_time,
          personName: d.person_name
        })),
        refundDetails: myRefundsList,
        onboardingDetails,
        retentionDetails: retentionDetailsList,
        salesDetails: mySalesList,
        reviewsDetails: myReviews.map(r => ({
          id: r.id,
          reviewerName: r.reviewer_name,
          completedAt: r.updated_at || r.created_at
        })),
        affiliatesDetails: myOrgs.map(a => ({
          id: a.id,
          name: a.name,
          organization: a.name,
          acquiredAt: a.add_time
        }))
      };

      // Debug info
      debugInfo[displayName] = {
        quotedCount,
        soldCount,
        leadConversionCalc: `${soldCount}/${quotedCount} = ${leadConversion}%`,
        overdueFollowUps: myOverdueCount,
        crsDealsCount: myCrsDeals.length,
        onboardingWithValidDates: totalWithValidDates,
        onboardingWithin5Days: withinFiveDays,
        onboardingSpeedCalc: `${withinFiveDays}/${totalWithValidDates} = ${onboardingSpeed}%`,
        onboardingDetails: onboardingDetails.slice(0, 5), // First 5 for debug
        revenueFromSales: `$${revenueGenerated} from ${mySales.length} sales rows`,
        salesConsultantNames: [...new Set(mySales.map(s => s.consultant))],
        affiliatesFromOrgs: `${affiliatesSigned} orgs created this month`,
        orgNames: myOrgs.map(o => o.name)
      };

      // Add to department totals
      departmentMetrics.leadConversion.value += leadConversion;
      departmentMetrics.refundRate.value += refundRate;
      departmentMetrics.onboardingSpeed.value += onboardingSpeed;
      departmentMetrics.consultationTime.value += consultationTime;
      departmentMetrics.followUpCompletion.value += myOverdueCount;
      departmentMetrics.clientRetention.value += clientRetention;
      departmentMetrics.revenueGenerated.value += revenueGenerated;
      departmentMetrics.reviewsCollected.value += reviewsCollected;
      departmentMetrics.affiliatesSigned.value += affiliatesSigned;
    }

    // Average percentage metrics for department
    const numConsultants = consultantNames.length;
    departmentMetrics.leadConversion.value = Math.round(departmentMetrics.leadConversion.value / numConsultants);
    departmentMetrics.refundRate.value = Math.round(departmentMetrics.refundRate.value / numConsultants);
    departmentMetrics.onboardingSpeed.value = Math.round(departmentMetrics.onboardingSpeed.value / numConsultants);
    departmentMetrics.consultationTime.value = Math.round(departmentMetrics.consultationTime.value / numConsultants);
    departmentMetrics.clientRetention.value = Math.round(departmentMetrics.clientRetention.value / numConsultants);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        dataSource: 'pipedrive-filters',
        departmentMetrics,
        metricsByConsultant,
        dealListsByConsultant, // For drill-down UI
        debug: {
          filters: FILTERS,
          totalQuotedDeals: quotedDeals.length,
          totalSoldDeals: soldDeals.length,
          totalCrsDeals: crsDeals.length,
          totalSupabaseDeals: supabaseDeals.length,
          totalOverdueActivities: overdueActivities.length,
          totalOrgsThisMonth: allOrganizations.length,
          totalSalesRows: allSales.length,
          overdueByConsultant,
          byConsultant: debugInfo
        }
      })
    };

  } catch (error) {
    console.error('Error fetching consultant metrics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Fetch all deals from a Pipedrive filter (with pagination)
async function fetchDealsFromFilter(filterId) {
  if (!PIPEDRIVE_API_KEY) {
    console.log('No Pipedrive API key configured');
    return [];
  }

  const allDeals = [];
  let start = 0;
  const limit = 500;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?filter_id=${filterId}&start=${start}&limit=${limit}&api_token=${PIPEDRIVE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.data) {
        allDeals.push(...data.data.map(d => ({
          id: d.id,
          title: d.title,
          owner_name: d.owner_name || d.user_id?.name,
          value: d.value,
          status: d.status,
          add_time: d.add_time,
          won_time: d.won_time,  // When deal was marked as won (entered SOLD)
          pipeline_change_time: d.pipeline_change_time,  // When deal moved to current pipeline
          moved_into_pipeline: d[MOVED_INTO_PIPELINE_FIELD],  // Custom field: Moved into Pipeline date
          person_name: d.person_id?.name || d.person_name
        })));
        
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
        start += limit;
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`Error fetching filter ${filterId}:`, err);
      hasMore = false;
    }

    // Safety limit
    if (start > 5000) hasMore = false;
  }

  return allDeals;
}

// Fetch activities from a Pipedrive filter
async function fetchActivitiesFromFilter(filterId) {
  if (!PIPEDRIVE_API_KEY) {
    console.log('No Pipedrive API key configured');
    return [];
  }

  const allActivities = [];
  let start = 0;
  const limit = 500;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/activities?filter_id=${filterId}&start=${start}&limit=${limit}&api_token=${PIPEDRIVE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.data) {
        allActivities.push(...data.data.map(a => ({
          id: a.id,
          subject: a.subject,
          owner_name: a.owner_name || a.user_id?.name,
          deal_title: a.deal_title,
          due_date: a.due_date
        })));
        
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
        start += limit;
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`Error fetching activities filter ${filterId}:`, err);
      hasMore = false;
    }

    // Safety limit
    if (start > 5000) hasMore = false;
  }

  return allActivities;
}
