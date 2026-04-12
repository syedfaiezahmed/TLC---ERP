/**
 * Fee Calculation Utilities for Coaching Institute
 * Handles late fees, discounts, and voucher calculations
 */

/**
 * Calculate late fee based on due date and current date
 * @param {Date} dueDate - Fee due date
 * @param {Number} lateFeeAmount - Late fee amount (default 200)
 * @param {Number} gracePeriodDays - Grace period in days (default 0)
 * @returns {Number} Late fee amount
 */
export const calculateLateFee = (dueDate, lateFeeAmount = 200, gracePeriodDays = 0) => {
  if (!dueDate) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  // Add grace period
  if (gracePeriodDays > 0) {
    due.setDate(due.getDate() + gracePeriodDays);
  }

  // If today is after due date, apply late fee
  if (today > due) {
    return lateFeeAmount;
  }

  return 0;
};

/**
 * Calculate net fee after discount
 * @param {Number} amount - Original amount
 * @param {Number} discount - Discount amount or percentage
 * @param {String} discountType - 'fixed' or 'percentage'
 * @returns {Number} Net amount after discount
 */
export const calculateNetAmount = (amount, discount = 0, discountType = 'fixed') => {
  if (!amount || amount <= 0) return 0;
  if (!discount || discount <= 0) return amount;

  let netAmount = amount;

  if (discountType === 'percentage') {
    const discountAmount = (amount * discount) / 100;
    netAmount = amount - discountAmount;
  } else {
    netAmount = amount - discount;
  }

  // Ensure net amount is not negative
  return Math.max(0, netAmount);
};

/**
 * Calculate total fee for multiple enrollments
 * @param {Array} enrollments - Array of enrollment objects with netMonthlyFee
 * @returns {Number} Total fee
 */
export const calculateTotalFee = (enrollments) => {
  if (!Array.isArray(enrollments) || enrollments.length === 0) return 0;

  return enrollments.reduce((total, enrollment) => {
    return total + (enrollment.netFee || enrollment.netMonthlyFee || 0);
  }, 0);
};

/**
 * Check if fee is overdue
 * @param {Date} dueDate - Fee due date
 * @param {String} status - Fee status
 * @returns {Boolean} True if overdue
 */
export const isOverdue = (dueDate, status) => {
  if (!dueDate || status === 'paid' || status === 'cancelled') {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  return today > due;
};

/**
 * Get fee display amounts (before and after due date)
 * @param {Number} totalFee - Base fee amount
 * @param {Date} dueDate - Due date
 * @param {Number} lateFeeAmount - Late fee amount
 * @returns {Object} { beforeDueDate, afterDueDate, isOverdue }
 */
export const getFeeDisplayAmounts = (totalFee, dueDate, lateFeeAmount = 200) => {
  const lateFee = calculateLateFee(dueDate, lateFeeAmount);
  const overdueStatus = isOverdue(dueDate, 'unpaid');

  return {
    beforeDueDate: totalFee,
    afterDueDate: totalFee + lateFeeAmount,
    currentAmount: overdueStatus ? totalFee + lateFee : totalFee,
    isOverdue: overdueStatus,
    lateFeeApplicable: lateFee > 0,
  };
};

/**
 * Calculate prorated fee for partial month
 * @param {Number} monthlyFee - Full monthly fee
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date (optional, defaults to end of month)
 * @returns {Number} Prorated fee amount
 */
export const calculateProratedFee = (monthlyFee, startDate, endDate = null) => {
  if (!monthlyFee || !startDate) return 0;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getFullYear(), start.getMonth() + 1, 0);

  // Get total days in the month
  const totalDaysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

  // Calculate days in the period
  const daysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // Calculate prorated fee
  const proratedFee = (monthlyFee / totalDaysInMonth) * daysInPeriod;

  return Math.round(proratedFee * 100) / 100; // Round to 2 decimal places
};

/**
 * Generate voucher number
 * @param {String} companyId - Company ID
 * @param {Number} lastVoucherNumber - Last voucher number
 * @param {Date} month - Month for the voucher
 * @returns {String} Voucher number (e.g., "VCH-202604-0001")
 */
export const generateVoucherNumber = (companyId, lastVoucherNumber = 0, month = new Date()) => {
  const year = month.getFullYear();
  const monthNum = String(month.getMonth() + 1).padStart(2, '0');
  const sequence = String(lastVoucherNumber + 1).padStart(4, '0');

  return `VCH-${year}${monthNum}-${sequence}`;
};

/**
 * Calculate balance due after payments
 * @param {Number} totalAmount - Total fee amount
 * @param {Number} paidAmount - Amount paid
 * @param {Number} writeOffAmount - Write-off amount
 * @param {Number} refundAmount - Refund amount
 * @returns {Number} Balance due
 */
export const calculateBalanceDue = (totalAmount, paidAmount = 0, writeOffAmount = 0, refundAmount = 0) => {
  const balance = totalAmount - paidAmount - writeOffAmount - refundAmount;
  return Math.max(0, balance);
};

/**
 * Determine fee status based on amounts
 * @param {Number} totalAmount - Total amount
 * @param {Number} paidAmount - Paid amount
 * @param {Number} writeOffAmount - Write-off amount
 * @param {Number} refundAmount - Refund amount
 * @returns {String} Status: 'paid', 'partial', or 'unpaid'
 */
export const determineFeeStatus = (totalAmount, paidAmount = 0, writeOffAmount = 0, refundAmount = 0) => {
  const balance = calculateBalanceDue(totalAmount, paidAmount, writeOffAmount, refundAmount);

  if (balance <= 0.01) {
    return 'paid';
  } else if (paidAmount > 0 || refundAmount > 0) {
    return 'partial';
  } else {
    return 'unpaid';
  }
};
