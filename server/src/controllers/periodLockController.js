import PeriodLock from '../models/PeriodLock.js';
import Company from '../models/Company.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';

const getPeriodLock = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const lock = await PeriodLock.findOne({ company: companyId }).lean();
    return res.json({
      companyId,
      lockedUntil: lock?.lockedUntil || null,
      reason: lock?.reason || '',
      lockedBy: lock?.lockedBy || null,
      updatedAt: lock?.updatedAt || null,
    });
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

const setPeriodLock = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { lockedUntil, reason } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const until = lockedUntil ? new Date(lockedUntil) : null;
    if (!until || Number.isNaN(until.getTime())) {
      return res.status(400).json({ message: 'lockedUntil is required and must be a valid date' });
    }
    until.setHours(23, 59, 59, 999);

    const lock = await PeriodLock.findOneAndUpdate(
      { company: companyId },
      { $set: { lockedUntil: until, reason: reason || '', lockedBy: req.user._id } },
      { upsert: true, new: true }
    ).lean();

    try { await logAudit({ req, companyId, action: 'set_lock', entityType: 'period_lock', entityId: lock?._id, before: null, after: { lockedUntil: lock.lockedUntil, reason: lock.reason } }); } catch(_) {}
    return res.json(lock);
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

const clearPeriodLock = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    await PeriodLock.findOneAndUpdate(
      { company: companyId },
      { $set: { lockedUntil: null, reason: '', lockedBy: req.user._id } },
      { upsert: true }
    );

    try { await logAudit({ req, companyId, action: 'clear_lock', entityType: 'period_lock', entityId: null, before: null, after: null }); } catch(_) {}
    return res.json({ message: 'Posting lock cleared' });
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

export { getPeriodLock, setPeriodLock, clearPeriodLock };
