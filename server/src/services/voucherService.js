import FeeVoucher from '../models/FeeVoucher.js';
import StudentEnrollment from '../models/StudentEnrollment.js';
import Company from '../models/Company.js';
import Fee from '../models/Fee.js';

class VoucherGenerationService {
  async generateVouchersForDate(companyId, selectedDate, userId) {
    try {
      // Parse date as UTC to avoid timezone shift (e.g. UTC+5 storing Apr 1 as Mar 31 UTC)
      const parsedDate = new Date(selectedDate);
      const y = parsedDate.getUTCFullYear();
      const mo = parsedDate.getUTCMonth();
      const voucherMonth = new Date(Date.UTC(y, mo, 1));
      const monthStart = new Date(Date.UTC(y, mo, 1));
      const monthEnd = new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999));

      const company = await Company.findById(companyId);
      if (!company) throw new Error('Company not found');

      const activeEnrollments = await StudentEnrollment.find({
        company: companyId,
        status: 'active',
        startDate: { $lte: monthEnd },
        $or: [
          { actualEndDate: { $gte: monthStart } },
          { actualEndDate: { $exists: false } },
          { actualEndDate: null }
        ]
      })
      .populate('student')
      .populate('course')
      .populate('batch');

      if (activeEnrollments.length === 0) {
        return { message: 'No active enrollments found for the selected month', vouchers: [] };
      }

      // Group enrollments by student
      const enrollmentsByStudent = {};
      for (const enrollment of activeEnrollments) {
        const sid = enrollment.student._id.toString();
        if (!enrollmentsByStudent[sid]) {
          enrollmentsByStudent[sid] = { student: enrollment.student, enrollments: [] };
        }
        enrollmentsByStudent[sid].enrollments.push(enrollment);
      }

      const generatedVouchers = [];
      let voucherCounter = await this.getNextVoucherNumber(companyId);

      for (const [studentId, studentData] of Object.entries(enrollmentsByStudent)) {
        // Skip if voucher already exists for this student/month
        const existingVoucher = await FeeVoucher.findOne({
          company: companyId,
          student: studentId,
          month: voucherMonth
        });
        if (existingVoucher) {
          generatedVouchers.push(existingVoucher);
          continue;
        }

        const voucherEnrollments = [];
        let totalFee = 0;
        let earliestDueDate = null;
        let admissionFeeTotal = 0;

        for (const enrollment of studentData.enrollments) {
          const dueDay = enrollment.dueDay || 10;
          const dueDate = new Date(Date.UTC(voucherMonth.getUTCFullYear(), voucherMonth.getUTCMonth(), dueDay));
          const lastDay = new Date(Date.UTC(voucherMonth.getUTCFullYear(), voucherMonth.getUTCMonth() + 1, 0)).getUTCDate();
          if (dueDay > lastDay) dueDate.setUTCDate(lastDay);
          if (!earliestDueDate || dueDate < earliestDueDate) earliestDueDate = dueDate;

          const monthlyFee = enrollment.finalFee || enrollment.netMonthlyFee || enrollment.monthlyFee || 0;
          const originalFee = enrollment.originalFee || enrollment.monthlyFee || monthlyFee;
          const discountAmount = Math.max(0, originalFee - monthlyFee);

          voucherEnrollments.push({
            enrollment: enrollment._id,
            course: enrollment.course._id,
            courseName: enrollment.course.name,
            monthlyFee: originalFee,
            discount: discountAmount,
            netFee: monthlyFee,
            finalFee: monthlyFee,
            originalFee: originalFee,
            discountAmount: discountAmount,
          });

          totalFee += monthlyFee;

          const enrollmentMonth = new Date(enrollment.enrollmentDate || enrollment.startDate);
          const isFirstMonth = (
            voucherMonth.getUTCFullYear() === enrollmentMonth.getUTCFullYear() &&
            voucherMonth.getUTCMonth() === enrollmentMonth.getUTCMonth()
          );
          if (isFirstMonth && enrollment.admissionFeeApplied && !enrollment.admissionFeeCharged) {
            admissionFeeTotal += (enrollment.admissionFee || 1000);
            enrollment._admissionFeeToCharge = true;
          }
        }

        const grandTotal = totalFee + admissionFeeTotal;
        const voucherNumber = `VCHR-${new Date().getUTCFullYear()}-${String(voucherCounter).padStart(6, '0')}`;
        voucherCounter++;

        const voucher = new FeeVoucher({
          company: companyId,
          voucherNumber: voucherNumber,
          student: studentId,
          month: voucherMonth,
          enrollments: voucherEnrollments,
          totalFee: grandTotal,
          baseFee: totalFee,
          admissionFee: admissionFeeTotal,
          dueDate: earliestDueDate,
          lateFeeAmount: company.lateFeeAmount || 200,
          totalWithLateFee: grandTotal + (company.lateFeeAmount || 200),
          generatedBy: userId,
          generatedDate: new Date(),
        });

        await voucher.save();
        generatedVouchers.push(voucher);

        // Mark admission fees as charged
        for (const enrollment of studentData.enrollments) {
          if (enrollment._admissionFeeToCharge) {
            await StudentEnrollment.findByIdAndUpdate(enrollment._id, { admissionFeeCharged: true });
          }
        }

        // Create corresponding fee record
        await this.createFeeRecord(voucher, studentData.student, voucherEnrollments, admissionFeeTotal);
      }

      return {
        message: `Generated ${generatedVouchers.length} voucher(s) for ${Object.keys(enrollmentsByStudent).length} student(s)`,
        vouchers: generatedVouchers,
      };

    } catch (error) {
      throw error;
    }
  }

  async createFeeRecord(voucher, student, enrollments, admissionFeeTotal = 0) {
    const feeItems = enrollments.map(e => ({
      course: e.course,
      description: `${e.courseName} - Monthly Fee`,
      quantity: 1,
      price: e.originalFee || e.monthlyFee || 0,
      discount: e.discountAmount || e.discount || 0,
      amount: e.finalFee || e.netFee || 0,
      feeType: 'monthly',
    }));

    if (admissionFeeTotal > 0) {
      feeItems.push({
        description: 'Admission Fee (One-time)',
        quantity: 1,
        price: admissionFeeTotal,
        discount: 0,
        amount: admissionFeeTotal,
        feeType: 'admission',
      });
    }

    const fee = new Fee({
      company: voucher.company,
      student: student._id,
      feeNumber: await this.getNextFeeNumber(voucher.company),
      date: new Date(),
      dueDate: voucher.dueDate,
      items: feeItems,
      subTotal: voucher.totalFee,
      totalAmount: voucher.totalFee,
      balanceDue: voucher.totalFee,
      status: 'unpaid',
      lateFeeRule: {
        amount: voucher.lateFeeAmount || 200,
        gracePeriodDays: 0,
      },
    });

    await fee.save();

    // Link fee to voucher
    voucher.fee = fee._id;
    await voucher.save();

    return fee;
  }

  async getNextVoucherNumber(companyId) {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
    const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));

    const lastVoucher = await FeeVoucher.findOne({
      company: companyId,
      generatedDate: { $gte: startOfYear, $lte: endOfYear }
    }).sort({ voucherNumber: -1 });

    if (!lastVoucher) return 1;
    const parts = lastVoucher.voucherNumber.split('-');
    const num = parseInt(parts[parts.length - 1] || '0');
    return isNaN(num) ? 1 : num + 1;
  }

  async getNextFeeNumber(companyId) {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
    const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));

    const lastFee = await Fee.findOne({
      company: companyId,
      date: { $gte: startOfYear, $lte: endOfYear }
    }).sort({ feeNumber: -1 });

    if (!lastFee) return 1;
    return (lastFee.feeNumber || 0) + 1;
  }

  async getVouchersByDate(companyId, selectedDate) {
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);

    const vouchers = await FeeVoucher.find({
      company: companyId,
      generatedDate: { $gte: startDate, $lte: endDate }
    })
    .populate('student', 'name email phone')
    .populate('enrollments.course', 'name')
    .populate('generatedBy', 'name')
    .sort({ voucherNumber: 1 });

    return vouchers;
  }

  async getVoucherDetails(companyId, voucherId) {
    const voucher = await FeeVoucher.findOne({
      company: companyId,
      _id: voucherId
    })
    .populate('student', 'name email phone address')
    .populate('enrollments.course', 'name duration')
    .populate('enrollments.enrollment', 'dueDay discount discountType')
    .populate('fee')
    .populate('generatedBy', 'name');

    if (!voucher) {
      throw new Error('Voucher not found');
    }

    return voucher;
  }

  async calculateVoucherAmounts(voucher) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(voucher.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const isOverdue = today > dueDate && voucher.status !== 'paid';
    const applicableAmount = isOverdue ? voucher.totalWithLateFee : voucher.totalFee;

    return {
      totalFee: voucher.totalFee,
      lateFeeAmount: voucher.lateFeeAmount,
      totalWithLateFee: voucher.totalWithLateFee,
      isOverdue: isOverdue,
      applicableAmount: applicableAmount,
      paidAmount: voucher.paidAmount || 0,
      balanceDue: applicableAmount - (voucher.paidAmount || 0)
    };
  }
}

const voucherService = new VoucherGenerationService();
export default voucherService;
