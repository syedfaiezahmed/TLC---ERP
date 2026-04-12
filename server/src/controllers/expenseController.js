import Expense from '../models/Expense.js';
import Company from '../models/Company.js';
import { postExpenseJournal } from '../services/journalService.js';
import { recalculateLedger } from '../services/ledgerService.js';
import { assertPeriodOpen } from '../services/periodLockService.js';
import { logAudit } from '../services/auditService.js';
import mongoose from 'mongoose';
import Ledger from '../models/Ledger.js';

// @desc    Create a new expense
// @route   POST /api/expenses
// @access  Private/Admin
const createExpense = async (req, res) => {
  try {
    const {
      companyId,
      date,
      description,
      amount,
      category,
      categoryCode,
      accountName,
      paymentMethod,
      reference,
      notes,
    } = req.body;

    if (!companyId || !description || !amount || !category) {
      return res.status(400).json({ message: 'Missing required fields: companyId, description, amount, category' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    try { await assertPeriodOpen(companyId, date); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    const expense = new Expense({
      company: companyId,
      date: date || new Date(),
      description,
      amount: Number(amount),
      category,
      categoryCode: categoryCode || '',
      paymentMethod: paymentMethod || 'Cash',
      reference: reference || '',
      notes: notes || '',
    });

    const createdExpense = await expense.save();

    // Audit (non-blocking)
    try { await logAudit({ req, companyId, action: 'create', entityType: 'expense', entityId: createdExpense._id, before: null, after: createdExpense }); } catch (_) {}

    // Post to Ledger — determine account based on payment method
    try {
      await postExpenseJournal({
          companyId,
          expense: createdExpense,
          date: createdExpense.date,
          amount: createdExpense.amount,
          category,
          categoryCode,
          accountName,
          description,
          paymentMethod: createdExpense.paymentMethod,
      });
    } catch (journalErr) {
      console.error('Expense journal posting failed:', journalErr.message);
    }

    // Recalculate ledger (non-critical)
    try { await recalculateLedger(companyId); } catch (_) {}

    return res.status(201).json(createdExpense);
  } catch (error) {
    console.error('createExpense error:', error);
    if (!res.headersSent) {
      return res.status(400).json({ message: error.message || 'Failed to create expense' });
    }
  }
};

// @desc    Get all expenses for a company
// @route   GET /api/expenses/company/:companyId
// @access  Private/Admin
const getExpenses = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate, category, search } = req.query;

    let query = { company: new mongoose.Types.ObjectId(companyId) };

    if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
    }

    if (category && category !== 'all') {
        query.category = category;
    }

    if (search) {
        query.description = { $regex: search, $options: 'i' };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    
    // Summary
    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    res.json({ expenses, totalAmount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private/Admin
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    try { await assertPeriodOpen(expense.company, expense.date); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    const before = expense.toObject ? expense.toObject() : expense;
    await Ledger.deleteMany({ company: expense.company, referenceType: 'expense', referenceId: expense._id });
    await expense.deleteOne();

    try { await logAudit({ req, companyId: expense.company, action: 'delete', entityType: 'expense', entityId: expense._id, before, after: null }); } catch (_) {}

    // Recalculate ledger in background (non-critical)
    Promise.all([
      recalculateLedger(expense.company, null, 'Cash'),
      recalculateLedger(expense.company, null, 'Bank'),
      recalculateLedger(expense.company, null, expense.category),
    ]).catch(() => {});

    return res.json({ message: 'Expense removed' });
  } catch (error) {
    console.error('deleteExpense error:', error.message);
    if (!res.headersSent) {
      return res.status(400).json({ message: error.message });
    }
  }
};

export { createExpense, getExpenses, deleteExpense };
