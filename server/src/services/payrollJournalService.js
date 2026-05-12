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

  const netSalary  = payroll.netSalary  || 0;
  const deductions = payroll.deductions || 0;
  const allowances = payroll.allowances || 0;
  // Gross cost to the company = net owed to teacher + deductions withheld
  // = totalSalary + allowances (allowances increase what we owe, deductions reduce it)
  const grossCost = netSalary + deductions;

  const lines = [];

  // Salary Expense = gross cost (base + allowances, before deductions)
  lines.push({
    accountName: 'Salary Expense',
    accountType: 'expense',
    debit: grossCost,
    credit: 0,
    relatedAccount: isPaid ? (paymentMethod === 'Cash' ? 'Cash' : 'Bank') : 'Salary Payable',
    type: 'payroll',
    teacher: teacherId,
    description: `${description} - Salary Expense`,
  });

  // Deductions (if any)
  if (deductions > 0) {
    lines.push({
      accountName: 'Salary Payable',
      accountType: 'liability',
      debit: 0,
      credit: deductions,
      relatedAccount: 'Salary Expense',
      type: 'payroll',
      teacher: teacherId,
      description: `${description} - Deductions`,
    });
  }

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
