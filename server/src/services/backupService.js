import fs from 'fs';
import path from 'path';
import Company from '../models/Company.js';
import Student from '../models/Student.js';
import Course from '../models/Course.js';
import Fee from '../models/Fee.js';
import Ledger from '../models/Ledger.js';
import Teacher from '../models/Teacher.js';
import Batch from '../models/Batch.js';
import Enquiry from '../models/Enquiry.js';
import Exam from '../models/Exam.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Account from '../models/Account.js';
import Asset from '../models/Asset.js';
import AuditLog from '../models/AuditLog.js';
import Expense from '../models/Expense.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import FeeRefund from '../models/FeeRefund.js';
import PeriodLock from '../models/PeriodLock.js';
import Purchase from '../models/Purchase.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import Result from '../models/Result.js';
import { encryptData, encryptDataWithPassword } from '../utils/encryption.js';
import { backupEvents } from '../utils/backupEvents.js';

const companyQueues = new Map();

const slugify = (name) => (name || 'company')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const rotateBackups = (dir, keep = 30) => {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > keep) {
      const toDelete = files.slice(keep);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(dir, f.name));
      }
    }
  } catch {}
};

export const buildCompanyBackup = async (companyId) => {
  const company = await Company.findById(companyId).lean();
  if (!company) throw new Error('Company not found');
  
  const [
    students, courses, fees, ledger, teachers, 
    batches, enquiries, exams, attendance,
    users, accounts, assets, auditLogs,
    expenses, expenseCategories, feeRefunds,
    periodLocks, purchases, purchaseReturns, results
  ] = await Promise.all([
    Student.find({ company: companyId }).lean(),
    Course.find({ company: companyId }).lean(),
    Fee.find({ company: companyId }).lean(),
    Ledger.find({ company: companyId }).lean(),
    Teacher.find({ company: companyId }).lean(),
    Batch.find({ company: companyId }).lean(),
    Enquiry.find({ company: companyId }).lean(),
    Exam.find({ company: companyId }).lean(),
    Attendance.find({ company: companyId }).lean(),
    User.find({ company: companyId }).lean(),
    Account.find({ company: companyId }).lean(),
    Asset.find({ company: companyId }).lean(),
    AuditLog.find({ company: companyId }).lean(),
    Expense.find({ company: companyId }).lean(),
    ExpenseCategory.find({ company: companyId }).lean(),
    FeeRefund.find({ company: companyId }).lean(),
    PeriodLock.find({ company: companyId }).lean(),
    Purchase.find({ company: companyId }).lean(),
    PurchaseReturn.find({ company: companyId }).lean(),
    Result.find({ company: companyId }).lean(),
  ]);

  return {
    company,
    students,
    courses,
    fees,
    ledger,
    teachers,
    batches,
    enquiries,
    exams,
    attendance,
    users,
    accounts,
    assets,
    auditLogs,
    expenses,
    expenseCategories,
    feeRefunds,
    periodLocks,
    purchases,
    purchaseReturns,
    results,
    metadata: {
      createdAt: new Date().toISOString(),
      version: '2.0' // Incremented version for coaching ERP
    }
  };
};

export const writeCompanyBackup = async (companyId, options = {}) => {
  const { password = null, rootDir = path.join(path.resolve(), 'backups'), subDir = null } = options;
  const company = await Company.findById(companyId).lean();
  if (!company) return;
  const slug = slugify(company.name);
  const baseDir = subDir ? path.join(rootDir, subDir, slug) : path.join(rootDir, slug);
  ensureDir(baseDir);

  const data = await buildCompanyBackup(companyId);
  const stamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  const fileName = `backup-${stamp}.json`;
  const filePath = path.join(baseDir, fileName);

  const encrypted = password ? encryptDataWithPassword(data, password) : encryptData(data);
  fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2));

  rotateBackups(baseDir, 30);
  return { path: filePath };
};

const queueCompanyBackup = (companyId) => {
  const existing = companyQueues.get(companyId);
  if (existing && existing.timer) {
    clearTimeout(existing.timer);
  }
  const timer = setTimeout(async () => {
    try {
      await writeCompanyBackup(companyId);
    } catch (e) {
      // swallow errors to not affect main request
    } finally {
      companyQueues.delete(companyId);
    }
  }, 2000); // debounce 2s
  companyQueues.set(companyId, { timer });
};

// Listen for backup events
backupEvents.on('queueBackup', (companyId) => {
    if (companyId) {
        queueCompanyBackup(companyId.toString());
    }
});

export const listCompanyBackups = async (companyId) => {
  const company = await Company.findById(companyId).lean();
  if (!company) throw new Error('Company not found');
  const slug = slugify(company.name);
  const dirs = [
    path.join(path.resolve(), 'backups', slug),
    path.join(path.resolve(), 'backups', 'daily', slug),
    path.join(path.resolve(), 'backups', 'weekly', slug),
  ];
  const items = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        return { file: f, dir, path: full, size: stat.size, createdAt: stat.mtime };
      });
    items.push(...files);
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
};
