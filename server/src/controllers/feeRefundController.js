import FeeRefund from '../models/FeeRefund.js';
import Company from '../models/Company.js';
import Student from '../models/Student.js';
import Fee from '../models/Fee.js';
import Course from '../models/Course.js';
import Ledger from '../models/Ledger.js';
import { postFeeRefundJournal } from '../services/journalService.js';
import { recalculateLedger } from '../services/ledgerService.js';
import { assertPeriodOpen } from '../services/periodLockService.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';

const createFeeRefund = async (req, res) => {
  try {
    const { companyId, studentId, feeId, date, items, taxRate = 0, reason, notes, refundMethod = 'Cash' } = req.body;

    if (!companyId || !studentId) {
      return res.status(400).json({ message: 'Company ID and Student ID are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await assertPeriodOpen(companyId, date);

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    let fee = null;
    if (feeId && feeId !== 'null') {
      fee = await Fee.findById(feeId);
      if (!fee) {
        return res.status(404).json({ message: 'Fee record not found' });
      }
      
      const maxReturnable = Number((fee.totalAmount - (fee.refundAmount || 0)).toFixed(2));
      let tempSubTotal = 0;
      items.forEach(item => {
        tempSubTotal += Number((Number(item.quantity || 1) * Number(item.price || 0)).toFixed(2));
      });
      const tempTax = Number(((tempSubTotal * Number(taxRate || 0)) / 100).toFixed(2));
      const tempTotal = Number((tempSubTotal + tempTax).toFixed(2));

      if (tempTotal > maxReturnable) {
        return res.status(400).json({ message: `Refund amount (${tempTotal}) cannot exceed remaining fee amount (${maxReturnable})` });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items are required' });
    }

    let subTotal = 0;
    const processedItems = items.map((item) => {
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const amount = Number((qty * price).toFixed(2));
      subTotal += amount;
      return { ...item, quantity: qty, price, amount };
    });

    const taxAmount = Number(((Math.max(0, subTotal) * Number(taxRate || 0)) / 100).toFixed(2));
    const totalAmount = Number((subTotal + taxAmount).toFixed(2));

    const last = await FeeRefund.findOne({ company: companyId }).sort({ refundNumber: -1 }).lean();
    const refundNumber = last ? last.refundNumber + 1 : 1;

    const feeRefund = await FeeRefund.create({
      company: companyId,
      student: studentId,
      fee: feeId || undefined,
      refundNumber,
      date,
      refundMethod,
      items: processedItems,
      subTotal: Number(subTotal.toFixed(2)),
      taxRate,
      taxAmount,
      totalAmount,
      reason,
      notes,
    });

    // Post Journal
    await postFeeRefundJournal({
      companyId,
      studentId,
      feeId: fee?._id || undefined,
      refund: feeRefund,
      date,
      refundMethod,
      subTotal: Number(subTotal.toFixed(2)),
      taxAmount,
      totalAmount,
    });

    // Update Fee Balance if linked
    if (fee) {
      fee.refundAmount = Number((Number(fee.refundAmount || 0) + totalAmount).toFixed(2));
      fee.balanceDue = Number((fee.totalAmount - (fee.paidAmount || 0) - (fee.writeOffAmount || 0) - fee.refundAmount).toFixed(2));
      
      if (fee.balanceDue <= 0.01) {
        fee.balanceDue = 0;
        fee.status = 'paid';
      } else if ((fee.paidAmount || 0) > 0 || (fee.refundAmount || 0) > 0) {
        fee.status = 'partial';
      } else {
        fee.status = 'unpaid';
      }
      await fee.save();
    }

    const refundCashAccount = (refundMethod && refundMethod !== 'Cash') ? 'Bank' : 'Cash';
    void Promise.all([
      recalculateLedger(companyId, null, 'Fee Revenue'),
      recalculateLedger(companyId, null, refundCashAccount),
    ]).catch(() => {});
    await logAudit({ req, companyId, action: 'create', entityType: 'fee_refund', entityId: feeRefund._id, before: null, after: feeRefund });

    res.status(201).json(feeRefund);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

const getFeeRefunds = async (req, res) => {
  try {
    const { companyId } = req.params;
    const refunds = await FeeRefund.find({ company: companyId })
      .populate('student', 'name')
      .populate('fee', 'feeNumber')
      .sort({ date: -1, refundNumber: -1 })
      .lean();
    res.json({ count: refunds.length, refunds });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFeeRefundById = async (req, res) => {
  try {
    const refund = await FeeRefund.findById(req.params.id)
      .populate('student', 'name email address contact')
      .populate('fee', 'feeNumber totalAmount')
      .populate('items.course', 'name code')
      .lean();

    if (!refund) {
      return res.status(404).json({ message: 'Refund record not found' });
    }

    if (!canAccessCompany(req.user, { _id: refund.company })) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(refund);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const deleteFeeRefund = async (req, res) => {
  try {
    const refund = await FeeRefund.findById(req.params.id);
    if (!refund) {
      return res.status(404).json({ message: 'Refund record not found' });
    }

    if (!canAccessCompany(req.user, { _id: refund.company })) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    try { await assertPeriodOpen(refund.company, refund.date); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    // Remove Ledger Entries
    await Ledger.deleteMany({ company: refund.company, referenceType: 'fee_refund', referenceId: refund._id });

    // Update Fee Balance if linked
    if (refund.fee) {
      const fee = await Fee.findById(refund.fee);
      if (fee) {
        fee.refundAmount = Math.max(0, Number((Number(fee.refundAmount || 0) - Number(refund.totalAmount)).toFixed(2)));
        fee.balanceDue = Number((fee.totalAmount - (fee.paidAmount || 0) - (fee.writeOffAmount || 0) - fee.refundAmount).toFixed(2));
        
        if (fee.balanceDue <= 0.01) {
            fee.balanceDue = 0;
            fee.status = 'paid';
        } else if ((fee.paidAmount || 0) > 0 || (fee.refundAmount || 0) > 0) {
            fee.status = 'partial';
        } else {
            fee.status = 'unpaid';
        }
        await fee.save();
      }
    }

    await logAudit({ req, companyId: refund.company, action: 'delete', entityType: 'fee_refund', entityId: refund._id, before: refund, after: null });

    await refund.deleteOne();

    const deletedCashAccount = (refund.refundMethod && refund.refundMethod !== 'Cash') ? 'Bank' : 'Cash';
    void Promise.all([
      recalculateLedger(refund.company, null, 'Fee Revenue'),
      recalculateLedger(refund.company, null, deletedCashAccount),
    ]).catch(() => {});

    res.json({ message: 'Refund record removed' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

export { createFeeRefund, getFeeRefunds, getFeeRefundById, deleteFeeRefund };
