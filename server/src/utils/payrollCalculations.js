/**
 * Payroll Calculation Utilities for Coaching Institute
 * Handles fixed salary, per-class, and commission-based calculations
 */

/**
 * Calculate fixed salary for a teacher
 * @param {Number} monthlySalary - Monthly fixed salary
 * @returns {Number} Salary amount
 */
export const calculateFixedSalary = (monthlySalary, annualSalary = 0) => {
  if (annualSalary > 0) return Number((annualSalary / 12).toFixed(2));
  return monthlySalary || 0;
};

/**
 * Find the best-matching rate for a (course, batch) pair.
 * Priority: batch+course specific rate → course-only rate (no batch set).
 */
const idToString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const findBestRate = (perClassRates, courseId, batchId) => {
  if (batchId) {
    const specific = perClassRates.find(
      (r) => idToString(r.course) === courseId && idToString(r.batch) === batchId.toString()
    );
    if (specific) return specific;
  }
  return perClassRates.find(
    (r) => idToString(r.course) === courseId && !r.batch
  );
};

export const calculatePerClassEarnings = (classAttendance, perClassRates) => {
  if (!Array.isArray(classAttendance) || classAttendance.length === 0) {
    return { totalAmount: 0, classCount: 0, breakdown: [] };
  }

  const breakdown = {};
  let totalAmount = 0;
  let totalClasses = 0;

  // Group classes by course+batch combination
  classAttendance.forEach((attendance) => {
    if (!attendance.classHeld || !attendance.course) return;

    const courseId = attendance.course.toString();
    const batchId  = attendance.batch ? attendance.batch.toString() : null;
    const comboKey = `${courseId}::${batchId || ''}`;

    if (!breakdown[comboKey]) {
      breakdown[comboKey] = {
        course:     attendance.course,
        batch:      attendance.batch || null,
        courseName: attendance.courseName || 'Unknown Course',
        batchName:  attendance.batchName  || null,
        classCount: 0,
        ratePerClass: 0,
        amount: 0,
      };
    }

    breakdown[comboKey].classCount += 1;
    totalClasses += 1;
  });

  // Calculate amounts using batch-aware rate lookup
  Object.values(breakdown).forEach((item) => {
    const courseId = item.course?.toString();
    const batchId  = item.batch?.toString();
    const rate = findBestRate(perClassRates, courseId, batchId);
    if (rate) {
      item.ratePerClass = rate.ratePerClass;
      item.amount = item.classCount * rate.ratePerClass;
      totalAmount += item.amount;
    }
  });

  return {
    totalAmount,
    classCount: totalClasses,
    breakdown: Object.values(breakdown),
  };
};

/**
 * Calculate commission earnings for a teacher
 * IMPORTANT: Commission is calculated ONLY on fees actually collected
 * @param {Array} feeCollections - Array of fee payments with course info
 * @param {Array} commissionRates - Array of { course, percentage }
 * @returns {Object} { totalAmount, breakdown }
 */
export const calculateCommissionEarnings = (feeCollections, commissionRates) => {
  if (!Array.isArray(feeCollections) || feeCollections.length === 0) {
    return { totalAmount: 0, breakdown: [] };
  }

  const breakdown = {};
  let totalAmount = 0;

  // Group fee collections by course
  feeCollections.forEach((collection) => {
    if (!collection.course || !collection.amountCollected) return;

    const courseId = idToString(collection.course);
    
    if (!breakdown[courseId]) {
      breakdown[courseId] = {
        course: collection.course,
        courseName: collection.courseName || 'Unknown Course',
        feeCollected: 0,
        commissionRate: 0,
        amount: 0,
      };
    }

    breakdown[courseId].feeCollected += collection.amountCollected;
  });

  // Calculate commission based on rates
  Object.keys(breakdown).forEach((courseId) => {
    const rate = commissionRates.find((r) => idToString(r.course) === courseId);
    if (rate) {
      breakdown[courseId].commissionRate = rate.percentage;
      breakdown[courseId].amount = (breakdown[courseId].feeCollected * rate.percentage) / 100;
      totalAmount += breakdown[courseId].amount;
    }
  });

  return {
    totalAmount,
    breakdown: Object.values(breakdown),
  };
};

/**
 * Calculate total payroll for a teacher (hybrid approach)
 * @param {Object} teacher - Teacher object with salary configuration
 * @param {Array} classAttendance - Class attendance records
 * @param {Array} feeCollections - Fee collection records
 * @returns {Object} Complete payroll breakdown
 */
export const calculateTeacherPayroll = (teacher, classAttendance, feeCollections) => {
  const payroll = {
    fixedSalary: { amount: 0 },
    perClassEarnings: { classCount: 0, totalAmount: 0, breakdown: [] },
    commission: { totalAmount: 0, breakdown: [] },
    totalSalary: 0,
  };

  // Calculate based on salary type
  if (teacher.salaryType === 'fixed' || teacher.salaryType === 'hybrid') {
    payroll.fixedSalary.amount = calculateFixedSalary(teacher.fixedSalary, teacher.annualSalary);
    payroll.totalSalary += payroll.fixedSalary.amount;
  }

  if (teacher.salaryType === 'per_class' || teacher.salaryType === 'hybrid') {
    const perClassResult = calculatePerClassEarnings(classAttendance, teacher.perClassRates || []);
    payroll.perClassEarnings = perClassResult;
    payroll.totalSalary += perClassResult.totalAmount;
  }

  if (teacher.salaryType === 'commission' || teacher.salaryType === 'hybrid') {
    const commissionResult = calculateCommissionEarnings(feeCollections, teacher.commissionRates || []);
    payroll.commission = commissionResult;
    payroll.totalSalary += commissionResult.totalAmount;
  }

  return payroll;
};

/**
 * Get fee collections for a teacher's courses in a specific month
 * This is used to calculate commission based on actual collected fees
 * @param {Array} fees - All fee records
 * @param {Array} teacherCourses - Courses taught by the teacher
 * @param {Date} month - Month to calculate for
 * @returns {Array} Fee collections grouped by course
 */
export const getTeacherFeeCollections = (fees, teacherCourses, month) => {
  if (!Array.isArray(fees) || fees.length === 0) return [];

  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

  const collections = [];

  fees.forEach((fee) => {
    // Check if fee has payments in this month
    if (!fee.payments || fee.payments.length === 0) return;

    fee.payments.forEach((payment) => {
      const paymentDate = new Date(payment.date);
      if (paymentDate >= startOfMonth && paymentDate <= endOfMonth) {
        // Check if fee items include teacher's courses
        fee.items.forEach((item) => {
          if (item.course && teacherCourses.includes(item.course.toString())) {
            // Calculate proportional amount for this course
            const itemProportion = item.amount / fee.totalAmount;
            const amountForThisCourse = payment.amount * itemProportion;

            collections.push({
              course: item.course,
              courseName: item.description,
              amountCollected: amountForThisCourse,
              paymentDate: payment.date,
              feeId: fee._id,
            });
          }
        });
      }
    });
  });

  return collections;
};

export const getTeacherVoucherCollections = (vouchers, teacherCourses) => {
  if (!Array.isArray(vouchers) || vouchers.length === 0) return [];
  const courseSet = new Set((teacherCourses || []).map(idToString).filter(Boolean));
  const collections = [];

  vouchers.forEach((voucher) => {
    const paidAmount = Number(voucher.paidAmount) || 0;
    const totalFee = Number(voucher.totalFee) || 0;
    if (paidAmount <= 0 || totalFee <= 0) return;

    (voucher.enrollments || []).forEach((enrollment) => {
      const courseId = idToString(enrollment.course);
      if (!courseId || !courseSet.has(courseId)) return;

      const netFee = Number(enrollment.netFee) || 0;
      const amountCollected = Math.round((paidAmount * (netFee / totalFee)) * 100) / 100;
      if (amountCollected <= 0) return;

      collections.push({
        course: enrollment.course,
        courseName: enrollment.courseName || 'Unknown Course',
        amountCollected,
        paymentDate: voucher.paidDate,
        feeId: voucher.fee || voucher._id,
      });
    });
  });

  return collections;
};

/**
 * Calculate prorated salary for partial month
 * @param {Number} monthlySalary - Full monthly salary
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date (optional)
 * @returns {Number} Prorated salary
 */
export const calculateProratedSalary = (monthlySalary, startDate, endDate = null) => {
  if (!monthlySalary || !startDate) return 0;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getFullYear(), start.getMonth() + 1, 0);

  // Get total days in the month
  const totalDaysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

  // Calculate days worked
  const daysWorked = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // Calculate prorated salary
  const proratedSalary = (monthlySalary / totalDaysInMonth) * daysWorked;

  return Math.round(proratedSalary * 100) / 100;
};

/**
 * Validate payroll data before saving
 * @param {Object} payrollData - Payroll data to validate
 * @returns {Object} { valid: Boolean, errors: Array }
 */
export const validatePayrollData = (payrollData) => {
  const errors = [];

  if (!payrollData.teacher) {
    errors.push('Teacher is required');
  }

  if (!payrollData.month) {
    errors.push('Month is required');
  }

  if (!payrollData.salaryType) {
    errors.push('Salary type is required');
  }

  if (payrollData.totalSalary < 0) {
    errors.push('Total salary cannot be negative');
  }

  if (payrollData.netSalary < 0) {
    errors.push('Net salary cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
