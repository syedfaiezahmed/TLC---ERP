import Purchase from '../models/Purchase.js';
import Asset from '../models/Asset.js';
import Teacher from '../models/Teacher.js';
import Course from '../models/Course.js';
import Company from '../models/Company.js';
import Ledger from '../models/Ledger.js';
import {
  postPurchaseJournal,
  postTeacherPaymentJournal,
  postGeneralPurchaseJournal,
  postGeneralPaymentJournal,
} from '../services/journalService.js';
import { recalculateLedger } from '../services/ledgerService.js';
import { assertPeriodOpen } from '../services/periodLockService.js';
import { logAudit } from '../services/auditService.js';
import mongoose from 'mongoose';

// @desc    Create a new purchase (Teacher Bill / Expense / Asset)
// @route   POST /api/purchases
// @access  Private/Admin
const createPurchase = async (req, res) => {
  try {
    const {
      companyId,
      category = 'teacher_payment',
      teacherId,
      supplier,
      description,
      paymentMethod = 'Credit',
      expenseAccountName,
      // Asset-specific fields
      assetName,
      assetCategory,
      assetAccountName,
      usefulLifeMonths,
      salvageValue,
      // Common
      date,
      dueDate,
      items,
      taxRate,
      cashDiscount,
      notes,
    } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // Teacher required only for teacher_payment category
    let teacher = null;
    if (category === 'teacher_payment') {
      teacher = await Teacher.findById(teacherId);
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    }

    try { await assertPeriodOpen(companyId, date); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    // Calculate totals from items
    let subTotal = 0;
    const processedItems = (items || []).map((item) => {
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const disc = Number(item.discount || 0);
      const amount = qty * price - disc;
      subTotal += amount;
      return { ...item, quantity: qty, price, discount: disc, amount };
    });

    const discountAmount = Number(cashDiscount || 0);
    const taxableAmount = Math.max(0, subTotal - discountAmount);
    const taxAmount = (taxableAmount * Number(taxRate || 0)) / 100;
    const totalAmount = taxableAmount + taxAmount;

    // Purchase status depends on payment method
    const isPaid = paymentMethod !== 'Credit';

    const lastPurchase = await Purchase.findOne({ company: companyId }).sort({ purchaseNumber: -1 });
    const purchaseNumber = lastPurchase ? lastPurchase.purchaseNumber + 1 : 1001;

    const purchase = new Purchase({
      company: companyId,
      category,
      teacher: teacher?._id || undefined,
      supplier: supplier || '',
      description: description || '',
      paymentMethod,
      expenseAccountName: expenseAccountName || 'Operating Expenses',
      purchaseNumber,
      date,
      dueDate: dueDate || undefined,
      items: processedItems,
      subTotal,
      taxRate: Number(taxRate || 0),
      taxAmount,
      cashDiscount: discountAmount,
      totalAmount,
      paidAmount: isPaid ? totalAmount : 0,
      balanceDue: isPaid ? 0 : totalAmount,
      status: isPaid ? 'paid' : 'unpaid',
      notes,
    });

    const createdPurchase = await purchase.save();

    // ── Post accounting journal ──────────────────────────────────────────────
    try {
      if (category === 'teacher_payment') {
        await postPurchaseJournal({ companyId, purchase: createdPurchase, teacher, items: processedItems, taxAmount, totalAmount });
      } else {
        await postGeneralPurchaseJournal({
          companyId, purchase: createdPurchase, category,
          expenseAccountName: expenseAccountName || 'Operating Expenses',
          assetAccountName: assetAccountName || 'Equipment',
          paymentMethod, totalAmount, taxAmount, subTotal,
          discountAmount: Number(discountAmount || 0),
          supplier: supplier || description || '',
          description,
        });
      }
    } catch (jErr) { console.error('[createPurchase] journal error:', jErr.message); }

    // ── Auto-create Asset if category = asset ───────────────────────────────
    if (category === 'asset') {
      try {
        const last = await Asset.findOne({ company: companyId }).sort({ assetNumber: -1 }).lean();
        const assetNumber = last ? last.assetNumber + 1 : 1;
        const newAsset = await Asset.create({
          company: companyId,
          assetNumber,
          name: assetName || description || `Asset from Purchase #${purchaseNumber}`,
          category: assetCategory || 'Fixed Asset',
          acquisitionDate: date,
          cost: Number(totalAmount),
          salvageValue: Number(salvageValue || 0),
          usefulLifeMonths: Number(usefulLifeMonths || 60),
          depreciationMethod: 'straight_line',
          assetAccountName: assetAccountName || 'Equipment',
          accumulatedDepreciationAccountName: 'Accumulated Depreciation',
          depreciationExpenseAccountName: 'Depreciation Expense',
          acquisitionAccountName: paymentMethod === 'Credit' ? 'Accounts Payable' : (paymentMethod === 'Bank' ? 'Bank' : 'Cash'),
          acquisitionOnCredit: paymentMethod === 'Credit',
          purchase: createdPurchase._id,
          notes: notes || '',
        });
        await createdPurchase.updateOne({ linkedAsset: newAsset._id });
        createdPurchase.linkedAsset = newAsset._id;
      } catch (assetErr) { console.error('[createPurchase] asset creation error:', assetErr.message); }
    }

    try { await logAudit({ req, companyId, action: 'create', entityType: 'purchase', entityId: createdPurchase._id, before: null, after: createdPurchase }); } catch (_) {}

    void Promise.all([
      recalculateLedger(companyId, null, category === 'expense' ? (expenseAccountName || 'Operating Expenses') : (assetAccountName || 'Equipment')),
      recalculateLedger(companyId, null, paymentMethod === 'Credit' ? 'Accounts Payable' : (paymentMethod === 'Bank' ? 'Bank' : 'Cash')),
    ]).catch(() => {});

    const result = await Purchase.findById(createdPurchase._id).populate('teacher', 'name').populate('linkedAsset', 'name assetNumber').lean();
    return res.status(201).json(result);
  } catch (error) {
    console.error('[createPurchase] error:', error);
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// @desc    Update purchase (Bill)
// @route   PUT /api/purchases/:id
// @access  Private/Admin
const updatePurchase = async (req, res) => {
  try {
    const { teacherId, date, dueDate, items, taxRate, cashDiscount, notes } = req.body;

    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase record not found' });
    if ((purchase.payments || []).length > 0 || Number(purchase.paidAmount || 0) > 0) {
      return res.status(400).json({ message: 'Cannot edit purchase with existing payments. Reverse them first.' });
    }

    try { await assertPeriodOpen(purchase.company, date || purchase.date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    const teacher = await Teacher.findById(teacherId || purchase.teacher);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    // Remove existing purchase journal lines
    await Ledger.deleteMany({ company: purchase.company, referenceType: 'purchase', referenceId: purchase._id });

    // Recalculate totals for new items
    let subTotal = 0;
    const processedItems = (items || []).map((item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);
      const amount = qty * price - discount;
      subTotal += amount;
      return { ...item, quantity: qty, price, discount, amount };
    });

    const discountAmount = Number(cashDiscount ?? purchase.cashDiscount ?? 0);
    const taxableAmount = Math.max(0, subTotal - discountAmount);
    const rate = Number(taxRate ?? purchase.taxRate ?? 0);
    const taxAmount = (taxableAmount * rate) / 100;
    const totalAmount = taxableAmount + taxAmount;

    const before = purchase.toObject();
    purchase.teacher = teacherId || purchase.teacher;
    purchase.date = date || purchase.date;
    purchase.dueDate = dueDate || purchase.dueDate;
    purchase.items = processedItems;
    purchase.subTotal = subTotal;
    purchase.taxRate = rate;
    purchase.taxAmount = taxAmount;
    purchase.cashDiscount = discountAmount;
    purchase.totalAmount = totalAmount;
    purchase.balanceDue = totalAmount;
    purchase.status = 'unpaid';
    purchase.notes = notes ?? purchase.notes;

    const updated = await purchase.save();

    // Re-post purchase journal
    await postPurchaseJournal({
      companyId: purchase.company,
      purchase: updated,
      teacher,
      items: processedItems,
      taxAmount,
      totalAmount,
    });

    await logAudit({ req, companyId: purchase.company, action: 'update', entityType: 'purchase', entityId: purchase._id, before, after: updated });

    void Promise.all([
      recalculateLedger(purchase.company, null, 'Institute Assets/Expenses'),
      recalculateLedger(purchase.company, null, 'Accounts Payable'),
      recalculateLedger(purchase.company, null, 'Input Tax'),
      recalculateLedger(purchase.company, null, 'Discount Received'),
    ]).catch(() => {});

    res.json(updated);
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete purchase (Bill) — auto-reverses any payments first
// @route   DELETE /api/purchases/:id
// @access  Private/Admin
const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).populate('teacher');
    if (!purchase) return res.status(404).json({ message: 'Purchase record not found' });

    try { await assertPeriodOpen(purchase.company, purchase.date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    // Auto-reverse any recorded payments before deleting
    const payments = purchase.payments || [];
    for (const payment of payments) {
      if (payment.journalId) {
        await Ledger.deleteMany({ company: purchase.company, journalId: payment.journalId });
      }
    }

    // Delete the purchase journal entries
    await Ledger.deleteMany({ company: purchase.company, referenceType: 'purchase', referenceId: purchase._id });

    const before = purchase.toObject();
    await purchase.deleteOne();

    try { await logAudit({ req, companyId: before.company, action: 'delete', entityType: 'purchase', entityId: before._id, before, after: null }); } catch(_) {}

    void Promise.all([
      recalculateLedger(before.company, null, 'Institute Assets/Expenses'),
      recalculateLedger(before.company, null, 'Accounts Payable'),
      recalculateLedger(before.company, null, 'Cash'),
      recalculateLedger(before.company, null, 'Bank'),
      recalculateLedger(before.company, null, 'Input Tax'),
      recalculateLedger(before.company, null, 'Discount Received'),
    ]).catch(() => {});

    return res.json({ message: 'Purchase and all associated payments deleted successfully' });
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete / reverse a single payment from a purchase bill
// @route   DELETE /api/purchases/:id/pay/:paymentId
// @access  Private/Admin
const deletePaymentEntry = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const purchase = await Purchase.findById(id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    try { await assertPeriodOpen(purchase.company, purchase.date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    const idx = (purchase.payments || []).findIndex(p => p._id.toString() === paymentId);
    if (idx === -1) return res.status(404).json({ message: 'Payment entry not found' });

    const payment = purchase.payments[idx];

    // Reverse journal
    if (payment.journalId) {
      await Ledger.deleteMany({ company: purchase.company, journalId: payment.journalId });
    }

    const before = { ...payment.toObject() };
    purchase.payments.splice(idx, 1);
    purchase.paidAmount   = purchase.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalDiscount   = purchase.payments.reduce((s, p) => s + Number(p.discount || 0), 0);
    purchase.balanceDue   = purchase.totalAmount - purchase.paidAmount - totalDiscount;
    if      (purchase.balanceDue <= 0.01)   purchase.status = 'paid';
    else if (purchase.paidAmount > 0)        purchase.status = 'partial';
    else                                     purchase.status = 'unpaid';

    await purchase.save();

    void Promise.all([
      recalculateLedger(purchase.company, null, 'Cash'),
      recalculateLedger(purchase.company, null, 'Bank'),
      recalculateLedger(purchase.company, null, 'Accounts Payable'),
      recalculateLedger(purchase.company, null, 'Discount Received'),
    ]).catch(() => {});

    try { await logAudit({ req, companyId: purchase.company, action: 'delete_payment', entityType: 'purchase', entityId: purchase._id, before, after: null }); } catch(_) {}

    return res.json({ message: 'Payment reversed and deleted successfully' });
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Get all purchases for a company
// @route   GET /api/purchases/company/:companyId
// @access  Private/Admin
const getPurchases = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page, limit, status, teacherId, search, startDate, endDate } = req.query;

    let query = { company: companyId };

    if (status && status !== 'all') {
        query.status = status;
    }

    if (teacherId) {
        query.teacher = teacherId;
    }

    if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const purchases = await Purchase.find(query)
        .populate('teacher', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    const total = await Purchase.countDocuments(query);

    res.json({
        purchases,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get purchase by ID
// @route   GET /api/purchases/:id
// @access  Private/Admin
const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('teacher', 'name email contact address')
      .populate('items.course', 'name code')
      .lean();

    if (!purchase) return res.status(404).json({ message: 'Purchase record not found' });
    return res.json(purchase);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// @desc    Record a payment to a teacher
// @route   POST /api/purchases/:id/pay
// @access  Private/Admin
const recordPayment = async (req, res) => {
    try {
        const { amount, method, reference, date, discount } = req.body;
        const purchase = await Purchase.findById(req.params.id).populate('teacher');

        if (!purchase) return res.status(404).json({ message: 'Purchase record not found' });

        try { await assertPeriodOpen(purchase.company, date || new Date()); } catch(lockErr) {
          return res.status(403).json({ message: lockErr.message });
        }

        const paymentAmount = Number(amount);
        const discountAmount = Number(discount || 0);

        let posted;
        if (purchase.category === 'teacher_payment' && purchase.teacher) {
          const teacher = purchase.teacher._id ? purchase.teacher : await Teacher.findById(purchase.teacher);
          if (!teacher) return res.status(404).json({ message: 'Teacher not found for this purchase' });
          posted = await postTeacherPaymentJournal({
            companyId: purchase.company, purchase, teacher,
            amount: paymentAmount, discount: discountAmount, method, reference, date: date || new Date(),
          });
        } else {
          posted = await postGeneralPaymentJournal({
            companyId: purchase.company, purchase,
            amount: paymentAmount, discount: discountAmount, method, reference,
            date: date || new Date(), supplier: purchase.supplier || purchase.description,
          });
        }

        const journalId = posted?.[0]?.journalId || null;

        purchase.payments.push({
            date: date || new Date(),
            amount: paymentAmount,
            method,
            reference,
            discount: discountAmount,
            journalId
        });

        purchase.paidAmount = purchase.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const allDiscounts = purchase.payments.reduce((sum, p) => sum + Number(p.discount || 0), 0);
        purchase.balanceDue = purchase.totalAmount - purchase.paidAmount - allDiscounts;

        if (purchase.balanceDue <= 0.01) {
            purchase.status = 'paid';
            purchase.balanceDue = 0;
        } else if (purchase.paidAmount > 0) {
            purchase.status = 'partial';
        }

        await purchase.save();
        await logAudit({ req, companyId: purchase.company, action: 'payment', entityType: 'purchase', entityId: purchase._id, before: null, after: { payment: { amount: paymentAmount, method, reference, date: date || new Date(), discount: discountAmount } } });

        void Promise.all([
            recalculateLedger(purchase.company, null, 'Accounts Payable'),
            recalculateLedger(purchase.company, null, 'Cash'),
            recalculateLedger(purchase.company, null, 'Bank'),
            recalculateLedger(purchase.company, null, 'Discount Received'),
        ]).catch(() => {});

        res.json(purchase);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export { createPurchase, getPurchases, getPurchaseById, updatePurchase, deletePurchase, recordPayment, deletePaymentEntry };
