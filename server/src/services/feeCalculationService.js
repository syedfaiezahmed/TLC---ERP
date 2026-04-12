import Fee from '../models/Fee.js';
import FeeVoucher from '../models/FeeVoucher.js';
import FeePayment from '../models/FeePayment.js';
import BadDebt from '../models/BadDebt.js';
import StudentEnrollment from '../models/StudentEnrollment.js';
import mongoose from 'mongoose';

class FeeCalculationService {
  async calculateFeeForVoucher(voucherId, companyId) {
    const voucher = await FeeVoucher.findOne({
      _id: voucherId,
      company: companyId
    })
    .populate('enrollments.course')
    .populate('enrollments.enrollment')
    .populate('student');

    if (!voucher) {
      throw new Error('Voucher not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(voucher.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const isOverdue = today > dueDate;
    const courseBreakdown = [];

    let totalMonthlyFee = 0;
    let totalDiscount = 0;
    let totalNetFee = 0;

    for (const enrollment of voucher.enrollments) {
      const courseData = {
        courseId: enrollment.course._id,
        courseName: enrollment.course.name,
        monthlyFee: enrollment.monthlyFee,
        discount: enrollment.discount,
        netFee: enrollment.netFee,
        feeWithinDueDate: enrollment.netFee,
        feeAfterDueDate: enrollment.netFee + voucher.lateFeeAmount,
        dueDay: enrollment.enrollment?.dueDay || 10
      };

      courseBreakdown.push(courseData);
      totalMonthlyFee += enrollment.monthlyFee;
      totalDiscount += enrollment.discount;
      totalNetFee += enrollment.netFee;
    }

    const totalWithinDueDate = totalNetFee;
    const totalAfterDueDate = totalNetFee + voucher.lateFeeAmount;
    const applicableAmount = isOverdue ? totalAfterDueDate : totalWithinDueDate;

    return {
      voucher: {
        voucherNumber: voucher.voucherNumber,
        student: voucher.student,
        month: voucher.month,
        dueDate: voucher.dueDate,
        status: voucher.status,
        isOverdue: isOverdue
      },
      courseBreakdown: courseBreakdown,
      totals: {
        totalMonthlyFee: totalMonthlyFee,
        totalDiscount: totalDiscount,
        totalNetFee: totalNetFee,
        totalWithinDueDate: totalWithinDueDate,
        totalAfterDueDate: totalAfterDueDate,
        applicableAmount: applicableAmount,
        paidAmount: voucher.paidAmount || 0,
        balanceDue: applicableAmount - (voucher.paidAmount || 0)
      }
    };
  }

  async calculateLateFee(feeId, companyId) {
    const fee = await Fee.findOne({
      _id: feeId,
      company: companyId
    });

    if (!fee) {
      throw new Error('Fee not found');
    }

    if (fee.status === 'paid') {
      return { lateFeeApplied: false, lateFeeAmount: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(fee.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (today <= dueDate) {
      return { lateFeeApplied: false, lateFeeAmount: 0 };
    }

    const gracePeriodDays = fee.lateFeeRule?.gracePeriodDays || 0;
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

    if (today <= gracePeriodEnd) {
      return { lateFeeApplied: false, lateFeeAmount: 0 };
    }

    const lateFeeAmount = fee.lateFeeRule?.amount || 200;

    // Update fee with late fee
    fee.lateFeeApplied = true;
    fee.lateFeeAmount = lateFeeAmount;
    fee.totalAmount = fee.subTotal + lateFeeAmount;
    fee.balanceDue = fee.totalAmount - fee.paidAmount;
    await fee.save();

    return {
      lateFeeApplied: true,
      lateFeeAmount: lateFeeAmount,
      newTotalAmount: fee.totalAmount,
      newBalanceDue: fee.balanceDue
    };
  }

  async applyDiscount(feeId, discountAmount, discountReason, approvedBy, companyId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const fee = await Fee.findOne({
        _id: feeId,
        company: companyId
      }).session(session);

      if (!fee) {
        throw new Error('Fee not found');
      }

      if (fee.status === 'paid') {
        throw new Error('Cannot apply discount to paid fee');
      }

      // Add discount payment entry
      fee.payments.push({
        date: new Date(),
        amount: 0,
        method: 'Discount',
        reference: discountReason,
        discount: discountAmount
      });

      // Update fee totals
      fee.cashDiscount += discountAmount;
      fee.totalAmount = Math.max(0, fee.subTotal - fee.cashDiscount + fee.lateFeeAmount);
      fee.balanceDue = Math.max(0, fee.totalAmount - fee.paidAmount);

      await fee.save({ session });

      await session.commitTransaction();
      session.endSession();

      return {
        discountApplied: discountAmount,
        newTotalAmount: fee.totalAmount,
        newBalanceDue: fee.balanceDue
      };

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async calculateStudentOutstanding(studentId, companyId) {
    const fees = await Fee.find({
      company: companyId,
      student: studentId,
      status: { $in: ['unpaid', 'partial'] }
    });

    let totalAssigned = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalLateFee = 0;
    let totalDiscount = 0;

    const feeDetails = [];

    for (const fee of fees) {
      const isOverdue = new Date() > new Date(fee.dueDate) && fee.status !== 'paid';
      const lateFeeAmount = isOverdue ? (fee.lateFeeAmount || 0) : 0;

      totalAssigned += fee.subTotal;
      totalReceived += fee.paidAmount;
      totalPending += fee.balanceDue;
      totalLateFee += lateFeeAmount;
      totalDiscount += fee.cashDiscount;

      feeDetails.push({
        feeId: fee._id,
        feeNumber: fee.feeNumber,
        date: fee.date,
        dueDate: fee.dueDate,
        subTotal: fee.subTotal,
        paidAmount: fee.paidAmount,
        balanceDue: fee.balanceDue,
        status: fee.status,
        isOverdue: isOverdue,
        lateFeeAmount: lateFeeAmount,
        discountAmount: fee.cashDiscount
      });
    }

    return {
      studentId: studentId,
      summary: {
        totalAssigned: totalAssigned,
        totalReceived: totalReceived,
        totalPending: totalPending,
        totalLateFee: totalLateFee,
        totalDiscount: totalDiscount
      },
      feeDetails: feeDetails
    };
  }

  async calculateCourseWiseFeeSummary(courseId, companyId, startDate, endDate) {
    const enrollments = await StudentEnrollment.find({
      company: companyId,
      course: courseId,
      status: 'active',
      startDate: { $lte: endDate },
      $or: [
        { actualEndDate: { $gte: startDate } },
        { actualEndDate: { $exists: false } },
        { actualEndDate: null }
      ]
    }).populate('student');

    const courseFees = await Fee.find({
      company: companyId,
      'items.course': courseId,
      date: { $gte: startDate, $lte: endDate }
    });

    let totalAssigned = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalLateFee = 0;
    let totalDiscount = 0;
    let totalBadDebt = 0;

    const studentBreakdown = [];

    for (const enrollment of enrollments) {
      const studentFees = courseFees.filter(fee => 
        fee.student.toString() === enrollment.student._id.toString()
      );

      let studentAssigned = 0;
      let studentReceived = 0;
      let studentPending = 0;
      let studentLateFee = 0;
      let studentDiscount = 0;

      for (const fee of studentFees) {
        const courseItem = fee.items.find(item => 
          item.course.toString() === courseId.toString()
        );

        if (courseItem) {
          studentAssigned += courseItem.amount;
          studentReceived += fee.paidAmount * (courseItem.amount / fee.subTotal);
          studentPending += fee.balanceDue * (courseItem.amount / fee.subTotal);
          studentLateFee += fee.lateFeeAmount || 0;
          studentDiscount += fee.cashDiscount * (courseItem.amount / fee.subTotal);
        }
      }

      totalAssigned += studentAssigned;
      totalReceived += studentReceived;
      totalPending += studentPending;
      totalLateFee += studentLateFee;
      totalDiscount += studentDiscount;

      studentBreakdown.push({
        student: enrollment.student,
        assigned: studentAssigned,
        received: studentReceived,
        pending: studentPending,
        lateFee: studentLateFee,
        discount: studentDiscount
      });
    }

    // Get bad debts for this course
    const badDebts = await BadDebt.find({
      company: companyId,
      'items.course': courseId,
      writeOffDate: { $gte: startDate, $lte: endDate }
    });

    for (const badDebt of badDebts) {
      const courseBadDebt = badDebt.items?.find(item => 
        item.course?.toString() === courseId.toString()
      );
      if (courseBadDebt) {
        totalBadDebt += courseBadDebt.amount || badDebt.writtenOffAmount;
      }
    }

    return {
      courseId: courseId,
      period: { startDate, endDate },
      summary: {
        totalStudents: enrollments.length,
        totalAssigned: totalAssigned,
        totalReceived: totalReceived,
        totalPending: totalPending,
        totalLateFee: totalLateFee,
        totalDiscount: totalDiscount,
        totalBadDebt: totalBadDebt,
        collectionRate: totalAssigned > 0 ? (totalReceived / totalAssigned) * 100 : 0
      },
      studentBreakdown: studentBreakdown
    };
  }

  async recalculateFeeAfterPayment(feeId, paymentAmount, companyId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const fee = await Fee.findOne({
        _id: feeId,
        company: companyId
      }).session(session);

      if (!fee) {
        throw new Error('Fee not found');
      }

      // Update paid amount
      fee.paidAmount += paymentAmount;
      fee.balanceDue = fee.totalAmount - fee.paidAmount;

      // Update status
      if (fee.balanceDue <= 0) {
        fee.status = 'paid';
        fee.paidAmount = fee.totalAmount;
        fee.balanceDue = 0;
      } else if (fee.paidAmount > 0) {
        fee.status = 'partial';
      }

      await fee.save({ session });

      await session.commitTransaction();
      session.endSession();

      return {
        status: fee.status,
        paidAmount: fee.paidAmount,
        balanceDue: fee.balanceDue,
        paymentAmount: paymentAmount
      };

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

const feeCalculationService = new FeeCalculationService();
export default feeCalculationService;
