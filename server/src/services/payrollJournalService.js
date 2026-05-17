import { postJournal } from './journalService.js';

/**
 * Post journal entry for payroll salary expense
 * DR Salary Expense
 * CR Cash/Bank (when paid) OR Salary Payable (when accrued)
 */
export const postPayrollJournal = async ({ companyId, teacherId, payroll, date, isPaid = false, paymentMethod = 'Cash' }) => {
  const description = `Payroll - ${payroll.month.toISOString().substring(0, 7)}`;
  const meta = {
    companyId,
    teacherId,
    date,
    description,
    referenceType: 'payroll',
    referenceId: payroll._id,
  };

  // netSalary is what the company ACTUALLY OWES the teacher after all deductions.
  // Deductions already reduce netSalary in the Payroll model, so the expense
  // recognised on the income statement is netSalary — no separate deduction line needed.
  const netSalary = payroll.netSalary || 0;

  const lines = [];

  // DR Salary Expense = netSalary (the earned obligation)
  lines.push({
    accountName: 'Salary Expense',
    accountType: 'expense',
    debit: netSalary,
    credit: 0,
    relatedAccount: isPaid ? (paymentMethod === 'Cash' ? 'Cash' : 'Bank') : 'Salary Payable',
    type: 'payroll',
    teacher: teacherId,
    description: `${description} - Salary Expense`,
  });

  // Payment or Liability
  if (isPaid) {
    const accountName = paymentMethod === 'Cash' ? 'Cash' : 'Bank';
    lines.push({
      accountName,
      accountType: 'asset',
      debit: 0,
      credit: netSalary,
      relatedAccount: 'Salary Expense',
      type: 'payroll',
      teacher: teacherId,
      description: `${description} - Payment via ${paymentMethod}`,
      // CR = netSalary balances DR Salary Expense = netSalary
    });
  } else {
    lines.push({
      accountName: 'Salary Payable',
      accountType: 'liability',
      debit: 0,
      credit: netSalary,
      relatedAccount: 'Salary Expense',
      type: 'payroll',
      teacher: teacherId,
      description: `${description} - Accrued Salary`,
    });
  }

  return postJournal(meta, lines);
};

/**
 * Post journal entry for payroll payment (when paying previously accrued salary)
 * DR Salary Payable
 * CR Cash/Bank
 */
export const postPayrollPaymentJournal = async ({ companyId, teacherId, payroll, paymentAmount, paymentMethod, date }) => {
  const description = `Payroll Payment - ${payroll.month.toISOString().substring(0, 7)}`;
  const meta = {
    companyId,
    teacherId,
    date,
    description,
    referenceType: 'payroll_payment',
    referenceId: payroll._id,
  };

  const accountName = paymentMethod === 'Cash' ? 'Cash' : 'Bank';

  const lines = [
    {
      accountName: 'Salary Payable',
      accountType: 'liability',
      debit: paymentAmount,
      credit: 0,
      relatedAccount: accountName,
      type: 'payroll_payment',
      teacher: teacherId,
      description: `${description} - Reduce Payable`,
    },
    {
      accountName,
      accountType: 'asset',
      debit: 0,
      credit: paymentAmount,
      relatedAccount: 'Salary Payable',
      type: 'payroll_payment',
      teacher: teacherId,
      description: `${description} - ${paymentMethod}`,
    },
  ];

  return postJournal(meta, lines);
};

/**
 * Post journal entry for voucher payment
 * DR Cash/Bank
 * CR Accounts Receivable
 */
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
