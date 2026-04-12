import BadDebt from '../models/BadDebt.js';
import Fee from '../models/Fee.js';
import FeeVoucher from '../models/FeeVoucher.js';
import { postBadDebtJournal, postBadDebtRecoveryJournal } from './journalService.js';

class BadDebtService {
  async markAsBadDebt(feeId, writeOffReason, companyId, userId, voucherId = null) {
    try {
      // Try to load fee; if feeId missing, try via voucherId
      let fee = null;
      let linkedVoucherId = voucherId;

      if (feeId) {
        fee = await Fee.findOne({ _id: feeId, company: companyId }).populate('student');
      }

      // If no fee but voucherId provided, load fee from voucher
      if (!fee && linkedVoucherId) {
        const voucher = await FeeVoucher.findOne({ _id: linkedVoucherId, company: companyId });
        if (voucher?.fee) {
          fee = await Fee.findOne({ _id: voucher.fee, company: companyId }).populate('student');
          if (!linkedVoucherId) linkedVoucherId = voucher._id;
        }
      }

      if (!fee) throw new Error('Fee record not found for this voucher. Generate a fee record first.');
      if (fee.status === 'paid') throw new Error('Cannot mark a fully paid fee as bad debt.');

      const writtenOffAmount = Math.max(fee.balanceDue || 0, fee.totalAmount - (fee.paidAmount || 0));
      if (writtenOffAmount <= 0) throw new Error('Nothing to write off — balance is zero.');

      const badDebt = new BadDebt({
        company: companyId,
        student: fee.student?._id || fee.student,
        fee: fee._id,
        voucher: linkedVoucherId || fee.voucher,
        originalAmount: fee.totalAmount,
        writtenOffAmount,
        writeOffReason,
        approvedBy: userId,
        academicYear: this.getAcademicYear(new Date()),
        month: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
      });

      await badDebt.save();

      // Update fee — use 'unpaid' as closest valid status (no 'written_off' enum)
      fee.writeOffAmount = writtenOffAmount;
      fee.balanceDue = 0;
      fee.status = 'unpaid'; // mark unpaid so it won't show as collectible
      await fee.save();

      // Cancel linked voucher
      const vId = linkedVoucherId || fee.voucher;
      if (vId) {
        const voucher = await FeeVoucher.findById(vId);
        if (voucher) {
          voucher.status = 'cancelled';
          await voucher.save();
        }
      }

      // Post journal: DR Bad Debt Expense / CR Accounts Receivable
      try {
        await postBadDebtJournal({
          companyId,
          studentId: fee.student?._id || fee.student,
          feeId: fee._id,
          voucherId: linkedVoucherId || undefined,
          writtenOffAmount,
          reason: writeOffReason,
          date: new Date(),
        });
      } catch (jErr) {
        console.error('[BadDebt] Journal post failed:', jErr.message);
      }

      return {
        success: true,
        badDebt,
        message: `PKR ${writtenOffAmount.toLocaleString()} written off as bad debt successfully`,
      };

    } catch (error) {
      throw error;
    }
  }

  async recoverBadDebt(badDebtId, recoveryAmount, recoveryNotes, companyId, userId) {
    try {
      const badDebt = await BadDebt.findOne({ _id: badDebtId, company: companyId });
      if (!badDebt) throw new Error('Bad debt record not found');
      if (badDebt.status === 'recovered') throw new Error('Bad debt is already fully recovered');

      const remaining = badDebt.writtenOffAmount - (badDebt.recoveredAmount || 0);
      if (recoveryAmount > remaining) throw new Error('Recovery amount exceeds remaining bad debt');

      badDebt.recoveredAmount = (badDebt.recoveredAmount || 0) + recoveryAmount;
      badDebt.recoveryDate = new Date();
      badDebt.recoveryNotes = recoveryNotes;
      badDebt.status = badDebt.recoveredAmount >= badDebt.writtenOffAmount ? 'recovered' : 'partial_recovered';
      await badDebt.save();

      const fee = await Fee.findById(badDebt.fee);
      if (fee) {
        fee.paidAmount = (fee.paidAmount || 0) + recoveryAmount;
        fee.writeOffAmount = Math.max(0, (fee.writeOffAmount || 0) - recoveryAmount);
        fee.balanceDue = Math.max(0, fee.totalAmount - fee.paidAmount);
        fee.status = fee.paidAmount >= fee.totalAmount - 0.01 ? 'paid' : 'partial';
        await fee.save();
      }

      // Post journal: DR Cash / CR Bad Debt Recovery Income
      try {
        await postBadDebtRecoveryJournal({
          companyId,
          studentId: badDebt.student,
          feeId: badDebt.fee,
          recoveryAmount,
          notes: recoveryNotes,
          date: new Date(),
        });
      } catch (jErr) {
        console.error('[BadDebt] Recovery journal failed:', jErr.message);
      }

      return {
        success: true,
        badDebt,
        message: `Bad debt recovery of PKR ${recoveryAmount} recorded successfully`,
      };
    } catch (error) {
      throw error;
    }
  }

  async getBadDebts(companyId, filters = {}) {
    const {
      student,
      status,
      startDate,
      endDate,
      academicYear,
      page = 1,
      limit = 20
    } = filters;

    // Build query
    const query = { company: companyId };

    if (student) {
      query.student = student;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.writeOffDate = {};
      if (startDate) query.writeOffDate.$gte = new Date(startDate);
      if (endDate) query.writeOffDate.$lte = new Date(endDate);
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    // Get bad debts with pagination
    const skip = (page - 1) * limit;
    const badDebts = await BadDebt.find(query)
      .populate('student', 'name email phone')
      .populate('fee', 'feeNumber date totalAmount')
      .populate('voucher', 'voucherNumber')
      .populate('approvedBy', 'name')
      .sort({ writeOffDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await BadDebt.countDocuments(query);

    return {
      badDebts: badDebts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getBadDebtSummary(companyId, filters = {}) {
    const { startDate, endDate, academicYear } = filters;

    const matchStage = { company: companyId };

    if (startDate || endDate) {
      matchStage.writeOffDate = {};
      if (startDate) matchStage.writeOffDate.$gte = new Date(startDate);
      if (endDate) matchStage.writeOffDate.$lte = new Date(endDate);
    }

    if (academicYear) {
      matchStage.academicYear = academicYear;
    }

    const summary = await BadDebt.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          originalAmount: { $sum: '$originalAmount' },
          writtenOffAmount: { $sum: '$writtenOffAmount' },
          recoveredAmount: { $sum: '$recoveredAmount' }
        }
      }
    ]);

    const totalSummary = await BadDebt.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalOriginalAmount: { $sum: '$originalAmount' },
          totalWrittenOffAmount: { $sum: '$writtenOffAmount' },
          totalRecoveredAmount: { $sum: '$recoveredAmount' },
          netBadDebt: { $sum: { $subtract: ['$writtenOffAmount', '$recoveredAmount'] } }
        }
      }
    ]);

    const monthlyTrend = await BadDebt.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$writeOffDate' },
            month: { $month: '$writeOffDate' }
          },
          writtenOffAmount: { $sum: '$writtenOffAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    return {
      statusBreakdown: summary,
      totalSummary: totalSummary[0] || {
        totalRecords: 0,
        totalOriginalAmount: 0,
        totalWrittenOffAmount: 0,
        totalRecoveredAmount: 0,
        netBadDebt: 0
      },
      monthlyTrend: monthlyTrend
    };
  }

  async getStudentBadDebtHistory(studentId, companyId) {
    const badDebts = await BadDebt.find({
      company: companyId,
      student: studentId
    })
    .populate('fee', 'feeNumber date totalAmount')
    .populate('voucher', 'voucherNumber')
    .populate('approvedBy', 'name')
    .sort({ writeOffDate: -1 });

    const summary = {
      totalBadDebts: badDebts.length,
      totalWrittenOff: badDebts.reduce((sum, bd) => sum + bd.writtenOffAmount, 0),
      totalRecovered: badDebts.reduce((sum, bd) => sum + bd.recoveredAmount, 0),
      netBadDebt: badDebts.reduce((sum, bd) => sum + (bd.writtenOffAmount - bd.recoveredAmount), 0),
      fullyRecovered: badDebts.filter(bd => bd.status === 'recovered').length,
      partiallyRecovered: badDebts.filter(bd => bd.status === 'partial_recovered').length,
      notRecovered: badDebts.filter(bd => bd.status === 'written_off').length
    };

    return {
      badDebts: badDebts,
      summary: summary
    };
  }

  async bulkMarkAsBadDebt(feeIds, writeOffReason, companyId, userId) {
    const results = [];
    let totalWrittenOff = 0;

    for (const feeId of feeIds) {
      try {
        const result = await this.markAsBadDebt(feeId, writeOffReason, companyId, userId);
        results.push({ feeId, success: true, badDebt: result.badDebt });
        totalWrittenOff += result.badDebt.writtenOffAmount;
      } catch (error) {
        results.push({ feeId, success: false, error: error.message });
      }
    }

    return {
      success: true,
      message: `Processed ${feeIds.length} fees. ${results.filter(r => r.success).length} marked as bad debt.`,
      totalWrittenOff,
      results,
    };
  }

  async reverseBadDebt(badDebtId, reverseReason, companyId, userId) {
    try {
      const badDebt = await BadDebt.findOne({ _id: badDebtId, company: companyId });
      if (!badDebt) throw new Error('Bad debt record not found');
      if (badDebt.status === 'recovered') throw new Error('Cannot reverse fully recovered bad debt');

      badDebt.status = 'written_off';
      badDebt.recoveredAmount = 0;
      badDebt.recoveryDate = null;
      badDebt.recoveryNotes = `Reversed: ${reverseReason}`;
      await badDebt.save();

      const fee = await Fee.findById(badDebt.fee);
      if (fee) {
        fee.status = 'unpaid';
        fee.paidAmount = 0;
        fee.writeOffAmount = 0;
        fee.balanceDue = fee.totalAmount;
        await fee.save();
      }

      return { success: true, badDebt, message: 'Bad debt reversed successfully' };
    } catch (error) {
      throw error;
    }
  }

  getAcademicYear(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Assuming academic year starts in June
    if (month >= 5) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  async getBadDebtReport(companyId, startDate, endDate) {
    const badDebts = await BadDebt.find({
      company: companyId,
      writeOffDate: { $gte: startDate, $lte: endDate }
    })
    .populate('student', 'name email phone')
    .populate('fee', 'feeNumber date items')
    .populate('voucher', 'voucherNumber')
    .sort({ writeOffDate: -1 });

    const courseWiseBadDebt = {};
    const monthlyBadDebt = {};

    for (const badDebt of badDebts) {
      // Course-wise breakdown
      if (badDebt.fee && badDebt.fee.items) {
        for (const item of badDebt.fee.items) {
          const courseName = item.course?.name || 'Unknown Course';
          if (!courseWiseBadDebt[courseName]) {
            courseWiseBadDebt[courseName] = {
              writtenOffAmount: 0,
              recoveredAmount: 0,
              count: 0
            };
          }
          courseWiseBadDebt[courseName].writtenOffAmount += badDebt.writtenOffAmount;
          courseWiseBadDebt[courseName].recoveredAmount += badDebt.recoveredAmount;
          courseWiseBadDebt[courseName].count++;
        }
      }

      // Monthly breakdown
      const monthKey = `${badDebt.writeOffDate.getFullYear()}-${String(badDebt.writeOffDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyBadDebt[monthKey]) {
        monthlyBadDebt[monthKey] = {
          writtenOffAmount: 0,
          recoveredAmount: 0,
          count: 0
        };
      }
      monthlyBadDebt[monthKey].writtenOffAmount += badDebt.writtenOffAmount;
      monthlyBadDebt[monthKey].recoveredAmount += badDebt.recoveredAmount;
      monthlyBadDebt[monthKey].count++;
    }

    return {
      period: { startDate, endDate },
      totalBadDebts: badDebts,
      courseWiseBreakdown: courseWiseBadDebt,
      monthlyBreakdown: monthlyBadDebt,
      summary: {
        totalRecords: badDebts.length,
        totalWrittenOff: badDebts.reduce((sum, bd) => sum + bd.writtenOffAmount, 0),
        totalRecovered: badDebts.reduce((sum, bd) => sum + bd.recoveredAmount, 0),
        netBadDebt: badDebts.reduce((sum, bd) => sum + (bd.writtenOffAmount - bd.recoveredAmount), 0)
      }
    };
  }
}

const badDebtService = new BadDebtService();
export default badDebtService;
