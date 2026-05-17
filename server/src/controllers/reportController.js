import Fee from '../models/Fee.js';
import FeePayment from '../models/FeePayment.js';
import FeeVoucher from '../models/FeeVoucher.js';
import FeeRefund from '../models/FeeRefund.js';
import BadDebt from '../models/BadDebt.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';
import Course from '../models/Course.js';
import Ledger from '../models/Ledger.js';
import Company from '../models/Company.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Batch from '../models/Batch.js';
import Enquiry from '../models/Enquiry.js';
import Exam from '../models/Exam.js';
import Payroll from '../models/Payroll.js';
import mongoose from 'mongoose';
import { getCache, setCache, makeKey } from '../utils/cache.js';

// ─── CA Sort Order for Trial Balance ─────────────────────────────────────────
const TB_ORDER = { asset: 0, liability: 1, equity: 2, revenue: 3, expense: 4 };

// @desc    Get Revenue Report (Fees within date range)
// @route   GET /api/reports/revenue/:companyId
// @access  Private/Admin
const getRevenueReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate } = req.query;
        const companyObjId = new mongoose.Types.ObjectId(companyId);

        let dateFilter = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { $gte: start, $lte: end };
        }

        // Ledger entries kept for detail/audit trail display
        const ledgerQuery = { company: companyObjId, accountName: 'Fee Revenue' };
        if (dateFilter.$gte) ledgerQuery.date = dateFilter;

        // CANONICAL totals: FeeVoucher (billed) + FeePayment (cash + discount + late fee)
        const voucherQuery = { company: companyObjId, status: { $ne: 'cancelled' } };
        const paymentQuery = { company: companyObjId, status: 'active' };
        if (dateFilter.$gte) {
            voucherQuery.generatedDate = dateFilter;
            paymentQuery.paymentDate = dateFilter;
        }

        const [revenueEntries, voucherAgg, paymentAgg] = await Promise.all([
            Ledger.find(ledgerQuery).populate('student', 'name').sort({ date: -1 }).lean(),
            FeeVoucher.aggregate([
                { $match: voucherQuery },
                { $group: { _id: null, totalFee: { $sum: { $ifNull: ['$totalFee', 0] } } } }
            ]),
            FeePayment.aggregate([
                { $match: paymentQuery },
                { $group: { _id: null, totalCash: { $sum: { $ifNull: ['$amount', 0] } }, totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } }, totalLateFee: { $sum: { $ifNull: ['$lateFeeAmount', 0] } } } }
            ])
        ]);

        // Canonical totals override stale Ledger sum
        const totalRevenue = voucherAgg[0]?.totalFee || 0;
        const totalCashCollected = paymentAgg[0]?.totalCash || 0;
        const totalDiscount = paymentAgg[0]?.totalDiscount || 0;
        const totalLateFee = paymentAgg[0]?.totalLateFee || 0;
        const totalOutstanding = Math.max(0, totalRevenue - totalCashCollected - totalDiscount);

        res.json({
            totalRevenue: Number(totalRevenue.toFixed(2)),
            totalCashCollected: Number(totalCashCollected.toFixed(2)),
            totalDiscount: Number(totalDiscount.toFixed(2)),
            totalLateFee: Number(totalLateFee.toFixed(2)),
            totalOutstanding: Number(totalOutstanding.toFixed(2)),
            count: revenueEntries.length,
            data: revenueEntries
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Receivables Report (Unpaid Fees)
// @route   GET /api/reports/receivables/:companyId
// @access  Private/Admin
const getReceivablesReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate } = req.query;
        const companyObjectId = new mongoose.Types.ObjectId(companyId);

        const query = { 
            company: companyObjectId, 
            accountName: 'Accounts Receivable' 
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        const data = await Ledger.aggregate([
            { $match: query },
            { $group: { _id: '$student', balance: { $sum: { $subtract: ['$debit', '$credit'] } } } },
            { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
            { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
            { $project: { studentId: '$_id', studentName: '$student.name', totalDue: '$balance' } },
            { $sort: { totalDue: -1 } }
        ]);

        const totalReceivable = data.reduce((acc, item) => acc + (item.totalDue || 0), 0);

        res.json({
            totalReceivable: Number(totalReceivable.toFixed(2)),
            count: data.length,
            data
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Receivables Aging Report (Grouped by Student)
// @route   GET /api/reports/receivables-aging/:companyId
// @access  Private/Admin
const getReceivablesAgingReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { asOfDate } = req.query;
        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        const today = asOfDate ? new Date(asOfDate) : new Date();

        const query = { 
            company: companyObjectId, 
            accountName: 'Accounts Receivable' 
        };

        if (asOfDate) {
            query.date = { $lte: new Date(asOfDate) };
        }

        const feeBalances = await Ledger.aggregate([
            { $match: query },
            { $group: { _id: '$fee', balance: { $sum: { $subtract: ['$debit', '$credit'] } } } },
            { $match: { _id: { $ne: null }, balance: { $gt: 0.01 } } },
            { $lookup: { from: 'fees', localField: '_id', foreignField: '_id', as: 'fee' } },
            { $unwind: '$fee' },
            { $lookup: { from: 'students', localField: 'fee.student', foreignField: '_id', as: 'stu' } },
            { $unwind: '$stu' },
            { $project: { feeId: '$_id', balance: 1, dueDate: '$fee.dueDate', date: '$fee.date', studentId: '$stu._id', studentName: '$stu.name' } }
        ]);

        const studentMap = {};

        for (const rec of feeBalances) {
            const balance = rec.balance || 0;
            if (balance <= 0) continue;

            const due = new Date(rec.dueDate || rec.date);
            const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24));
            const studentId = rec.studentId.toString();

            if (!studentMap[studentId]) {
                studentMap[studentId] = {
                    studentId: studentId,
                    studentName: rec.studentName,
                    current: 0,
                    days1_30: 0,
                    days31_60: 0,
                    days61_90: 0,
                    days90plus: 0,
                    totalDue: 0
                };
            }

            studentMap[studentId].totalDue += balance;

            if (daysOverdue <= 0) studentMap[studentId].current += balance;
            else if (daysOverdue <= 30) studentMap[studentId].days1_30 += balance;
            else if (daysOverdue <= 60) studentMap[studentId].days31_60 += balance;
            else if (daysOverdue <= 90) studentMap[studentId].days61_90 += balance;
            else studentMap[studentId].days90plus += balance;
        }

        const reportData = Object.values(studentMap).sort((a, b) => b.totalDue - a.totalDue);

        res.json({
            count: reportData.length,
            data: reportData
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPayablesAgingReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { asOfDate } = req.query;
        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        const today = asOfDate ? new Date(asOfDate) : new Date();

        const query = { 
            company: companyObjectId, 
            accountName: 'Accounts Payable' 
        };

        if (asOfDate) {
            query.date = { $lte: new Date(asOfDate) };
        }

        const purchaseBalances = await Ledger.aggregate([
            { $match: query },
            { $group: { _id: '$referenceId', balance: { $sum: { $subtract: ['$credit', '$debit'] } } } },
            { $match: { _id: { $ne: null }, balance: { $gt: 0.01 } } },
            { $lookup: { from: 'purchases', localField: '_id', foreignField: '_id', as: 'pur' } },
            { $unwind: { path: '$pur', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'teachers', localField: 'pur.teacher', foreignField: '_id', as: 'tea' } },
            { $unwind: { path: '$tea', preserveNullAndEmptyArrays: true } },
            { $project: {
                purchaseId: '$_id', balance: 1,
                dueDate: '$pur.dueDate', date: '$pur.date',
                vendorId: { $ifNull: ['$tea._id', '$_id'] },
                vendorName: { $ifNull: ['$tea.name', { $ifNull: ['$pur.supplier', { $ifNull: ['$pur.description', 'Unknown Supplier'] }] }] }
            }}
        ]);

        const teacherMap = {};

        for (const rec of purchaseBalances) {
            const balance = rec.balance || 0;
            if (balance <= 0) continue;

            const due = new Date(rec.dueDate || rec.date);
            const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24));
            const vendorKey = rec.vendorId ? rec.vendorId.toString() : rec.vendorName;

            if (!teacherMap[vendorKey]) {
                teacherMap[vendorKey] = {
                    teacherId: vendorKey,
                    teacherName: rec.vendorName || 'Unknown',
                    current: 0,
                    days1_30: 0,
                    days31_60: 0,
                    days61_90: 0,
                    days90plus: 0,
                    totalDue: 0
                };
            }

            teacherMap[vendorKey].totalDue += balance;

            if (daysOverdue <= 0) teacherMap[vendorKey].current += balance;
            else if (daysOverdue <= 30) teacherMap[vendorKey].days1_30 += balance;
            else if (daysOverdue <= 60) teacherMap[vendorKey].days31_60 += balance;
            else if (daysOverdue <= 90) teacherMap[vendorKey].days61_90 += balance;
            else teacherMap[vendorKey].days90plus += balance;
        }

        const reportData = Object.values(teacherMap).sort((a, b) => b.totalDue - a.totalDue);

        res.json({
            count: reportData.length,
            data: reportData
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Detailed Revenue Report — merges old Fee model + new FeePayment (voucher) model
// @route   GET /api/reports/revenue-detail/:companyId
// @access  Private/Admin
const getRevenueDetailReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate, studentId } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { $gte: start, $lte: end };
        }

        const groupedData = {};

        // ── 1. Old Fee model (fee receipts) ──────────────────────────────────
        const feeQuery = { company: companyId, status: { $ne: 'cancelled' } };
        if (dateFilter.$gte) feeQuery.date = dateFilter;
        if (studentId) feeQuery.student = studentId;

        const fees = await Fee.find(feeQuery)
            .select('feeNumber date items student totalAmount')
            .populate('student', 'name')
            .sort({ date: 1 })
            .lean();

        for (const fee of fees) {
            if (!fee.student) continue;
            const sid = fee.student._id.toString();
            if (!groupedData[sid]) groupedData[sid] = { studentName: fee.student.name, items: [], totalQty: 0, totalAmount: 0 };
            for (const item of (fee.items || [])) {
                groupedData[sid].totalQty += (item.quantity || 1);
                groupedData[sid].totalAmount += (item.amount || 0);
                groupedData[sid].items.push({
                    _id: `${fee._id}_${item._id}`,
                    type: 'Fee Receipt',
                    date: fee.date,
                    num: fee.feeNumber,
                    item: item.description || 'Course Fee',
                    qty: item.quantity || 1,
                    price: item.price || 0,
                    amount: item.amount || 0,
                });
            }
        }

        // ── 2. Fee Refunds (deductions from income) ────────────────────────
        // FeeRefund imported at top
        const refundQuery = { company: companyId };
        if (dateFilter.$gte) refundQuery.date = dateFilter;
        if (studentId) refundQuery.student = studentId;

        try {
            const refunds = await FeeRefund.find(refundQuery)
                .populate('student', 'name')
                .sort({ date: 1 })
                .lean();

            for (const ref of refunds) {
                if (!ref.student) continue;
                const sid = ref.student._id.toString();
                if (!groupedData[sid]) groupedData[sid] = { studentName: ref.student.name, items: [], totalQty: 0, totalAmount: 0 };
                const amount = -(ref.totalAmount || 0);
                groupedData[sid].totalAmount += amount;
                groupedData[sid].items.push({
                    _id: `refund_${ref._id}`,
                    type: 'Fee Refund',
                    date: ref.date,
                    num: ref.refundNumber || 'REF',
                    item: `Refund — ${ref.reason || 'Fee Refund'}`,
                    qty: 1,
                    price: amount,
                    amount,
                });
            }
        } catch (e) { /* FeeRefund model may not exist yet */ }

        // ── 4. Bad Debt Write-offs (deductions from income) ─────────────────
        // BadDebt imported at top
        const bdQuery = { company: companyId };
        if (dateFilter.$gte) bdQuery.writeOffDate = dateFilter;
        if (studentId) bdQuery.student = studentId;

        try {
            const badDebts = await BadDebt.find(bdQuery)
                .populate('student', 'name')
                .sort({ writeOffDate: 1 })
                .lean();

            for (const bd of badDebts) {
                if (!bd.student) continue;
                const sid = bd.student._id.toString();
                if (!groupedData[sid]) groupedData[sid] = { studentName: bd.student.name, items: [], totalQty: 0, totalAmount: 0 };
                const amount = -(bd.writtenOffAmount || 0);
                groupedData[sid].totalAmount += amount;
                groupedData[sid].items.push({
                    _id: `bd_${bd._id}`,
                    type: 'Bad Debt',
                    date: bd.writeOffDate,
                    num: 'WO',
                    item: `Bad Debt Write-off — ${bd.writeOffReason || ''}`,
                    qty: 1,
                    price: amount,
                    amount,
                });
            }
        } catch (e) { /* BadDebt model may not exist yet */ }

        // sort items within each student by date
        for (const sid of Object.keys(groupedData)) {
            groupedData[sid].items.sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        res.json(groupedData);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPurchasesDetailReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate, teacherId } = req.query;

        const query = { company: companyId };
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }
        if (teacherId) {
            query.teacher = teacherId;
        }

        const purchases = await Purchase.find(query)
            .select('purchaseNumber date items teacher totalAmount')
            .populate('teacher', 'name')
            .sort({ date: 1, purchaseNumber: 1 })
            .lean();

        const groupedData = {};
        
        for (const pur of purchases) {
            const teacherId = pur.teacher ? pur.teacher._id.toString() : `supplier_${pur._id}`;
            const teacherName = pur.teacher ? pur.teacher.name : (pur.supplier || pur.description || 'General Purchase');

            if (!groupedData[teacherId]) {
                groupedData[teacherId] = {
                    teacherName: teacherName,
                    items: [],
                    totalQty: 0,
                    totalAmount: 0
                };
            }

            for (const item of pur.items) {
                 groupedData[teacherId].totalQty += item.quantity;
                 groupedData[teacherId].totalAmount += item.amount;
                 
                 groupedData[teacherId].items.push({
                     _id: pur._id + '_' + item._id,
                     type: 'Purchase',
                     date: pur.date,
                     num: pur.purchaseNumber,
                     item: item.description || 'Item',
                     qty: item.quantity,
                     price: item.price,
                     amount: item.amount
                 });
            }
        }
        
        // ── 2. Operating Expenses (from Expense model) ────────────────────────
        const expQuery = { company: companyId };
        if (query.date) expQuery.date = query.date;

        const expenses = await Expense.find(expQuery).sort({ date: 1 }).lean();

        for (const exp of expenses) {
            const key = `expense_${exp.category || 'General'}`;
            if (!groupedData[key]) {
                groupedData[key] = { teacherName: `Expense: ${exp.category || 'General'}`, items: [], totalQty: 0, totalAmount: 0 };
            }
            groupedData[key].totalQty += 1;
            groupedData[key].totalAmount += (exp.amount || 0);
            groupedData[key].items.push({
                _id: `exp_${exp._id}`, type: 'Expense', date: exp.date,
                num: exp.categoryCode || exp.reference || '—',
                item: exp.description || exp.category,
                qty: 1, price: exp.amount || 0, amount: exp.amount || 0
            });
        }

        // ── 3. Payroll (approved & paid payrolls) ───────────────────────────────
        const payrollQuery = { company: companyId, status: { $in: ['approved', 'paid'] } };
        if (query.date) payrollQuery.month = query.date;

        const payrolls = await Payroll.find(payrollQuery)
            .populate('teacher', 'name')
            .sort({ month: 1 })
            .lean();

        for (const pr of payrolls) {
            const key = `payroll_${pr.teacher?._id || 'unknown'}`;
            const teacherLabel = `Payroll: ${pr.teacher?.name || 'Unknown Teacher'}`;
            if (!groupedData[key]) {
                groupedData[key] = { teacherName: teacherLabel, items: [], totalQty: 0, totalAmount: 0 };
            }
            groupedData[key].totalQty += 1;
            groupedData[key].totalAmount += (pr.netSalary || 0);
            groupedData[key].items.push({
                _id: `pr_${pr._id}`, type: 'Payroll',
                date: pr.approvedDate || pr.month,
                num: `PR-${new Date(pr.month).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}`,
                item: `Salary — ${pr.teacher?.name || 'Unknown'} (${pr.salaryType || 'fixed'})`,
                qty: 1, price: pr.netSalary || 0, amount: pr.netSalary || 0
            });
        }

        // Sort items within each group by date
        for (const key of Object.keys(groupedData)) {
            groupedData[key].items.sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        res.json(groupedData);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Profit and Loss Statement
// @route   GET /api/reports/pnl/:companyId
// @access  Private/Admin
const getProfitAndLoss = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate } = req.query;

        const cacheKey = makeKey('pnl', { companyId, startDate, endDate });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const query = { 
            company: new mongoose.Types.ObjectId(companyId),
            accountType: { $in: ['revenue', 'expense'] }
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        const result = await Ledger.aggregate([
            { $match: query },
            { $group: {
                _id: "$accountName",
                type: { $first: "$accountType" },
                debit: { $sum: "$debit" },
                credit: { $sum: "$credit" }
            }}
        ]);

        const dateRange = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateRange.start = start;
            dateRange.end = end;
        }

        const voucherQuery = {
            company: new mongoose.Types.ObjectId(companyId),
            status: { $ne: 'cancelled' }
        };
        if (dateRange.start && dateRange.end) {
            voucherQuery.generatedDate = { $gte: dateRange.start, $lte: dateRange.end };
        }

        // Discounts and late-fee revenue are accrual items — they belong to the voucher's
        // period (generatedDate), not to the month the cash was received. Join each payment
        // to its voucher and filter by voucher.generatedDate so a May payment for an April
        // voucher is reported in April's P&L, not May's.
        const paymentAccrualPipeline = [
            { $match: { company: new mongoose.Types.ObjectId(companyId), status: 'active' } },
            { $lookup: { from: 'feevouchers', localField: 'voucher', foreignField: '_id', as: 'vDoc' } },
            { $unwind: { path: '$vDoc', preserveNullAndEmptyArrays: true } },
            { $addFields: { reportingDate: { $ifNull: ['$vDoc.generatedDate', '$paymentDate'] } } },
            ...(dateRange.start && dateRange.end ? [{
                $match: { reportingDate: { $gte: dateRange.start, $lte: dateRange.end } },
            }] : []),
            { $group: {
                _id: null,
                scholarshipDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
                lateFeeRevenue:      { $sum: { $ifNull: ['$lateFeeAmount',  0] } },
            }},
        ];

        const [voucherRevenueAgg, paymentExpenseAgg] = await Promise.all([
            FeeVoucher.aggregate([
                { $match: voucherQuery },
                {
                    $group: {
                        _id: null,
                        feeRevenue: { $sum: { $ifNull: ['$totalFee', 0] } }
                    }
                }
            ]),
            FeePayment.aggregate(paymentAccrualPipeline),
        ]);

        const canonicalFeeRevenue = voucherRevenueAgg[0]?.feeRevenue || 0;
        const canonicalScholarshipDiscount = paymentExpenseAgg[0]?.scholarshipDiscount || 0;
        const canonicalLateFeeRevenue = paymentExpenseAgg[0]?.lateFeeRevenue || 0;

        let operatingExpenses = [];
        let totalOperatingExpenses = 0;
        let otherIncome = [];
        let totalOtherIncome = 0;

        result.forEach(account => {
            const revenueBalance = account.credit - account.debit;
            const expenseBalance = account.debit - account.credit;

            if (account.type === 'revenue') {
                if (['Fee Revenue', 'Late Fee Revenue'].includes(account._id)) return;
                otherIncome.push({ name: account._id, amount: revenueBalance });
                totalOtherIncome += revenueBalance;
            } else if (account.type === 'expense') {
                if (account._id === 'Scholarship/Discount') return;
                operatingExpenses.push({ name: account._id, amount: expenseBalance });
                totalOperatingExpenses += expenseBalance;
            }
        });

        if (canonicalFeeRevenue > 0) {
            otherIncome.push({ name: 'Fee Revenue', amount: canonicalFeeRevenue });
            totalOtherIncome += canonicalFeeRevenue;
        }
        if (canonicalLateFeeRevenue > 0) {
            otherIncome.push({ name: 'Late Fee Revenue', amount: canonicalLateFeeRevenue });
            totalOtherIncome += canonicalLateFeeRevenue;
        }
        if (canonicalScholarshipDiscount > 0) {
            operatingExpenses.push({ name: 'Scholarship/Discount', amount: canonicalScholarshipDiscount });
            totalOperatingExpenses += canonicalScholarshipDiscount;
        }

        // Sort income: Fee Revenue first, then others alphabetically
        otherIncome.sort((a, b) => {
            if (a.name === 'Fee Revenue') return -1;
            if (b.name === 'Fee Revenue') return 1;
            return a.name.localeCompare(b.name);
        });
        operatingExpenses.sort((a, b) => a.name.localeCompare(b.name));

        // For a service business: Gross Profit = Total Revenue (no COGS)
        const totalRevenue = totalOtherIncome;
        const grossProfit = totalRevenue;
        const operatingProfit = grossProfit - totalOperatingExpenses;
        const netIncome = operatingProfit;

        // Separate fee revenue from other income streams for detailed breakdown
        const feeRevenueEntry = otherIncome.find(i => i.name === 'Fee Revenue');
        const feeRevenue = feeRevenueEntry ? feeRevenueEntry.amount : 0;
        const otherIncomeLines = otherIncome.filter(i => i.name !== 'Fee Revenue');
        const totalOtherIncomeLines = otherIncomeLines.reduce((s, i) => s + i.amount, 0);

        const payload = {
            feeRevenue,
            totalRevenue,
            grossProfit,
            operatingExpenses,
            totalOperatingExpenses,
            operatingProfit,
            otherIncome,                       // all income lines for display
            otherIncomeLines,                  // non-fee income only
            totalOtherIncome: totalOtherIncomeLines,
            netIncome
        };
        setCache(cacheKey, payload, 10);
        res.json(payload);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Balance Sheet
// @route   GET /api/reports/balance-sheet/:companyId
// @access  Private/Admin
const getBalanceSheet = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { asOfDate } = req.query;

        const cacheKey = makeKey('balance-sheet', { companyId, asOfDate });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const query = { 
            company: new mongoose.Types.ObjectId(companyId),
            accountType: { $in: ['asset', 'liability', 'equity'] }
        };

        if (asOfDate) {
            query.date = { $lte: new Date(asOfDate) };
        }

        const result = await Ledger.aggregate([
            { $match: query },
            { $group: {
                _id: "$accountName",
                type: { $first: "$accountType" },
                debit: { $sum: "$debit" },
                credit: { $sum: "$credit" }
            }}
        ]);

        let assets = [];
        let liabilities = [];
        let equity = [];
        
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        result.forEach(account => {
            const assetBalance = account.debit - account.credit;
            const creditBalance = account.credit - account.debit;

            if (account.type === 'asset') {
                assets.push({ name: account._id, amount: assetBalance });
                totalAssets += assetBalance;
            } else if (account.type === 'liability') {
                liabilities.push({ name: account._id, amount: creditBalance });
                totalLiabilities += creditBalance;
            } else {
                equity.push({ name: account._id, amount: creditBalance });
                totalEquity += creditBalance;
            }
        });

        const pnlQuery = {
            company: new mongoose.Types.ObjectId(companyId),
            accountType: { $in: ['revenue', 'expense'] }
        };
        if (asOfDate) pnlQuery.date = { $lte: new Date(asOfDate) };
        
        const pnlResult = await Ledger.aggregate([
            { $match: pnlQuery },
            { $group: {
                _id: null,
                totalDebit: { $sum: "$debit" },
                totalCredit: { $sum: "$credit" }
            }}
        ]);

        let netIncome = 0;
        if (pnlResult.length > 0) {
            netIncome = pnlResult[0].totalCredit - pnlResult[0].totalDebit;
        }

        equity.push({ name: "Retained Earnings", amount: netIncome });
        totalEquity += netIncome;

        const payload = {
            assets: { items: assets, total: totalAssets },
            liabilities: { items: liabilities, total: totalLiabilities },
            equity: { items: equity, total: totalEquity },
            isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05
        };
        setCache(cacheKey, payload, 10);
        res.json(payload);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Dashboard Summary
// @route   GET /api/reports/dashboard/:companyId
// @access  Private/Admin
const getDashboardSummary = async (req, res) => {
    try {
        const { companyId } = req.params;
        const companyObjectId = new mongoose.Types.ObjectId(companyId);

        const [
            expenseResult,
            receivablesResult,
            bankResult,
            cashResult,
            payablesResult,
            payrollResult,
            otherLedgerRevenueResult,
            canonicalVoucherResult,
            canonicalPaymentResult,
            totalStudents,
            totalCourses,
            totalEnquiries,
            totalBatches,
            totalExams
        ] = await Promise.all([
            // Expenses: Ledger is the source of truth (payroll, purchases, etc. are posted correctly)
            Ledger.aggregate([
                 { $match: { company: companyObjectId, accountType: 'expense' }},
                 { $group: { _id: null, total: { $sum: { $subtract: ["$debit", "$credit"] } } } }
            ]),
            // Asset / liability balances — correctly maintained in Ledger
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountName: 'Accounts Receivable' }},
                { $group: { _id: null, total: { $sum: { $subtract: ["$debit", "$credit"] } } } }
            ]),
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountName: 'Bank' }},
                { $group: { _id: null, total: { $sum: { $subtract: ["$debit", "$credit"] } } } }
            ]),
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountName: 'Cash' }},
                { $group: { _id: null, total: { $sum: { $subtract: ["$debit", "$credit"] } } } }
            ]),
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountName: 'Accounts Payable' }},
                { $group: { _id: null, total: { $sum: { $subtract: ["$credit", "$debit"] } } } }
            ]),
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountName: { $in: ['Salary Expense', 'Salary Payable', 'Payroll Expense'] } }},
                { $group: { _id: null, total: { $sum: { $subtract: ["$debit", "$credit"] } } } }
            ]),
            // Non-fee revenue from Ledger (e.g. interest income, other income entries)
            // Exclude Fee Revenue and Late Fee Revenue — these come from canonical sources below
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountType: 'revenue', accountName: { $nin: ['Fee Revenue', 'Late Fee Revenue'] } }},
                { $group: { _id: null, total: { $sum: { $subtract: ["$credit", "$debit"] } } } }
            ]),
            // CANONICAL: FeeVoucher is the single source of truth for billed fee revenue
            FeeVoucher.aggregate([
                { $match: { company: companyObjectId, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, totalFee: { $sum: { $ifNull: ['$totalFee', 0] } } } }
            ]),
            // CANONICAL: FeePayment is the single source of truth for cash collected & discounts
            FeePayment.aggregate([
                { $match: { company: companyObjectId, status: 'active' } },
                { $group: { _id: null, totalCash: { $sum: { $ifNull: ['$amount', 0] } }, totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } }, totalLateFee: { $sum: { $ifNull: ['$lateFeeAmount', 0] } } } }
            ]),
            Student.countDocuments({ company: companyObjectId }),
            Course.countDocuments({ company: companyObjectId }),
            Enquiry.countDocuments({ company: companyObjectId }),
            Batch.countDocuments({ company: companyObjectId }),
            Exam.countDocuments({ company: companyObjectId, status: 'Scheduled' })
        ]);

        // Canonical fee revenue = FeeVoucher.totalFee (accrual: what was billed)
        const feeRevenue = canonicalVoucherResult[0]?.totalFee || 0;
        const canonicalLateFeeRevenue = canonicalPaymentResult[0]?.totalLateFee || 0;
        // Other income from Ledger (non-fee sources, correctly tracked there)
        const otherLedgerRevenue = otherLedgerRevenueResult[0]?.total || 0;
        // Total Revenue = canonical fee + late fee + any other non-fee ledger income
        const netRevenue = feeRevenue + canonicalLateFeeRevenue + otherLedgerRevenue;
        const totalOtherIncome = otherLedgerRevenue;

        const totalExpenses = expenseResult.length > 0 ? expenseResult[0].total : 0;
        const totalReceivables = receivablesResult.length > 0 ? receivablesResult[0].total : 0;
        const totalPayables = payablesResult.length > 0 ? payablesResult[0].total : 0;
        const bankBalance = bankResult.length > 0 ? bankResult[0].total : 0;
        const cashBalance = cashResult.length > 0 ? cashResult[0].total : 0;
        const totalPayroll = payrollResult.length > 0 ? Math.max(0, payrollResult[0].total) : 0;

        const netIncome = netRevenue - totalExpenses;

        res.json({
            totalRevenue: Number(netRevenue.toFixed(2)),
            totalReceivables: Number(Math.max(0, totalReceivables).toFixed(2)),
            totalPayables: Number(Math.max(0, totalPayables).toFixed(2)),
            netIncome: Number(netIncome.toFixed(2)),
            bankBalance: Number(bankBalance.toFixed(2)),
            cashBalance: Number(cashBalance.toFixed(2)),
            totalExpenses: Number(Math.max(0, totalExpenses).toFixed(2)),
            totalPayroll: Number(totalPayroll.toFixed(2)),
            feeRevenue: Number(feeRevenue.toFixed(2)),
            totalOtherIncome: Number(totalOtherIncome.toFixed(2)),
            totalStudents,
            totalCourses,
            totalEnquiries,
            totalBatches,
            totalExams
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getDashboardChartData = async (req, res) => {
    try {
        const { companyId } = req.params;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const companyObjectId = new mongoose.Types.ObjectId(companyId);

        const [revenueData, expenseData] = await Promise.all([
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountType: 'revenue', date: { $gte: sixMonthsAgo } } },
                { $group: {
                    _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                    monthName: { $first: { $dateToString: { format: '%b %Y', date: '$date' } } },
                    totalRevenue: { $sum: { $subtract: ['$credit', '$debit'] } }
                }},
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            Ledger.aggregate([
                { $match: { company: companyObjectId, accountType: 'expense', date: { $gte: sixMonthsAgo } } },
                { $group: {
                    _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                    monthName: { $first: { $dateToString: { format: '%b %Y', date: '$date' } } },
                    totalExpenses: { $sum: { $subtract: ['$debit', '$credit'] } }
                }},
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ])
        ]);

        // Merge into unified monthly chart
        const monthMap = {};
        for (const r of revenueData) {
            const k = `${r._id.year}-${r._id.month}`;
            if (!monthMap[k]) monthMap[k] = { monthName: r.monthName, totalRevenue: 0, totalExpenses: 0 };
            monthMap[k].totalRevenue = Number((r.totalRevenue || 0).toFixed(2));
        }
        for (const e of expenseData) {
            const k = `${e._id.year}-${e._id.month}`;
            if (!monthMap[k]) monthMap[k] = { monthName: e.monthName, totalRevenue: 0, totalExpenses: 0 };
            monthMap[k].totalExpenses = Number((e.totalExpenses || 0).toFixed(2));
        }

        const result = Object.values(monthMap).map(m => ({ ...m, netProfit: Number((m.totalRevenue - m.totalExpenses).toFixed(2)) }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Student Statement
// @route   GET /api/reports/statement/:companyId
// @access  Private/Admin
//
// ACCRUAL PRINCIPLE: A payment for a voucher generated in month M always belongs
// to month M in this statement, regardless of when the student actually paid.
// We join each FeePayment with its FeeVoucher and use voucher.generatedDate as
// the "reporting date". Payments with no voucher link fall back to paymentDate.
const getStudentStatement = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate, studentId } = req.query;

        if (!studentId) {
            return res.status(400).json({ message: "Student ID is required" });
        }

        const companyObj = new mongoose.Types.ObjectId(companyId);
        const studentObj = new mongoose.Types.ObjectId(studentId);

        // Base pipeline: join payment → its voucher, derive reportingDate
        const basePaymentPipeline = [
            { $match: { company: companyObj, student: studentObj, status: 'active' } },
            { $lookup: { from: 'feevouchers', localField: 'voucher', foreignField: '_id', as: 'vDoc' } },
            { $unwind: { path: '$vDoc', preserveNullAndEmptyArrays: true } },
            // reportingDate = the period the fee belongs to (voucher month), not when cash arrived
            { $addFields: { reportingDate: { $ifNull: ['$vDoc.generatedDate', '$paymentDate'] } } },
        ];

        // Opening balance: billed before startDate minus payments whose voucher period is before startDate
        let openingBalance = 0;
        if (startDate && !isNaN(new Date(startDate))) {
            const start = new Date(startDate);
            const [openingVouchers, openingPayments] = await Promise.all([
                FeeVoucher.find({
                    company: companyObj, student: studentObj,
                    status: { $ne: 'cancelled' },
                    generatedDate: { $lt: start },
                }).select('totalFee').lean(),
                FeePayment.aggregate([
                    ...basePaymentPipeline,
                    { $match: { reportingDate: { $lt: start } } },
                    { $project: { amount: 1, discountAmount: 1 } },
                ]),
            ]);
            const openingBilled   = openingVouchers.reduce((s, v) => s + (v.totalFee || 0), 0);
            const openingSettled  = openingPayments.reduce((s, p) => s + (p.amount || 0) + (p.discountAmount || 0), 0);
            openingBalance = openingBilled - openingSettled;
        }

        // Build period date bounds
        const periodStart = startDate ? new Date(startDate) : null;
        const periodEnd   = endDate   ? (() => { const e = new Date(endDate); e.setHours(23, 59, 59, 999); return e; })() : null;
        const periodFilter = (periodStart || periodEnd)
            ? { ...(periodStart ? { $gte: periodStart } : {}), ...(periodEnd ? { $lte: periodEnd } : {}) }
            : null;

        const voucherFilter = {
            company: companyObj, student: studentObj,
            status: { $ne: 'cancelled' },
            ...(periodFilter ? { generatedDate: periodFilter } : {}),
        };
        const paymentPeriodPipeline = [
            ...basePaymentPipeline,
            ...(periodFilter ? [{ $match: { reportingDate: periodFilter } }] : []),
            { $sort: { reportingDate: 1, createdAt: 1 } },
        ];

        const [vouchers, payments] = await Promise.all([
            FeeVoucher.find(voucherFilter).sort({ generatedDate: 1, createdAt: 1 }).lean(),
            FeePayment.aggregate(paymentPeriodPipeline),
        ]);

        const entries = [];
        vouchers.forEach(voucher => {
            entries.push({
                _id: voucher._id,
                date: voucher.generatedDate,
                description: `Fee Voucher #${voucher.voucherNumber || voucher._id}`,
                reference: voucher.voucherNumber,
                debit: voucher.totalFee || 0,
                credit: 0,
                source: 'voucher',
            });
        });
        payments.forEach(payment => {
            // Flag late payments so the description notes when cash was actually received
            const rDate = payment.reportingDate ? new Date(payment.reportingDate) : null;
            const pDate = payment.paymentDate   ? new Date(payment.paymentDate)   : null;
            const isLate = rDate && pDate && (
                rDate.getFullYear() !== pDate.getFullYear() || rDate.getMonth() !== pDate.getMonth()
            );
            const lateSuffix = isLate
                ? ` (paid: ${pDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })})`
                : '';
            entries.push({
                _id: payment._id,
                date: payment.reportingDate,   // accrual period date (voucher month)
                paymentDate: payment.paymentDate,
                description: `Fee Payment #${payment.paymentNumber}${lateSuffix}`,
                reference: payment.referenceNumber || payment.transactionId || payment.paymentNumber,
                debit: 0,
                credit: payment.amount || 0,
                source: 'payment',
            });
            if ((payment.discountAmount || 0) > 0) {
                entries.push({
                    _id: `${payment._id}-discount`,
                    date: payment.reportingDate,
                    paymentDate: payment.paymentDate,
                    description: `Scholarship/Discount on Payment #${payment.paymentNumber}`,
                    reference: payment.paymentNumber,
                    debit: 0,
                    credit: payment.discountAmount || 0,
                    source: 'discount',
                });
            }
        });
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalDebit = 0;
        let totalCredit = 0;
        let totalReceived = 0;
        let totalDiscount = 0;
        let runningBalance = openingBalance;

        const statement = entries.map(entry => {
            const dr = entry.debit || 0;
            const cr = entry.credit || 0;
            totalDebit += dr;
            totalCredit += cr;
            if (entry.source === 'payment') totalReceived += cr;
            if (entry.source === 'discount') totalDiscount += cr;
            runningBalance += (dr - cr);
            return { ...entry, runningBalance: Number(runningBalance.toFixed(2)) };
        });

        const summary = {
            openingBalance,
            totalBilled: totalDebit,
            totalReceived,
            totalDiscount,
            totalSettled: totalCredit,
            closingBalance: openingBalance + totalDebit - totalCredit,
        };

        res.json({ entries: statement, summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Teacher Statement
// @route   GET /api/reports/teacher-statement/:companyId
// @access  Private/Admin
//
// ACCRUAL PRINCIPLE: A salary payment for payroll month M always belongs to
// month M in this statement, regardless of when the salary was actually paid.
// We use payroll.month as the reporting date for both the obligation and the
// payment entry so that late salary payments are still reported in their month.
const getTeacherStatement = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate, teacherId } = req.query;

        if (!teacherId) {
            return res.status(400).json({ message: "Teacher ID is required" });
        }

        const companyObj = new mongoose.Types.ObjectId(companyId);
        const teacherObj = new mongoose.Types.ObjectId(teacherId);

        // Build month range filter against Payroll.month
        const monthFilter = {};
        if (startDate) monthFilter.$gte = new Date(startDate);
        if (endDate) {
            const e = new Date(endDate); e.setHours(23, 59, 59, 999);
            monthFilter.$lte = e;
        }

        // Opening balance = sum of netSalary for APPROVED (committed) payrolls in months
        // BEFORE startDate that have NOT been paid yet (still owed to the teacher).
        // Draft payrolls are excluded — a draft is a calculation, not a posted obligation.
        let openingBalance = 0;
        if (startDate && !isNaN(new Date(startDate))) {
            const priorUnpaid = await Payroll.find({
                company: companyObj,
                teacher: teacherObj,
                status: 'approved',
                month: { $lt: new Date(startDate) },
            }).select('netSalary').lean();
            openingBalance = priorUnpaid.reduce((s, p) => s + (p.netSalary || 0), 0);
        }

        // Only committed payrolls (approved or paid) appear in the statement.
        // Draft payrolls are preliminary calculations — not posted obligations.
        const payrolls = await Payroll.find({
            company: companyObj,
            teacher: teacherObj,
            status: { $in: ['approved', 'paid'] },
            ...(Object.keys(monthFilter).length ? { month: monthFilter } : {}),
        }).sort({ month: 1, createdAt: 1 }).lean();

        // Build entries: salary-due entry + payment entry (if paid) per payroll
        const entries = [];
        payrolls.forEach(payroll => {
            const monthLabel = new Date(payroll.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            // Salary obligation (credit — amount owed to teacher)
            entries.push({
                _id: `${payroll._id}-due`,
                date: payroll.month,
                type: 'salary_due',
                accountName: 'Salary Payable',
                description: `Salary — ${monthLabel} (${payroll.salaryType}, ${payroll.status})`,
                reference: String(payroll._id),
                debit: 0,
                credit: payroll.netSalary || 0,
            });

            // Payment (debit — money disbursed): use payroll.month NOT paidDate so it
            // always closes in the salary month even when paid in a later month.
            if (payroll.status === 'paid' && (payroll.netSalary || 0) > 0) {
                const isLate = payroll.paidDate &&
                    new Date(payroll.paidDate).getMonth() !== new Date(payroll.month).getMonth();
                const lateSuffix = isLate
                    ? ` (paid: ${new Date(payroll.paidDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })})`
                    : '';
                entries.push({
                    _id: `${payroll._id}-paid`,
                    date: payroll.month,          // accrual period — NOT paidDate
                    paidDate: payroll.paidDate,
                    type: 'salary_payment',
                    accountName: payroll.paymentMethod === 'Cash' ? 'Cash' : 'Bank',
                    description: `Salary Paid via ${payroll.paymentMethod || 'Cash'}${lateSuffix}`,
                    reference: payroll.paymentReference || String(payroll._id),
                    debit: payroll.netSalary || 0,
                    credit: 0,
                });
            }
        });

        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalDebit = 0;
        let totalCredit = 0;
        let runningBalance = openingBalance;

        const statement = entries.map(entry => {
            const dr = entry.debit || 0;
            const cr = entry.credit || 0;
            totalDebit += dr;
            totalCredit += cr;
            runningBalance += (cr - dr);
            return { ...entry, runningBalance: Number(runningBalance.toFixed(2)) };
        });

        const summary = {
            openingBalance,
            totalBills: totalCredit,
            totalPaid: totalDebit,
            closingBalance: openingBalance + totalCredit - totalDebit,
        };

        res.json({ entries: statement, summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getTrialBalance = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate } = req.query;

        const match = { company: new mongoose.Types.ObjectId(companyId) };
        if (startDate && endDate) {
            match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (endDate) {
            match.date = { $lte: new Date(endDate) };
        }

        const rows = await Ledger.aggregate([
            { $match: match },
            { $group: { _id: { accountName: '$accountName', accountType: '$accountType' }, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
            { $project: { _id: 0, accountName: '$_id.accountName', accountType: '$_id.accountType', debit: 1, credit: 1, net: { $subtract: ['$debit', '$credit'] } } }
        ]);

        const ORDER = { asset: 0, liability: 1, equity: 2, revenue: 3, expense: 4 };
        const data = rows
            .map(r => {
                const net = (r.debit || 0) - (r.credit || 0);
                return {
                    accountName: r.accountName,
                    accountType: r.accountType,
                    debitTotal: r.debit || 0,
                    creditTotal: r.credit || 0,
                    debitBalance: net > 0 ? net : 0,
                    creditBalance: net < 0 ? Math.abs(net) : 0
                };
            })
            .sort((a, b) => {
                const oa = ORDER[a.accountType] ?? 9;
                const ob = ORDER[b.accountType] ?? 9;
                if (oa !== ob) return oa - ob;
                return a.accountName.localeCompare(b.accountName);
            });

        const totals = data.reduce((acc, r) => {
            acc.debit += r.debitBalance;
            acc.credit += r.creditBalance;
            return acc;
        }, { debit: 0, credit: 0 });

        res.json({
            data,
            totals,
            isBalanced: Math.abs(totals.debit - totals.credit) < 0.05
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getGeneralLedgerReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate, accountName, accountType, studentId, teacherId, type, page, limit } = req.query;

        const query = { company: new mongoose.Types.ObjectId(companyId) };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        if (accountName && accountName !== 'all') query.accountName = accountName;
        if (accountType && accountType !== 'all') query.accountType = accountType;
        if (studentId) query.student = studentId;
        if (teacherId) query.teacher = teacherId;

        if (type && type !== 'all') {
            if (type === 'debit') query.debit = { $gt: 0 };
            if (type === 'credit') query.credit = { $gt: 0 };
        }

        const pageNum = page ? Number(page) : 1;
        const limitNum = limit ? Number(limit) : 0;
        const skip = limitNum > 0 ? (pageNum - 1) * limitNum : 0;

        let queryExec = Ledger.find(query)
            .select('date accountName description reference type debit credit student teacher createdAt accountType')
            .populate('student', 'name')
            .populate('teacher', 'name')
            .sort({ date: 1, createdAt: 1 })
            .lean();

        if (limitNum > 0) {
            queryExec = Ledger.find(query)
                .select('date accountName description reference type debit credit student teacher createdAt accountType')
                .populate('student', 'name')
                .populate('teacher', 'name')
                .sort({ date: 1, createdAt: 1 })
                .skip(skip)
                .limit(limitNum)
                .lean();
        }

        const [entries, total] = await Promise.all([
            queryExec,
            Ledger.countDocuments(query)
        ]);

        res.json({
            count: entries.length,
            total,
            page: pageNum,
            pages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
            data: entries
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Payments Received Report
// @route   GET /api/reports/payments/:companyId
// @access  Private/Admin
const getPaymentsReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate, studentId } = req.query;

        let allPayments = [];
        const start = startDate ? new Date(startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const fpQuery = { company: new mongoose.Types.ObjectId(companyId), status: 'active' };
        if (studentId) fpQuery.student = new mongoose.Types.ObjectId(studentId);
        if (start && end) fpQuery.paymentDate = { $gte: start, $lte: end };

        const feePayments = await FeePayment.find(fpQuery)
            .populate('student', 'name email contact')
            .populate('voucher', 'voucherNumber')
            .lean();

        feePayments.forEach(fp => {
            allPayments.push({
                _id: fp._id,
                feeId: fp.fee || null,
                feeNumber: fp.voucher?.voucherNumber || fp.paymentNumber || 'N/A',
                student: fp.student,
                date: fp.paymentDate,
                amount: fp.amount,
                method: fp.paymentMethod,
                reference: fp.referenceNumber || fp.transactionId || '',
                discount: fp.discountAmount || 0,
                cashReceived: fp.amount,
                description: `Fee Payment — Voucher #${fp.voucher?.voucherNumber || fp.paymentNumber}`
            });
        });

        const query = { company: new mongoose.Types.ObjectId(companyId) };
        if (studentId) query.student = new mongoose.Types.ObjectId(studentId);
        if (start && end) query["payments.date"] = { $gte: start, $lte: end };

        const fees = await Fee.find(query)
            .populate('student', 'name email contact')
            .lean();

        const feePaymentFeeIds = new Set(feePayments.map(fp => fp.fee?.toString()).filter(Boolean));
        const feePaymentVoucherIds = new Set(feePayments.map(fp => fp.voucher?._id?.toString() || fp.voucher?.toString()).filter(Boolean));

        for (const fee of fees) {
            if (feePaymentFeeIds.has(fee._id.toString())) continue;
            const linkedVoucher = fee.voucher?.toString?.() || '';
            if (linkedVoucher && feePaymentVoucherIds.has(linkedVoucher)) continue;

            (fee.payments || []).forEach(payment => {
                const payDate = new Date(payment.date);
                if ((!start || payDate >= start) && (!end || payDate <= end)) {
                    allPayments.push({
                        _id: payment._id,
                        feeId: fee._id,
                        feeNumber: fee.feeNumber,
                        student: fee.student,
                        date: payment.date,
                        amount: payment.amount,
                        method: payment.method,
                        reference: payment.reference,
                        discount: payment.discount,
                        cashReceived: payment.amount,
                        description: `Payment for Fee #${fee.feeNumber}`
                    });
                }
            });
        }

        allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(allPayments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Cash Flow Statement (Operating Activities from Ledger)
// @route   GET /api/reports/cash-flow/:companyId
const getCashFlowStatement = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate } = req.query;
        const companyObjectId = new mongoose.Types.ObjectId(companyId);

        const dateQuery = {};
        if (startDate && endDate) {
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            dateQuery.date = { $gte: start, $lte: end };
        }

        // Cash & Bank movements from Ledger
        const cashEntries = await Ledger.aggregate([
            { $match: { company: companyObjectId, accountName: { $in: ['Cash', 'Bank'] }, ...dateQuery } },
            { $group: {
                _id: '$accountName',
                inflow: { $sum: '$debit' },
                outflow: { $sum: '$credit' }
            }}
        ]);

        // Opening balance (before period)
        const openingCash = startDate ? await Ledger.aggregate([
            { $match: { company: companyObjectId, accountName: 'Cash', date: { $lt: new Date(startDate) } } },
            { $group: { _id: null, bal: { $sum: { $subtract: ['$debit', '$credit'] } } } }
        ]) : [];
        const openingBank = startDate ? await Ledger.aggregate([
            { $match: { company: companyObjectId, accountName: 'Bank', date: { $lt: new Date(startDate) } } },
            { $group: { _id: null, bal: { $sum: { $subtract: ['$debit', '$credit'] } } } }
        ]) : [];

        // Revenue collections (cash inflows from fee payments)
        const feeInflows = await Ledger.aggregate([
            { $match: { company: companyObjectId, accountName: { $in: ['Cash', 'Bank'] }, type: { $in: ['fee_payment', 'payment'] }, ...dateQuery } },
            { $group: { _id: '$type', total: { $sum: '$debit' } } }
        ]);

        // Expense outflows (cash paid for expenses, salary, etc.)
        const expenseOutflows = await Ledger.aggregate([
            { $match: { company: companyObjectId, accountName: { $in: ['Cash', 'Bank'] }, type: { $in: ['expense', 'payroll_payment', 'teacher_payment', 'purchase_payment'] }, ...dateQuery } },
            { $group: { _id: '$type', total: { $sum: '$credit' } } }
        ]);

        const cashEntry = cashEntries.find(e => e._id === 'Cash') || { inflow: 0, outflow: 0 };
        const bankEntry = cashEntries.find(e => e._id === 'Bank') || { inflow: 0, outflow: 0 };

        const totalInflow = (cashEntry.inflow || 0) + (bankEntry.inflow || 0);
        const totalOutflow = (cashEntry.outflow || 0) + (bankEntry.outflow || 0);
        const netCashFlow = totalInflow - totalOutflow;

        const openCash = openingCash.length ? openingCash[0].bal : 0;
        const openBank = openingBank.length ? openingBank[0].bal : 0;

        res.json({
            openingCash: Number(openCash.toFixed(2)),
            openingBank: Number(openBank.toFixed(2)),
            openingBalance: Number((openCash + openBank).toFixed(2)),
            cashInflows: { cash: cashEntry.inflow, bank: bankEntry.inflow, total: totalInflow },
            cashOutflows: { cash: cashEntry.outflow, bank: bankEntry.outflow, total: totalOutflow },
            netCashFlow: Number(netCashFlow.toFixed(2)),
            closingCash: Number((openCash + cashEntry.inflow - cashEntry.outflow).toFixed(2)),
            closingBank: Number((openBank + bankEntry.inflow - bankEntry.outflow).toFixed(2)),
            closingBalance: Number((openCash + openBank + netCashFlow).toFixed(2)),
            feeInflows: feeInflows.map(f => ({ type: f._id, amount: Number(f.total.toFixed(2)) })),
            expenseOutflows: expenseOutflows.map(e => ({ type: e._id, amount: Number(e.total.toFixed(2)) }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc  One-time cleanup: reverse historical duplicate Fee Revenue credits.
 *        When a voucher payment was collected against a pre-existing Fee record,
 *        the old code incorrectly posted Dr Cash / Cr Fee Revenue (double-crediting
 *        revenue that was already recognised at invoice creation).
 *        This endpoint finds those bad entries, reverses them, and posts the
 *        correct Dr Cash / Cr Accounts Receivable settlement journals.
 * @route POST /api/reports/admin/purge-duplicate-fee-revenue/:companyId
 * @access SuperAdmin only
 */
const purgeDoubleFeeRevenueEntries = async (req, res) => {
    try {
        const { companyId } = req.params;
        const companyObjectId = new mongoose.Types.ObjectId(companyId);

        // Find all FeePayment records that have a linked Fee (pre-existing fee)
        const linkedPayments = await FeePayment.find({
            company: companyId,
            fee: { $ne: null },
        }).lean();

        if (linkedPayments.length === 0) {
            return res.json({ message: 'No linked payments found — nothing to clean up.', purged: 0 });
        }

        let purgedCount = 0;
        const errors = [];

        for (const pmt of linkedPayments) {
            try {
                // Find the bad Ledger entry: Fee Revenue credit posted with referenceType 'fee_payment'
                // for this specific payment (referenceId = pmt._id)
                const badEntries = await Ledger.find({
                    company: companyObjectId,
                    referenceType: 'fee_payment',
                    accountName: 'Fee Revenue',
                    credit: { $gt: 0 },
                    $or: [
                        { referenceId: pmt._id },
                        { fee: pmt.fee },
                    ],
                }).lean();

                if (badEntries.length === 0) continue;

                // Reverse each bad Fee Revenue credit with a debit (contra entry)
                for (const bad of badEntries) {
                    const reversal = new Ledger({
                        company: companyObjectId,
                        student: bad.student,
                        fee: bad.fee,
                        referenceType: 'adjustment',
                        referenceId: bad._id,
                        reference: `CLEANUP-REV-${bad._id}`,
                        journalId: `cleanup-${bad._id}`,
                        date: new Date(),
                        description: `[Cleanup] Reverse duplicate Fee Revenue — orig entry ${bad._id}`,
                        debit: bad.credit,
                        credit: 0,
                        type: 'adjustment',
                        accountName: 'Fee Revenue',
                        accountType: 'revenue',
                        relatedAccount: 'Accounts Receivable',
                        balance: 0,
                    });
                    await reversal.save();

                    // Post matching Cr Accounts Receivable to restore proper balance
                    const arCredit = new Ledger({
                        company: companyObjectId,
                        student: bad.student,
                        fee: bad.fee,
                        referenceType: 'adjustment',
                        referenceId: bad._id,
                        reference: `CLEANUP-AR-${bad._id}`,
                        journalId: `cleanup-${bad._id}`,
                        date: new Date(),
                        description: `[Cleanup] Restore AR settlement — orig entry ${bad._id}`,
                        debit: 0,
                        credit: bad.credit,
                        type: 'adjustment',
                        accountName: 'Accounts Receivable',
                        accountType: 'asset',
                        relatedAccount: 'Fee Revenue',
                        balance: 0,
                    });
                    await arCredit.save();
                    purgedCount++;
                }
            } catch (err) {
                errors.push({ paymentId: pmt._id, error: err.message });
            }
        }

        return res.json({
            message: `Cleanup complete. Reversed ${purgedCount} duplicate Fee Revenue entries.`,
            purged: purgedCount,
            errors,
        });
    } catch (error) {
        console.error('[purgeDoubleFeeRevenueEntries]', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cross-validate all fee totals across every data source
// @route   GET /api/reports/validate/:companyId
// @access  Private/Admin
// Returns OK if all sources agree; lists every mismatch if not.
const getFinancialValidation = async (req, res) => {
    try {
        const { companyId } = req.params;
        const C = new mongoose.Types.ObjectId(companyId);

        const [feeAgg, fpAgg, fvAgg, ledgerFeeRev, ledgerCashBank] = await Promise.all([
            Fee.aggregate([{ $match: { company: C, status: { $ne: 'cancelled' } } }, { $group: { _id: null, totalInvoiced: { $sum: '$totalAmount' }, totalPaid: { $sum: '$paidAmount' }, totalDue: { $sum: '$balanceDue' } } }]),
            FeePayment.aggregate([{ $match: { company: C, status: 'active' } }, { $group: { _id: null, totalCash: { $sum: '$amount' }, totalDiscount: { $sum: '$discountAmount' }, count: { $sum: 1 } } }]),
            FeeVoucher.aggregate([{ $match: { company: C, status: { $ne: 'cancelled' } } }, { $group: { _id: null, totalFee: { $sum: '$totalFee' }, totalPaid: { $sum: '$paidAmount' } } }]),
            Ledger.aggregate([{ $match: { company: C, accountName: 'Fee Revenue' } }, { $group: { _id: null, net: { $sum: { $subtract: ['$credit', '$debit'] } } } }]),
            Ledger.aggregate([{ $match: { company: C, accountName: { $in: ['Cash', 'Bank'] }, accountType: 'asset' } }, { $group: { _id: null, net: { $sum: { $subtract: ['$debit', '$credit'] } } } }]),
        ]);

        const sources = {
            fee_totalInvoiced:   feeAgg[0]?.totalInvoiced  || 0,
            fee_totalPaid:       feeAgg[0]?.totalPaid       || 0,
            fee_totalDue:        feeAgg[0]?.totalDue        || 0,
            feePayment_cash:     fpAgg[0]?.totalCash        || 0,
            feePayment_discount: fpAgg[0]?.totalDiscount    || 0,
            feePayment_count:    fpAgg[0]?.count            || 0,
            voucher_totalFee:    fvAgg[0]?.totalFee         || 0,
            voucher_paidAmount:  fvAgg[0]?.totalPaid        || 0,
            ledger_feeRevenue:   ledgerFeeRev[0]?.net       || 0,
            ledger_cashBank:     ledgerCashBank[0]?.net     || 0,
        };

        const mismatches = [];
        const tol = 0.01;

        // Fee model vs FeeVoucher — both represent billed amounts
        if (Math.abs(sources.fee_totalInvoiced - sources.voucher_totalFee) > tol) {
            mismatches.push({ check: 'Fee.totalAmount vs FeeVoucher.totalFee', a: sources.fee_totalInvoiced, b: sources.voucher_totalFee, diff: sources.fee_totalInvoiced - sources.voucher_totalFee });
        }
        // Fee.paidAmount vs FeePayment.amount — both should equal cash collected
        if (Math.abs(sources.fee_totalPaid - sources.feePayment_cash) > tol) {
            mismatches.push({ check: 'Fee.paidAmount vs FeePayment.amount', a: sources.fee_totalPaid, b: sources.feePayment_cash, diff: sources.fee_totalPaid - sources.feePayment_cash });
        }
        // FeeVoucher.paidAmount vs FeePayment.amount
        if (Math.abs(sources.voucher_paidAmount - sources.feePayment_cash) > tol) {
            mismatches.push({ check: 'FeeVoucher.paidAmount vs FeePayment.amount', a: sources.voucher_paidAmount, b: sources.feePayment_cash, diff: sources.voucher_paidAmount - sources.feePayment_cash });
        }
        // Ledger Cash+Bank vs FeePayment.amount — cash in bank must equal cash received
        if (Math.abs(sources.ledger_cashBank - sources.feePayment_cash) > tol) {
            mismatches.push({ check: 'Ledger Cash+Bank vs FeePayment.amount', a: sources.ledger_cashBank, b: sources.feePayment_cash, diff: sources.ledger_cashBank - sources.feePayment_cash });
        }
        // Ledger Fee Revenue vs FeeVoucher.totalFee — ledger should match billing
        if (Math.abs(sources.ledger_feeRevenue - sources.voucher_totalFee) > tol) {
            mismatches.push({ check: 'Ledger Fee Revenue vs FeeVoucher.totalFee (INCOMPLETE LEDGER)', a: sources.ledger_feeRevenue, b: sources.voucher_totalFee, diff: sources.ledger_feeRevenue - sources.voucher_totalFee, note: 'Ledger accrual entries are incomplete. P&L and Dashboard now use FeeVoucher as canonical source.' });
        }

        res.json({
            status: mismatches.length === 0 ? 'OK' : 'MISMATCH_DETECTED',
            sources,
            mismatches,
            canonical: {
                feeBilled:    sources.voucher_totalFee,
                cashCollected: sources.feePayment_cash,
                discountGiven: sources.feePayment_discount,
                outstanding:  Math.max(0, sources.voucher_totalFee - sources.feePayment_cash - sources.feePayment_discount),
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export {
    getRevenueReport,
    getReceivablesReport,
    getReceivablesAgingReport,
    getPayablesAgingReport,
    getRevenueDetailReport,
    getPurchasesDetailReport,
    getProfitAndLoss,
    getBalanceSheet,
    getDashboardSummary,
    getDashboardChartData,
    getStudentStatement,
    getTeacherStatement,
    getTrialBalance,
    getGeneralLedgerReport,
    getPaymentsReport,
    getCashFlowStatement,
    purgeDoubleFeeRevenueEntries,
    getFinancialValidation,
};
