import voucherService from '../services/voucherService.js';
import feeCalculationService from '../services/feeCalculationService.js';
import FeeVoucher from '../models/FeeVoucher.js';
import Company from '../models/Company.js';
import mongoose from 'mongoose';
import { postJournal } from '../services/journalService.js';
import { logAudit } from '../services/auditService.js';

// Helper: resolve companyId from user or request
const resolveCompanyId = (req) => {
  return req.body?.companyId || req.query?.companyId || req.user?.company?.toString() || null;
};

class VoucherController {
  async generateVouchers(req, res) {
    try {
      const { selectedDate } = req.body;
      const companyId = resolveCompanyId(req);
      const userId = req.user._id;

      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required. Please select a company.' });

      if (!selectedDate) {
        return res.status(400).json({ message: 'Selected date is required' });
      }

      const result = await voucherService.generateVouchersForDate(companyId, selectedDate, userId);
      
      res.json({
        success: true,
        message: result.message,
        vouchers: result.vouchers,
        totalVouchers: result.vouchers.length
      });

    } catch (error) {
      console.error('Error generating vouchers:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate vouchers', 
        error: error.message 
      });
    }
  }

  async getVouchersByDate(req, res) {
    try {
      const { date } = req.query;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

      if (!date) {
        return res.status(400).json({ message: 'Date is required' });
      }

      const vouchers = await voucherService.getVouchersByDate(companyId, date);
      
      res.json({
        success: true,
        vouchers: vouchers,
        totalVouchers: vouchers.length
      });

    } catch (error) {
      console.error('Error fetching vouchers:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch vouchers', 
        error: error.message 
      });
    }
  }

  async getVoucherDetails(req, res) {
    try {
      const { id } = req.params;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

      const voucher = await voucherService.getVoucherDetails(companyId, id);
      const calculation = await feeCalculationService.calculateFeeForVoucher(id, companyId);
      
      res.json({
        success: true,
        voucher: voucher,
        calculation: calculation
      });

    } catch (error) {
      console.error('Error fetching voucher details:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch voucher details', 
        error: error.message 
      });
    }
  }

  async getVouchersWithFilters(req, res) {
    try {
      const { 
        startDate, 
        endDate, 
        status, 
        student, 
        course,
        page = 1, 
        limit = 20 
      } = req.query;
      
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

      // Build query
      const query = { company: companyId };

      if (startDate || endDate) {
        query.month = {};
        if (startDate) {
          // Subtract 1 day to catch vouchers stored with timezone-shifted UTC dates
          const start = new Date(startDate);
          start.setUTCDate(start.getUTCDate() - 1);
          query.month.$gte = start;
        }
        if (endDate) {
          // Add 1 day to catch vouchers stored with timezone-shifted UTC dates
          const end = new Date(endDate);
          end.setUTCDate(end.getUTCDate() + 1);
          end.setUTCHours(23, 59, 59, 999);
          query.month.$lte = end;
        }
      }

      if (status) {
        if (Array.isArray(status)) {
          query.status = { $in: status };
        } else {
          query.status = status;
        }
      }

      if (student) {
        query.student = student;
      }

      if (course) {
        query['enrollments.course'] = course;
      }

      // Get vouchers with pagination
      const skip = (page - 1) * limit;
      const vouchers = await FeeVoucher.find(query)
        .populate('student', 'name email phone')
        .populate('enrollments.course', 'name')
        .populate('generatedBy', 'name')
        .sort({ generatedDate: -1, voucherNumber: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count
      const total = await FeeVoucher.countDocuments(query);

      // Calculate amounts for each voucher
      const vouchersWithAmounts = [];
      for (const voucher of vouchers) {
        const amounts = await voucherService.calculateVoucherAmounts(voucher);
        vouchersWithAmounts.push({
          ...voucher.toObject(),
          ...amounts
        });
      }

      res.json({
        success: true,
        vouchers: vouchersWithAmounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching vouchers with filters:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch vouchers', 
        error: error.message 
      });
    }
  }

  async updateVoucherStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes, paymentMethod, paidAmount } = req.body;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

      const voucher = await FeeVoucher.findOne({
        _id: id,
        company: companyId
      }).populate('student', 'name _id');

      if (!voucher) {
        return res.status(404).json({ message: 'Voucher not found' });
      }

      const prevStatus = voucher.status;
      voucher.status = status;
      if (notes) voucher.notes = notes;
      if (paymentMethod) voucher.paymentMethod = paymentMethod;
      
      if (status === 'paid') {
        const today = new Date();
        const dueDate = new Date(voucher.dueDate);
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = today > dueDate;
        const amountPaid = Number(paidAmount) || (isOverdue ? voucher.totalWithLateFee : voucher.totalFee);

        voucher.paidDate = new Date();
        voucher.paidAmount = amountPaid;

        // Post accounting journal: Dr Cash/Bank  Cr Fee Revenue (base) + Cr Late Fee Revenue (if any)
        if (prevStatus !== 'paid') {
          try {
            const cashAccount = (paymentMethod === 'Bank Transfer' || paymentMethod === 'Cheque' || paymentMethod === 'Online')
              ? 'Bank' : 'Cash';
            const lateFee = Number(voucher.lateFee || 0);
            const baseFee = amountPaid - lateFee;
            const jLines = [
              { accountName: cashAccount, accountType: 'asset', debit: amountPaid, credit: 0, type: 'fee_payment', student: voucher.student?._id, description: `Fee collected - ${voucher.voucherNumber}` },
              { accountName: 'Fee Revenue', accountType: 'revenue', debit: 0, credit: lateFee > 0 ? baseFee : amountPaid, type: 'fee_payment', student: voucher.student?._id, description: `Fee Revenue - ${voucher.voucherNumber}` },
            ];
            if (lateFee > 0) {
              jLines.push({ accountName: 'Late Fee Revenue', accountType: 'revenue', debit: 0, credit: lateFee, type: 'fee_payment', student: voucher.student?._id, description: `Late Fee - ${voucher.voucherNumber}` });
            }
            await postJournal(
              { companyId, studentId: voucher.student?._id, date: new Date(), description: `Fee Payment - Voucher #${voucher.voucherNumber}`, referenceType: 'fee_payment', referenceId: voucher._id },
              jLines
            );
          } catch (jErr) { console.error('[updateVoucherStatus] journal error:', jErr.message); }
        }
      }

      await voucher.save();

      res.json({
        success: true,
        message: 'Voucher status updated successfully',
        voucher: voucher
      });

    } catch (error) {
      console.error('Error updating voucher status:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update voucher status', 
        error: error.message 
      });
    }
  }

  async getVoucherStatistics(req, res) {
    try {
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      // Auto-mark overdue: any pending/partial voucher past due date → overdue
      const now = new Date();
      await FeeVoucher.updateMany(
        {
          company: companyId,
          status: { $in: ['pending', 'partial'] },
          dueDate: { $lt: now },
        },
        { $set: { status: 'overdue' } }
      );

      const statistics = await FeeVoucher.aggregate([
        { $match: { company: new mongoose.Types.ObjectId(companyId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalFee: { $sum: '$totalFee' },
            totalPaid: { $sum: '$paidAmount' },
          }
        }
      ]);

      const totalVouchers = await FeeVoucher.countDocuments({ company: companyId });

      const summary = {
        total: totalVouchers,
        pending: 0, paid: 0, partial: 0, overdue: 0, cancelled: 0,
        totalAmount: 0,
        totalPaidAmount: 0,
        totalPendingAmount: 0,
        totalOverdueAmount: 0,
      };

      for (const stat of statistics) {
        const s = stat._id;
        summary[s] = (summary[s] || 0) + stat.count;
        summary.totalAmount += stat.totalFee || 0;
        summary.totalPaidAmount += s === 'paid' ? (stat.totalPaid || 0) : 0;
        if (s === 'pending' || s === 'partial') summary.totalPendingAmount += stat.totalFee || 0;
        if (s === 'overdue') summary.totalOverdueAmount += stat.totalFee || 0;
      }

      res.json({ success: true, statistics: summary });

    } catch (error) {
      console.error('Error fetching voucher statistics:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch voucher statistics', error: error.message });
    }
  }

  async printVoucher(req, res) {
    try {
      const { id } = req.params;
      const { copyType = 'both' } = req.query;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

      const voucher = await voucherService.getVoucherDetails(companyId, id);
      const calculation = await feeCalculationService.calculateFeeForVoucher(id, companyId);
      
      // Get company settings for branding
      const company = await Company.findById(companyId);

      const printData = {
        company: company,
        voucher: voucher,
        calculation: calculation,
        copyType: copyType,
        printDate: new Date()
      };

      res.json({
        success: true,
        printData: printData
      });

    } catch (error) {
      console.error('Error preparing voucher for print:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to prepare voucher for print', 
        error: error.message 
      });
    }
  }

  async bulkPrintVouchers(req, res) {
    try {
      const { voucherIds, copyType = 'both' } = req.body;
      const companyId = resolveCompanyId(req);

      if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
        return res.status(400).json({ message: 'Voucher IDs are required' });
      }

      const vouchers = [];
      for (const voucherId of voucherIds) {
        try {
          const voucher = await voucherService.getVoucherDetails(companyId, voucherId);
          const calculation = await feeCalculationService.calculateFeeForVoucher(voucherId, companyId);
          
          vouchers.push({
            voucher: voucher,
            calculation: calculation
          });
        } catch (error) {
          console.error(`Error preparing voucher ${voucherId}:`, error);
        }
      }

      // Get company settings for branding
      const company = await Company.findById(companyId);

      const printData = {
        company: company,
        vouchers: vouchers,
        copyType: copyType,
        printDate: new Date()
      };

      res.json({
        success: true,
        printData: printData,
        totalVouchers: vouchers.length
      });

    } catch (error) {
      console.error('Error preparing bulk vouchers for print:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to prepare vouchers for print', 
        error: error.message 
      });
    }
  }

  async deleteVoucher(req, res) {
    try {
      const { id } = req.params;
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

      const voucher = await FeeVoucher.findOne({
        _id: id,
        company: companyId
      });

      if (!voucher) {
        return res.status(404).json({ message: 'Voucher not found' });
      }

      if (voucher.status === 'paid') {
        return res.status(400).json({ message: 'Cannot delete paid voucher' });
      }

      const before = voucher.toObject();
      await FeeVoucher.findByIdAndDelete(id);
      try { await logAudit({ req, companyId, action: 'delete', entityType: 'fee_voucher', entityId: id, before, after: null }); } catch (_) {}

      res.json({
        success: true,
        message: 'Voucher deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting voucher:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete voucher', 
        error: error.message 
      });
    }
  }
}

export default new VoucherController();
