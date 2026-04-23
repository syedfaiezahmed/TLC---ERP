import Fee from '../models/Fee.js';
import FeePayment from '../models/FeePayment.js';
import FeeVoucher from '../models/FeeVoucher.js';
import Student from '../models/Student.js';
import StudentEnrollment from '../models/StudentEnrollment.js';
import Course from '../models/Course.js';
import Batch from '../models/Batch.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { getCache, setCache, makeKey } from '../utils/cache.js';

// @desc    Get Comprehensive Fee Collection Report
// @route   GET /api/reports/fee-collection/:companyId
// @access  Private/Admin/Accountant
const getFeeCollectionReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { 
            startDate, 
            endDate, 
            studentId, 
            courseId, 
            batchId, 
            status,
            page = 1, 
            limit = 50 
        } = req.query;

        const cacheKey = makeKey('fee-collection', { companyId, ...req.query });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        // Always filter active payments only — FeePayment.status is 'active'|'cancelled'|'refunded'
        // The UI's 'paid/unpaid/partial' reflects Fee/Voucher status, not FeePayment status.
        // We apply it below after the fee $lookup instead.
        const matchStage = { company: companyObjectId, status: 'active' };

        // Date filtering — endDate must cover full day (set to 23:59:59 local)
        if (startDate && endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matchStage.paymentDate = {
                $gte: new Date(startDate),
                $lte: endOfDay
            };
        } else if (startDate) {
            matchStage.paymentDate = { $gte: new Date(startDate) };
        } else if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matchStage.paymentDate = { $lte: endOfDay };
        }

        // Additional filters
        if (studentId) matchStage.student = new mongoose.Types.ObjectId(studentId);

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'students',
                    localField: 'student',
                    foreignField: '_id',
                    as: 'student'
                }
            },
            { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'fees',
                    localField: 'fee',
                    foreignField: '_id',
                    as: 'fee'
                }
            },
            { $unwind: { path: '$fee', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'feevouchers',
                    localField: 'voucher',
                    foreignField: '_id',
                    as: 'voucher'
                }
            },
            { $unwind: { path: '$voucher', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'receivedBy',
                    foreignField: '_id',
                    as: 'receivedBy'
                }
            },
            { $unwind: { path: '$receivedBy', preserveNullAndEmptyArrays: true } }
        ];

        // Status filter — applied on the fee's status after fee $lookup
        if (status) {
            // Map UI status values (voucher-centric) to Fee model status values
            const feeStatusMap = { paid: 'paid', unpaid: 'unpaid', pending: 'unpaid', partial: 'partial', overdue: 'unpaid' };
            const feeStatus = feeStatusMap[status];
            if (feeStatus) pipeline.push({ $match: { 'fee.status': feeStatus } });
        }

        // Course and Batch filtering
        // IMPORTANT: After student $lookup+$unwind, student field is an object.
        // Use student._id as localField, and match on enrollment.course / enrollment.batch.
        if (courseId || batchId) {
            const enrollmentMatch = {};
            if (courseId) enrollmentMatch['enrollment.course'] = new mongoose.Types.ObjectId(courseId);
            if (batchId) enrollmentMatch['enrollment.batch'] = new mongoose.Types.ObjectId(batchId);

            pipeline.push({
                $lookup: {
                    from: 'studentenrollments',
                    localField: 'student._id',   // student is an object after $unwind
                    foreignField: 'student',
                    as: 'enrollment'
                }
            });
            pipeline.push({ $unwind: { path: '$enrollment', preserveNullAndEmptyArrays: false } });
            pipeline.push({ $match: enrollmentMatch });
        }

        pipeline.push(
            {
                $project: {
                    paymentNumber: 1,
                    paymentDate: 1,
                    amount: 1,
                    paymentMethod: 1,
                    referenceNumber: 1,
                    lateFeeAmount: 1,
                    discountAmount: 1,
                    status: 1,
                    'student.name': 1,
                    'student.rollNumber': 1,
                    'student.contact': 1,
                    'fee.feeNumber': 1,
                    'fee.dueDate': 1,
                    'fee.totalAmount': 1,
                    'fee.status': 1,
                    'voucher.voucherNumber': 1,
                    'receivedBy.name': 1
                }
            },
            { $sort: { paymentDate: -1 } }
        );

        // Use $facet to get paginated data AND total count in one pass
        const facetPipeline = [
            ...pipeline,
            {
                $facet: {
                    data: [
                        { $skip: (parseInt(page) - 1) * parseInt(limit) },
                        { $limit: parseInt(limit) }
                    ],
                    totalCount: [{ $count: 'count' }]
                }
            }
        ];

        const [facetResult] = await FeePayment.aggregate(facetPipeline);
        const payments = facetResult?.data || [];
        const totalCount = facetResult?.totalCount?.[0]?.count || 0;

        // CA-correct summary: aggregate over ALL matching records, not just current page.
        // `amount` is cash actually received (what hits bank/cash). Discount is separately tracked.
        // grossBilled = what student was charged (cash + discount waived).
        const summaryPipeline = [...pipeline.filter(s => !s.$sort), {
            $group: {
                _id: null,
                totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
                totalLateFee: { $sum: { $ifNull: ['$lateFeeAmount', 0] } },
                totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
                totalPayments: { $sum: 1 },
            }
        }];
        const [summaryAgg] = await FeePayment.aggregate(summaryPipeline);
        const agg = summaryAgg || { totalAmount: 0, totalLateFee: 0, totalDiscount: 0, totalPayments: 0 };

        const result = {
            payments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            },
            summary: {
                totalAmount: agg.totalAmount,         // Cash received
                totalLateFee: agg.totalLateFee,       // Late fee collected (subset of cash)
                totalDiscount: agg.totalDiscount,     // Discount given (not cash)
                netCollection: agg.totalAmount,       // Same as totalAmount — cash that hit accounts
                grossBilled: agg.totalAmount + agg.totalDiscount, // Accrual view: total charged to students
                totalPayments: agg.totalPayments,
                averagePayment: agg.totalPayments > 0 ? agg.totalAmount / agg.totalPayments : 0
            },
            filters: {
                startDate,
                endDate,
                studentId,
                courseId,
                batchId,
                status
            }
        };

        setCache(cacheKey, result, 300); // Cache for 5 minutes
        res.json(result);

    } catch (error) {
        console.error('Error in getFeeCollectionReport:', error);
        res.status(500).json({ 
            message: 'Failed to fetch fee collection report',
            error: error.message 
        });
    }
};

// @desc    Get Pending Fees Report
// @route   GET /api/reports/pending-fees/:companyId
// @access  Private/Admin/Accountant
// CA-correct: uses FeeVoucher as source of truth (matches Fee Management workflow).
// Heals vouchers first so data is never stale. Net due = totalFee − (paidAmount + paymentDiscount).
const getPendingFeesReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const {
            asOfDate,
            studentId,
            overdueOnly,
            page = 1,
            limit = 50
        } = req.query;

        const cacheKey = makeKey('pending-fees', { companyId, ...req.query });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        const asOf = asOfDate ? new Date(asOfDate) : new Date();

        // Heal voucher statuses first so pending report is never stale.
        try {
            const { healVoucherStatuses } = await import('../services/voucherHealService.js');
            await healVoucherStatuses(companyId);
        } catch (healErr) {
            console.warn('[getPendingFeesReport] heal skipped:', healErr.message);
        }

        // Match unpaid vouchers (pending/partial/overdue) with positive balance.
        const matchStage = {
            company: companyObjectId,
            status: { $in: ['pending', 'partial', 'overdue'] },
        };
        if (studentId) matchStage.student = new mongoose.Types.ObjectId(studentId);
        if (overdueOnly === 'true') matchStage.dueDate = { $lt: asOf };

        const basePipeline = [
            { $match: matchStage },
            {
                $addFields: {
                    effectivePaid: {
                        $add: [
                            { $ifNull: ['$paidAmount', 0] },
                            { $ifNull: ['$paymentDiscountTotal', 0] },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    balanceDue: {
                        $max: [0, { $subtract: [{ $ifNull: ['$totalFee', 0] }, '$effectivePaid'] }],
                    },
                    isOverdue: { $lt: ['$dueDate', asOf] },
                    daysOverdue: {
                        $cond: {
                            if: { $lt: ['$dueDate', asOf] },
                            then: { $floor: { $divide: [{ $subtract: [asOf, '$dueDate'] }, 1000 * 60 * 60 * 24] } },
                            else: 0,
                        },
                    },
                },
            },
            // Keep only truly pending: balance due > 0 after settlement.
            { $match: { balanceDue: { $gt: 0 } } },
            {
                $lookup: {
                    from: 'students',
                    localField: 'student',
                    foreignField: '_id',
                    as: 'student',
                },
            },
            { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    voucherNumber: 1,
                    feeMonth: 1,
                    dueDate: 1,
                    totalFee: 1,
                    paidAmount: 1,
                    paymentDiscountTotal: 1,
                    effectivePaid: 1,
                    balanceDue: 1,
                    status: 1,
                    lateFeeAmount: 1,
                    isOverdue: 1,
                    daysOverdue: 1,
                    'student._id': 1,
                    'student.name': 1,
                    'student.studentId': 1,
                    'student.contact': 1,
                    'student.email': 1,
                },
            },
            { $sort: { dueDate: 1 } },
        ];

        // Paginated data + full-dataset summary in parallel.
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 50;

        const dataPipeline = [
            ...basePipeline,
            {
                $facet: {
                    data: [
                        { $skip: (pageNum - 1) * limitNum },
                        { $limit: limitNum },
                    ],
                    totalCount: [{ $count: 'count' }],
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalFees: { $sum: { $ifNull: ['$totalFee', 0] } },
                                totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
                                totalDiscount: { $sum: { $ifNull: ['$paymentDiscountTotal', 0] } },
                                totalPending: { $sum: '$balanceDue' },
                                totalLateFee: { $sum: { $ifNull: ['$lateFeeAmount', 0] } },
                                overdueCount: {
                                    $sum: { $cond: ['$isOverdue', 1, 0] },
                                },
                                overdueAmount: {
                                    $sum: { $cond: ['$isOverdue', '$balanceDue', 0] },
                                },
                                totalVouchers: { $sum: 1 },
                            },
                        },
                    ],
                },
            },
        ];

        const [facetResult] = await FeeVoucher.aggregate(dataPipeline);
        const pendingFees = facetResult?.data || [];
        const totalCount = facetResult?.totalCount?.[0]?.count || 0;
        const summaryAgg = facetResult?.summary?.[0] || {};

        const summary = {
            totalFees: summaryAgg.totalFees || 0,
            totalPaid: summaryAgg.totalPaid || 0,
            totalDiscount: summaryAgg.totalDiscount || 0,
            totalPending: summaryAgg.totalPending || 0,
            totalLateFee: summaryAgg.totalLateFee || 0,
            overdueCount: summaryAgg.overdueCount || 0,
            overdueAmount: summaryAgg.overdueAmount || 0,
            totalPendingFees: summaryAgg.totalVouchers || 0,
            overduePercentage: summaryAgg.totalFees > 0
                ? (summaryAgg.overdueAmount / summaryAgg.totalFees) * 100
                : 0,
        };

        const result = {
            pendingFees,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                pages: Math.ceil(totalCount / limitNum),
            },
            summary,
            asOfDate: asOf,
            filters: { asOfDate, studentId, overdueOnly },
        };

        setCache(cacheKey, result, 300);
        res.json(result);

    } catch (error) {
        console.error('Error in getPendingFeesReport:', error);
        res.status(500).json({
            message: 'Failed to fetch pending fees report',
            error: error.message,
        });
    }
};

// @desc    Get Student Ledger Report
// @route   GET /api/reports/student-ledger/:companyId/:studentId
// @access  Private/Admin/Accountant
// CA-correct: uses FeeVoucher (debits) + FeePayment (credits for cash, and credits for discount/contra-revenue).
// Running balance = total charged − total (paid + discounted).
const getStudentLedgerReport = async (req, res) => {
    try {
        const { companyId, studentId } = req.params;
        const { startDate, endDate } = req.query;

        const cacheKey = makeKey('student-ledger', { companyId, studentId, ...req.query });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        const studentObjectId = new mongoose.Types.ObjectId(studentId);

        // Get student information
        const student = await Student.findOne({
            _id: studentObjectId,
            company: companyObjectId
        }).populate('courses course').populate('batches batch');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const dateInRange = (dateField, qStart, qEnd) => {
            const clause = {};
            if (qStart) clause.$gte = new Date(qStart);
            if (qEnd) clause.$lte = new Date(qEnd);
            return Object.keys(clause).length ? { [dateField]: clause } : {};
        };

        // Heal vouchers first so statuses/paid amounts are fresh.
        try {
            const { healVoucherStatuses } = await import('../services/voucherHealService.js');
            await healVoucherStatuses(companyId);
        } catch (_) { /* non-fatal */ }

        // ── DEBITS: Vouchers generated for the student (invoices) ────────────
        const voucherMatch = {
            company: companyObjectId,
            student: studentObjectId,
            status: { $ne: 'cancelled' },
            ...dateInRange('generatedDate', startDate, endDate),
        };
        const vouchers = await FeeVoucher.find(voucherMatch).sort({ generatedDate: 1 }).lean();

        // ── CREDITS: Active payments (cash received) ─────────────────────────
        const paymentMatch = {
            company: companyObjectId,
            student: studentObjectId,
            status: 'active',
            ...dateInRange('paymentDate', startDate, endDate),
        };
        const payments = await FeePayment.find(paymentMatch)
            .populate('receivedBy', 'name')
            .sort({ paymentDate: 1 })
            .lean();

        // ── Build unified ledger ─────────────────────────────────────────────
        const transactions = [];

        vouchers.forEach(v => {
            transactions.push({
                date: v.generatedDate,
                type: 'voucher',
                description: `Voucher #${v.voucherNumber || v._id} — ${v.feeMonth ? new Date(v.feeMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Fee'}`,
                reference: v.voucherNumber,
                debit: v.totalFee || 0,
                credit: 0,
                balance: 0,
                status: v.status,
                dueDate: v.dueDate,
            });
        });

        payments.forEach(p => {
            // Cash payment credit (reduces receivable)
            transactions.push({
                date: p.paymentDate,
                type: 'payment',
                description: `Payment #${p.paymentNumber} via ${p.paymentMethod}`,
                reference: p.paymentNumber,
                debit: 0,
                credit: p.amount || 0,
                balance: 0,
                method: p.paymentMethod,
                receivedBy: p.receivedBy?.name,
            });
            // Discount allowed is a contra-revenue credit that also reduces receivable.
            if (Number(p.discountAmount) > 0) {
                transactions.push({
                    date: p.paymentDate,
                    type: 'discount',
                    description: `Discount allowed on ${p.paymentNumber}${p.discountReason ? ` — ${p.discountReason}` : ''}`,
                    reference: p.paymentNumber,
                    debit: 0,
                    credit: p.discountAmount,
                    balance: 0,
                });
            }
        });

        // Sort by date (stable) and compute running balance.
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = 0;
        transactions.forEach(t => {
            runningBalance += (t.debit || 0) - (t.credit || 0);
            t.balance = runningBalance;
        });

        // ── Summary ──────────────────────────────────────────────────────────
        const totalBilled = vouchers.reduce((s, v) => s + (v.totalFee || 0), 0);
        const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
        const totalDiscount = payments.reduce((s, p) => s + (p.discountAmount || 0), 0);
        const totalPending = Math.max(0, totalBilled - totalPaid - totalDiscount);

        const nextDueVoucher = vouchers
            .filter(v => v.status !== 'paid')
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

        const summary = {
            totalFees: totalBilled,          // total invoiced (debits)
            totalPaid,                        // cash received
            totalDiscount,                    // discounts allowed
            totalPending,                     // remaining receivable
            feeCount: vouchers.length,
            paymentCount: payments.length,
            lastPaymentDate: payments.length > 0 ? payments[payments.length - 1].paymentDate : null,
            nextDueDate: nextDueVoucher?.dueDate || null,
        };

        const result = {
            student: {
                _id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                studentId: student.studentId,
                contact: student.contact,
                email: student.email,
                courses: student.courses,
                batches: student.batches,
            },
            transactions,
            summary,
            reportPeriod: {
                startDate,
                endDate,
                generatedOn: new Date(),
            },
        };

        setCache(cacheKey, result, 300);
        res.json(result);

    } catch (error) {
        console.error('Error in getStudentLedgerReport:', error);
        res.status(500).json({
            message: 'Failed to fetch student ledger report',
            error: error.message,
        });
    }
};

// @desc    Get Daily/Monthly Summary Report
// @route   GET /api/reports/summary/:companyId
// @access  Private/Admin/Accountant
const getSummaryReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { 
            startDate, 
            endDate, 
            groupBy = 'day', // day, week, month
            includePending = true 
        } = req.query;

        const cacheKey = makeKey('summary', { companyId, ...req.query });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        const now = new Date();
        const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const end = endDate ? new Date(endDate) : now;
        end.setHours(23, 59, 59, 999);

        // Heal vouchers first for accurate pending amounts.
        try {
            const { healVoucherStatuses } = await import('../services/voucherHealService.js');
            await healVoucherStatuses(companyId);
        } catch (_) { /* non-fatal */ }

        // Payment aggregation (cash collected)
        const paymentPipeline = [
            {
                $match: {
                    company: companyObjectId,
                    paymentDate: { $gte: start, $lte: end },
                    status: 'active'
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$paymentDate' },
                        month: { $month: '$paymentDate' },
                        day: groupBy === 'day' ? { $dayOfMonth: '$paymentDate' } :
                             groupBy === 'week' ? { $week: '$paymentDate' } : null
                    },
                    totalAmount: { $sum: '$amount' },
                    totalLateFee: { $sum: { $ifNull: ['$lateFeeAmount', 0] } },
                    totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
                    paymentCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ];

        const paymentSummary = await FeePayment.aggregate(paymentPipeline);

        // Voucher-generation aggregation (fees INVOICED)
        const voucherPipeline = [
            {
                $match: {
                    company: companyObjectId,
                    generatedDate: { $gte: start, $lte: end },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$generatedDate' },
                        month: { $month: '$generatedDate' },
                        day: groupBy === 'day' ? { $dayOfMonth: '$generatedDate' } :
                             groupBy === 'week' ? { $week: '$generatedDate' } : null
                    },
                    totalFees: { $sum: { $ifNull: ['$totalFee', 0] } },
                    feeCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ];

        const feeSummary = await FeeVoucher.aggregate(voucherPipeline);

        // Combine data
        const summaryData = {};
        const blank = (key) => ({
            period: key, totalFees: 0, totalCollected: 0, totalLateFee: 0, totalDiscount: 0,
            netCollection: 0, feeCount: 0, paymentCount: 0, pendingAmount: 0,
        });

        // Process payment data (cash is `amount` — NOT amount−discount)
        paymentSummary.forEach(item => {
            const key = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}-${item._id.day?.toString().padStart(2, '0') || '01'}`;
            const row = summaryData[key] || blank(key);
            row.totalCollected = item.totalAmount;
            row.totalLateFee = item.totalLateFee;
            row.totalDiscount = item.totalDiscount;
            row.netCollection = item.totalAmount;   // Cash actually received
            row.paymentCount = item.paymentCount;
            summaryData[key] = row;
        });

        // Process fee data
        feeSummary.forEach(item => {
            const key = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}-${item._id.day?.toString().padStart(2, '0') || '01'}`;
            const row = summaryData[key] || blank(key);
            row.totalFees = item.totalFees;
            row.feeCount = item.feeCount;
            summaryData[key] = row;
        });

        // Pending amount (outstanding receivable) by generation period
        if (includePending === 'true') {
            const pendingMatch = {
                company: companyObjectId,
                status: { $in: ['pending', 'partial', 'overdue'] },
            };
            if (startDate && endDate) {
                pendingMatch.generatedDate = { $gte: start, $lte: end };
            }

            const pendingVouchers = await FeeVoucher.find(pendingMatch, {
                generatedDate: 1, totalFee: 1, paidAmount: 1, paymentDiscountTotal: 1,
            }).lean();

            pendingVouchers.forEach(v => {
                const d = new Date(v.generatedDate);
                const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                const effectivePaid = (v.paidAmount || 0) + (v.paymentDiscountTotal || 0);
                const balanceDue = Math.max(0, (v.totalFee || 0) - effectivePaid);
                if (!summaryData[key]) summaryData[key] = blank(key);
                summaryData[key].pendingAmount += balanceDue;
            });
        }

        const result = {
            summary: Object.values(summaryData),
            totals: {
                totalFees: Object.values(summaryData).reduce((sum, item) => sum + item.totalFees, 0),
                totalCollected: Object.values(summaryData).reduce((sum, item) => sum + item.totalCollected, 0),
                totalLateFee: Object.values(summaryData).reduce((sum, item) => sum + item.totalLateFee, 0),
                totalDiscount: Object.values(summaryData).reduce((sum, item) => sum + item.totalDiscount, 0),
                netCollection: Object.values(summaryData).reduce((sum, item) => sum + item.netCollection, 0),
                totalPending: Object.values(summaryData).reduce((sum, item) => sum + item.pendingAmount, 0),
                totalFeeCount: Object.values(summaryData).reduce((sum, item) => sum + item.feeCount, 0),
                totalPaymentCount: Object.values(summaryData).reduce((sum, item) => sum + item.paymentCount, 0)
            },
            period: {
                startDate,
                endDate,
                groupBy
            }
        };

        setCache(cacheKey, result, 300);
        res.json(result);

    } catch (error) {
        console.error('Error in getSummaryReport:', error);
        res.status(500).json({ 
            message: 'Failed to fetch summary report',
            error: error.message 
        });
    }
};

// @desc    Get Voucher Report
// @route   GET /api/reports/vouchers/:companyId
// @access  Private/Admin/Accountant
const getVoucherReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { 
            startDate, 
            endDate, 
            status,
            studentId,
            page = 1, 
            limit = 50 
        } = req.query;

        const cacheKey = makeKey('voucher-report', { companyId, ...req.query });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        const matchStage = { company: companyObjectId };

        if (startDate && endDate) {
            const vs = new Date(startDate); vs.setHours(0, 0, 0, 0);
            const ve = new Date(endDate); ve.setHours(23, 59, 59, 999);
            matchStage.dueDate = { $gte: vs, $lte: ve };
        }

        if (status) matchStage.status = status;
        if (studentId) matchStage.student = new mongoose.Types.ObjectId(studentId);

        // Heal for accurate statuses/paid amounts.
        try {
            const { healVoucherStatuses } = await import('../services/voucherHealService.js');
            await healVoucherStatuses(companyId);
        } catch (_) { /* non-fatal */ }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 50;

        const pipeline = [
            { $match: matchStage },
            {
                $addFields: {
                    effectivePaid: {
                        $add: [
                            { $ifNull: ['$paidAmount', 0] },
                            { $ifNull: ['$paymentDiscountTotal', 0] },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    balanceDue: {
                        $max: [0, { $subtract: [{ $ifNull: ['$totalFee', 0] }, '$effectivePaid'] }],
                    },
                },
            },
            {
                $lookup: {
                    from: 'students',
                    localField: 'student',
                    foreignField: '_id',
                    as: 'student',
                },
            },
            { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    voucherNumber: 1,
                    status: 1,
                    createdAt: 1,
                    generatedDate: 1,
                    feeMonth: 1,
                    dueDate: 1,
                    totalFee: 1,
                    paidAmount: 1,
                    paymentDiscountTotal: 1,
                    effectivePaid: 1,
                    balanceDue: 1,
                    lateFeeAmount: 1,
                    'student._id': 1,
                    'student.name': 1,
                    'student.studentId': 1,
                    'student.contact': 1,
                },
            },
            { $sort: { createdAt: -1 } },
        ];

        const dataPipeline = [
            ...pipeline,
            {
                $facet: {
                    data: [
                        { $skip: (pageNum - 1) * limitNum },
                        { $limit: limitNum },
                    ],
                    totalCount: [{ $count: 'count' }],
                    summary: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalFee: { $sum: { $ifNull: ['$totalFee', 0] } },
                                totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
                                totalDiscount: { $sum: { $ifNull: ['$paymentDiscountTotal', 0] } },
                                totalBalance: { $sum: '$balanceDue' },
                            },
                        },
                    ],
                },
            },
        ];

        const [facetResult] = await FeeVoucher.aggregate(dataPipeline);
        const vouchers = facetResult?.data || [];
        const totalCount = facetResult?.totalCount?.[0]?.count || 0;
        const byStatus = facetResult?.summary || [];

        const summary = {
            totalVouchers: 0,
            totalAmount: 0,          // totalFee across all matched
            totalPaid: 0,            // cash received
            totalDiscount: 0,        // discount allowed
            totalPending: 0,         // remaining receivable
            paidVouchers: 0,
            partialVouchers: 0,
            unpaidVouchers: 0,
            overdueVouchers: 0,
            cancelledVouchers: 0,
        };
        for (const s of byStatus) {
            summary.totalVouchers += s.count;
            if (s._id !== 'cancelled') {
                summary.totalAmount += s.totalFee || 0;
                summary.totalPaid += s.totalPaid || 0;
                summary.totalDiscount += s.totalDiscount || 0;
                summary.totalPending += s.totalBalance || 0;
            }
            if (s._id === 'paid') summary.paidVouchers = s.count;
            else if (s._id === 'partial') summary.partialVouchers = s.count;
            else if (s._id === 'overdue') summary.overdueVouchers = s.count;
            else if (s._id === 'cancelled') summary.cancelledVouchers = s.count;
            else summary.unpaidVouchers += s.count; // pending
        }

        const result = {
            vouchers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            },
            summary,
            filters: {
                startDate,
                endDate,
                status,
                studentId
            }
        };

        setCache(cacheKey, result, 300);
        res.json(result);

    } catch (error) {
        console.error('Error in getVoucherReport:', error);
        res.status(500).json({ 
            message: 'Failed to fetch voucher report',
            error: error.message 
        });
    }
};

export {
    getFeeCollectionReport,
    getPendingFeesReport,
    getStudentLedgerReport,
    getSummaryReport,
    getVoucherReport
};
