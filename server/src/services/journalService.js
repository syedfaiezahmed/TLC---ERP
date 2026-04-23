import { v4 as uuidv4 } from 'uuid';
import Ledger from '../models/Ledger.js';

/**
 * Post a balanced journal to the Ledger collection.
 * Validates that total debit equals total credit.
 * Adds journalId and reference metadata to each line.
 *
 * @param {Object} meta - { companyId, date, description, referenceType, referenceId, studentId, teacherId, feeId }
 * @param {Array} lines - Array of { accountName, accountType, debit, credit, relatedAccount, student, teacher, fee }
 * @returns {Promise<Array>} - Created ledger documents
 */
export const postJournal = async (meta, lines) => {
  const journalId = uuidv4();
  const date = meta.date || new Date();
  const companyId = meta.companyId;
  const referenceType = meta.referenceType;
  const referenceId = meta.referenceId;
  const reference = meta.reference || '';

  let totalDebit = 0;
  let totalCredit = 0;

  const docs = lines.map((l) => {
    const debit = Number(l.debit || 0);
    const credit = Number(l.credit || 0);
    totalDebit += debit;
    totalCredit += credit;
    return {
      company: companyId,
      student: l.student || meta.studentId || undefined,
      teacher: l.teacher || meta.teacherId || undefined,
      fee: l.fee || meta.feeId || undefined,
      referenceType,
      referenceId,
      reference: l.reference || reference,
      journalId,
      date,
      description: l.description || meta.description || 'Manual Journal Entry',
      debit,
      credit,
      type: l.type || referenceType || 'adjustment',
      accountName: l.accountName,
      accountType: l.accountType,
      relatedAccount: l.relatedAccount || undefined,
      balance: 0,
    };
  });

  if (Number(totalDebit.toFixed(2)) !== Number(totalCredit.toFixed(2))) {
    if (Math.abs(totalDebit - totalCredit) < 0.01) {
        const diff = totalDebit - totalCredit;
        const lastDoc = docs[docs.length - 1];
        if (diff > 0) {
            lastDoc.credit += diff;
        } else {
            lastDoc.debit += Math.abs(diff);
        }
    } else {
        console.error(`Unbalanced journal: debit ${totalDebit.toFixed(4)} != credit ${totalCredit.toFixed(4)}`, docs);
        throw new Error(`Unbalanced journal: debit ${totalDebit.toFixed(2)} != credit ${totalCredit.toFixed(2)}`);
    }
  }

  const created = await Ledger.insertMany(docs);
  return created;
};

/**
 * Helpers for common transactions
 */
export const postFeeJournal = async ({ companyId, studentId, fee, date, totalAmount, subTotal, taxAmount, cogs = 0 }) => {
  const description = `Fee Receipt #${fee.feeNumber}`;
  const meta = {
    companyId,
    studentId: studentId,
    feeId: fee._id,
    date,
    description,
    referenceType: 'fee',
    referenceId: fee._id,
  };

  const lines = [
    {
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      debit: totalAmount,
      credit: 0,
      relatedAccount: 'Fee Revenue',
      type: 'fee',
      student: studentId,
      fee: fee._id,
      description: `${description} - Receivable`,
    },
    {
      accountName: 'Fee Revenue',
      accountType: 'revenue',
      debit: 0,
      credit: subTotal,
      relatedAccount: 'Accounts Receivable',
      type: 'fee',
      fee: fee._id,
      description: `${description} - Revenue`,
    },
  ];

  if (taxAmount > 0) {
      lines.push({
          accountName: 'Tax Payable',
          accountType: 'liability',
          debit: 0,
          credit: taxAmount,
          relatedAccount: 'Accounts Receivable',
          type: 'fee',
          fee: fee._id,
          description: `${description} - Tax`,
      });
  }

  return postJournal(meta, lines);
};

/**
 * Cash-basis fee refund journal.
 * DR: Fee Revenue (reversal of income)
 * CR: Cash / Bank (cash refunded to student)
 * + DR: Tax Payable (if tax was collected)
 */
export const postFeeRefundJournal = async ({ companyId, studentId, feeId, refund, date, subTotal, taxAmount, totalAmount, refundMethod = 'Cash' }) => {
  const cashAccount = (refundMethod && refundMethod !== 'Cash') ? 'Bank' : 'Cash';
  const meta = {
    companyId,
    studentId,
    feeId,
    date,
    description: `Fee Refund #${refund.refundNumber}`,
    referenceType: 'fee_refund',
    referenceId: refund._id,
  };

  const lines = [
    {
      accountName: 'Fee Revenue',
      accountType: 'revenue',
      debit: subTotal,
      credit: 0,
      relatedAccount: cashAccount,
      type: 'fee_refund',
      fee: feeId,
      student: studentId,
      description: `Fee Refund #${refund.refundNumber} - Revenue reversal`,
    },
    ...(taxAmount > 0
      ? [
          {
            accountName: 'Tax Payable',
            accountType: 'liability',
            debit: taxAmount,
            credit: 0,
            relatedAccount: cashAccount,
            type: 'fee_refund',
            fee: feeId,
            student: studentId,
            description: `Fee Refund #${refund.refundNumber} - Tax reversal`,
          },
        ]
      : []),
    {
      accountName: cashAccount,
      accountType: 'asset',
      debit: 0,
      credit: totalAmount,
      relatedAccount: 'Fee Revenue',
      type: 'fee_refund',
      fee: feeId,
      student: studentId,
      description: `Fee Refund #${refund.refundNumber} - Cash/Bank refunded`,
    },
  ];

  return postJournal(meta, lines);
};

export const postPurchaseReturnJournal = async ({ companyId, teacherId, purchaseId, purchaseReturn, date, subTotal, taxAmount, totalAmount }) => {
  const meta = {
    companyId,
    teacherId: teacherId,
    date,
    description: `Purchase Return #${purchaseReturn.returnNumber}`,
    referenceType: 'purchase_return',
    referenceId: purchaseReturn._id,
  };

  const lines = [
    {
      accountName: 'Accounts Payable',
      accountType: 'liability',
      debit: totalAmount,
      credit: 0,
      relatedAccount: 'Institute Assets/Expenses',
      type: 'purchase_return',
      teacher: teacherId,
      description: `Purchase Return #${purchaseReturn.returnNumber} - Reduce payable`,
    },
    {
      accountName: 'Institute Assets/Expenses',
      accountType: 'asset',
      debit: 0,
      credit: subTotal,
      relatedAccount: 'Accounts Payable',
      type: 'purchase_return',
      teacher: teacherId,
      description: `Purchase Return #${purchaseReturn.returnNumber} - Reversal`,
    },
    ...(taxAmount > 0
      ? [
          {
            accountName: 'Input Tax',
            accountType: 'asset',
            debit: 0,
            credit: taxAmount,
            relatedAccount: 'Accounts Payable',
            type: 'tax',
            teacher: teacherId,
            description: `Purchase Return #${purchaseReturn.returnNumber} - Tax reversal`,
          },
        ]
      : []),
  ];

  return postJournal(meta, lines);
};

export const postGenericStudentPaymentJournal = async ({ companyId, studentId, date, amount, discount = 0, method, reference, description }) => {
  const meta = {
    companyId,
    studentId: studentId,
    date: date || new Date(),
    description: description || `Student Receipt - ${method || 'Cash'} ${reference || ''}`,
    referenceType: 'payment',
    referenceId: studentId,
    reference: reference || '',
  };

  const payAmount = Number(amount);
  const discAmount = Number(discount || 0);

  const lines = [
    {
      accountName: 'Cash',
      accountType: 'asset',
      debit: payAmount,
      credit: 0,
      relatedAccount: 'Accounts Receivable',
      type: 'payment',
      student: studentId,
      description: `Cash Received from Student ${reference || ''}`,
    },
    ...(discAmount > 0
      ? [
          {
            accountName: 'Scholarship/Discount',
            accountType: 'expense',
            debit: discAmount,
            credit: 0,
            relatedAccount: 'Accounts Receivable',
            type: 'payment',
            student: studentId,
            description: `Scholarship/Discount on Payment ${reference || ''}`,
          },
        ]
      : []),
    {
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      debit: 0,
      credit: payAmount + discAmount,
      relatedAccount: 'Cash',
      type: 'payment',
      student: studentId,
      description: meta.description,
    },
  ];

  return postJournal(meta, lines);
};

export const postPurchaseJournal = async ({ companyId, purchase, teacher, items, taxAmount, totalAmount }) => {
  const meta = {
    companyId,
    date: purchase.date,
    description: `Purchase #${purchase.purchaseNumber}`,
    referenceType: 'purchase',
    referenceId: purchase._id,
    teacherId: teacher._id,
  };

  const lines = [];

  lines.push({
    accountName: 'Institute Assets/Expenses',
    accountType: 'asset',
    debit: purchase.subTotal,
    credit: 0,
    relatedAccount: 'Accounts Payable',
    type: 'purchase',
    description: `Purchase from ${teacher.name}`,
  });

  if (taxAmount > 0) {
    lines.push({
      accountName: 'Input Tax',
      accountType: 'asset',
      debit: taxAmount,
      credit: 0,
      relatedAccount: 'Accounts Payable',
      type: 'tax',
      description: `Input Tax on Purchase #${purchase.purchaseNumber}`,
    });
  }

  lines.push({
    accountName: 'Accounts Payable',
    accountType: 'liability',
    debit: 0,
    credit: totalAmount,
    relatedAccount: 'Institute Assets/Expenses',
    type: 'purchase',
    description: `Payable to ${teacher.name}`,
  });

  return postJournal(meta, lines);
};

export const postTeacherPaymentJournal = async ({ companyId, purchase, teacher, amount, discount = 0, method, reference, date }) => {
  const paymentAmount = Number(amount || 0);
  const discountAmount = Number(discount || 0);
  const totalSettlement = paymentAmount + discountAmount;
  const cashAccount = (method && method !== 'Cash') ? 'Bank' : 'Cash';
  const meta = {
    companyId,
    date: date ? new Date(date) : new Date(),
    description: `Payment to ${teacher.name} for Purchase #${purchase.purchaseNumber}`,
    referenceType: 'teacher_payment',
    referenceId: purchase._id,
    teacherId: teacher._id,
    reference: reference || '',
  };

  const lines = [
    {
      accountName: 'Accounts Payable',
      accountType: 'liability',
      debit: totalSettlement,
      credit: 0,
      relatedAccount: cashAccount,
      type: 'teacher_payment',
      description: `Payment via ${method || 'Cash'} ${reference || ''}`,
    },
    {
      accountName: cashAccount,
      accountType: 'asset',
      debit: 0,
      credit: paymentAmount,
      relatedAccount: 'Accounts Payable',
      type: 'teacher_payment',
      description: `Payment to ${teacher.name} via ${method || 'Cash'}`,
    },
  ];

  if (discountAmount > 0) {
    lines.push({
      accountName: 'Discount Received',
      accountType: 'revenue',
      debit: 0,
      credit: discountAmount,
      relatedAccount: 'Accounts Payable',
      type: 'teacher_payment',
      description: `Discount to ${teacher.name} on Purchase #${purchase.purchaseNumber}`,
    });
  }

  return postJournal(meta, lines);
};

/**
 * General Purchase Journal — handles expense and asset purchases.
 *
 * Expense Purchase:
 *   DR Expense Account (Operating Expenses / custom)
 *   DR Input Tax (if taxAmount > 0)
 *   CR Cash / Bank (if Cash or Bank)  OR  CR Accounts Payable (if Credit)
 *
 * Asset Purchase:
 *   DR Asset Account (Equipment / Furniture / custom)
 *   CR Cash / Bank (if Cash or Bank)  OR  CR Accounts Payable (if Credit)
 */
export const postGeneralPurchaseJournal = async ({
  companyId, purchase, category, expenseAccountName, assetAccountName,
  paymentMethod, totalAmount, taxAmount, subTotal, discountAmount = 0, supplier, description: desc,
}) => {
  const isCredit = paymentMethod === 'Credit';
  const cashAccount = paymentMethod === 'Bank' ? 'Bank' : 'Cash';
  const creditAccount = isCredit ? 'Accounts Payable' : cashAccount;
  const creditAccountType = isCredit ? 'liability' : 'asset';

  const meta = {
    companyId,
    date: purchase.date,
    description: `Purchase #${purchase.purchaseNumber}${supplier ? ' - ' + supplier : ''}`,
    referenceType: 'purchase',
    referenceId: purchase._id,
  };

  const lines = [];

  if (category === 'expense') {
    const debitAcc = expenseAccountName || 'Operating Expenses';
    lines.push({
      accountName: debitAcc,
      accountType: 'expense',
      debit: Number((subTotal).toFixed(2)),
      credit: 0,
      relatedAccount: creditAccount,
      type: 'purchase',
      description: desc || `Expense purchase #${purchase.purchaseNumber}`,
    });
    if (taxAmount > 0) {
      lines.push({
        accountName: 'Input Tax',
        accountType: 'asset',
        debit: Number(taxAmount.toFixed(2)),
        credit: 0,
        relatedAccount: creditAccount,
        type: 'tax',
        description: `Input Tax on Purchase #${purchase.purchaseNumber}`,
      });
    }
  } else {
    // asset
    const debitAcc = assetAccountName || 'Equipment';
    lines.push({
      accountName: debitAcc,
      accountType: 'asset',
      debit: Number(totalAmount.toFixed(2)),
      credit: 0,
      relatedAccount: creditAccount,
      type: 'purchase',
      description: desc || `Asset purchase #${purchase.purchaseNumber}`,
    });
  }

  lines.push({
    accountName: creditAccount,
    accountType: creditAccountType,
    debit: 0,
    credit: Number(totalAmount.toFixed(2)),
    relatedAccount: lines[0].accountName,
    type: 'purchase',
    description: `Purchase settlement #${purchase.purchaseNumber}`,
  });

  // Balance the journal when a trade/cash discount reduces totalAmount below subTotal
  const disc = Number((discountAmount || 0).toFixed(2));
  if (disc > 0) {
    lines.push({
      accountName: 'Discount Received',
      accountType: 'revenue',
      debit: 0,
      credit: disc,
      relatedAccount: lines[0].accountName,
      type: 'purchase',
      description: `Trade discount on Purchase #${purchase.purchaseNumber}`,
    });
  }

  return postJournal(meta, lines);
};

/**
 * Payment against a general (expense/asset) purchase on Credit.
 *   DR Accounts Payable
 *   CR Cash / Bank
 *   + optional: DR Accounts Payable / CR Discount Received (if discount)
 */
export const postGeneralPaymentJournal = async ({
  companyId, purchase, amount, discount = 0, method, reference, date, supplier,
}) => {
  const paymentAmount = Number(amount || 0);
  const discountAmount = Number(discount || 0);
  const totalSettlement = paymentAmount + discountAmount;
  const cashAccount = (method && method !== 'Cash') ? 'Bank' : 'Cash';
  const label = supplier || `Purchase #${purchase.purchaseNumber}`;

  const meta = {
    companyId,
    date: date ? new Date(date) : new Date(),
    description: `Payment for ${label}`,
    referenceType: 'purchase_payment',
    referenceId: purchase._id,
    reference: reference || '',
  };

  const lines = [
    {
      accountName: 'Accounts Payable',
      accountType: 'liability',
      debit: totalSettlement,
      credit: 0,
      relatedAccount: cashAccount,
      type: 'purchase_payment',
      description: `Payable settled for ${label}`,
    },
    {
      accountName: cashAccount,
      accountType: 'asset',
      debit: 0,
      credit: paymentAmount,
      relatedAccount: 'Accounts Payable',
      type: 'purchase_payment',
      description: `Cash out for ${label}`,
    },
  ];

  if (discountAmount > 0) {
    lines.push({
      accountName: 'Discount Received',
      accountType: 'revenue',
      debit: 0,
      credit: discountAmount,
      relatedAccount: 'Accounts Payable',
      type: 'purchase_payment',
      description: `Discount on ${label}`,
    });
  }

  return postJournal(meta, lines);
};

export const postExpenseJournal = async ({ companyId, expense, date, amount, category, categoryCode, accountName, description, paymentMethod }) => {
  if (!amount || amount <= 0) return null;
  const cashAccount = (paymentMethod && paymentMethod !== 'Cash') ? 'Bank' : 'Cash';
  // Use explicit accountName if provided (COA-mapped), else fall back to category string, else 'Operating Expenses'
  const expenseAccount = accountName || category || 'Operating Expenses';
  const meta = {
    companyId,
    date: date || new Date(),
    description: description || `Expense: ${category}`,
    referenceType: 'expense',
    referenceId: expense._id,
  };

  const lines = [
    {
      accountName: expenseAccount,
      accountType: 'expense',
      debit: Number(amount),
      credit: 0,
      relatedAccount: cashAccount,
      type: 'expense',
      description: `Expense: ${description || category}`,
    },
    {
      accountName: cashAccount,
      accountType: 'asset',
      debit: 0,
      credit: Number(amount),
      relatedAccount: expenseAccount,
      type: 'expense',
      description: `Payment for ${description || category}`,
    },
  ];

  return postJournal(meta, lines);
};

/**
 * Cash-basis journal for fee collection via FeeManagement voucher system.
 * DR: Cash / Bank (asset)
 * CR: Fee Revenue (revenue)
 */
export const postFeeCollectionJournal = async ({ companyId, studentId, voucher, payment, paymentAmount, paymentMethod, lateFeeAmount = 0, discountAmount = 0, date }) => {
  const description = `Fee Collected - Voucher #${voucher.voucherNumber}`;
  const cashAccount = (paymentMethod && paymentMethod !== 'Cash') ? 'Bank' : 'Cash';
  // Total fee revenue = cash received + discount given + late fee
  const discount = Number(discountAmount || 0);
  const lateFee = Number(lateFeeAmount || 0);
  const baseFeeRevenue = paymentAmount - lateFee;  // portion of cash that is base fee
  const totalFeeRevenue = baseFeeRevenue + discount; // gross base fee before discount

  const meta = {
    companyId,
    studentId,
    date,
    description,
    referenceType: 'fee_payment',
    referenceId: payment._id,
  };

  const lines = [
    {
      accountName: cashAccount,
      accountType: 'asset',
      debit: paymentAmount,
      credit: 0,
      relatedAccount: 'Fee Revenue',
      type: 'fee_payment',
      student: studentId,
      description: `${description} - ${paymentMethod}`,
    },
    {
      accountName: 'Fee Revenue',
      accountType: 'revenue',
      debit: 0,
      credit: totalFeeRevenue > 0 ? totalFeeRevenue : (paymentAmount - lateFee),
      relatedAccount: cashAccount,
      type: 'fee_payment',
      student: studentId,
      description: `${description} - Income`,
    },
  ];

  if (discount > 0) {
    lines.push({
      accountName: 'Scholarship/Discount',
      accountType: 'expense',
      debit: discount,
      credit: 0,
      relatedAccount: 'Fee Revenue',
      type: 'fee_payment',
      student: studentId,
      description: `${description} - Discount/Scholarship`,
    });
  }

  if (lateFee > 0 && baseFeeRevenue > 0) {
    lines.push({
      accountName: 'Late Fee Revenue',
      accountType: 'revenue',
      debit: 0,
      credit: lateFee,
      relatedAccount: cashAccount,
      type: 'fee_payment',
      student: studentId,
      description: `${description} - Late Fee`,
    });
  }

  return postJournal(meta, lines);
};

/**
 * Reverse journal when a FeePayment is refunded.
 * DR: Fee Revenue (revenue) — reverses income
 * CR: Cash / Bank (asset) — cash goes back
 */
export const postFeePaymentRefundJournal = async ({ companyId, studentId, payment, refundAmount, refundReason, date }) => {
  const description = `Fee Refund - Payment #${payment.paymentNumber}`;
  const cashAccount = (payment.paymentMethod && payment.paymentMethod !== 'Cash') ? 'Bank' : 'Cash';

  const meta = {
    companyId,
    studentId,
    date: date || new Date(),
    description,
    referenceType: 'fee_refund',
    referenceId: payment._id,
  };

  const lines = [
    {
      accountName: 'Fee Revenue',
      accountType: 'revenue',
      debit: refundAmount,
      credit: 0,
      relatedAccount: cashAccount,
      type: 'fee_refund',
      student: studentId,
      description: `${description} - Revenue reversal (${refundReason})`,
    },
    {
      accountName: cashAccount,
      accountType: 'asset',
      debit: 0,
      credit: refundAmount,
      relatedAccount: 'Fee Revenue',
      type: 'fee_refund',
      student: studentId,
      description: `${description} - Cash refunded`,
    },
  ];

  return postJournal(meta, lines);
};

export const postVoucherPaymentJournal = async ({ companyId, studentId, voucher, paymentAmount, paymentMethod, date }) => {
  const description = `Voucher Payment #${voucher.voucherNumber}`;
  const meta = {
    companyId,
    studentId,
    date,
    description,
    referenceType: 'voucher_payment',
    referenceId: voucher._id,
  };

  const accountName = paymentMethod === 'Cash' ? 'Cash' : 'Bank';

  const lines = [
    {
      accountName,
      accountType: 'asset',
      debit: paymentAmount,
      credit: 0,
      relatedAccount: 'Accounts Receivable',
      type: 'voucher_payment',
      student: studentId,
      description: `${description} - ${paymentMethod}`,
    },
    {
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      debit: 0,
      credit: paymentAmount,
      relatedAccount: accountName,
      type: 'voucher_payment',
      student: studentId,
      description: `${description} - Receivable Reduction`,
    },
  ];

  return postJournal(meta, lines);
};

/**
 * Accrual-basis settlement journal for fee payments.
 *
 * CA RULES (double-entry must always balance):
 *   Dr Cash/Bank             = totalCashReceived  (base fee + late fee)
 *   Dr Scholarship/Discount  = discountAmount     (if any)
 *   Cr Accounts Receivable   = baseFee + discount (clears EXACTLY what was accrued)
 *   Cr Late Fee Revenue      = lateFeeAmount      (new income — was never accrued)
 *
 * Balance check: Dr = cash + disc = Cr = (base + disc) + lateFee = cash - lateFee + disc + lateFee = cash + disc ✅
 */
export const postFeePaymentJournal = async ({ companyId, studentId, fee, date, amount, discount = 0, lateFeeAmount = 0, reference, paymentMethod = 'Cash' }) => {
  const description = `Payment for Fee Receipt #${fee.feeNumber}`;
  const cashAccount = (paymentMethod && paymentMethod !== 'Cash') ? 'Bank' : 'Cash';
  const meta = {
    companyId,
    studentId: studentId,
    feeId: fee._id,
    date,
    description,
    referenceType: 'payment',
    referenceId: fee._id,
    reference: reference || '',
  };

  const totalCash  = Number(amount);              // full cash received (may include late fee)
  const discAmount = Number(discount || 0);
  const lateFee    = Number(lateFeeAmount || 0);
  const baseFee    = totalCash - lateFee;         // portion that settles the AR accrual

  const lines = [
    {
      accountName: cashAccount,
      accountType: 'asset',
      debit: totalCash,
      credit: 0,
      relatedAccount: 'Accounts Receivable',
      type: 'payment',
      student: studentId,
      fee: fee._id,
      description: `${cashAccount} received for Fee Receipt #${fee.feeNumber}`,
    },
    ...(discAmount > 0
      ? [
          {
            accountName: 'Scholarship/Discount',
            accountType: 'expense',
            debit: discAmount,
            credit: 0,
            relatedAccount: 'Accounts Receivable',
            type: 'payment',
            student: studentId,
            fee: fee._id,
            description: `Scholarship/Discount on Fee Receipt #${fee.feeNumber}`,
          },
        ]
      : []),
    {
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      debit: 0,
      credit: baseFee + discAmount,  // clears EXACTLY what was accrued (base fee net of discount)
      relatedAccount: cashAccount,
      type: 'payment',
      student: studentId,
      fee: fee._id,
      description,
    },
    ...(lateFee > 0
      ? [
          {
            accountName: 'Late Fee Revenue',
            accountType: 'revenue',
            debit: 0,
            credit: lateFee,
            relatedAccount: cashAccount,
            type: 'payment',
            student: studentId,
            fee: fee._id,
            description: `Late Fee — Fee Receipt #${fee.feeNumber}`,
          },
        ]
      : []),
  ];

  return postJournal(meta, lines);
};

/**
 * Bad Debt Write-off:
 * DR: Bad Debt Expense (expense)
 * CR: Accounts Receivable (asset)
 */
export const postBadDebtJournal = async ({ companyId, studentId, feeId, voucherId, writtenOffAmount, reason, date }) => {
  const description = `Bad Debt Write-off — ${reason}`;
  const meta = {
    companyId,
    studentId,
    feeId: feeId || undefined,
    date: date || new Date(),
    description,
    referenceType: 'bad_debt',
    referenceId: feeId || voucherId,
  };
  const lines = [
    {
      accountName: 'Bad Debt Expense',
      accountType: 'expense',
      debit: writtenOffAmount,
      credit: 0,
      relatedAccount: 'Accounts Receivable',
      type: 'bad_debt',
      student: studentId,
      fee: feeId || undefined,
      description,
    },
    {
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      debit: 0,
      credit: writtenOffAmount,
      relatedAccount: 'Bad Debt Expense',
      type: 'bad_debt',
      student: studentId,
      fee: feeId || undefined,
      description,
    },
  ];
  return postJournal(meta, lines);
};

/**
 * Bad Debt Recovery:
 * DR: Cash (asset)
 * CR: Bad Debt Recovery Income (revenue)
 */
export const postBadDebtRecoveryJournal = async ({ companyId, studentId, feeId, recoveryAmount, notes, date }) => {
  const description = `Bad Debt Recovery — ${notes}`;
  const meta = {
    companyId,
    studentId,
    feeId: feeId || undefined,
    date: date || new Date(),
    description,
    referenceType: 'bad_debt_recovery',
    referenceId: feeId,
  };
  const lines = [
    {
      accountName: 'Cash',
      accountType: 'asset',
      debit: recoveryAmount,
      credit: 0,
      relatedAccount: 'Bad Debt Recovery Income',
      type: 'bad_debt_recovery',
      student: studentId,
      fee: feeId || undefined,
      description,
    },
    {
      accountName: 'Bad Debt Recovery Income',
      accountType: 'revenue',
      debit: 0,
      credit: recoveryAmount,
      relatedAccount: 'Cash',
      type: 'bad_debt_recovery',
      student: studentId,
      fee: feeId || undefined,
      description,
    },
  ];
  return postJournal(meta, lines);
};
