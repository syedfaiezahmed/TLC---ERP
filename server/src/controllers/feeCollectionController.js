import feeCollectionService from '../services/feeCollectionService.js';
import feeCalculationService from '../services/feeCalculationService.js';
import FeePayment from '../models/FeePayment.js';
import FeeVoucher from '../models/FeeVoucher.js';
import Ledger from '../models/Ledger.js';
import mongoose from 'mongoose';
import { postFeeCollectionJournal } from '../services/journalService.js';
import { logAudit } from '../services/auditService.js';
import { recalculateLedger } from '../services/ledgerService.js';

// Helper: resolve companyId from user or request
const resolveCompanyId = (req) => {
  return req.body?.companyId || req.query?.companyId || req.user?.company?.toString() || null;
};

class FeeCollectionController {
  async collectFee(req, res) {
    try {
      const paymentData = req.body;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });
      const userId = req.user._id;

      // Validate payment before collection
      if (paymentData.voucherId && paymentData.amount) {
        const validation = await feeCollectionService.validatePaymentBeforeCollection(
          paymentData.voucherId,
          paymentData.amount,
          companyId
        );

        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            message: 'Payment validation failed',
            validation: validation
          });
        }
      }

      const result = await feeCollectionService.collectFeePayment(
        paymentData,
        companyId,
        userId
      );

      res.json({
        success: true,
        message: result.message,
        payment: result.payment,
        updatedFee: result.updatedFee,
        updatedVoucher: result.updatedVoucher
      });

    } catch (error) {
      console.error('[FeeCollectionController] ❌ collectFee ERROR:', error.message);
      console.error('[FeeCollectionController] Stack:', error.stack);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to collect fee payment',
        error: error.message,
      });
    }
  }

  async getPaymentHistory(req, res) {
    try {
      const filters = req.query;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      const result = await feeCollectionService.getPaymentHistory(companyId, filters);

      res.json({
        success: true,
        payments: result.payments,
        pagination: result.pagination
      });

    } catch (error) {
      console.error('Error fetching payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment history',
        error: error.message
      });
    }
  }

  async getStudentPaymentHistory(req, res) {
    try {
      const { studentId } = req.params;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      const result = await feeCollectionService.getStudentPaymentHistory(studentId, companyId);

      res.json({
        success: true,
        payments: result.payments,
        summary: result.summary
      });

    } catch (error) {
      console.error('Error fetching student payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student payment history',
        error: error.message
      });
    }
  }

  async refundPayment(req, res) {
    try {
      const { paymentId } = req.params;
      const { refundAmount, refundReason } = req.body;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });
      const userId = req.user._id;

      if (!refundAmount || !refundReason) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount and reason are required'
        });
      }

      const result = await feeCollectionService.refundPayment(
        paymentId,
        refundAmount,
        refundReason,
        companyId,
        userId
      );

      res.json({
        success: true,
        message: result.message,
        refundedPayment: result.refundedPayment
      });

    } catch (error) {
      console.error('Error processing refund:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: error.message
      });
    }
  }

  async getDailyCollectionSummary(req, res) {
    try {
      const { date } = req.query;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required'
        });
      }

      const result = await feeCollectionService.getDailyCollectionSummary(companyId, date);

      res.json({
        success: true,
        date: result.date,
        summary: result.summary,
        payments: result.payments
      });

    } catch (error) {
      console.error('Error fetching daily collection summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch daily collection summary',
        error: error.message
      });
    }
  }

  async getMonthlyCollectionSummary(req, res) {
    try {
      const { year, month } = req.query;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      if (!year || !month) {
        return res.status(400).json({
          success: false,
          message: 'Year and month are required'
        });
      }

      const result = await feeCollectionService.getMonthlyCollectionSummary(
        companyId,
        parseInt(year),
        parseInt(month)
      );

      res.json({
        success: true,
        year: result.year,
        month: result.month,
        summary: result.summary,
        dailyBreakdown: result.dailyBreakdown
      });

    } catch (error) {
      console.error('Error fetching monthly collection summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch monthly collection summary',
        error: error.message
      });
    }
  }

  async validatePayment(req, res) {
    try {
      const { voucherId, amount } = req.body;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      if (!voucherId || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Voucher ID and amount are required'
        });
      }

      const validation = await feeCollectionService.validatePaymentBeforeCollection(
        voucherId,
        amount,
        companyId
      );

      res.json({
        success: true,
        validation: validation
      });

    } catch (error) {
      console.error('Error validating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate payment',
        error: error.message
      });
    }
  }

  async getPaymentDetails(req, res) {
    try {
      const { paymentId } = req.params;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      const payment = await FeePayment.findOne({
        _id: paymentId,
        company: companyId
      })
      .populate('student', 'name email phone address')
      .populate('fee', 'feeNumber date totalAmount status')
      .populate('voucher', 'voucherNumber dueDate totalFee status')
      .populate('receivedBy', 'name')
      .populate('discountApprovedBy', 'name');

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.json({
        success: true,
        payment: payment
      });

    } catch (error) {
      console.error('Error fetching payment details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment details',
        error: error.message
      });
    }
  }

  async updatePayment(req, res) {
    try {
      const { paymentId } = req.params;
      const updateData = req.body;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      const payment = await FeePayment.findOne({
        _id: paymentId,
        company: companyId,
        status: 'active'
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found or cannot be updated'
        });
      }

      // Allow updating only certain fields
      const allowedUpdates = ['notes', 'referenceNumber', 'bankName', 'chequeNumber', 'transactionId'];
      const updates = {};

      for (const field of allowedUpdates) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      Object.assign(payment, updates);
      await payment.save();

      res.json({
        success: true,
        message: 'Payment updated successfully',
        payment: payment
      });

    } catch (error) {
      console.error('Error updating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update payment',
        error: error.message
      });
    }
  }

  async getCollectionStatistics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      const companyObjId = new mongoose.Types.ObjectId(companyId);
      const matchStage = { company: companyObjId, status: 'active' };

      if (startDate || endDate) {
        matchStage.paymentDate = {};
        if (startDate) matchStage.paymentDate.$gte = new Date(startDate);
        if (endDate) matchStage.paymentDate.$lte = new Date(endDate);
      }

      const statistics = await FeePayment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalPayments: { $sum: 1 },
            totalLateFee: { $sum: '$lateFeeAmount' },
            totalDiscount: { $sum: '$discountAmount' },
            avgPaymentAmount: { $avg: '$amount' }
          }
        }
      ]);

      const methodBreakdown = await FeePayment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        }
      ]);

      const result = {
        summary: statistics[0] || {
          totalAmount: 0,
          totalPayments: 0,
          totalLateFee: 0,
          totalDiscount: 0,
          avgPaymentAmount: 0
        },
        paymentMethods: methodBreakdown
      };

      res.json({
        success: true,
        statistics: result
      });

    } catch (error) {
      console.error('Error fetching collection statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch collection statistics',
        error: error.message
      });
    }
  }

  async deletePayment(req, res) {
    try {
      const { paymentId } = req.params;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      const payment = await FeePayment.findOne({ _id: paymentId, company: companyId });
      if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
      if (payment.status === 'refunded') return res.status(400).json({ success: false, message: 'Cannot delete a refunded payment' });

      const before = payment.toObject();

      // Soft-delete: mark as cancelled
      payment.status = 'cancelled';
      await payment.save();

      // Reverse journal entries for this payment
      await Ledger.deleteMany({ company: companyId, referenceType: 'fee_payment', referenceId: payment._id });
      await Ledger.deleteMany({ company: companyId, referenceType: 'fee_collection', referenceId: payment._id });

      // Revert voucher status if it was paid by this payment
      if (payment.voucher) {
        const voucher = await FeeVoucher.findById(payment.voucher);
        if (voucher && voucher.status === 'paid') {
          const otherActive = await FeePayment.countDocuments({
            voucher: payment.voucher, status: 'active', _id: { $ne: payment._id }
          });
          if (otherActive === 0) {
            voucher.status = 'pending';
            voucher.paidAmount = 0;
            await voucher.save();
          }
        }
      }

      // Recalculate ledger accounts
      const cashAcc = (payment.paymentMethod && payment.paymentMethod !== 'Cash') ? 'Bank' : 'Cash';
      await Promise.all([
        recalculateLedger(companyId, payment.student),
        recalculateLedger(companyId, null, cashAcc),
        recalculateLedger(companyId, null, 'Accounts Receivable'),
        recalculateLedger(companyId, null, 'Fee Revenue'),
      ]);

      try { await logAudit({ req, companyId, action: 'delete', entityType: 'fee_payment', entityId: paymentId, before, after: null }); } catch (_) {}

      res.json({ success: true, message: 'Payment deleted and journal reversed successfully' });
    } catch (error) {
      console.error('[deletePayment] error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async syncJournals(req, res) {
    try {
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      // Find all active fee payments for this company
      const payments = await FeePayment.find({ company: companyId, status: 'active' })
        .populate('voucher', 'voucherNumber lateFeeAmount')
        .lean();

      let synced = 0;
      let skipped = 0;

      for (const payment of payments) {
        // Check if a journal entry already exists for this payment
        const existing = await Ledger.findOne({
          company: companyId,
          referenceType: 'fee_payment',
          referenceId: payment._id,
        });

        if (existing) { skipped++; continue; }

        // No journal entry — post one now
        try {
          const voucher = payment.voucher || { voucherNumber: 'N/A', lateFeeAmount: 0 };
          await postFeeCollectionJournal({
            companyId,
            studentId: payment.student,
            voucher,
            payment,
            paymentAmount: payment.amount,
            paymentMethod: payment.paymentMethod || 'Cash',
            lateFeeAmount: payment.lateFeeAmount || 0,
            date: payment.paymentDate || payment.createdAt,
          });
          synced++;
        } catch (jErr) {
          console.error(`[SyncJournals] Failed for payment ${payment._id}:`, jErr.message);
        }
      }

      res.json({
        success: true,
        message: `Sync complete. ${synced} journal entries created, ${skipped} already existed.`,
        synced,
        skipped,
      });
    } catch (error) {
      console.error('[SyncJournals] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new FeeCollectionController();
