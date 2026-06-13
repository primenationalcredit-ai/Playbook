// Account Manager Metrics Function
// Fetches Account Manager KPIs from Pipedrive and Supabase

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Filter IDs (single filters, we group by Account Manager field in code)
const FILTERS = {
  CLIENTS_120_DAYS: 133910,      // All clients signed up in last 120 days
  RD1_NO_REPORTS: 133929,        // RD1 clients who haven't pulled reports
  RD2_NO_REPORTS: 133939,        // RD2 clients who haven't pulled reports
  RD3_NO_REPORTS: 133942,        // RD3 clients who haven't pulled reports
  UPSELL_ADDITIONAL_ROUNDS: 134021,  // Additional round sales
  AM_FOLLOWUP_ACTIVITIES: 134943     // Account Manager follow-up activities
};

// Account Manager field key (Person field)
const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';

// Account Managers (will auto-detect from Pipedrive data)
const KNOWN_ACCOUNT_MANAGERS = [
  'Rosa',
  'Dex-ann', 
  'Zairen',
  'Raquel',
  'Bryan'
];

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!PIPEDRIVE_API_KEY) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Pipedrive API not configured',
        mockData: true,
        metrics: getMockMetrics(),
        accountManagers: KNOWN_ACCOUNT_MANAGERS
      })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const accountManager = params.account_manager || 'all';
    const days = parseInt(params.days) || 30;

    const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch deals from each filter
    const [clients120Days, rd1NoReports, rd2NoReports, rd3NoReports, upsellDeals, followUpActivities] = await Promise.all([
      fetchFilterDeals(baseUrl, FILTERS.CLIENTS_120_DAYS),
      fetchFilterDeals(baseUrl, FILTERS.RD1_NO_REPORTS),
      fetchFilterDeals(baseUrl, FILTERS.RD2_NO_REPORTS),
      fetchFilterDeals(baseUrl, FILTERS.RD3_NO_REPORTS),
      fetchFilterDeals(baseUrl, FILTERS.UPSELL_ADDITIONAL_ROUNDS),
      fetchFilterActivities(baseUrl, FILTERS.AM_FOLLOWUP_ACTIVITIES)
    ]);

    // Fetch Supabase data for secured cards and reviews
    let securedCardsData = { total: 0, byAM: {} };
    let reviewsData = { total: 0, byAM: {} };

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        // Fetch secured cards for this period
        const securedCardsResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/secured_cards?select=account_manager&updated_at=gte.${startDateStr}`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        const securedCards = await securedCardsResponse.json();
        if (Array.isArray(securedCards)) {
          securedCardsData.total = securedCards.length;
          securedCards.forEach(card => {
            const am = card.account_manager || 'Unknown';
            if (!securedCardsData.byAM[am]) securedCardsData.byAM[am] = 0;
            securedCardsData.byAM[am]++;
          });
        }

        // Fetch reviews for this period - need to join with users to get department
        const reviewsResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/reviews?select=user_id,rating,created_at&created_at=gte.${startDateStr}`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        const reviews = await reviewsResponse.json();
        
        // Fetch users to map user_id to names
        const usersResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/users?select=id,name,department`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        const users = await usersResponse.json();
        const userMap = {};
        if (Array.isArray(users)) {
          users.forEach(u => {
            if (u.department === 'account_managers') {
              userMap[u.id] = u.name;
            }
          });
        }

        if (Array.isArray(reviews)) {
          reviews.forEach(review => {
            const userName = userMap[review.user_id];
            if (userName) {
              reviewsData.total++;
              if (!reviewsData.byAM[userName]) reviewsData.byAM[userName] = 0;
              reviewsData.byAM[userName]++;
            }
          });
        }
      } catch (supabaseError) {
        console.error('Supabase fetch error:', supabaseError);
      }
    }

    // Group all data by Account Manager
    const allAccountManagers = new Set();
    
    // Extract unique account managers from the data
    [...clients120Days, ...rd1NoReports, ...rd2NoReports, ...rd3NoReports, ...upsellDeals].forEach(deal => {
      const am = getAccountManager(deal);
      if (am) allAccountManagers.add(am);
    });

    // Calculate metrics for each Account Manager
    const metricsByAM = {};
    const accountManagerList = Array.from(allAccountManagers);

    accountManagerList.forEach(am => {
      // Filter deals for this AM
      const amClients120 = clients120Days.filter(d => getAccountManager(d) === am);
      const amRd1NoReports = rd1NoReports.filter(d => getAccountManager(d) === am);
      const amRd2NoReports = rd2NoReports.filter(d => getAccountManager(d) === am);
      const amRd3NoReports = rd3NoReports.filter(d => getAccountManager(d) === am);
      const amUpsells = upsellDeals.filter(d => getAccountManager(d) === am);

      // CMS Retention Calculation
      // Total clients in 120 days vs those who haven't pulled reports
      const totalClients = amClients120.length;
      const clientsNotPulled = amRd1NoReports.length + amRd2NoReports.length + amRd3NoReports.length;
      const clientsRetained = totalClients - clientsNotPulled;
      const retentionRate = totalClients > 0 ? Math.round((clientsRetained / totalClients) * 100) : 0;

      // Upsell Rate
      const upsellCount = amUpsells.length;
      const upsellRate = totalClients > 0 ? Math.round((upsellCount / totalClients) * 100) : 0;

      // Follow-up Compliance: 0 overdue activities = 100% compliant
      const amOverdue = followUpActivities.filter(a => {
        const activityOwner = a.owner_name || '';
        return activityOwner.toLowerCase().includes(am.toLowerCase());
      });
      const followUpRate = amOverdue.length === 0 ? 100 : 0;

      // Secured Cards from Supabase
      const amSecuredCards = securedCardsData.byAM[am] || 0;

      // Reviews from Supabase
      const amReviews = reviewsData.byAM[am] || 0;

      metricsByAM[am] = {
        cmsRetention: { 
          value: retentionRate, 
          trend: 0,
          live: true,
          details: {
            totalClients,
            clientsRetained,
            rd1NotPulled: amRd1NoReports.length,
            rd2NotPulled: amRd2NoReports.length,
            rd3NotPulled: amRd3NoReports.length
          }
        },
        followUpCompliance: { 
          value: followUpRate, 
          trend: 0, 
          live: true,
          overdueCount: amOverdue.length
        },
        upsellCrossSell: { 
          value: upsellRate, 
          trend: 0,
          live: true,
          details: {
            upsellCount,
            totalClients
          }
        },
        securedCards: { 
          value: amSecuredCards, 
          trend: 0, 
          live: true 
        },
        reviewGeneration: { 
          value: amReviews, 
          trend: 0, 
          live: true 
        }
      };
    });

    // Calculate department totals
    const totalClients120 = clients120Days.length;
    const totalNotPulled = rd1NoReports.length + rd2NoReports.length + rd3NoReports.length;
    const totalRetained = totalClients120 - totalNotPulled;
    const overallRetention = totalClients120 > 0 ? Math.round((totalRetained / totalClients120) * 100) : 0;
    const totalUpsells = upsellDeals.length;
    const overallUpsellRate = totalClients120 > 0 ? Math.round((totalUpsells / totalClients120) * 100) : 0;
    
    // Overall follow-up compliance (0 overdue = 100%)
    const overallFollowUpRate = followUpActivities.length === 0 ? 100 : 0;

    const departmentMetrics = {
      cmsRetention: { 
        value: overallRetention, 
        trend: 0,
        live: true,
        details: {
          totalClients: totalClients120,
          totalRetained,
          rd1NotPulled: rd1NoReports.length,
          rd2NotPulled: rd2NoReports.length,
          rd3NotPulled: rd3NoReports.length
        }
      },
      followUpCompliance: { 
        value: overallFollowUpRate, 
        trend: 0, 
        live: true,
        overdueCount: followUpActivities.length
      },
      upsellCrossSell: { 
        value: overallUpsellRate, 
        trend: 0,
        live: true,
        details: {
          totalUpsells,
          totalClients: totalClients120
        }
      },
      securedCards: { 
        value: securedCardsData.total, 
        trend: 0, 
        live: true 
      },
      reviewGeneration: { 
        value: reviewsData.total, 
        trend: 0, 
        live: true 
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        accountManager: accountManager,
        accountManagers: accountManagerList.length > 0 ? accountManagerList : KNOWN_ACCOUNT_MANAGERS,
        departmentMetrics,
        metricsByAM,
        rawCounts: {
          clients120Days: totalClients120,
          rd1NoReports: rd1NoReports.length,
          rd2NoReports: rd2NoReports.length,
          rd3NoReports: rd3NoReports.length,
          upsellDeals: totalUpsells
        }
      })
    };

  } catch (error) {
    console.error('Error fetching Account Manager data:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        mockData: true,
        metrics: getMockMetrics(),
        accountManagers: KNOWN_ACCOUNT_MANAGERS
      })
    };
  }
};

async function fetchFilterDeals(baseUrl, filterId) {
  try {
    const url = `${baseUrl}/deals?api_token=${PIPEDRIVE_API_KEY}&filter_id=${filterId}&start=0&limit=500`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching filter ${filterId}:`, error);
    return [];
  }
}

async function fetchFilterActivities(baseUrl, filterId) {
  try {
    const url = `${baseUrl}/activities?api_token=${PIPEDRIVE_API_KEY}&filter_id=${filterId}&start=0&limit=500`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching activities filter ${filterId}:`, error);
    return [];
  }
}

function getAccountManager(deal) {
  // Account Manager is a Person field with key 0a2bceaec010dd949056d374970917a6b573f1dc
  const amField = deal[ACCOUNT_MANAGER_FIELD];
  
  if (amField) {
    // Person fields return an object with name property
    if (typeof amField === 'object' && amField.name) {
      return amField.name;
    }
    // Or sometimes just a string
    if (typeof amField === 'string') {
      return amField;
    }
  }
  
  // Fallback: check owner_name against known AMs
  if (deal.owner_name) {
    const ownerLower = deal.owner_name.toLowerCase();
    for (const am of KNOWN_ACCOUNT_MANAGERS) {
      if (ownerLower.includes(am.toLowerCase())) {
        return am;
      }
    }
  }
  
  return null;
}

function getMockMetrics() {
  return {
    cmsRetention: { value: 78, trend: 2, live: false },
    followUpCompliance: { value: 85, trend: -1, live: false },
    upsellCrossSell: { value: 12, trend: 3, live: false },
    securedCards: { value: 45, trend: 5, live: false },
    reviewGeneration: { value: 8, trend: 1, live: false }
  };
}
