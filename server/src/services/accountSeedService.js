import Account from '../models/Account.js';

export const ensureDefaultAccounts = async (companyId) => {
  if (!companyId) return;

  const existing = await Account.countDocuments({ company: companyId });
  if (existing > 0) return;

  const defaults = [
    // --- ASSETS (11000 - 19999) ---
    { code: '11001', name: 'Cash', type: 'asset', isSystem: true },
    { code: '11002', name: 'Bank', type: 'asset', isSystem: true },
    { code: '11003', name: 'Accounts Receivable', type: 'asset', isSystem: true },
    { code: '11004', name: 'Inventory Asset', type: 'asset', isSystem: true },
    { code: '11005', name: 'Input Tax', type: 'asset', isSystem: true },
    { code: '11006', name: 'Prepaid Expenses', type: 'asset', isSystem: true },
    { code: '11007', name: 'Institute Assets/Expenses', type: 'asset', isSystem: true },
    { code: '11101', name: 'Equipment', type: 'asset', isSystem: true },
    { code: '11102', name: 'Furniture', type: 'asset', isSystem: true },
    { code: '11103', name: 'Vehicles', type: 'asset', isSystem: true },
    { code: '11104', name: 'Computer Equipment', type: 'asset', isSystem: true },
    { code: '11901', name: 'Accumulated Depreciation', type: 'asset', isSystem: true },

    // --- LIABILITIES (21000 - 29999) ---
    { code: '21001', name: 'Accounts Payable', type: 'liability', isSystem: true },
    { code: '21002', name: 'Sales Tax Payable', type: 'liability', isSystem: true },
    { code: '21003', name: 'Tax Payable', type: 'liability', isSystem: true },
    { code: '21004', name: 'Accrued Expenses', type: 'liability', isSystem: true },
    { code: '21005', name: 'Short-term Loans', type: 'liability', isSystem: true },
    { code: '21006', name: 'Salary Payable', type: 'liability', isSystem: true },
    { code: '21101', name: 'Long-term Liabilities', type: 'liability', isSystem: true },

    // --- EQUITY (31000 - 39999) ---
    { code: '31001', name: 'Owner Capital', type: 'equity', isSystem: true },
    { code: '31002', name: 'Owner Drawings', type: 'equity', isSystem: true },
    { code: '31003', name: 'Retained Earnings', type: 'equity', isSystem: true },
    { code: '31004', name: 'Opening Balance Equity', type: 'equity', isSystem: true },

    // --- REVENUE (41000 - 49999) ---
    { code: '41001', name: 'Fee Revenue', type: 'revenue', isSystem: true },
    { code: '41002', name: 'Late Fee Revenue', type: 'revenue', isSystem: true },
    { code: '41003', name: 'Bad Debt Recovery Income', type: 'revenue', isSystem: true },
    { code: '41004', name: 'Discount Received', type: 'revenue', isSystem: true },
    { code: '41005', name: 'Sales Revenue', type: 'revenue', isSystem: true },
    { code: '41006', name: 'Service Revenue', type: 'revenue', isSystem: true },
    { code: '41007', name: 'Other Income', type: 'revenue', isSystem: true },

    // --- EXPENSES (51000 - 59999) ---
    { code: '51001', name: 'Bad Debt Expense', type: 'expense', isSystem: true },
    { code: '51002', name: 'Scholarship/Discount', type: 'expense', isSystem: true },
    { code: '51003', name: 'Cost of Goods Sold', type: 'expense', isSystem: true },
    { code: '51004', name: 'Operating Expenses', type: 'expense', isSystem: true },
    { code: '51005', name: 'Discount Allowed', type: 'expense', isSystem: true },
    { code: '51006', name: 'Salary Expense', type: 'expense', isSystem: true },
    { code: '51007', name: 'Rent Expense', type: 'expense', isSystem: true },
    { code: '51008', name: 'Utility Expense', type: 'expense', isSystem: true },
    { code: '51009', name: 'Marketing Expense', type: 'expense', isSystem: true },
    { code: '51010', name: 'Financial Expense', type: 'expense', isSystem: true },
    { code: '51011', name: 'Purchase Return', type: 'expense', isSystem: true },
    { code: '51012', name: 'Depreciation Expense', type: 'expense', isSystem: true },
  ];

  await Account.insertMany(defaults.map((d) => ({ ...d, company: companyId })));
};

/**
 * Ensures all system accounts exist for a company — safe to call on existing companies.
 * Only inserts accounts that are missing (by name).
 */
export const ensureMissingAccounts = async (companyId) => {
  if (!companyId) return;

  const systemAccounts = [
    { code: '11001', name: 'Cash', type: 'asset' },
    { code: '11002', name: 'Bank', type: 'asset' },
    { code: '11003', name: 'Accounts Receivable', type: 'asset' },
    { code: '11004', name: 'Inventory Asset', type: 'asset' },
    { code: '11005', name: 'Input Tax', type: 'asset' },
    { code: '11006', name: 'Prepaid Expenses', type: 'asset' },
    { code: '11007', name: 'Institute Assets/Expenses', type: 'asset' },
    { code: '11101', name: 'Equipment', type: 'asset' },
    { code: '11102', name: 'Furniture', type: 'asset' },
    { code: '11103', name: 'Vehicles', type: 'asset' },
    { code: '11104', name: 'Computer Equipment', type: 'asset' },
    { code: '11901', name: 'Accumulated Depreciation', type: 'asset' },
    { code: '21001', name: 'Accounts Payable', type: 'liability' },
    { code: '21002', name: 'Sales Tax Payable', type: 'liability' },
    { code: '21003', name: 'Tax Payable', type: 'liability' },
    { code: '21004', name: 'Accrued Expenses', type: 'liability' },
    { code: '21005', name: 'Short-term Loans', type: 'liability' },
    { code: '21006', name: 'Salary Payable', type: 'liability' },
    { code: '21101', name: 'Long-term Liabilities', type: 'liability' },
    { code: '31001', name: 'Owner Capital', type: 'equity' },
    { code: '31002', name: 'Owner Drawings', type: 'equity' },
    { code: '31003', name: 'Retained Earnings', type: 'equity' },
    { code: '31004', name: 'Opening Balance Equity', type: 'equity' },
    { code: '41001', name: 'Fee Revenue', type: 'revenue' },
    { code: '41002', name: 'Late Fee Revenue', type: 'revenue' },
    { code: '41003', name: 'Bad Debt Recovery Income', type: 'revenue' },
    { code: '41004', name: 'Discount Received', type: 'revenue' },
    { code: '41005', name: 'Sales Revenue', type: 'revenue' },
    { code: '41006', name: 'Service Revenue', type: 'revenue' },
    { code: '41007', name: 'Other Income', type: 'revenue' },
    { code: '51001', name: 'Bad Debt Expense', type: 'expense' },
    { code: '51002', name: 'Scholarship/Discount', type: 'expense' },
    { code: '51003', name: 'Cost of Goods Sold', type: 'expense' },
    { code: '51004', name: 'Operating Expenses', type: 'expense' },
    { code: '51005', name: 'Discount Allowed', type: 'expense' },
    { code: '51006', name: 'Salary Expense', type: 'expense' },
    { code: '51007', name: 'Rent Expense', type: 'expense' },
    { code: '51008', name: 'Utility Expense', type: 'expense' },
    { code: '51009', name: 'Marketing Expense', type: 'expense' },
    { code: '51010', name: 'Financial Expense', type: 'expense' },
    { code: '51011', name: 'Purchase Return', type: 'expense' },
    { code: '51012', name: 'Depreciation Expense', type: 'expense' },
  ];

  const existing = await Account.find({ company: companyId }).select('name').lean();
  const existingNames = new Set(existing.map((a) => a.name));

  const toInsert = systemAccounts
    .filter((a) => !existingNames.has(a.name))
    .map((a) => ({ ...a, company: companyId, isSystem: true, isActive: true }));

  if (toInsert.length > 0) {
    await Account.insertMany(toInsert, { ordered: false });
  }
};
