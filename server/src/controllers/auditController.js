import AuditLog from '../models/AuditLog.js';
import Company from '../models/Company.js';
import mongoose from 'mongoose';
import { canAccessCompany } from '../utils/companyAccess.js';

const getAuditLogs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 20, action, entityType } = req.query;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const query = { company: new mongoose.Types.ObjectId(companyId) };
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      logs,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
    });
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

export { getAuditLogs };
