import PurchaseReturn from '../models/PurchaseReturn.js';
import Company from '../models/Company.js';
import Teacher from '../models/Teacher.js';
import Purchase from '../models/Purchase.js';
import Course from '../models/Course.js';
import Ledger from '../models/Ledger.js';
import { postPurchaseReturnJournal } from '../services/journalService.js';
import { recalculateLedger } from '../services/ledgerService.js';
import { assertPeriodOpen } from '../services/periodLockService.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';

const createPurchaseReturn = async (req, res) => {
  try {
    const { companyId, teacherId, purchaseId, date, items, taxRate = 0, reason, notes } = req.body;

    if (!companyId || !teacherId) {
      return res.status(400).json({ message: 'Company ID and Teacher ID are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await assertPeriodOpen(companyId, date);

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    let purchase = null;
    if (purchaseId && purchaseId !== 'null') {
      purchase = await Purchase.findById(purchaseId);
      if (!purchase) {
        return res.status(404).json({ message: 'Purchase record not found' });
      }
      
      const maxReturnable = Number((purchase.totalAmount - (purchase.returnAmount || 0)).toFixed(2));
      let tempSubTotal = 0;
      items.forEach(item => {
        tempSubTotal += Number((Number(item.quantity || 1) * Number(item.price || 0)).toFixed(2));
      });
      const tempTax = Number(((tempSubTotal * Number(taxRate || 0)) / 100).toFixed(2));
      const tempTotal = Number((tempSubTotal + tempTax).toFixed(2));

      if (tempTotal > maxReturnable) {
        return res.status(400).json({ message: `Return amount (${tempTotal}) cannot exceed remaining purchase amount (${maxReturnable})` });
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

    const last = await PurchaseReturn.findOne({ company: companyId }).sort({ returnNumber: -1 }).lean();
    const returnNumber = last ? last.returnNumber + 1 : 1;

    const purchaseReturn = await PurchaseReturn.create({
      company: companyId,
      teacher: teacherId,
      purchase: purchaseId || undefined,
      returnNumber,
      date,
      items: processedItems,
      subTotal: Number(subTotal.toFixed(2)),
      taxRate,
      taxAmount,
      totalAmount,
      reason,
      notes,
    });

    await postPurchaseReturnJournal({
      companyId,
      teacherId,
      purchaseId: purchase?._id || undefined,
      purchaseReturn,
      date,
      subTotal: Number(subTotal.toFixed(2)),
      taxAmount,
      totalAmount,
    });

    if (purchase) {
      purchase.returnAmount = Number((Number(purchase.returnAmount || 0) + totalAmount).toFixed(2));
      purchase.balanceDue = Number((purchase.totalAmount - (purchase.paidAmount || 0) - purchase.returnAmount).toFixed(2));
      if (purchase.balanceDue <= 0.01) {
        purchase.balanceDue = 0;
        purchase.status = 'paid';
      } else if ((purchase.paidAmount || 0) > 0 || (purchase.returnAmount || 0) > 0) {
        purchase.status = 'partial';
      } else {
        purchase.status = 'unpaid';
      }
      await purchase.save();
    }
    
    await recalculateLedger(companyId, null, 'Accounts Payable', teacherId);
    await recalculateLedger(companyId, null, 'Institute Assets/Expenses');
    await recalculateLedger(companyId, null, 'Input Tax');

    await logAudit({ req, companyId, action: 'create', entityType: 'purchase_return', entityId: purchaseReturn._id, before: null, after: purchaseReturn });

    res.status(201).json(purchaseReturn);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

const getPurchaseReturns = async (req, res) => {
  try {
    const { companyId } = req.params;
    const returns = await PurchaseReturn.find({ company: companyId })
      .populate('teacher', 'name')
      .populate('purchase', 'purchaseNumber')
      .sort({ date: -1, returnNumber: -1 })
      .lean();
    res.json({ count: returns.length, returns });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPurchaseReturnById = async (req, res) => {
  try {
    const ret = await PurchaseReturn.findById(req.params.id)
      .populate('teacher', 'name email address contact')
      .populate('purchase', 'purchaseNumber totalAmount')
      .populate('items.course', 'name code')
      .lean();

    if (!ret) {
      return res.status(404).json({ message: 'Return record not found' });
    }

    if (!canAccessCompany(req.user, { _id: ret.company })) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(ret);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const deletePurchaseReturn = async (req, res) => {
  try {
    const ret = await PurchaseReturn.findById(req.params.id);
    if (!ret) {
      return res.status(404).json({ message: 'Return record not found' });
    }

    if (!canAccessCompany(req.user, { _id: ret.company })) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await assertPeriodOpen(ret.company, ret.date);

    // Remove Ledger Entries
    await Ledger.deleteMany({ company: ret.company, referenceType: 'purchase_return', referenceId: ret._id });

    // Update Purchase Balance if linked
    if (ret.purchase) {
      const purchase = await Purchase.findById(ret.purchase);
      if (purchase) {
        purchase.returnAmount = Math.max(0, Number((Number(purchase.returnAmount || 0) - Number(ret.totalAmount)).toFixed(2)));
        purchase.balanceDue = Number((purchase.totalAmount - (purchase.paidAmount || 0) - purchase.returnAmount).toFixed(2));
        
        if (purchase.balanceDue <= 0.01) {
            purchase.balanceDue = 0;
            purchase.status = 'paid';
        } else if ((purchase.paidAmount || 0) > 0 || (purchase.returnAmount || 0) > 0) {
            purchase.status = 'partial';
        } else {
            purchase.status = 'unpaid';
        }
        await purchase.save();
      }
    }

    await logAudit({ req, companyId: ret.company, action: 'delete', entityType: 'purchase_return', entityId: ret._id, before: ret, after: null });
    
    await ret.deleteOne();
    await recalculateLedger(ret.company, null, 'Accounts Payable', ret.teacher);
    await recalculateLedger(ret.company, null, 'Institute Assets/Expenses');
    await recalculateLedger(ret.company, null, 'Input Tax');

    res.json({ message: 'Return record removed' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

export { createPurchaseReturn, getPurchaseReturns, getPurchaseReturnById, deletePurchaseReturn };
