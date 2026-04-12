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
import { encryptData, decryptData, encryptDataWithPassword, decryptDataWithPassword } from '../utils/encryption.js';
import { writeCompanyBackup, listCompanyBackups } from '../services/backupService.js';
import multer from 'multer';
const upload = multer();
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

// Helper to gather all data
const gatherAllData = async () => {
    const [
        users, companies, students, courses, fees, ledger, teachers, 
        batches, enquiries, exams, attendance,
        accounts, assets, auditLogs, expenses, expenseCategories,
        feeRefunds, periodLocks, purchases, purchaseReturns, results
    ] = await Promise.all([
        User.find({}),
        Company.find({}),
        Student.find({}),
        Course.find({}),
        Fee.find({}),
        Ledger.find({}),
        Teacher.find({}),
        Batch.find({}),
        Enquiry.find({}),
        Exam.find({}),
        Attendance.find({}),
        Account.find({}),
        Asset.find({}),
        AuditLog.find({}),
        Expense.find({}),
        ExpenseCategory.find({}),
        FeeRefund.find({}),
        PeriodLock.find({}),
        Purchase.find({}),
        PurchaseReturn.find({}),
        Result.find({}),
    ]);

    return {
        users,
        companies,
        students,
        courses,
        fees,
        ledger,
        teachers,
        batches,
        enquiries,
        exams,
        attendance,
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
        timestamp: new Date().toISOString(),
        version: '2.0'
    };
};

// @desc    Export Backup (Manual)
// @route   GET /api/backup/export
// @access  Private/Admin
const exportBackup = async (req, res) => {
    try {
        const data = await gatherAllData();
        const password = req.query.password || null;
        const encrypted = password ? encryptDataWithPassword(data, password) : encryptData(data);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.json`);
        res.json(encrypted);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Restore Backup
// @route   POST /api/backup/restore
// @access  Private/Admin
const restoreBackup = async (req, res) => {
    try {
        const strategy = req.body.mode || req.body.strategy || 'merge';
        const password = req.body.password;

        let payload;
        if (req.file && req.file.buffer) {
            payload = JSON.parse(req.file.buffer.toString('utf8'));
        } else if (req.body.iv && req.body.encryptedData) {
            payload = { iv: req.body.iv, encryptedData: req.body.encryptedData };
        } else {
            return res.status(400).json({ message: 'Invalid backup upload' });
        }

        const decrypted = password ? decryptDataWithPassword(payload, password) : decryptData(payload);
        
        if (!decrypted || !decrypted.version) {
            throw new Error('Invalid decrypted data structure');
        }

        if (strategy === 'overwrite') {
            // DANGER: Delete all
            await Promise.all([
                User.deleteMany({}),
                Company.deleteMany({}),
                Student.deleteMany({}),
                Course.deleteMany({}),
                Fee.deleteMany({}),
                Ledger.deleteMany({}),
                Teacher.deleteMany({}),
                Batch.deleteMany({}),
                Enquiry.deleteMany({}),
                Exam.deleteMany({}),
                Attendance.deleteMany({}),
                Account.deleteMany({}),
                Asset.deleteMany({}),
                AuditLog.deleteMany({}),
                Expense.deleteMany({}),
                ExpenseCategory.deleteMany({}),
                FeeRefund.deleteMany({}),
                PeriodLock.deleteMany({}),
                Purchase.deleteMany({}),
                PurchaseReturn.deleteMany({}),
                Result.deleteMany({}),
            ]);

            // Insert
            if (decrypted.users) await User.insertMany(decrypted.users);
            if (decrypted.companies) await Company.insertMany(decrypted.companies);
            if (decrypted.students) await Student.insertMany(decrypted.students);
            if (decrypted.courses) await Course.insertMany(decrypted.courses);
            if (decrypted.fees) await Fee.insertMany(decrypted.fees);
            if (decrypted.ledger) await Ledger.insertMany(decrypted.ledger);
            if (decrypted.teachers) await Teacher.insertMany(decrypted.teachers);
            if (decrypted.batches) await Batch.insertMany(decrypted.batches);
            if (decrypted.enquiries) await Enquiry.insertMany(decrypted.enquiries);
            if (decrypted.exams) await Exam.insertMany(decrypted.exams);
            if (decrypted.attendance) await Attendance.insertMany(decrypted.attendance);
            if (decrypted.accounts) await Account.insertMany(decrypted.accounts);
            if (decrypted.assets) await Asset.insertMany(decrypted.assets);
            if (decrypted.auditLogs) await AuditLog.insertMany(decrypted.auditLogs);
            if (decrypted.expenses) await Expense.insertMany(decrypted.expenses);
            if (decrypted.expenseCategories) await ExpenseCategory.insertMany(decrypted.expenseCategories);
            if (decrypted.feeRefunds) await FeeRefund.insertMany(decrypted.feeRefunds);
            if (decrypted.periodLocks) await PeriodLock.insertMany(decrypted.periodLocks);
            if (decrypted.purchases) await Purchase.insertMany(decrypted.purchases);
            if (decrypted.purchaseReturns) await PurchaseReturn.insertMany(decrypted.purchaseReturns);
            if (decrypted.results) await Result.insertMany(decrypted.results);

            res.json({ message: 'Restore successful (Overwrite)' });
        } else {
            // Merge logic (Upsert)
            const upsertMany = async (Model, items) => {
                for (const item of items) {
                    await Model.findByIdAndUpdate(item._id, item, { upsert: true });
                }
            };

            if (decrypted.users) await upsertMany(User, decrypted.users);
            if (decrypted.companies) await upsertMany(Company, decrypted.companies);
            if (decrypted.students) await upsertMany(Student, decrypted.students);
            if (decrypted.courses) await upsertMany(Course, decrypted.courses);
            if (decrypted.fees) await upsertMany(Fee, decrypted.fees);
            if (decrypted.ledger) await upsertMany(Ledger, decrypted.ledger);
            if (decrypted.teachers) await upsertMany(Teacher, decrypted.teachers);
            if (decrypted.batches) await upsertMany(Batch, decrypted.batches);
            if (decrypted.enquiries) await upsertMany(Enquiry, decrypted.enquiries);
            if (decrypted.exams) await upsertMany(Exam, decrypted.exams);
            if (decrypted.attendance) await upsertMany(Attendance, decrypted.attendance);
            if (decrypted.accounts) await upsertMany(Account, decrypted.accounts);
            if (decrypted.assets) await upsertMany(Asset, decrypted.assets);
            if (decrypted.auditLogs) await upsertMany(AuditLog, decrypted.auditLogs);
            if (decrypted.expenses) await upsertMany(Expense, decrypted.expenses);
            if (decrypted.expenseCategories) await upsertMany(ExpenseCategory, decrypted.expenseCategories);
            if (decrypted.feeRefunds) await upsertMany(FeeRefund, decrypted.feeRefunds);
            if (decrypted.periodLocks) await upsertMany(PeriodLock, decrypted.periodLocks);
            if (decrypted.purchases) await upsertMany(Purchase, decrypted.purchases);
            if (decrypted.purchaseReturns) await upsertMany(PurchaseReturn, decrypted.purchaseReturns);
            if (decrypted.results) await upsertMany(Result, decrypted.results);

            res.json({ message: 'Restore successful (Merge)' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Restore failed: ' + error.message });
    }
};

// @desc    List Backup History for a company
// @route   GET /api/backup/history/:companyId
// @access  Private/Admin
const getBackupHistory = async (req, res) => {
    try {
        const { companyId } = req.params;
        const items = await listCompanyBackups(companyId);
        res.json(items.map(i => ({
            file: i.file,
            dir: i.dir.replace(path.resolve(), ''),
            size: i.size,
            createdAt: i.createdAt
        })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Scheduled Task (Daily/Weekly Backups per company)
const scheduleBackups = () => {
    cron.schedule('0 2 * * *', async () => {
        try {
            const companies = await Company.find({}).lean();
            for (const c of companies) {
                await writeCompanyBackup(c._id, { subDir: 'daily' });
            }
        } catch (error) {
            console.error('Daily backup failed:', error);
        }
    });
    cron.schedule('0 3 * * 1', async () => {
        try {
            const companies = await Company.find({}).lean();
            for (const c of companies) {
                await writeCompanyBackup(c._id, { subDir: 'weekly' });
            }
        } catch (error) {
            console.error('Weekly backup failed:', error);
        }
    });
};

export { exportBackup, restoreBackup, scheduleBackups, getBackupHistory, upload };
