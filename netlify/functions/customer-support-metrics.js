// Customer Support Metrics Function
// Reads metrics from cs_metrics_cache (populated by webhooks from cs_deals)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Customer Support employees
const CUSTOMER_SUPPORT_STAFF = [
  'Kenneth Larios',
  'Vic Baltodano',
  'Reni',
  'Araceli Carrion Garcia',
  'Jenifer Venegas',
  'CJ'
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

  try {
    const params = event.queryStringParameters || {};
    const days = parseInt(params.days) || 30;
    const period = '30d'; // For now, just 30d

    // ============================================
    // READ FROM SUPABASE CACHE
    // ============================================
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.log('CS Metrics: Supabase not configured');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Supabase not configured',
          mockData: true,
          departmentMetrics: getMockMetrics(),
          employees: CUSTOMER_SUPPORT_STAFF
        })
      };
    }

    // Fetch cached metrics
    const cacheUrl = `${SUPABASE_URL}/rest/v1/cs_metrics_cache?period=eq.${period}&select=*`;
    const cacheResponse = await fetch(cacheUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    let cacheData = [];
    if (cacheResponse.ok) {
      cacheData = await cacheResponse.json();
    }

    // If no cache data, return mock
    if (!cacheData || cacheData.length === 0) {
      console.log('CS Metrics: No cache data found, returning mock');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No cache data - run initial sync',
          mockData: true,
          departmentMetrics: getMockMetrics(),
          employees: CUSTOMER_SUPPORT_STAFF
        })
      };
    }

    console.log(`CS Metrics: Loaded ${cacheData.length} cached records`);

    // Find department totals
    const deptRecord = cacheData.find(r => r.employee_name === 'DEPARTMENT') || {};

    // Build department metrics
    const departmentMetrics = {
      reportAcquisition: {
        current: deptRecord.report_acquisition || 0,
        target: 47 * CUSTOMER_SUPPORT_STAFF.length,
        byEmployee: {}
      },
      rptsToQtd: {
        current: deptRecord.rpts_to_qtd_rate || 0,
        target: 50,
        byEmployee: {}
      },
      qtdToDoc: {
        current: deptRecord.qtd_to_doc_rate || 0,
        target: 40,
        byEmployee: {}
      },
      responseTime: {
        current: 0, // Placeholder - not tracked yet
        target: 5,
        byEmployee: {}
      },
      reviewGeneration: {
        current: 0,
        target: 10 * CUSTOMER_SUPPORT_STAFF.length,
        byEmployee: {}
      }
    };

    // Process employee records
    let totalReviews = 0;

    for (const record of cacheData) {
      if (record.employee_name === 'DEPARTMENT') continue;

      const name = record.employee_name;

      // Report Acquisition
      departmentMetrics.reportAcquisition.byEmployee[name] = record.report_acquisition || 0;

      // RPTS→QTD Conversion
      departmentMetrics.rptsToQtd.byEmployee[name] = {
        totalDeals: record.total_deals || 0,
        inQuoted: record.report_acquisition || 0,
        rate: record.rpts_to_qtd_rate || 0
      };

      // QTD→DOC Conversion
      departmentMetrics.qtdToDoc.byEmployee[name] = {
        inQuoted: record.report_acquisition || 0,
        docsCompleted: (record.sold_count || 0) + (record.crs_count || 0),
        rate: record.qtd_to_doc_rate || 0
      };

      // Response Time (placeholder)
      departmentMetrics.responseTime.byEmployee[name] = record.response_time || 0;

      // Review Generation
      const reviewCount = record.review_count || 0;
      departmentMetrics.reviewGeneration.byEmployee[name] = reviewCount;
      totalReviews += reviewCount;
    }

    // Also add any employees not in cache with 0 values
    for (const name of CUSTOMER_SUPPORT_STAFF) {
      if (!departmentMetrics.reportAcquisition.byEmployee[name]) {
        departmentMetrics.reportAcquisition.byEmployee[name] = 0;
        departmentMetrics.rptsToQtd.byEmployee[name] = { totalDeals: 0, inQuoted: 0, rate: 0 };
        departmentMetrics.qtdToDoc.byEmployee[name] = { inQuoted: 0, docsCompleted: 0, rate: 0 };
        departmentMetrics.responseTime.byEmployee[name] = 0;
        departmentMetrics.reviewGeneration.byEmployee[name] = 0;
      }
    }

    departmentMetrics.reviewGeneration.current = totalReviews;

    // Get cache freshness
    const lastUpdated = deptRecord.last_updated ? new Date(deptRecord.last_updated) : null;
    const cacheAgeMinutes = lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / 60000) : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        mockData: false,
        fromCache: true,
        cacheAgeMinutes,
        lastUpdated: lastUpdated?.toISOString(),
        departmentMetrics,
        employees: CUSTOMER_SUPPORT_STAFF,
        period: days
      })
    };

  } catch (error) {
    console.error('CS Metrics Error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        mockData: true,
        departmentMetrics: getMockMetrics(),
        employees: CUSTOMER_SUPPORT_STAFF
      })
    };
  }
};

// Mock data fallback
function getMockMetrics() {
  return {
    reportAcquisition: {
      current: 0,
      target: 282,
      byEmployee: {
        'Kenneth Larios': 0,
        'Vic Baltodano': 0,
        'Reni': 0,
        'Araceli Carrion Garcia': 0,
        'Jenifer Venegas': 0,
        'CJ': 0
      }
    },
    rptsToQtd: {
      current: 0,
      target: 50,
      byEmployee: {
        'Kenneth Larios': { totalDeals: 0, inQuoted: 0, rate: 0 },
        'Vic Baltodano': { totalDeals: 0, inQuoted: 0, rate: 0 },
        'Reni': { totalDeals: 0, inQuoted: 0, rate: 0 },
        'Araceli Carrion Garcia': { totalDeals: 0, inQuoted: 0, rate: 0 },
        'Jenifer Venegas': { totalDeals: 0, inQuoted: 0, rate: 0 },
        'CJ': { totalDeals: 0, inQuoted: 0, rate: 0 }
      }
    },
    qtdToDoc: {
      current: 0,
      target: 40,
      byEmployee: {
        'Kenneth Larios': { inQuoted: 0, docsCompleted: 0, rate: 0 },
        'Vic Baltodano': { inQuoted: 0, docsCompleted: 0, rate: 0 },
        'Reni': { inQuoted: 0, docsCompleted: 0, rate: 0 },
        'Araceli Carrion Garcia': { inQuoted: 0, docsCompleted: 0, rate: 0 },
        'Jenifer Venegas': { inQuoted: 0, docsCompleted: 0, rate: 0 },
        'CJ': { inQuoted: 0, docsCompleted: 0, rate: 0 }
      }
    },
    responseTime: {
      current: 0,
      target: 5,
      byEmployee: {
        'Kenneth Larios': 0,
        'Vic Baltodano': 0,
        'Reni': 0,
        'Araceli Carrion Garcia': 0,
        'Jenifer Venegas': 0,
        'CJ': 0
      }
    },
    reviewGeneration: {
      current: 0,
      target: 60,
      byEmployee: {
        'Kenneth Larios': 0,
        'Vic Baltodano': 0,
        'Reni': 0,
        'Araceli Carrion Garcia': 0,
        'Jenifer Venegas': 0,
        'CJ': 0
      }
    }
  };
}
