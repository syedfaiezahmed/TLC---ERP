import FeePayment from '../models/FeePayment.js';
import Fee from '../models/Fee.js';
import FeeVoucher from '../models/FeeVoucher.js';
import { postFeeCollectionJournal, postFeePaymentRefundJournal, postFeePaymentJournal, postFeeJournal } from './journalService.js';
import { forceHealVoucherStatuses } from './voucherHealService.js';

class FeeCollectionService {
  async collectFeePayment(paymentData, companyId, userId) {
    try {
      console.log('[FeeCollection] collectFeePayment called:', JSON.stringify({ ...paymentData, companyId, userId }));

      const {
        voucherId,
        feeId,
        amount,
        paymentMethod = 'Cash',
        paymentDate = new Date(),
        referenceNumber,
        bankName,
        chequeNumber,
        transactionId,
        notes,
        discountAmount = 0,
        discountReason,
        lateFeeIncluded = false,
        lateFeeAmount: providedLateFeeAmount,
      } = paymentData;

      // ── Validate required fields ─────────────────────────────────────────────
      if (!voucherId) throw new Error('Voucher ID is required');
      const numericAmount = Number(amount);
      if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0)
        throw new Error('Payment amount must be a positive number');

      console.log('[FeeCollection] Step 1: Loading voucher', voucherId);

      // ── Load voucher ─────────────────────────────────────────────────────────
      const voucher = await FeeVoucher.findOne({ _id: voucherId, company: companyId });
      if (!voucher) throw new Error(`Voucher not found (id: ${voucherId})`);
      console.log('[FeeCollection] Voucher loaded:', voucher.voucherNumber, 'status:', voucher.status);

      if (voucher.status === 'paid') throw new Error('This voucher is already fully paid');
      if (voucher.status === 'cancelled') throw new Error('Cannot collect payment for a cancelled voucher');

      // ── Load fee record (optional — never block payment on missing fee) ──────
      console.log('[FeeCollection] Step 2: Loading fee record (feeId:', feeId, ', voucher.fee:', voucher.fee, ')');
      let fee = null;
      let feeIsPreExisting = false; // CA flag: true = fee has prior Dr AR / Cr Revenue accrual entry
      const lookupFeeId = feeId || voucher.fee;
      if (lookupFeeId) {
        fee = await Fee.findOne({ _id: lookupFeeId, company: companyId });
        if (fee) {
          feeIsPreExisting = true; // Fee was created via feeController → already has accrual journal
          console.log('[FeeCollection] Fee found (pre-existing, has accrual entry):', fee._id);
        } else {
          console.log('[FeeCollection] Fee ID provided but not found:', lookupFeeId);
        }
      }

      // ── Auto-create Fee if missing so future accounting stays intact ─────────
      if (!fee) {
        console.log('[FeeCollection] No fee linked — auto-creating fee record for voucher');
        try {
          const nextFeeNum = await this._getNextFeeNumber(companyId);
          fee = new Fee({
            company: companyId,
            student: voucher.student,
            feeNumber: nextFeeNum,
            date: new Date(),
            dueDate: voucher.dueDate,
            items: [{
              description: 'Monthly Fee (auto-generated at payment)',
              quantity: 1,
              price: voucher.totalFee,
              discount: 0,
              amount: voucher.totalFee,
              feeType: 'monthly',
            }],
            subTotal: voucher.totalFee,
            totalAmount: voucher.totalFee,
            balanceDue: voucher.totalFee,
            status: 'unpaid',
            lateFeeRule: { amount: voucher.lateFeeAmount || 200, gracePeriodDays: 0 },
          });
          await fee.save();
          // Post accrual journal: Dr AR / Cr Fee Revenue
          await postFeeJournal({
            companyId,
            studentId: voucher.student,
            fee,
            date: new Date(),
            totalAmount: voucher.totalFee,
            subTotal: voucher.totalFee,
            taxAmount: 0,
            cogs: 0,
          });
          // Link back to voucher
          voucher.fee = fee._id;
          console.log('[FeeCollection] Auto-created fee record with accrual journal:', fee._id);
        } catch (feeErr) {
          console.error('[FeeCollection] Fee auto-create failed (non-fatal):', feeErr.message);
          fee = null;
        }
      }

      // ── Calculate amounts ────────────────────────────────────────────────────
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(voucher.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const isOverdue = today > dueDate;

      // CA RULE: Applicable amount depends on whether admin chose to include late fee.
      // If admin waives late fee (lateFeeIncluded=false), the voucher's payable amount
      // is just the base totalFee — late fee is NOT recognized as revenue.
      const applicableAmount = (isOverdue && lateFeeIncluded)
        ? (voucher.totalWithLateFee || voucher.totalFee)
        : voucher.totalFee;
      const currentPaidAmount = voucher.paidAmount || 0;
      const remainingBalance = applicableAmount - currentPaidAmount;

      console.log('[FeeCollection] Step 3: Amounts — applicable:', applicableAmount, 'paid so far:', currentPaidAmount, 'remaining:', remainingBalance, 'new payment:', numericAmount, 'lateFeeIncluded:', lateFeeIncluded);

      if (numericAmount > remainingBalance + 0.5) {
        throw new Error(`Payment (PKR ${numericAmount}) exceeds remaining balance (PKR ${remainingBalance.toFixed(0)})`);
      }

      // ── Generate payment number (explicit — do NOT rely on pre-save hook) ────
      console.log('[FeeCollection] Step 4a: Generating payment number');
      let paymentNumber;
      try {
        const currentYear = new Date().getUTCFullYear();
        const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
        const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
        const count = await FeePayment.countDocuments({
          company: companyId,
          paymentDate: { $gte: startOfYear, $lte: endOfYear },
        });
        paymentNumber = `PAY-${currentYear}-${String(count + 1).padStart(6, '0')}`;
      } catch (pnErr) {
        // Fallback: timestamp-based number to guarantee uniqueness
        paymentNumber = `PAY-${new Date().getUTCFullYear()}-${Date.now()}`;
      }
      console.log('[FeeCollection] Payment number:', paymentNumber);

      // ── Save payment record ──────────────────────────────────────────────────
      console.log('[FeeCollection] Step 4b: Creating FeePayment record');
      const payDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
      const payment = new FeePayment({
        paymentNumber,
        company: companyId,
        student: voucher.student,
        fee: fee?._id || undefined,
        voucher: voucherId,
        amount: numericAmount,
        paymentMethod,
        paymentDate: payDate,
        referenceNumber: referenceNumber || undefined,
        bankName: bankName || undefined,
        chequeNumber: chequeNumber || undefined,
        transactionId: transactionId || undefined,
        lateFeeApplied: lateFeeIncluded,
        lateFeeAmount: lateFeeIncluded ? (Number(providedLateFeeAmount) || voucher.lateFeeAmount || 0) : 0,
        discountApplied: Number(discountAmount) > 0,
        discountAmount: Number(discountAmount) || 0,
        discountReason: discountReason || undefined,
        discountApprovedBy: Number(discountAmount) > 0 ? userId : undefined,
        receivedBy: userId,
        notes: notes || undefined,
        academicYear: this.getAcademicYear(payDate),
        month: new Date(Date.UTC(payDate.getUTCFullYear(), payDate.getUTCMonth(), 1)),
      });

      await payment.save();
      console.log('[FeeCollection] Payment saved:', payment.paymentNumber);

      // ── Update voucher ───────────────────────────────────────────────────────
      console.log('[FeeCollection] Step 5: Updating voucher status');
      const newPaidTotal = currentPaidAmount + numericAmount;
      voucher.paidAmount = newPaidTotal;
      if (newPaidTotal >= applicableAmount - 0.5) {
        voucher.status = 'paid';
        voucher.paidDate = payDate;
        voucher.paymentMethod = paymentMethod;
        voucher.paymentReference = referenceNumber || transactionId || undefined;
      } else {
        voucher.status = 'partial';
      }
      await voucher.save();
      console.log('[FeeCollection] Voucher updated — new status:', voucher.status, 'paid:', newPaidTotal);

      // ── Update Fee record (STANDARD FORMULA everywhere) ──────────────────────
      // CA RULE: fee.totalAmount tracks BASE FEE only (not late fee).
      // Late fee is a SEPARATE income stream (Late Fee Revenue) collected on top.
      // fee.paidAmount must ONLY include the base fee component of the payment.
      if (fee) {
        console.log('[FeeCollection] Step 6: Updating fee record');
        const discApplied      = Number(discountAmount) || 0;
        const lateFeeCollected = lateFeeIncluded
          ? (Number(providedLateFeeAmount) || voucher.lateFeeAmount || 0)
          : 0;
        const baseFeeComponent = numericAmount - lateFeeCollected;  // base fee portion only

        fee.paidAmount     = (fee.paidAmount || 0) + baseFeeComponent;
        fee.writeOffAmount = (fee.writeOffAmount || 0) + discApplied;
        // STANDARD FORMULA: balanceDue = totalAmount - paidAmount(base) - writeOffAmount - refundAmount
        fee.balanceDue = Math.max(0, Number((
          fee.totalAmount - fee.paidAmount - (fee.writeOffAmount || 0) - (fee.refundAmount || 0)
        ).toFixed(2)));
        if (fee.balanceDue <= 0.01)    { fee.status = 'paid';    fee.balanceDue = 0; }
        else if (fee.paidAmount > 0)   { fee.status = 'partial'; }
        else                           { fee.status = 'unpaid';  }
        await fee.save();
        console.log('[FeeCollection] Fee updated — base component:', baseFeeComponent, 'lateFee:', lateFeeCollected, 'new status:', fee.status);
      }

      // ── Post journal entry (non-fatal — never block payment on accounting failure) ─
      // CA RULE: Accrual-basis settlement:
      //   Dr Cash/Bank (full amount incl. late fee)
      //   Cr AR (base fee only — clears the accrual)
      //   Cr Late Fee Revenue (if late fee was charged — new income, never accrued)
      //   Dr Scholarship/Discount (if discount given)
      const lateFeeForJournal = lateFeeIncluded
        ? (Number(providedLateFeeAmount) || voucher.lateFeeAmount || 0)
        : 0;
      try {
        await postFeePaymentJournal({
          companyId,
          studentId: voucher.student,
          fee,
          date: payDate,
          amount: numericAmount,
          discount: Number(discountAmount) || 0,
          lateFeeAmount: lateFeeForJournal,
          reference: referenceNumber || '',
          paymentMethod,
        });
        console.log('[FeeCollection] Settlement journal posted (Dr Cash / Cr AR / Cr Late Fee Revenue)');
      } catch (jErr) {
        console.error('[FeeCollection] Journal post failed (non-fatal):', jErr.message);
      }

      console.log('[FeeCollection] ✅ Payment complete:', payment.paymentNumber);
      return {
        success: true,
        payment,
        updatedFee: fee,
        updatedVoucher: voucher,
        message: `Payment of PKR ${numericAmount.toLocaleString()} recorded successfully`,
      };

    } catch (error) {
      console.error('[FeeCollection] ❌ collectFeePayment FAILED:', error.message, error.stack);
      throw error;
    }
  }

  async _getNextFeeNumber(companyId) {
    try {
      const currentYear = new Date().getUTCFullYear();
      const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
      const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
      const lastFee = await Fee.findOne({
        company: companyId,
        date: { $gte: startOfYear, $lte: endOfYear },
      }).sort({ feeNumber: -1 });
      return (lastFee?.feeNumber || 0) + 1;
    } catch {
      return Date.now(); // fallback unique number
    }
  }

  async getPaymentHistory(companyId, filters = {}) {
    const {
      student,
      startDate,
      endDate,
      paymentMethod,
      status,
      page = 1,
      limit = 20
    } = filters;

    // Build query — default to active payments only
    const query = { company: companyId, status: status || 'active' };

    if (student) {
      query.student = student;
    }

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Get payments with pagination
    const skip = (page - 1) * limit;
    const payments = await FeePayment.find(query)
      .populate('student', 'name email phone')
      .populate('fee', 'feeNumber date totalAmount')
      .populate('voucher', 'voucherNumber dueDate')
      .populate('receivedBy', 'name')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await FeePayment.countDocuments(query);

    return {
      payments: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getStudentPaymentHistory(studentId, companyId) {
    const payments = await FeePayment.find({
      company: companyId,
      student: studentId
    })
    .populate('fee', 'feeNumber date totalAmount status')
    .populate('voucher', 'voucherNumber dueDate totalFee')
    .populate('receivedBy', 'name')
    .sort({ paymentDate: -1 });

    const summary = {
      totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
      totalLateFee: payments.reduce((sum, p) => sum + (p.lateFeeAmount || 0), 0),
      totalDiscount: payments.reduce((sum, p) => sum + (p.discountAmount || 0), 0),
      paymentCount: payments.length,
      lastPaymentDate: payments.length > 0 ? payments[0].paymentDate : null
    };

    return {
      payments: payments,
      summary: summary
    };
  }

  async refundPayment(paymentId, refundAmount, refundReason, companyId, userId) {
    try {
      const payment = await FeePayment.findOne({
        _id: paymentId,
        company: companyId,
        status: 'active'
      });

      if (!payment) throw new Error('Payment not found or already refunded');
      if (refundAmount > payment.amount) throw new Error('Refund amount cannot exceed payment amount');

      payment.status = 'refunded';
      payment.refundedAmount = refundAmount;
      payment.refundDate = new Date();
      payment.refundReason = refundReason;
      await payment.save();

      // Post reverse journal entry (non-fatal)
      try {
        await postFeePaymentRefundJournal({
          companyId,
          studentId: payment.student,
          payment,
          refundAmount,
          refundReason,
          date: new Date(),
        });
      } catch (jErr) {
        console.error('[FeeCollection] Refund journal failed (non-fatal):', jErr.message);
      }

      // Update fee record — recompute from remaining active FeePayments
      if (payment.fee) {
        const fee = await Fee.findById(payment.fee);
        if (fee) {
          const activePmts = await FeePayment.find({ fee: payment.fee, status: 'active' });
          fee.paidAmount    = activePmts.reduce((s, p) => s + p.amount, 0);
          fee.refundAmount  = (fee.refundAmount || 0) + refundAmount;
          // STANDARD FORMULA: balanceDue = totalAmount - paidAmount - writeOffAmount - refundAmount
          fee.balanceDue = Math.max(0, Number((
            fee.totalAmount - fee.paidAmount - (fee.writeOffAmount || 0) - (fee.refundAmount || 0)
          ).toFixed(2)));
          if (fee.balanceDue <= 0.01)   { fee.status = 'paid';    fee.balanceDue = 0; }
          else if (fee.paidAmount > 0)  { fee.status = 'partial'; }
          else                          { fee.status = 'unpaid';  }
          await fee.save();
        }
      }

      // Update voucher
      if (payment.voucher) {
        // Recompute voucher.paidAmount + status from remaining ACTIVE payments
        await forceHealVoucherStatuses(companyId);
      }

      return {
        success: true,
        message: `Refund of PKR ${refundAmount} processed successfully`,
        refundedPayment: payment,
      };

    } catch (error) {
      throw error;
    }
  }

  async getDailyCollectionSummary(companyId, date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const payments = await FeePayment.find({
      company: companyId,
      paymentDate: { $gte: startDate, $lte: endDate },
      status: 'active'
    })
    .populate('student', 'name')
    .populate('receivedBy', 'name');

    const summary = {
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      totalPayments: payments.length,
      paymentMethods: {},
      lateFeeCollected: payments.reduce((sum, p) => sum + (p.lateFeeAmount || 0), 0),
      discountGiven: payments.reduce((sum, p) => sum + (p.discountAmount || 0), 0)
    };

    // Breakdown by payment method
    for (const payment of payments) {
      if (!summary.paymentMethods[payment.paymentMethod]) {
        summary.paymentMethods[payment.paymentMethod] = {
          count: 0,
          amount: 0
        };
      }
      summary.paymentMethods[payment.paymentMethod].count++;
      summary.paymentMethods[payment.paymentMethod].amount += payment.amount;
    }

    return {
      date: date,
      summary: summary,
      payments: payments
    };
  }

  async getMonthlyCollectionSummary(companyId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const payments = await FeePayment.find({
      company: companyId,
      paymentDate: { $gte: startDate, $lte: endDate },
      status: 'active'
    });

    const dailyBreakdown = {};
    const summary = {
      totalAmount: 0,
      totalPayments: 0,
      lateFeeCollected: 0,
      discountGiven: 0
    };

    for (const payment of payments) {
      const day = payment.paymentDate.getDate();
      
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = {
          amount: 0,
          count: 0,
          lateFee: 0,
          discount: 0
        };
      }

      dailyBreakdown[day].amount += payment.amount;
      dailyBreakdown[day].count++;
      dailyBreakdown[day].lateFee += payment.lateFeeAmount || 0;
      dailyBreakdown[day].discount += payment.discountAmount || 0;

      summary.totalAmount += payment.amount;
      summary.totalPayments++;
      summary.lateFeeCollected += payment.lateFeeAmount || 0;
      summary.discountGiven += payment.discountAmount || 0;
    }

    return {
      year: year,
      month: month,
      summary: summary,
      dailyBreakdown: dailyBreakdown
    };
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

  async validatePaymentBeforeCollection(voucherId, amount, companyId) {
    const voucher = await FeeVoucher.findOne({ _id: voucherId, company: companyId });

    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status === 'paid') throw new Error('Voucher is already paid');
    if (voucher.status === 'cancelled') throw new Error('Cannot collect payment for cancelled voucher');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(voucher.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isOverdue = today > dueDate;
    const applicableAmount = isOverdue
      ? (voucher.totalWithLateFee || voucher.totalFee)
      : voucher.totalFee;
    const balanceDue = applicableAmount - (voucher.paidAmount || 0);

    return {
      isValid: Number(amount) <= balanceDue + 0.01,
      balanceDue,
      applicableAmount,
      voucherStatus: voucher.status,
      isOverdue,
    };
  }
}

const feeCollectionService = new FeeCollectionService();
export default feeCollectionService;
