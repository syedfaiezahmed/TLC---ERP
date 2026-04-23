import Fee from '../models/Fee.js';
import FeePayment from '../models/FeePayment.js';
import FeeVoucher from '../models/FeeVoucher.js';
import Company from '../models/Company.js';
import Student from '../models/Student.js';
import Ledger from '../models/Ledger.js';
import Course from '../models/Course.js';
import { recalculateLedger } from '../services/ledgerService.js';
import { postFeeJournal, postFeePaymentJournal, postGenericStudentPaymentJournal } from '../services/journalService.js';
import { assertPeriodOpen } from '../services/periodLockService.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import mongoose from 'mongoose';

// @desc    Create a new fee receipt
// @route   POST /api/fees
// @access  Private/Admin
const createFee = async (req, res) => {
  try {
    const {
      companyId,
      studentId,
      date,
      dueDate,
      items,
      taxRate,
      cashDiscount,
      status,
      notes,
    } = req.body;

    // Verify company
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized to create fee for this company' });

    try { await assertPeriodOpen(companyId, date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    // Verify student
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Calculate totals
    let subTotal = 0;
    const processedItems = items.map((item) => {
      const discount = Number(item.discount || 0);
      const amount = (item.quantity * item.price) - discount;
      subTotal += amount;
      return { 
        ...item, 
        discount, 
        amount,
        feeType: item.feeType || 'monthly' // Default to monthly if not specified
      };
    });

    const discountAmount = Number(cashDiscount || 0);
    const taxableAmount = Math.max(0, subTotal - discountAmount);
    const taxAmount = (taxableAmount * taxRate) / 100;
    const totalAmount = taxableAmount + taxAmount;

    // Auto-increment fee number
    const lastFee = await Fee.findOne({ company: companyId })
      .sort({ feeNumber: -1 })
      .limit(1);

    const feeNumber = lastFee ? lastFee.feeNumber + 1 : 1;

    const fee = new Fee({
      company: companyId,
      student: studentId,
      feeNumber,
      date,
      dueDate,
      items: processedItems,
      subTotal,
      cashDiscount: discountAmount,
      taxRate,
      taxAmount,
      totalAmount,
      status: status || 'unpaid',
      balanceDue: status === 'paid' ? 0 : totalAmount,
      notes,
      enrollment: req.body.enrollment || null,
    });

    const createdFee = await fee.save();
    try { await logAudit({ req, companyId, action: 'create', entityType: 'fee', entityId: createdFee._id, before: null, after: createdFee }); } catch(_) {}

    // Post accrual journal: Dr AR / Cr Fee Revenue
    await postFeeJournal({
        companyId,
        studentId,
        fee: createdFee,
        date,
        totalAmount,
        subTotal: taxableAmount,
        taxAmount,
        cogs: 0
    });

    // If marked as PAID on creation, post settlement journal
    if (status === 'paid') {
      await postFeePaymentJournal({
          companyId,
          studentId,
          fee: createdFee,
          date,
          amount: totalAmount
      });
      createdFee.paidAmount = totalAmount;
      await createdFee.save();
    }
    
    try { await recalculateLedger(companyId, studentId); } catch(lErr) { console.error('[createFee] ledger error:', lErr.message); }

    return res.status(201).json(createdFee);
  } catch (error) {
    console.error('[createFee] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Get all fees for a company
// @route   GET /api/fees/company/:companyId
// @access  Private/Admin
const getFees = async (req, res) => {
  try {
    const { companyId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { search, status, startDate, endDate } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    let query = { company: new mongoose.Types.ObjectId(companyId) };

    if (status && status !== 'all') {
        if (status === 'overdue') {
            query.status = { $ne: 'paid' };
            query.dueDate = { $lt: new Date() };
        } else {
            query.status = status;
        }
    }

    if (startDate && endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date = { $gte: new Date(startDate), $lte: end };
    }

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        const students = await Student.find({ 
            company: companyId, 
            name: searchRegex 
        }).select('_id');
        
        const studentIds = students.map(s => s._id);

        query.$or = [
            { feeNumber: !isNaN(search) ? Number(search) : null },
            { student: { $in: studentIds } }
        ].filter(condition => condition.feeNumber !== null || condition.student);
        
        if (isNaN(search)) {
             query.$or = [{ student: { $in: studentIds } }];
        }
    }

    const [fees, total, summaryResult] = await Promise.all([
        Fee.find(query)
        .populate('student', 'name email') 
        .select('feeNumber date dueDate totalAmount paidAmount balanceDue status student') 
        .sort({ date: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
        Fee.countDocuments(query),
        Fee.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalInvoiced: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                    totalDue: { 
                        $sum: { 
                            $subtract: [
                                "$totalAmount", 
                                { $add: [
                                    { $ifNull: ["$paidAmount", 0] }, 
                                    { $ifNull: ["$writeOffAmount", 0] }, 
                                    { $ifNull: ["$refundAmount", 0] }
                                ]}
                            ]
                        }
                    }
                }
            }
        ])
    ]);

    const summary = summaryResult.length > 0 ? {
        totalInvoiced: Number((summaryResult[0].totalInvoiced || 0).toFixed(2)),
        totalPaid: Number((summaryResult[0].totalPaid || 0).toFixed(2)),
        totalDue: Number((summaryResult[0].totalDue || 0).toFixed(2))
    } : { totalInvoiced: 0, totalPaid: 0, totalDue: 0 };

    res.json({
        fees,
        page,
        pages: Math.ceil(total / limit),
        total,
        summary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get fee by ID
// @route   GET /api/fees/:id
// @access  Private/Admin
const getFeeById = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate('student')
      .populate('company')
      .populate('items.course');

    if (!fee) return res.status(404).json({ message: 'Fee record not found' });
    if (!canAccessCompany(req.user, fee.company)) return res.status(401).json({ message: 'Not authorized' });

    // Fetch FeePayment records for this fee (single source of truth)
    const feePayments = await FeePayment.find({ fee: fee._id, status: 'active' })
      .populate('receivedBy', 'name')
      .sort({ paymentDate: 1 })
      .lean();

    const feeObj = fee.toObject();
    feeObj.feePayments = feePayments;
    // Computed summary
    feeObj.totalCollected = feePayments.reduce((s, p) => s + p.amount, 0);
    feeObj.totalDiscount  = feePayments.reduce((s, p) => s + (p.discountAmount || 0), 0);
    return res.json(feeObj);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// @desc    Update fee
// @route   PUT /api/fees/:id
// @access  Private/Admin
const updateFee = async (req, res) => {
  try {
    const { items, taxRate, cashDiscount, status, notes, date, dueDate } = req.body;

    const fee = await Fee.findById(req.params.id).populate('company');

    if (!fee) return res.status(404).json({ message: 'Fee record not found' });
    if (!canAccessCompany(req.user, fee.company)) return res.status(401).json({ message: 'Not authorized' });

    try { await assertPeriodOpen(fee.company._id, date || fee.date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

      if (items) {
        let subTotal = 0;
        const processedItems = items.map((item) => {
          const discount = Number(item.discount || 0);
          const amount = (item.quantity * item.price) - discount;
          subTotal += amount;
          return { ...item, discount, amount };
        });
        fee.items = processedItems;
        fee.subTotal = subTotal;
      }
      
      if (taxRate !== undefined) fee.taxRate = taxRate;
      if (cashDiscount !== undefined) fee.cashDiscount = cashDiscount;
      
      if (items || taxRate !== undefined || cashDiscount !== undefined) {
         const currentSubTotal = fee.subTotal;
         const currentTaxRate = taxRate !== undefined ? Number(taxRate) : Number(fee.taxRate);
         const currentCashDiscount = cashDiscount !== undefined ? Number(cashDiscount) : Number(fee.cashDiscount || 0);
         
         const taxableAmount = Math.max(0, currentSubTotal - currentCashDiscount);
         fee.taxAmount = (taxableAmount * currentTaxRate) / 100;
         fee.totalAmount = taxableAmount + fee.taxAmount;
         
         fee.balanceDue = fee.totalAmount - (fee.paidAmount || 0) - (fee.writeOffAmount || 0) - (fee.refundAmount || 0);
         if (fee.balanceDue <= 0.01) {
             fee.balanceDue = 0;
             fee.status = 'paid';
         } else if (fee.paidAmount > 0 || (fee.refundAmount || 0) > 0) {
             fee.status = 'partial';
         } else {
             fee.status = 'unpaid';
         }

         await Ledger.deleteMany({ 
             fee: fee._id, 
             company: fee.company._id,
             $or: [{ type: 'fee' }, { type: 'cogs' }]
         });

         await postFeeJournal({
             companyId: fee.company._id,
             studentId: fee.student,
             fee: fee,
             date: date || fee.date,
             totalAmount: fee.totalAmount,
             subTotal: taxableAmount,
             taxAmount: fee.taxAmount,
             cogs: 0
         });
      } else if (date) {
         await Ledger.updateMany(
           { fee: fee._id, company: fee.company._id },
           { $set: { date } }
         );
      }

      if (status) fee.status = status;
      if (notes) fee.notes = notes;
      if (date) fee.date = date;
      if (dueDate) fee.dueDate = dueDate;

    const updatedFee = await fee.save();
    try { await logAudit({ req, companyId: fee.company._id, action: 'update', entityType: 'fee', entityId: fee._id, before: null, after: updatedFee }); } catch(_) {}
    try { await recalculateLedger(fee.company._id, fee.student); } catch(lErr) { console.error('[updateFee] ledger error:', lErr.message); }

    return res.json(updatedFee);
  } catch (error) {
    console.error('[updateFee] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete fee
// @route   DELETE /api/fees/:id
// @access  Private/Admin
const deleteFee = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id).populate('company');

    if (!fee) return res.status(404).json({ message: 'Fee record not found' });
    if (!canAccessCompany(req.user, fee.company)) return res.status(401).json({ message: 'Not authorized' });

    try { await assertPeriodOpen(fee.company._id, fee.date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    await fee.deleteOne();
    try { await logAudit({ req, companyId: fee.company._id, action: 'delete', entityType: 'fee', entityId: fee._id, before: { feeId: fee._id, feeNumber: fee.feeNumber }, after: null }); } catch(_) {}
    try {
      await Ledger.deleteMany({ fee: fee._id });
      await recalculateLedger(fee.company._id, fee.student);
    } catch(lErr) { console.error('[deleteFee] ledger cleanup error:', lErr.message); }

    return res.json({ message: 'Fee record removed' });
  } catch (error) {
    console.error('[deleteFee] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Void a fee (CA-correct: reversal journal + mark cancelled — never delete)
// @route   POST /api/fees/:id/void
// @access  Private/Admin
const voidFee = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id).populate('company').populate('student');
    if (!fee) return res.status(404).json({ message: 'Fee record not found' });
    if (!canAccessCompany(req.user, fee.company)) return res.status(401).json({ message: 'Not authorized' });
    if (fee.status === 'cancelled') return res.status(400).json({ message: 'Fee is already voided/cancelled' });

    // Block void if payments have been received — must refund/cancel payments first
    const activePayments = await FeePayment.find({ fee: fee._id, status: 'active' });
    if (activePayments.length > 0) {
      return res.status(400).json({
        message: `Cannot void fee with ${activePayments.length} active payment(s). Cancel all payments first.`,
      });
    }

    try { await assertPeriodOpen(fee.company._id, fee.date); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    const { reason } = req.body;
    const companyId = fee.company._id;
    const studentId = fee.student._id || fee.student;
    const subTotal  = fee.subTotal  || fee.totalAmount;
    const taxAmount = fee.taxAmount || 0;
    const amount    = fee.totalAmount;
    const journalId = new mongoose.Types.ObjectId().toString();
    const now       = new Date();
    const desc      = `VOID: Fee #${fee.feeNumber} — ${fee.student?.name || ''} (${reason || 'voided by admin'})`;

    // REVERSAL ENTRIES: Dr Fee Revenue / Cr AR  (undoes original accrual)
    const lines = [
      {
        company: companyId, student: studentId, fee: fee._id,
        referenceType: 'fee_void', referenceId: fee._id,
        reference: `VOID-${fee.feeNumber}`, journalId, date: now, description: desc,
        debit: subTotal, credit: 0, type: 'fee_void',
        accountName: 'Fee Revenue', accountType: 'revenue', relatedAccount: 'Accounts Receivable',
        balance: 0, createdAt: now, updatedAt: now,
      },
      {
        company: companyId, student: studentId, fee: fee._id,
        referenceType: 'fee_void', referenceId: fee._id,
        reference: `VOID-AR-${fee.feeNumber}`, journalId, date: now, description: desc,
        debit: 0, credit: amount, type: 'fee_void',
        accountName: 'Accounts Receivable', accountType: 'asset', relatedAccount: 'Fee Revenue',
        balance: 0, createdAt: now, updatedAt: now,
      },
    ];
    if (taxAmount > 0) {
      lines.push({
        company: companyId, student: studentId, fee: fee._id,
        referenceType: 'fee_void', referenceId: fee._id,
        reference: `VOID-TAX-${fee.feeNumber}`, journalId, date: now, description: desc,
        debit: taxAmount, credit: 0, type: 'fee_void',
        accountName: 'Tax Payable', accountType: 'liability', relatedAccount: 'Accounts Receivable',
        balance: 0, createdAt: now, updatedAt: now,
      });
    }

    await Ledger.insertMany(lines);

    fee.status     = 'cancelled';
    fee.balanceDue = 0;
    fee.voidedAt   = now;
    fee.voidReason = reason || 'voided by admin';
    await fee.save();

    try { await recalculateLedger(companyId, studentId); } catch (_) {}
    try { await logAudit({ req, companyId, action: 'void_fee', entityType: 'fee', entityId: fee._id, before: { status: 'active', balanceDue: amount }, after: { status: 'cancelled' } }); } catch (_) {}

    return res.json({ message: `Fee #${fee.feeNumber} voided successfully`, fee });
  } catch (error) {
    console.error('[voidFee] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Record a payment for a fee
// @route   POST /api/fees/:id/payment
// @access  Private/Admin
const recordPayment = async (req, res) => {
  try {
    const { amount, date, method, reference, notes, discount = 0 } = req.body;
    const fee = await Fee.findById(req.params.id).populate('company').populate('student');

    if (!fee) return res.status(404).json({ message: 'Fee record not found' });
    if (!canAccessCompany(req.user, fee.company)) return res.status(401).json({ message: 'Not authorized' });

    try { await assertPeriodOpen(fee.company._id, date || new Date()); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    const payAmount  = Number(amount);
    const discAmount = Number(discount || 0);

    if (!payAmount || payAmount <= 0 || !isFinite(payAmount)) {
      return res.status(400).json({ message: 'Payment amount must be a positive number' });
    }
    if (discAmount < 0 || !isFinite(discAmount)) {
      return res.status(400).json({ message: 'Discount amount cannot be negative' });
    }
    if (payAmount + discAmount > fee.balanceDue + 0.01) {
      return res.status(400).json({ message: `Payment (${payAmount}) + discount (${discAmount}) exceeds balance due (${fee.balanceDue})` });
    }

    // ── Post settlement journal: Dr Cash / Cr AR ────────────────────────────
    await postFeePaymentJournal({
        companyId: fee.company._id,
        studentId: fee.student._id || fee.student,
        fee: fee,
        date: date || Date.now(),
        amount: payAmount,
        discount: discAmount,
        reference: reference || '',
        paymentMethod: method || 'Cash',
    });

    // ── Create FeePayment record (single source of truth) ───────────────────
    const payDate = date ? new Date(date) : new Date();
    const currentYear = payDate.getUTCFullYear();
    const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
    const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
    const count = await FeePayment.countDocuments({ company: fee.company._id, paymentDate: { $gte: startOfYear, $lte: endOfYear } });
    const paymentNumber = `PAY-${currentYear}-${String(count + 1).padStart(6, '0')}`;

    const feePayment = new FeePayment({
      paymentNumber,
      company: fee.company._id,
      student: fee.student._id || fee.student,
      fee: fee._id,
      amount: payAmount,
      paymentMethod: method || 'Cash',
      paymentDate: payDate,
      referenceNumber: reference || undefined,
      discountApplied: discAmount > 0,
      discountAmount: discAmount,
      receivedBy: req.user._id,
      notes: notes || undefined,
      academicYear: currentYear + '-' + (currentYear + 1),
      month: new Date(Date.UTC(payDate.getUTCFullYear(), payDate.getUTCMonth(), 1)),
      status: 'active',
    });
    await feePayment.save();

    // ── Update fee totals (standard formula everywhere) ───────────────────────
    fee.paidAmount     = (fee.paidAmount || 0) + payAmount;
    fee.writeOffAmount = (fee.writeOffAmount || 0) + discAmount;
    // STANDARD FORMULA: balanceDue = totalAmount - paidAmount - writeOffAmount - refundAmount
    fee.balanceDue = Math.max(0, Number((
      fee.totalAmount - fee.paidAmount - (fee.writeOffAmount || 0) - (fee.refundAmount || 0)
    ).toFixed(2)));

    if (fee.balanceDue <= 0.01) {
        fee.status = 'paid';
        fee.balanceDue = 0;
    } else if (fee.paidAmount > 0) {
        fee.status = 'partial';
    } else {
        fee.status = 'unpaid';
    }

    const updatedFee = await fee.save();
    try { await logAudit({ req, companyId: fee.company._id, action: 'payment', entityType: 'fee', entityId: fee._id, before: null, after: { amount: payAmount, date: date || Date.now(), method, reference } }); } catch(_) {}
    try {
      const pmCashAcc = (method && method !== 'Cash') ? 'Bank' : 'Cash';
      const sid = fee.student._id || fee.student;
      await Promise.all([
        recalculateLedger(fee.company._id, sid),
        recalculateLedger(fee.company._id, null, pmCashAcc),
        recalculateLedger(fee.company._id, null, 'Accounts Receivable'),
      ]);
    } catch(lErr) { console.error('[recordPayment] ledger error:', lErr.message); }

    return res.json({ ...updatedFee.toObject(), feePayment });

  } catch (error) {
    console.error('[recordPayment] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Record a generic student payment (not tied to a specific fee)
// @route   POST /api/fees/student/:studentId/payment
// @access  Private/Admin
const recordGenericPayment = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { amount, discount = 0, date, method, reference, notes, companyId } = req.body;

        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ message: 'Company not found' });
        if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

        try { await assertPeriodOpen(companyId, date || new Date()); } catch(lockErr) {
          return res.status(403).json({ message: lockErr.message });
        }

        await postGenericStudentPaymentJournal({
            companyId,
            studentId,
            date,
            amount,
            discount,
            method,
            reference,
            description: notes || `Generic Payment - ${method} ${reference || ''}`
        });

        await recalculateLedger(companyId, studentId);
        
        await logAudit({ req, companyId, action: 'payment', entityType: 'student', entityId: studentId, before: null, after: { amount, discount, method, reference } });

        return res.json({ message: 'Generic payment recorded successfully' });
    } catch (error) {
        console.error('[recordGenericPayment] error:', error.message);
        if (!res.headersSent) return res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a payment from a fee
// @route   DELETE /api/fees/payment/:paymentId
// @access  Private/Admin
const deletePayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        // 1. Try to find if it's a fee payment
        const fee = await Fee.findOne({ "payments._id": paymentId }).populate('company');

        if (fee) {
            if (!canAccessCompany(req.user, fee.company)) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            const paymentIndex = fee.payments.findIndex(p => p._id.toString() === paymentId);
            const payment = fee.payments[paymentIndex];
            
            await assertPeriodOpen(fee.company._id, payment.date);

            // Reverse logic
            fee.paidAmount     = Math.max(0, (fee.paidAmount || 0) - payment.amount);
            fee.writeOffAmount = Math.max(0, (fee.writeOffAmount || 0) - (payment.discount || 0));
            fee.payments.splice(paymentIndex, 1);

            fee.balanceDue = Math.max(0, Number((
              fee.totalAmount - fee.paidAmount - fee.writeOffAmount
              - (fee.refundAmount || 0) - (fee.creditNoteAmount || 0)
            ).toFixed(2)));
            if (fee.balanceDue <= 0.01) {
                fee.status = 'paid';
                fee.balanceDue = 0;
            } else if (fee.paidAmount > 0) {
                fee.status = 'partial';
            } else {
                fee.status = 'unpaid';
            }

            await fee.save();
            const pmCashAcc = (payment.method && payment.method !== 'Cash') ? 'Bank' : 'Cash';
            await Promise.all([
                recalculateLedger(fee.company._id, fee.student),
                recalculateLedger(fee.company._id, null, pmCashAcc),
                recalculateLedger(fee.company._id, null, 'Accounts Receivable'),
            ]);
            try { await logAudit({ req, companyId: fee.company._id, action: 'delete_payment', entityType: 'fee', entityId: fee._id, before: payment, after: null }); } catch (_) {}
            
            return res.json({ message: 'Fee payment deleted successfully' });
        }

        // 2. Check FeePayment model (new collection-based system)
        const feePayment = await FeePayment.findById(paymentId).populate('company');
        if (feePayment) {
            if (feePayment.company && !canAccessCompany(req.user, feePayment.company)) {
                return res.status(401).json({ message: 'Not authorized' });
            }
            if (feePayment.status === 'cancelled') {
                return res.status(400).json({ message: 'Payment is already cancelled' });
            }

            const before = feePayment.toObject();

            // Soft-delete
            feePayment.status = 'cancelled';
            await feePayment.save();

            // Reverse journal entries for ALL referenceTypes linked to this payment
            const cid = feePayment.company?._id || feePayment.company;
            await Ledger.deleteMany({ company: cid, referenceId: feePayment._id });
            // Also delete payment-type entries referencing the parent fee
            await Ledger.deleteMany({ company: cid, referenceType: 'payment', referenceId: feePayment.fee, type: 'payment' });

            // Sync fee.paidAmount & balanceDue from remaining active FeePayments
            if (feePayment.fee) {
                const feeDoc = await Fee.findById(feePayment.fee);
                if (feeDoc) {
                    const activePmts = await FeePayment.find({ fee: feePayment.fee, status: 'active' });
                    // CA RULE: fee.paidAmount tracks BASE FEE only — exclude late fee from each payment
                    const newPaid = activePmts.reduce((s, p) => s + (p.amount - (p.lateFeeAmount || 0)), 0);
                    const newDiscount = activePmts.reduce((s, p) => s + (p.discountAmount || 0), 0);
                    feeDoc.paidAmount     = newPaid;
                    feeDoc.writeOffAmount = newDiscount;
                    // STANDARD FORMULA
                    feeDoc.balanceDue = Math.max(0, Number((
                      feeDoc.totalAmount - feeDoc.paidAmount - (feeDoc.writeOffAmount || 0) - (feeDoc.refundAmount || 0)
                    ).toFixed(2)));
                    if (feeDoc.balanceDue <= 0.01)     { feeDoc.status = 'paid';    feeDoc.balanceDue = 0; }
                    else if (feeDoc.paidAmount > 0)     { feeDoc.status = 'partial'; }
                    else                                { feeDoc.status = 'unpaid';  }
                    await feeDoc.save();
                }
            }

            // Revert voucher status — use heal service for accuracy
            if (feePayment.voucher) {
                const { forceHealVoucherStatuses } = await import('../services/voucherHealService.js');
                await forceHealVoucherStatuses(cid);
            }

            // Recalculate ledgers
            const cashAcc = (feePayment.paymentMethod && feePayment.paymentMethod !== 'Cash') ? 'Bank' : 'Cash';
            await Promise.all([
                recalculateLedger(cid, feePayment.student),
                recalculateLedger(cid, null, cashAcc),
                recalculateLedger(cid, null, 'Accounts Receivable'),
                recalculateLedger(cid, null, 'Fee Revenue'),
                recalculateLedger(cid, null, 'Late Fee Revenue'),
            ]).catch(() => {});

            try { await logAudit({ req, companyId: cid, action: 'delete_payment', entityType: 'fee_payment', entityId: feePayment._id, before, after: null }); } catch (_) {}
            return res.json({ message: 'Fee payment deleted and journal reversed successfully' });
        }

        // 3. Check Ledger for generic payment
        const ledgerEntry = await Ledger.findById(paymentId);
        if (ledgerEntry && ledgerEntry.type === 'payment') {
            await assertPeriodOpen(ledgerEntry.company, ledgerEntry.date);
            const companyId = ledgerEntry.company;
            const studentId = ledgerEntry.student;

            await Ledger.deleteMany({
                company: companyId,
                date: ledgerEntry.date,
                description: ledgerEntry.description,
                reference: ledgerEntry.reference,
            });

            await recalculateLedger(companyId, studentId);
            try { await logAudit({ req, companyId, action: 'delete_payment', entityType: 'ledger_payment', entityId: paymentId, before: ledgerEntry, after: null }); } catch (_) {}
            return res.json({ message: 'Generic payment deleted successfully' });
        }

        return res.status(404).json({ message: 'Payment record not found' });
    } catch (error) {
        console.error('[deletePayment] error:', error.message);
        if (!res.headersSent) return res.status(400).json({ message: error.message });
    }
};

// @desc    Get payment details
// @route   GET /api/fees/:feeId/payment/:paymentId
// @access  Private/Admin
const getPaymentDetails = async (req, res) => {
    try {
        const { feeId, paymentId } = req.params;
        const fee = await Fee.findById(feeId).populate('company').populate('student');

        if (!fee) return res.status(404).json({ message: 'Fee record not found' });
        if (!canAccessCompany(req.user, fee.company)) return res.status(401).json({ message: 'Not authorized' });

        const payment = fee.payments.find(p => p._id.toString() === paymentId);
        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        res.json({
            ...payment.toObject(),
            feeNumber: fee.feeNumber,
            student: fee.student
        });
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export {
  createFee,
  getFees,
  getFeeById,
  updateFee,
  deleteFee,
  voidFee,
  recordPayment,
  recordGenericPayment,
  deletePayment,
  getPaymentDetails
};
