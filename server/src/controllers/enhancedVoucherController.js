import voucherService from '../services/voucherService.js';
import feeCalculationService from '../services/feeCalculationService.js';
import FeeVoucher from '../models/FeeVoucher.js';
import Company from '../models/Company.js';
import mongoose from 'mongoose';
import { postJournal, postFeePaymentJournal, postFeeCollectionJournal } from '../services/journalService.js';
import Fee from '../models/Fee.js';
import { logAudit } from '../services/auditService.js';
import { healVoucherStatuses, forceHealVoucherStatuses } from '../services/voucherHealService.js';

// Single-company mode: always use the authenticated user's company.
// Client-supplied companyId in params/query/body is IGNORED for security.
const resolveCompanyId = (req) => req.user?.company?.toString() || null;

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

      // CA-correct status heal: compute status from paidAmount + dueDate for ALL vouchers.
      // - paidAmount >= totalFee       → paid (late fee may be waived; base fully covered)
      // - 0 < paidAmount < totalFee    → partial (or overdue if past due)
      // - paidAmount == 0              → pending (or overdue if past due)
      // Bad-debt and cancelled vouchers are preserved.
      await healVoucherStatuses(companyId);

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

        // CA RULE: All fees now have accrual entries (either pre-existing or auto-created)
        // Therefore, all payments post settlement: Dr Cash / Cr Accounts Receivable
        if (prevStatus !== 'paid') {
          try {
            const payMeth = paymentMethod || 'Cash';
            const linkedFee = voucher.fee ? await Fee.findById(voucher.fee).lean() : null;
            if (linkedFee) {
              await postFeePaymentJournal({
                companyId,
                studentId: voucher.student?._id,
                fee: linkedFee,
                date: new Date(),
                amount: amountPaid,
                discount: 0,
                reference: '',
                paymentMethod: payMeth,
              });
              console.log('[updateVoucherStatus] Settlement journal posted (Dr Cash / Cr AR)');
            } else {
              console.warn('[updateVoucherStatus] No linked fee found - skipping journal posting');
            }
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

      // Heal voucher statuses first so stats reflect true paid/overdue/partial counts.
      await healVoucherStatuses(companyId);

      const statistics = await FeeVoucher.aggregate([
        { $match: { company: new mongoose.Types.ObjectId(companyId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalFee: { $sum: '$totalFee' },
            totalPaid: { $sum: '$paidAmount' },
            totalDiscount: { $sum: { $ifNull: ['$paymentDiscountTotal', 0] } },
          }
        }
      ]);

      const totalVouchers = await FeeVoucher.countDocuments({ company: companyId });

      const summary = {
        total: totalVouchers,
        pending: 0, paid: 0, partial: 0, overdue: 0, cancelled: 0,
        totalAmount: 0,
        totalPaidAmount: 0,
        totalDiscountAmount: 0,
        totalPendingAmount: 0,
        totalOverdueAmount: 0,
      };

      for (const stat of statistics) {
        const s = stat._id;
        summary[s] = (summary[s] || 0) + stat.count;
        if (s === 'cancelled') continue; // exclude written-off vouchers from financial totals
        summary.totalAmount += stat.totalFee || 0;
        // Cash actually collected (settles bank/cash account)
        summary.totalPaidAmount += stat.totalPaid || 0;
        summary.totalDiscountAmount += stat.totalDiscount || 0;
        // NET balance due = totalFee − (cash received + discount allowed)
        const effectivePaid = (stat.totalPaid || 0) + (stat.totalDiscount || 0);
        const netDue = Math.max(0, (stat.totalFee || 0) - effectivePaid);
        if (s === 'pending' || s === 'partial') summary.totalPendingAmount += netDue;
        if (s === 'overdue') summary.totalOverdueAmount += netDue;
      }

      res.json({ success: true, statistics: summary });

    } catch (error) {
      console.error('Error fetching voucher statistics:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch voucher statistics', error: error.message });
    }
  }

  // Admin manual repair — force heal bypassing throttle
  async forceHeal(req, res) {
    try {
      const companyId = resolveCompanyId(req);
      if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

      const result = await forceHealVoucherStatuses(companyId);
      return res.json({
        success: !!result.ok,
        message: result.ok
          ? `Heal complete: scanned ${result.scanned || 0} vouchers, updated ${result.statusChanges || 0} statuses.`
          : `Heal failed: ${result.error || 'unknown error'}`,
        result,
      });
    } catch (err) {
      console.error('[forceHeal] error:', err);
      res.status(500).json({ success: false, message: err.message });
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
