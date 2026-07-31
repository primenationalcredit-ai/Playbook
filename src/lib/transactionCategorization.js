// Transaction categorization utilities for ASAP Financial Dashboard
// Includes affiliate revenue detection for DOO P&L exclusion

// Affiliate vendor patterns - these are excluded from DOO bonus calculations
const AFFILIATE_VENDORS = [
  'idiq',
  'identityiq', 
  'identity iq',
  'smartcredit',
  'smart credit',
  'affiliate commission',
  'affiliate payment',
  'referral commission'
];

// Transfer patterns - excluded from P&L entirely
const TRANSFER_PATTERNS = [
  'payment thank you',
  'online payment - thank you',
  'chase credit crd epay',
  'american express ach pmt',
  'amex epay',
  'transfer from',
  'transfer to',
  'xfer from',
  'xfer to'
];

// Owner-level costs (Joe 7/31): Meta/Facebook ad spend and attorney fees paid
// through the company card are the owner's costs - they never touch the P&L
// or the DOO compensation basis.
const OWNER_EXCLUDED_PATTERNS = [
  'facebk',
  'facebook',
  'meta ads',
  'metaplatforms',
  'meta platforms',
  'attorney',
  'law office',
  'law offices',
  'law firm',
  'lawyer',
  'legal fee',
  'legal fees'
];
// Payroll patterns
const PAYROLL_PATTERNS = [
  'paychex',
  'wise inc',
  'wise us inc', 
  'trnwise',
  'xoom debit',
  'remitly inc',
  'remittance',
  'gusto',
  'adp payroll'
];

// Merchant processing patterns (COGS)
const MERCHANT_PROCESSING_PATTERNS = [
  'ems merch disc',
  'signapay',
  'pci fees',
  'ems dly fees',
  'merchant services'
];

// Software/Services with specific categories
const SOFTWARE_VENDORS = {
  'godaddy': 'Domain & Email Services',
  'go daddy': 'Domain & Email Services',
  'instantly': 'Sales Software',
  'smartlead': 'Email Marketing Software',
  'twilio': 'Communication Services',
  'sendgrid': 'Email Services',
  'zapier': 'Automation Services',
  'zoho': 'Invoicing Software',
  'insightful': 'Employee Monitoring',
  'pipedrive': 'CRM Software',
  'cognito': 'Web Forms',
  'railway': 'Cloud Hosting',
  'readyrefresh': 'Water Service',
  'ringcentral': 'Phone Service',
  'facebk': 'Advertising - Facebook',
  'facebook': 'Advertising - Facebook',
  'meta ads': 'Advertising - Facebook'
};

/**
 * Check if a transaction is affiliate revenue
 * @param {Object} transaction - Transaction object with description and merchant_name
 * @returns {boolean} - True if this is affiliate revenue
 */
export const isAffiliateRevenue = (transaction) => {
  const searchText = `${transaction.description || ''} ${transaction.merchant_name || ''}`.toLowerCase();
  return AFFILIATE_VENDORS.some(pattern => searchText.includes(pattern));
};

/**
 * Check if a transaction is a transfer (exclude from P&L)
 * @param {Object} transaction
 * @returns {boolean}
 */
export const isTransfer = (transaction) => {
  const searchText = `${transaction.description || ''} ${transaction.merchant_name || ''}`.toLowerCase();
  return TRANSFER_PATTERNS.some(pattern => searchText.includes(pattern));
};

/**
 * Check if a transaction is payroll
 * @param {Object} transaction
 * @returns {boolean}
 */
export const isPayroll = (transaction) => {
  const searchText = `${transaction.description || ''} ${transaction.merchant_name || ''}`.toLowerCase();
  return PAYROLL_PATTERNS.some(pattern => searchText.includes(pattern));
};

/**
 * Check if a transaction is merchant processing fees
 * @param {Object} transaction
 * @returns {boolean}
 */
export const isMerchantProcessing = (transaction) => {
  const searchText = `${transaction.description || ''} ${transaction.merchant_name || ''}`.toLowerCase();
  return MERCHANT_PROCESSING_PATTERNS.some(pattern => searchText.includes(pattern));
};

/**
 * Get software vendor category if recognized
 * @param {Object} transaction
 * @returns {string|null} - Category name or null if not recognized
 */
export const getSoftwareCategory = (transaction) => {
  const searchText = `${transaction.description || ''} ${transaction.merchant_name || ''}`.toLowerCase();
  for (const [pattern, category] of Object.entries(SOFTWARE_VENDORS)) {
    if (searchText.includes(pattern)) {
      return category;
    }
  }
  return null;
};

/**
 * Categorize a transaction with confidence scoring
 * @param {Object} transaction
 * @returns {Object} - { category, transactionType, confidence, isAffiliateRevenue, needsReview }
 */
export const categorizeTransaction = (transaction) => {
  const result = {
    category: 'Uncategorized',
    transactionType: transaction.amount < 0 ? 'income' : 'expense',
    confidence: 0,
    isAffiliateRevenue: false,
    needsReview: true
  };

  // Check for transfers first (exclude from P&L)
  if (isTransfer(transaction)) {
    return {
      category: 'Transfer',
      transactionType: 'transfer',
      confidence: 0.98,
      isAffiliateRevenue: false,
      needsReview: false
    };
  }

  // Owner-level costs: out of the P&L entirely (Joe 7/31)
  {
    const searchText = `${transaction.description || ''} ${transaction.merchant_name || ''}`.toLowerCase();
    if (transaction.amount > 0 && OWNER_EXCLUDED_PATTERNS.some(p => searchText.includes(p))) {
      return {
        category: 'Owner Cost (excluded)',
        transactionType: 'owner_excluded',
        confidence: 0.97,
        isAffiliateRevenue: false,
        needsReview: false
      };
    }
  }
  // Check for affiliate revenue (income that's excluded from DOO P&L)
  if (isAffiliateRevenue(transaction) && transaction.amount < 0) {
    return {
      category: 'Affiliate Revenue',
      transactionType: 'income',
      confidence: 0.97,
      isAffiliateRevenue: true,
      needsReview: false
    };
  }

  // Check for payroll
  if (isPayroll(transaction)) {
    return {
      category: 'Payroll',
      transactionType: 'expense',
      confidence: 0.97,
      isAffiliateRevenue: false,
      needsReview: false
    };
  }

  // Check for merchant processing
  if (isMerchantProcessing(transaction)) {
    return {
      category: 'Merchant Processing Fees',
      transactionType: 'cogs',
      confidence: 0.96,
      isAffiliateRevenue: false,
      needsReview: false
    };
  }

  // Check for known software vendors
  const softwareCategory = getSoftwareCategory(transaction);
  if (softwareCategory) {
    return {
      category: softwareCategory,
      transactionType: 'expense',
      confidence: 0.95,
      isAffiliateRevenue: false,
      needsReview: false
    };
  }

  // Everything else needs review
  return result;
};

/**
 * Calculate P&L summary from transactions
 * @param {Array} transactions - Array of categorized transactions
 * @returns {Object} - { totalRevenue, affiliateRevenue, coreRevenue, totalExpenses, cogs, netProfit, dooNetProfit }
 */
export const calculatePL = (transactions) => {
  const summary = {
    totalRevenue: 0,
    affiliateRevenue: 0,
    coreRevenue: 0,
    totalExpenses: 0,
    cogs: 0,
    payroll: 0,
    netProfit: 0,
    dooNetProfit: 0,  // Excludes affiliate revenue
    transfersExcluded: 0
  };

  transactions.forEach(txn => {
    // Skip transfers
    if (txn.transactionType === 'transfer') {
      summary.transfersExcluded += Math.abs(txn.amount);
      return;
    }
    // Owner-level costs: excluded from P&L and DOO comp entirely (Joe 7/31)
    if (txn.transactionType === 'owner_excluded') {
      summary.ownerExcluded = (summary.ownerExcluded || 0) + Math.abs(txn.amount);
      return;
    }

    // Income (negative amounts in Plaid)
    if (txn.amount < 0) {
      const incomeAmount = Math.abs(txn.amount);
      summary.totalRevenue += incomeAmount;
      
      if (txn.isAffiliateRevenue) {
        summary.affiliateRevenue += incomeAmount;
      } else {
        summary.coreRevenue += incomeAmount;
      }
    }
    
    // Expenses (positive amounts in Plaid)
    if (txn.amount > 0 && txn.transactionType !== 'transfer') {
      summary.totalExpenses += txn.amount;
      
      if (txn.transactionType === 'cogs') {
        summary.cogs += txn.amount;
      }
      
      if (txn.category === 'Payroll') {
        summary.payroll += txn.amount;
      }
    }
  });

  // Calculate net profits
  summary.netProfit = summary.totalRevenue - summary.totalExpenses;
  summary.dooNetProfit = summary.coreRevenue - summary.totalExpenses;  // Excludes affiliate

  return summary;
};

/**
 * Calculate DOO bonus based on P&L
 * @param {Object} plSummary - P&L summary from calculatePL
 * @param {number} priorYearRevenue - Same month prior year revenue for YoY calc
 * @param {Object} suspensionStatus - { active: boolean, reason: string }
 * @returns {Object} - Bonus breakdown
 */
export const calculateDOOBonus = (plSummary, priorYearRevenue, suspensionStatus = { active: false }) => {
  const { coreRevenue, dooNetProfit } = plSummary;
  
  // Check suspension
  if (suspensionStatus.active) {
    return {
      profitShare: 0,
      growthBonus: 0,
      milestoneBonus: 0,
      totalBeforeCap: 0,
      bonusCap: 0,
      capApplied: false,
      finalBonus: 0,
      suspended: true,
      suspensionReason: suspensionStatus.reason
    };
  }

  // No bonus if not profitable
  if (dooNetProfit <= 0) {
    return {
      profitShare: 0,
      growthBonus: 0,
      milestoneBonus: 0,
      totalBeforeCap: 0,
      bonusCap: 0,
      capApplied: false,
      finalBonus: 0,
      suspended: false,
      reason: 'Not profitable'
    };
  }

  // Profit Share: 3%
  const profitShare = dooNetProfit * 0.03;

  // YoY Growth Bonus
  let growthBonus = 0;
  if (priorYearRevenue > 0) {
    const yoyGrowth = (coreRevenue - priorYearRevenue) / priorYearRevenue;
    if (yoyGrowth >= 0.75) growthBonus = 750;
    else if (yoyGrowth >= 0.50) growthBonus = 500;
    else if (yoyGrowth >= 0.30) growthBonus = 250;
  }

  // Profitability Milestone
  let milestoneBonus = 0;
  if (dooNetProfit >= 20000) milestoneBonus = 1000;
  else if (dooNetProfit >= 10001) milestoneBonus = 600;
  else if (dooNetProfit >= 5001) milestoneBonus = 300;
  else if (dooNetProfit >= 1) milestoneBonus = 150;

  // Total and cap
  const totalBeforeCap = profitShare + growthBonus + milestoneBonus;
  const bonusCap = dooNetProfit * 0.25;
  const capApplied = totalBeforeCap > bonusCap;
  const finalBonus = capApplied ? bonusCap : totalBeforeCap;

  return {
    profitShare: Math.round(profitShare * 100) / 100,
    growthBonus,
    milestoneBonus,
    totalBeforeCap: Math.round(totalBeforeCap * 100) / 100,
    bonusCap: Math.round(bonusCap * 100) / 100,
    capApplied,
    finalBonus: Math.round(finalBonus * 100) / 100,
    suspended: false
  };
};

export default {
  isAffiliateRevenue,
  isTransfer,
  isPayroll,
  isMerchantProcessing,
  getSoftwareCategory,
  categorizeTransaction,
  calculatePL,
  calculateDOOBonus,
  AFFILIATE_VENDORS,
  TRANSFER_PATTERNS,
  PAYROLL_PATTERNS
};
