import ExpenseCategory from '../models/ExpenseCategory.js';
import Expense from '../models/Expense.js';
import { logAudit } from '../services/auditService.js';

// @desc    Create a new expense category
// @route   POST /api/expense-categories
// @access  Private/Admin
const createCategory = async (req, res) => {
  try {
    const { companyId, name, code, description } = req.body;

    if (!companyId || !name || !name.trim()) {
      return res.status(400).json({ message: 'Company ID and category name are required.' });
    }

    const catCode = (code && code.trim()) ? code.trim() : `EXP-${Date.now().toString(36).toUpperCase()}`;

    // Check if code or name exists for this company
    const existing = await ExpenseCategory.findOne({
      company: companyId,
      $or: [{ code: catCode }, { name: name.trim() }]
    });

    if (existing) {
      return res.status(400).json({ message: 'Category with this name or code already exists.' });
    }

    const category = new ExpenseCategory({
      company: companyId,
      name: name.trim(),
      code: catCode,
      description: description || '',
    });

    const createdCategory = await category.save();

    try { await logAudit({ req, companyId, action: 'create', entityType: 'expense_category', entityId: createdCategory._id, before: null, after: createdCategory }); } catch (_) {}

    return res.status(201).json(createdCategory);
  } catch (error) {
    console.error('createCategory error:', error.message);
    if (!res.headersSent) {
      return res.status(400).json({ message: error.message || 'Failed to create category' });
    }
  }
};

// @desc    Get all categories for a company
// @route   GET /api/expense-categories/company/:companyId
// @access  Private/Admin
const getCategories = async (req, res) => {
  try {
    const categories = await ExpenseCategory.find({ company: req.params.companyId }).sort({ code: 1 });
    return res.json(categories);
  } catch (error) {
    console.error('getCategories error:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message });
    }
  }
};

// @desc    Delete an expense category
// @route   DELETE /api/expense-categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
  try {
    const category = await ExpenseCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    // Check if any expenses are using this category
    const expenseCount = await Expense.countDocuments({
      company: category.company,
      category: category.name
    });

    if (expenseCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category — it is being used by existing expenses.' });
    }

    const before = category.toObject ? category.toObject() : category;
    await category.deleteOne();

    try { await logAudit({ req, companyId: category.company, action: 'delete', entityType: 'expense_category', entityId: category._id, before, after: null }); } catch (_) {}

    return res.json({ message: 'Category removed successfully.' });
  } catch (error) {
    console.error('deleteCategory error:', error.message);
    if (!res.headersSent) {
      return res.status(400).json({ message: error.message });
    }
  }
};

export { createCategory, getCategories, deleteCategory };
