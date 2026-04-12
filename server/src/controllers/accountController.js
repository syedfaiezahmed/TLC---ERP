import Account from '../models/Account.js';
import Company from '../models/Company.js';
import { ensureDefaultAccounts, ensureMissingAccounts } from '../services/accountSeedService.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';

const getAccounts = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    await ensureDefaultAccounts(companyId);
    await ensureMissingAccounts(companyId);
    const accounts = await Account.find({ company: companyId }).sort({ code: 1 }).lean();
    return res.json(accounts);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

const createAccount = async (req, res) => {
  try {
    const { companyId, code, name, type, parent } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const exists = await Account.findOne({ company: companyId, $or: [{ code }, { name }] }).lean();
    if (exists) return res.status(400).json({ message: 'Account with this code or name already exists' });

    const created = await Account.create({
      company: companyId,
      code,
      name,
      type,
      parent: parent || undefined,
      isSystem: false,
      isActive: true,
    });

    try { await logAudit({ req, companyId, action: 'create', entityType: 'account', entityId: created._id, before: null, after: created }); } catch(_) {}
    return res.status(201).json(created);
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

const updateAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const company = await Company.findById(account.company);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });
    if (account.isSystem) return res.status(400).json({ message: 'System accounts cannot be edited' });

    const before = account.toObject();
    const { code, name, type, parent, isActive } = req.body;

    if (code && code !== account.code) {
      const codeExists = await Account.findOne({ company: account.company, code }).lean();
      if (codeExists) return res.status(400).json({ message: 'Account code already exists' });
      account.code = code;
    }

    if (name && name !== account.name) {
      const nameExists = await Account.findOne({ company: account.company, name }).lean();
      if (nameExists) return res.status(400).json({ message: 'Account name already exists' });
      account.name = name;
    }

    if (type) account.type = type;
    account.parent = parent || undefined;
    if (typeof isActive === 'boolean') account.isActive = isActive;

    const updated = await account.save();
    try { await logAudit({ req, companyId: account.company, action: 'update', entityType: 'account', entityId: account._id, before, after: updated }); } catch(_) {}
    return res.json(updated);
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const company = await Company.findById(account.company);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });
    if (account.isSystem) return res.status(400).json({ message: 'System accounts cannot be deleted' });

    const before = account.toObject();
    await account.deleteOne();
    try { await logAudit({ req, companyId: account.company, action: 'delete', entityType: 'account', entityId: before._id, before, after: null }); } catch(_) {}
    return res.json({ message: 'Account deleted' });
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

export { getAccounts, createAccount, updateAccount, deleteAccount };
