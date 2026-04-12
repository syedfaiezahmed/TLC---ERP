import Asset from '../models/Asset.js';
import DepreciationRecord from '../models/DepreciationRecord.js';
import Company from '../models/Company.js';
import Teacher from '../models/Teacher.js';
import Ledger from '../models/Ledger.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import { assertPeriodOpen } from '../services/periodLockService.js';
import { postJournal } from '../services/journalService.js';
import { recalculateLedger } from '../services/ledgerService.js';
import { logAudit } from '../services/auditService.js';

const toMonthKey = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const monthEnd = (monthKey) => {
  const [y, m] = monthKey.split('-').map((n) => Number(n));
  return new Date(y, m, 0, 23, 59, 59, 999);
};

const nextMonthKey = (monthKey) => {
  const [y, m] = monthKey.split('-').map((n) => Number(n));
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return toMonthKey(d);
};

const compareMonthKey = (a, b) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

const createAsset = async (req, res) => {
  try {
    const {
      companyId,
      name,
      category,
      acquisitionDate,
      cost,
      salvageValue = 0,
      usefulLifeMonths,
      depreciationMethod = 'straight_line',
      assetAccountName,
      accumulatedDepreciationAccountName,
      depreciationExpenseAccountName,
      teacherId,
      acquisitionAccountName = 'Cash',
      acquisitionOnCredit = false,
      notes,
    } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    try { await assertPeriodOpen(companyId, acquisitionDate); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    let teacher = null;
    if (teacherId) {
      teacher = await Teacher.findById(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
    }

    const last = await Asset.findOne({ company: companyId }).sort({ assetNumber: -1 }).lean();
    const assetNumber = last ? last.assetNumber + 1 : 1;

    const asset = await Asset.create({
      company: companyId,
      assetNumber,
      name,
      category,
      acquisitionDate,
      cost: Number(cost),
      salvageValue: Number(salvageValue || 0),
      usefulLifeMonths: Number(usefulLifeMonths),
      depreciationMethod,
      assetAccountName,
      accumulatedDepreciationAccountName,
      depreciationExpenseAccountName,
      teacher: teacher?._id,
      acquisitionAccountName,
      acquisitionOnCredit: Boolean(acquisitionOnCredit),
      notes,
    });

    await postJournal(
      {
        companyId,
        date: new Date(acquisitionDate),
        description: `Asset Acquisition #${asset.assetNumber} - ${asset.name}`,
        referenceType: 'asset',
        referenceId: asset._id,
        teacherId: teacher?._id,
      },
      [
        {
          accountName: assetAccountName,
          accountType: 'asset',
          debit: Number(cost),
          credit: 0,
          relatedAccount: acquisitionOnCredit ? 'Accounts Payable' : acquisitionAccountName,
          type: 'asset',
          description: `Asset acquisition - ${asset.name}`,
        },
        acquisitionOnCredit
          ? {
              accountName: 'Accounts Payable',
              accountType: 'liability',
              debit: 0,
              credit: Number(cost),
              relatedAccount: assetAccountName,
              type: 'asset',
              teacher: teacher?._id,
              description: `Asset on credit - ${asset.name}`,
            }
          : {
              accountName: acquisitionAccountName,
              accountType: 'asset',
              debit: 0,
              credit: Number(cost),
              relatedAccount: assetAccountName,
              type: 'asset',
              description: `Asset payment - ${asset.name}`,
            },
      ]
    );

    await logAudit({ req, companyId, action: 'create', entityType: 'asset', entityId: asset._id, before: null, after: asset });

    void Promise.all([
      recalculateLedger(companyId, null, assetAccountName),
      recalculateLedger(companyId, null, acquisitionOnCredit ? 'Accounts Payable' : acquisitionAccountName),
    ]).catch(() => {});

    res.status(201).json(asset);
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

const getAssets = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const assets = await Asset.find({ company: companyId }).sort({ assetNumber: -1 }).lean();
    res.json(assets);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

const updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const company = await Company.findById(asset.company);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (Number(asset.accumulatedDepreciation || 0) > 0 || asset.depreciationPostedThrough) {
      return res.status(400).json({ message: 'Cannot edit asset after depreciation posting' });
    }

    const before = asset.toObject();
    asset.name = req.body.name ?? asset.name;
    asset.category = req.body.category ?? asset.category;
    asset.acquisitionDate = req.body.acquisitionDate ?? asset.acquisitionDate;
    asset.cost = req.body.cost ?? asset.cost;
    asset.salvageValue = req.body.salvageValue ?? asset.salvageValue;
    asset.usefulLifeMonths = req.body.usefulLifeMonths ?? asset.usefulLifeMonths;
    asset.depreciationMethod = req.body.depreciationMethod ?? asset.depreciationMethod;
    asset.assetAccountName = req.body.assetAccountName ?? asset.assetAccountName;
    asset.accumulatedDepreciationAccountName = req.body.accumulatedDepreciationAccountName ?? asset.accumulatedDepreciationAccountName;
    asset.depreciationExpenseAccountName = req.body.depreciationExpenseAccountName ?? asset.depreciationExpenseAccountName;
    asset.acquisitionAccountName = req.body.acquisitionAccountName ?? asset.acquisitionAccountName;
    asset.acquisitionOnCredit = req.body.acquisitionOnCredit ?? asset.acquisitionOnCredit;
    asset.notes = req.body.notes ?? asset.notes;

    try { await assertPeriodOpen(asset.company, asset.acquisitionDate); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    await Ledger.deleteMany({ company: asset.company, referenceType: 'asset', referenceId: asset._id });

    await postJournal(
      {
        companyId: asset.company,
        date: new Date(asset.acquisitionDate),
        description: `Asset Acquisition #${asset.assetNumber} - ${asset.name}`,
        referenceType: 'asset',
        referenceId: asset._id,
        teacherId: asset.teacher,
      },
      [
        {
          accountName: asset.assetAccountName,
          accountType: 'asset',
          debit: Number(asset.cost),
          credit: 0,
          relatedAccount: asset.acquisitionOnCredit ? 'Accounts Payable' : asset.acquisitionAccountName,
          type: 'asset',
          description: `Asset acquisition - ${asset.name}`,
        },
        asset.acquisitionOnCredit
          ? {
              accountName: 'Accounts Payable',
              accountType: 'liability',
              debit: 0,
              credit: Number(asset.cost),
              relatedAccount: asset.assetAccountName,
              type: 'asset',
              teacher: asset.teacher,
              description: `Asset on credit - ${asset.name}`,
            }
          : {
              accountName: asset.acquisitionAccountName,
              accountType: 'asset',
              debit: 0,
              credit: Number(asset.cost),
              relatedAccount: asset.assetAccountName,
              type: 'asset',
              description: `Asset payment - ${asset.name}`,
            },
      ]
    );

    const updated = await asset.save();
    await logAudit({ req, companyId: asset.company, action: 'update', entityType: 'asset', entityId: asset._id, before, after: updated });

    void Promise.all([
      recalculateLedger(asset.company, null, asset.assetAccountName),
      recalculateLedger(asset.company, null, asset.acquisitionOnCredit ? 'Accounts Payable' : asset.acquisitionAccountName),
    ]).catch(() => {});

    res.json(updated);
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const company = await Company.findById(asset.company);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (Number(asset.accumulatedDepreciation || 0) > 0 || asset.depreciationPostedThrough) {
      return res.status(400).json({ message: 'Cannot delete asset after depreciation posting' });
    }

    try { await assertPeriodOpen(asset.company, asset.acquisitionDate); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    await Ledger.deleteMany({ company: asset.company, referenceId: asset._id, referenceType: { $in: ['asset', 'asset_depreciation'] } });
    const before = asset.toObject();
    await asset.deleteOne();
    await logAudit({ req, companyId: asset.company, action: 'delete', entityType: 'asset', entityId: before._id, before, after: null });

    void Promise.all([
      recalculateLedger(asset.company, null, asset.assetAccountName),
      recalculateLedger(asset.company, null, asset.acquisitionOnCredit ? 'Accounts Payable' : asset.acquisitionAccountName),
    ]).catch(() => {});

    res.json({ message: 'Asset deleted' });
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

const postDepreciationForMonth = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month } = req.query;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const monthKey = month || toMonthKey(new Date());
    const postingDate = monthEnd(monthKey);
    try { await assertPeriodOpen(companyId, postingDate); } catch (lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    const assets = await Asset.find({ company: companyId, status: 'active' }).sort({ assetNumber: 1 });
    let postedCount = 0;
    let totalPosted = 0;

    for (const asset of assets) {
      const startKey = toMonthKey(asset.acquisitionDate);
      if (compareMonthKey(monthKey, startKey) < 0) continue;

      if (asset.depreciationPostedThrough && compareMonthKey(asset.depreciationPostedThrough, monthKey) >= 0) continue;

      const depreciableBase = Math.max(0, Number(asset.cost || 0) - Number(asset.salvageValue || 0));
      const life = Math.max(1, Number(asset.usefulLifeMonths || 1));
      const monthly = depreciableBase / life;

      const remaining = depreciableBase - Number(asset.accumulatedDepreciation || 0);
      if (remaining <= 0.000001) continue;
      const amount = Math.min(remaining, monthly);
      if (amount <= 0.000001) continue;

      const accBefore = Number(asset.accumulatedDepreciation || 0);
      const bookValueBefore = Number(asset.cost || 0) - accBefore;

      const journalResult = await postJournal(
        {
          companyId,
          date: postingDate,
          description: `Depreciation ${monthKey} - Asset #${asset.assetNumber} ${asset.name}`,
          referenceType: 'asset_depreciation',
          referenceId: asset._id,
        },
        [
          {
            accountName: asset.depreciationExpenseAccountName,
            accountType: 'expense',
            debit: Number(amount.toFixed(2)),
            credit: 0,
            relatedAccount: asset.accumulatedDepreciationAccountName,
            type: 'asset_depreciation',
            description: `Depreciation expense ${monthKey}`,
          },
          {
            accountName: asset.accumulatedDepreciationAccountName,
            accountType: 'asset',
            debit: 0,
            credit: Number(amount.toFixed(2)),
            relatedAccount: asset.depreciationExpenseAccountName,
            type: 'asset_depreciation',
            description: `Accumulated depreciation ${monthKey}`,
          },
        ]
      );

      const accAfter = accBefore + Number(amount.toFixed(2));
      asset.accumulatedDepreciation = accAfter;
      asset.depreciationPostedThrough = monthKey;
      await asset.save();

      // Store depreciation history record
      try {
        await DepreciationRecord.create({
          company: companyId,
          asset: asset._id,
          month: monthKey,
          amount: Number(amount.toFixed(2)),
          accumulatedDepreciationBefore: accBefore,
          accumulatedDepreciationAfter: accAfter,
          bookValueBefore,
          bookValueAfter: Math.max(0, bookValueBefore - Number(amount.toFixed(2))),
          journalId: journalResult?.[0]?.journalId || null,
          postedBy: req.user?._id,
        });
      } catch (recErr) { console.error('[depreciation] record error:', recErr.message); }

      postedCount += 1;
      totalPosted += Number(amount.toFixed(2));
    }

    await logAudit({ req, companyId, action: 'post_depreciation', entityType: 'asset', entityId: companyId, before: null, after: { month: monthKey, postedCount, totalPosted } });

    void Promise.all([
      recalculateLedger(companyId, null, 'Opening Balance Equity'),
    ]).catch(() => {});

    res.json({ month: monthKey, postedCount, totalPosted });
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('purchase', 'purchaseNumber date totalAmount supplier description')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const company = await Company.findById(asset.company);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    // Attach computed fields
    const depreciableBase = Math.max(0, Number(asset.cost || 0) - Number(asset.salvageValue || 0));
    const life = Math.max(1, Number(asset.usefulLifeMonths || 1));
    const monthlyDepreciation = depreciableBase / life;
    const annualDepreciation = monthlyDepreciation * 12;
    const bookValue = Math.max(0, Number(asset.cost || 0) - Number(asset.accumulatedDepreciation || 0));

    return res.json({
      ...asset,
      depreciableBase,
      monthlyDepreciation: Number(monthlyDepreciation.toFixed(2)),
      annualDepreciation: Number(annualDepreciation.toFixed(2)),
      bookValue: Number(bookValue.toFixed(2)),
    });
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

const getDepreciationHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findById(id).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const company = await Company.findById(asset.company);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const records = await DepreciationRecord.find({ asset: id })
      .sort({ month: 1 })
      .lean();

    return res.json(records);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

export { createAsset, getAssets, getAssetById, updateAsset, deleteAsset, postDepreciationForMonth, getDepreciationHistory };

