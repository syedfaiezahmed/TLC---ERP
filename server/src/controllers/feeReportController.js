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
        const matchStage = { company: companyObjectId, status: status || 'active' };

        // Date filtering
        if (startDate && endDate) {
            matchStage.paymentDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (startDate) {
            matchStage.paymentDate = { $gte: new Date(startDate) };
        } else if (endDate) {
            matchStage.paymentDate = { $lte: new Date(endDate) };
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

        // Course and Batch filtering
        if (courseId || batchId) {
            const enrollmentMatch = {};
            if (courseId) enrollmentMatch.course = new mongoose.Types.ObjectId(courseId);
            if (batchId) enrollmentMatch.batch = new mongoose.Types.ObjectId(batchId);

            pipeline.push({
                $lookup: {
                    from: 'studentenrollments',
                    localField: 'student',
                    foreignField: 'student',
                    as: 'enrollment'
                }
            });
            pipeline.push({ $unwind: '$enrollment' });
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

        // Calculate totals
        const totals = payments.reduce((acc, payment) => {
            acc.totalAmount += payment.amount || 0;
            acc.totalLateFee += payment.lateFeeAmount || 0;
            acc.totalDiscount += payment.discountAmount || 0;
            acc.netCollection += (payment.amount || 0) - (payment.discountAmount || 0);
            return acc;
        }, {
            totalAmount: 0,
            totalLateFee: 0,
            totalDiscount: 0,
            netCollection: 0
        });

        const result = {
            payments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            },
            summary: {
                ...totals,
                totalPayments: payments.length,
                averagePayment: payments.length > 0 ? totals.netCollection / payments.length : 0
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
const getPendingFeesReport = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { 
            asOfDate, 
            studentId, 
            courseId, 
            batchId, 
            overdueOnly,
            page = 1, 
            limit = 50 
        } = req.query;

        const cacheKey = makeKey('pending-fees', { companyId, ...req.query });
        const cached = getCache(cacheKey);
        if (cached) return res.json(cached);

        const companyObjectId = new mongoose.Types.ObjectId(companyId);
        const asOf = asOfDate ? new Date(asOfDate) : new Date();

        const matchStage = { 
            company: companyObjectId,
            status: { $in: ['unpaid', 'partial'] },
            balanceDue: { $gt: 0 }
        };

        if (studentId) matchStage.student = new mongoose.Types.ObjectId(studentId);
        
        if (overdueOnly === 'true') {
            matchStage.dueDate = { $lt: asOf };
        }

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
                    from: 'feevouchers',
                    localField: '_id',
                    foreignField: 'fee',
                    as: 'vouchers'
                }
            },
            {
                $lookup: {
                    from: 'feepayments',
                    localField: '_id',
                    foreignField: 'fee',
                    as: 'payments'
                }
            }
        ];

        // Course and Batch filtering
        if (courseId || batchId) {
            pipeline.push({
                $lookup: {
                    from: 'studentenrollments',
                    localField: 'student',
                    foreignField: 'student',
                    as: 'enrollments'
                }
            });
            pipeline.push({ $unwind: '$enrollments' });
            
            if (courseId) {
                pipeline.push({ 
                    $match: { 'enrollments.course': new mongoose.Types.ObjectId(courseId) } 
                });
            }
            if (batchId) {
                pipeline.push({ 
                    $match: { 'enrollments.batch': new mongoose.Types.ObjectId(batchId) } 
                });
            }
        }

        pipeline.push(
            {
                $addFields: {
                    totalPaid: { $sum: '$payments.amount' },
                    daysOverdue: {
                        $cond: {
                            if: { $lt: ['$dueDate', asOf] },
                            then: { $divide: [{ $subtract: [asOf, '$dueDate'] }, 1000 * 60 * 60 * 24] },
                            else: 0
                        }
                    },
                    isOverdue: { $lt: ['$dueDate', asOf] }
                }
            },
            {
                $project: {
                    feeNumber: 1,
                    date: 1,
                    dueDate: 1,
                    totalAmount: 1,
                    paidAmount: 1,
                    balanceDue: 1,
                    status: 1,
                    lateFeeAmount: 1,
                    cashDiscount: 1,
                    daysOverdue: { $floor: '$daysOverdue' },
                    // placeholder - project continues below
                    isOverdue: 1,
                    'student.name': 1,
                    'student.rollNumber': 1,
                    'student.contact': 1,
                    'student.email': 1,
                    paymentCount: { $size: '$payments' }
                }
            },
            { $sort: { dueDate: 1 } }
        );

        // Use $facet for paginated data + total count in one pass
        const pendingFacetPipeline = [
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

        const [pendingFacetResult] = await Fee.aggregate(pendingFacetPipeline);
        const pendingFees = pendingFacetResult?.data || [];
        const totalCount = pendingFacetResult?.totalCount?.[0]?.count || 0;

        // Calculate summary
        const summary = pendingFees.reduce((acc, fee) => {
            acc.totalFees += fee.totalAmount || 0;
            acc.totalPaid += fee.paidAmount || 0;
            acc.totalPending += fee.balanceDue || 0;
            acc.totalLateFee += fee.lateFeeAmount || 0;
            
            if (fee.isOverdue) {
                acc.overdueCount += 1;
                acc.overdueAmount += fee.balanceDue || 0;
            }
            
            return acc;
        }, {
            totalFees: 0,
            totalPaid: 0,
            totalPending: 0,
            totalLateFee: 0,
            overdueCount: 0,
            overdueAmount: 0
        });

        const result = {
            pendingFees,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            },
            summary: {
                ...summary,
                totalPendingFees: pendingFees.length,
                overduePercentage: summary.totalFees > 0 ? (summary.overdueAmount / summary.totalFees) * 100 : 0
            },
            asOfDate: asOf,
            filters: {
                asOfDate,
                studentId,
                courseId,
                batchId,
                overdueOnly
            }
        };

        setCache(cacheKey, result, 300);
        res.json(result);

    } catch (error) {
        console.error('Error in getPendingFeesReport:', error);
        res.status(500).json({ 
            message: 'Failed to fetch pending fees report',
            error: error.message 
        });
    }
};

// @desc    Get Student Ledger Report
// @route   GET /api/reports/student-ledger/:companyId/:studentId
// @access  Private/Admin/Accountant
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

        // Get all fees for the student
        const feeMatch = { 
            company: companyObjectId, 
            student: studentObjectId 
        };

        if (startDate && endDate) {
            feeMatch.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const fees = await Fee.find(feeMatch)
            .populate('voucher')
            .sort({ date: 1 });

        // Get all payments for the student
        const paymentMatch = { 
            company: companyObjectId, 
            student: studentObjectId 
        };

        if (startDate && endDate) {
            paymentMatch.paymentDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const payments = await FeePayment.find(paymentMatch)
            .populate('fee', 'feeNumber dueDate')
            .populate('receivedBy', 'name')
            .sort({ paymentDate: 1 });

        // Combine and sort transactions
        const transactions = [];

        // Add fee transactions (debits)
        fees.forEach(fee => {
            transactions.push({
                date: fee.date,
                type: 'fee',
                description: `Fee #${fee.feeNumber} - ${fee.items.map(item => item.description).join(', ')}`,
                reference: fee.feeNumber,
                debit: fee.totalAmount,
                credit: 0,
                balance: 0, // Will be calculated
                status: fee.status,
                dueDate: fee.dueDate
            });
        });

        // Add payment transactions (credits)
        payments.forEach(payment => {
            transactions.push({
                date: payment.paymentDate,
                type: 'payment',
                description: `Payment #${payment.paymentNumber} via ${payment.paymentMethod}`,
                reference: payment.paymentNumber,
                debit: 0,
                credit: payment.amount,
                balance: 0, // Will be calculated
                method: payment.paymentMethod,
                receivedBy: payment.receivedBy?.name
            });
        });

        // Sort by date and calculate running balance
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let runningBalance = 0;
        transactions.forEach(transaction => {
            runningBalance = runningBalance + transaction.debit - transaction.credit;
            transaction.balance = runningBalance;
        });

        // Calculate summary
        const summary = {
            totalFees: fees.reduce((sum, fee) => sum + fee.totalAmount, 0),
            totalPaid: payments.reduce((sum, payment) => sum + payment.amount, 0),
            totalPending: Math.max(0, fees.reduce((sum, fee) => sum + fee.totalAmount, 0) - payments.reduce((sum, payment) => sum + payment.amount, 0)),
            feeCount: fees.length,
            paymentCount: payments.length,
            lastPaymentDate: payments.length > 0 ? payments[payments.length - 1].paymentDate : null,
            nextDueDate: fees
                .filter(fee => fee.status === 'unpaid')
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]?.dueDate || null
        };

        const result = {
            student: {
                _id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                contact: student.contact,
                email: student.email,
                courses: student.courses,
                batches: student.batches
            },
            transactions,
            summary,
            reportPeriod: {
                startDate,
                endDate,
                generatedOn: new Date()
            }
        };

        setCache(cacheKey, result, 300);
        res.json(result);

    } catch (error) {
        console.error('Error in getStudentLedgerReport:', error);
        res.status(500).json({ 
            message: 'Failed to fetch student ledger report',
            error: error.message 
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

        // Payment aggregation
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
                    totalLateFee: { $sum: '$lateFeeAmount' },
                    totalDiscount: { $sum: '$discountAmount' },
                    paymentCount: { $sum: 1 },
                    payments: { $push: '$$ROOT' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ];

        const paymentSummary = await FeePayment.aggregate(paymentPipeline);

        // Fee generation aggregation
        const feePipeline = [
            {
                $match: {
                    company: companyObjectId,
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        day: groupBy === 'day' ? { $dayOfMonth: '$date' } : 
                             groupBy === 'week' ? { $week: '$date' } : null
                    },
                    totalFees: { $sum: '$totalAmount' },
                    feeCount: { $sum: 1 },
                    fees: { $push: '$$ROOT' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ];

        const feeSummary = await Fee.aggregate(feePipeline);

        // Combine data
        const summaryData = {};
        
        // Process payment data
        paymentSummary.forEach(item => {
            const key = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}-${item._id.day?.toString().padStart(2, '0') || '01'}`;
            summaryData[key] = {
                period: key,
                totalFees: 0,
                totalCollected: item.totalAmount,
                totalLateFee: item.totalLateFee,
                totalDiscount: item.totalDiscount,
                netCollection: item.totalAmount - item.totalDiscount,
                feeCount: 0,
                paymentCount: item.paymentCount,
                pendingAmount: 0
            };
        });

        // Process fee data
        feeSummary.forEach(item => {
            const key = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}-${item._id.day?.toString().padStart(2, '0') || '01'}`;
            if (!summaryData[key]) {
                summaryData[key] = {
                    period: key,
                    totalFees: 0,
                    totalCollected: 0,
                    totalLateFee: 0,
                    totalDiscount: 0,
                    netCollection: 0,
                    feeCount: 0,
                    paymentCount: 0,
                    pendingAmount: 0
                };
            }
            summaryData[key].totalFees = item.totalFees;
            summaryData[key].feeCount = item.feeCount;
        });

        // Calculate pending amounts
        if (includePending === 'true') {
            const pendingMatch = {
                company: companyObjectId,
                status: { $in: ['unpaid', 'partial'] },
                balanceDue: { $gt: 0 }
            };

            if (startDate && endDate) {
                pendingMatch.date = { $gte: start, $lte: end };
            }

            const pendingFees = await Fee.find(pendingMatch);
            
            pendingFees.forEach(fee => {
                const feeDate = new Date(fee.date);
                const key = `${feeDate.getFullYear()}-${(feeDate.getMonth() + 1).toString().padStart(2, '0')}-${feeDate.getDate().toString().padStart(2, '0')}`;
                if (summaryData[key]) {
                    summaryData[key].pendingAmount += fee.balanceDue;
                }
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
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdBy'
                }
            },
            { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    voucherNumber: 1,
                    status: 1,
                    createdAt: 1,
                    totalAmount: 1,
                    paidAmount: 1,
                    balanceDue: 1,
                    dueDate: 1,
                    'student.name': 1,
                    'student.rollNumber': 1,
                    'fee.feeNumber': 1,
                    'fee.items': 1,
                    'createdBy.name': 1
                }
            },
            { $sort: { createdAt: -1 } }
        ];

        const [vouchers, totalCount] = await Promise.all([
            FeeVoucher.aggregate(pipeline),
            FeeVoucher.countDocuments(matchStage)
        ]);

        // Calculate summary
        const summary = vouchers.reduce((acc, voucher) => {
            acc.totalVouchers += 1;
            acc.totalAmount += voucher.totalAmount || 0;
            acc.totalPaid += voucher.paidAmount || 0;
            acc.totalPending += voucher.balanceDue || 0;
            
            if (voucher.status === 'paid') acc.paidVouchers += 1;
            else if (voucher.status === 'partial') acc.partialVouchers += 1;
            else acc.unpaidVouchers += 1;
            
            return acc;
        }, {
            totalVouchers: 0,
            totalAmount: 0,
            totalPaid: 0,
            totalPending: 0,
            paidVouchers: 0,
            partialVouchers: 0,
            unpaidVouchers: 0
        });

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
