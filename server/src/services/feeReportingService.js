import FeeReport from '../models/FeeReport.js';
import Fee from '../models/Fee.js';
import FeePayment from '../models/FeePayment.js';
import FeeVoucher from '../models/FeeVoucher.js';
import BadDebt from '../models/BadDebt.js';
import StudentEnrollment from '../models/StudentEnrollment.js';
import Student from '../models/Student.js';
import Course from '../models/Course.js';
import Teacher from '../models/Teacher.js';
import feeCalculationService from './feeCalculationService.js';
import mongoose from 'mongoose';

class FeeReportingService {
  async generateStudentFeeReport(companyId, filters, userId) {
    try {
      const {
        startDate,
        endDate,
        students,
        courses,
        status,
        includeBadDebts = true,
        includeLateFees = true
      } = filters;

      // Build match stage for fees
      const feeMatchStage = {
        company: companyId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };

      if (students && students.length > 0) {
        feeMatchStage.student = { $in: students.map(id => new mongoose.Types.ObjectId(id)) };
      }

      if (status) {
        feeMatchStage.status = status;
      }

      // Get fees with course breakdown
      const fees = await Fee.find(feeMatchStage)
        .populate('student', 'name email phone')
        .populate('items.course', 'name')
        .sort({ date: 1 });

      // Process fees and calculate course-wise breakdown
      const studentData = {};
      const courseData = {};
      let totalAssigned = 0;
      let totalReceived = 0;
      let totalPending = 0;
      let totalBadDebt = 0;
      let totalLateFee = 0;
      let totalDiscount = 0;

      for (const fee of fees) {
        const studentId = fee.student._id.toString();
        
        if (!studentData[studentId]) {
          studentData[studentId] = {
            student: fee.student,
            courses: {},
            totalAssigned: 0,
            totalReceived: 0,
            totalPending: 0,
            totalLateFee: 0,
            totalDiscount: 0
          };
        }

        // Process each course in the fee
        for (const item of fee.items) {
          if (courses && courses.length > 0 && !courses.includes(item.course._id.toString())) {
            continue;
          }

          const courseId = item.course._id.toString();
          const courseName = item.course.name;

          if (!studentData[studentId].courses[courseId]) {
            studentData[studentId].courses[courseId] = {
              courseName: courseName,
              assigned: 0,
              received: 0,
              pending: 0,
              lateFee: 0,
              discount: 0
            };
          }

          if (!courseData[courseId]) {
            courseData[courseId] = {
              courseName: courseName,
              students: {},
              totalAssigned: 0,
              totalReceived: 0,
              totalPending: 0,
              totalLateFee: 0,
              totalDiscount: 0
            };
          }

          const itemTotal = item.amount;
          const itemReceived = fee.paidAmount * (itemTotal / fee.subTotal);
          const itemPending = fee.balanceDue * (itemTotal / fee.subTotal);
          const itemLateFee = includeLateFees ? (fee.lateFeeAmount || 0) * (itemTotal / fee.subTotal) : 0;
          const itemDiscount = fee.cashDiscount * (itemTotal / fee.subTotal);

          // Update student data
          studentData[studentId].courses[courseId].assigned += itemTotal;
          studentData[studentId].courses[courseId].received += itemReceived;
          studentData[studentId].courses[courseId].pending += itemPending;
          studentData[studentId].courses[courseId].lateFee += itemLateFee;
          studentData[studentId].courses[courseId].discount += itemDiscount;

          studentData[studentId].totalAssigned += itemTotal;
          studentData[studentId].totalReceived += itemReceived;
          studentData[studentId].totalPending += itemPending;
          studentData[studentId].totalLateFee += itemLateFee;
          studentData[studentId].totalDiscount += itemDiscount;

          // Update course data
          if (!courseData[courseId].students[studentId]) {
            courseData[courseId].students[studentId] = {
              studentName: fee.student.name,
              assigned: 0,
              received: 0,
              pending: 0,
              lateFee: 0,
              discount: 0
            };
          }

          courseData[courseId].students[studentId].assigned += itemTotal;
          courseData[courseId].students[studentId].received += itemReceived;
          courseData[courseId].students[studentId].pending += itemPending;
          courseData[courseId].students[studentId].lateFee += itemLateFee;
          courseData[courseId].students[studentId].discount += itemDiscount;

          courseData[courseId].totalAssigned += itemTotal;
          courseData[courseId].totalReceived += itemReceived;
          courseData[courseId].totalPending += itemPending;
          courseData[courseId].totalLateFee += itemLateFee;
          courseData[courseId].totalDiscount += itemDiscount;

          // Update totals
          totalAssigned += itemTotal;
          totalReceived += itemReceived;
          totalPending += itemPending;
          totalLateFee += itemLateFee;
          totalDiscount += itemDiscount;
        }
      }

      // Get bad debts if included
      if (includeBadDebts) {
        const badDebtMatchStage = {
          company: companyId,
          writeOffDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
        };

        if (students && students.length > 0) {
          badDebtMatchStage.student = { $in: students.map(id => new mongoose.Types.ObjectId(id)) };
        }

        const badDebts = await BadDebt.find(badDebtMatchStage);
        
        for (const badDebt of badDebts) {
          const studentId = badDebt.student.toString();
          if (studentData[studentId]) {
            studentData[studentId].totalBadDebt = (studentData[studentId].totalBadDebt || 0) + badDebt.writtenOffAmount;
            totalBadDebt += badDebt.writtenOffAmount;
          }
        }
      }

      const reportData = {
        summary: {
          totalAssigned: totalAssigned,
          totalReceived: totalReceived,
          totalPending: totalPending,
          totalBadDebt: totalBadDebt,
          totalLateFee: totalLateFee,
          totalDiscount: totalDiscount,
          collectionRate: totalAssigned > 0 ? ((totalReceived / totalAssigned) * 100).toFixed(2) : 0
        },
        studentBreakdown: Object.values(studentData),
        courseBreakdown: Object.values(courseData)
      };

      // Save report to database
      const report = new FeeReport({
        company: companyId,
        reportType: 'student_fee',
        reportName: `Student Fee Report - ${startDate} to ${endDate}`,
        generatedBy: userId,
        period: { startDate: new Date(startDate), endDate: new Date(endDate) },
        filters: { students, courses, status },
        data: reportData
      });

      await report.save();

      return {
        report: report,
        data: reportData
      };

    } catch (error) {
      throw error;
    }
  }

  async generateCashFlowReport(companyId, filters, userId) {
    try {
      const {
        startDate,
        endDate,
        includeExpenses = true,
        groupBy = 'daily' // 'daily', 'weekly', 'monthly'
      } = filters;

      // Get fee payments (income)
      const paymentMatchStage = {
        company: companyId,
        paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: 'active'
      };

      const payments = await FeePayment.find(paymentMatchStage)
        .populate('student', 'name')
        .sort({ paymentDate: 1 });

      // Get fee refunds (expense)
      const refundMatchStage = {
        company: companyId,
        refundDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };

      const refunds = await FeePayment.find(refundMatchStage)
        .populate('student', 'name')
        .sort({ refundDate: 1 });

      // Process cash flow data
      const cashFlowData = [];
      let totalIncome = 0;
      let totalExpense = 0;

      // Group payments by date
      const paymentGroups = {};
      for (const payment of payments) {
        const dateKey = this.getDateKey(payment.paymentDate, groupBy);
        if (!paymentGroups[dateKey]) {
          paymentGroups[dateKey] = {
            date: payment.paymentDate,
            income: 0,
            expense: 0,
            details: []
          };
        }
        paymentGroups[dateKey].income += payment.amount;
        paymentGroups[dateKey].details.push({
          type: 'income',
          description: `Fee payment from ${payment.student.name}`,
          amount: payment.amount,
          method: payment.paymentMethod,
          reference: payment.referenceNumber
        });
        totalIncome += payment.amount;
      }

      // Group refunds by date
      for (const refund of refunds) {
        const dateKey = this.getDateKey(refund.refundDate, groupBy);
        if (!paymentGroups[dateKey]) {
          paymentGroups[dateKey] = {
            date: refund.refundDate,
            income: 0,
            expense: 0,
            details: []
          };
        }
        paymentGroups[dateKey].expense += refund.refundAmount;
        paymentGroups[dateKey].details.push({
          type: 'expense',
          description: `Fee refund to ${refund.student.name}`,
          amount: refund.refundAmount,
          reason: refund.refundReason
        });
        totalExpense += refund.refundAmount;
      }

      // Convert to array and sort by date
      const sortedDates = Object.keys(paymentGroups).sort();
      for (const dateKey of sortedDates) {
        const group = paymentGroups[dateKey];
        group.balance = group.income - group.expense;
        cashFlowData.push(group);
      }

      // Calculate running balance
      let runningBalance = 0;
      for (const item of cashFlowData) {
        runningBalance += item.balance;
        item.runningBalance = runningBalance;
      }

      const reportData = {
        summary: {
          totalIncome: totalIncome,
          totalExpense: totalExpense,
          netCashFlow: totalIncome - totalExpense,
          averageDailyIncome: cashFlowData.length > 0 ? totalIncome / cashFlowData.length : 0,
          totalTransactions: payments.length + refunds.length
        },
        cashFlow: cashFlowData,
        groupBy: groupBy
      };

      // Save report to database
      const report = new FeeReport({
        company: companyId,
        reportType: 'cash_flow',
        reportName: `Cash Flow Report - ${startDate} to ${endDate}`,
        generatedBy: userId,
        period: { startDate: new Date(startDate), endDate: new Date(endDate) },
        data: reportData
      });

      await report.save();

      return {
        report: report,
        data: reportData
      };

    } catch (error) {
      throw error;
    }
  }

  async generateClassWiseReport(companyId, filters, userId) {
    try {
      const {
        startDate,
        endDate,
        courses,
        batches,
        includeTeacherCommission = true
      } = filters;

      // Get enrollments for the period
      const enrollmentMatchStage = {
        company: companyId,
        status: 'active',
        startDate: { $lte: new Date(endDate) },
        $or: [
          { actualEndDate: { $gte: new Date(startDate) } },
          { actualEndDate: { $exists: false } },
          { actualEndDate: null }
        ]
      };

      if (courses && courses.length > 0) {
        enrollmentMatchStage.course = { $in: courses.map(id => new mongoose.Types.ObjectId(id)) };
      }

      if (batches && batches.length > 0) {
        enrollmentMatchStage.batch = { $in: batches.map(id => new mongoose.Types.ObjectId(id)) };
      }

      const enrollments = await StudentEnrollment.find(enrollmentMatchStage)
        .populate('student', 'name')
        .populate('course', 'name')
        .populate('batch', 'name')
        .populate('teacher', 'name');

      // Get fees for these enrollments
      const courseIds = enrollments.map(e => e.course._id);
      const studentIds = enrollments.map(e => e.student._id);

      const feeMatchStage = {
        company: companyId,
        student: { $in: studentIds },
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };

      const fees = await Fee.find(feeMatchStage);

      // Process data by course
      const courseData = {};
      let totalStudents = 0;
      let totalFees = 0;
      let totalReceived = 0;
      let totalPending = 0;
      let totalLateFee = 0;

      for (const enrollment of enrollments) {
        const courseId = enrollment.course._id.toString();
        
        if (!courseData[courseId]) {
          courseData[courseId] = {
            course: enrollment.course,
            batch: enrollment.batch,
            teacher: enrollment.teacher,
            students: [],
            totalFees: 0,
            totalReceived: 0,
            totalPending: 0,
            totalLateFee: 0,
            studentCount: 0
          };
        }

        // Get fees for this student and course
        const studentFees = fees.filter(fee => 
          fee.student.toString() === enrollment.student._id.toString() &&
          fee.items.some(item => item.course.toString() === courseId)
        );

        let studentFeesTotal = 0;
        let studentReceivedTotal = 0;
        let studentPendingTotal = 0;
        let studentLateFeeTotal = 0;

        for (const fee of studentFees) {
          const courseItem = fee.items.find(item => item.course.toString() === courseId);
          if (courseItem) {
            const itemRatio = courseItem.amount / fee.subTotal;
            studentFeesTotal += courseItem.amount;
            studentReceivedTotal += fee.paidAmount * itemRatio;
            studentPendingTotal += fee.balanceDue * itemRatio;
            studentLateFeeTotal += (fee.lateFeeAmount || 0) * itemRatio;
          }
        }

        courseData[courseId].students.push({
          student: enrollment.student,
          fees: studentFeesTotal,
          received: studentReceivedTotal,
          pending: studentPendingTotal,
          lateFee: studentLateFeeTotal,
          enrollment: enrollment
        });

        courseData[courseId].totalFees += studentFeesTotal;
        courseData[courseId].totalReceived += studentReceivedTotal;
        courseData[courseId].totalPending += studentPendingTotal;
        courseData[courseId].totalLateFee += studentLateFeeTotal;
        courseData[courseId].studentCount += 1;

        totalFees += studentFeesTotal;
        totalReceived += studentReceivedTotal;
        totalPending += studentPendingTotal;
        totalLateFee += studentLateFeeTotal;
        totalStudents += 1;
      }

      // Calculate teacher commissions if included
      if (includeTeacherCommission) {
        for (const courseId in courseData) {
          const course = courseData[courseId];
          if (course.teacher && course.teacher.commissionRate) {
            course.teacherCommission = {
              commissionRate: course.teacher.commissionRate,
              commissionAmount: (course.totalReceived * course.teacher.commissionRate) / 100
            };
          }
        }
      }

      const reportData = {
        summary: {
          totalCourses: Object.keys(courseData).length,
          totalStudents: totalStudents,
          totalFees: totalFees,
          totalReceived: totalReceived,
          totalPending: totalPending,
          totalLateFee: totalLateFee,
          collectionRate: totalFees > 0 ? ((totalReceived / totalFees) * 100).toFixed(2) : 0
        },
        courseBreakdown: Object.values(courseData)
      };

      // Save report to database
      const report = new FeeReport({
        company: companyId,
        reportType: 'class_wise',
        reportName: `Class-wise Report - ${startDate} to ${endDate}`,
        generatedBy: userId,
        period: { startDate: new Date(startDate), endDate: new Date(endDate) },
        filters: { courses, batches },
        data: reportData
      });

      await report.save();

      return {
        report: report,
        data: reportData
      };

    } catch (error) {
      throw error;
    }
  }

  async generateTeacherCommissionReport(companyId, filters, userId) {
    try {
      const {
        startDate,
        endDate,
        teachers,
        courses
      } = filters;

      // Get enrollments with teachers
      const enrollmentMatchStage = {
        company: companyId,
        status: 'active',
        startDate: { $lte: new Date(endDate) },
        $or: [
          { actualEndDate: { $gte: new Date(startDate) } },
          { actualEndDate: { $exists: false } },
          { actualEndDate: null }
        ]
      };

      if (teachers && teachers.length > 0) {
        enrollmentMatchStage.teacher = { $in: teachers.map(id => new mongoose.Types.ObjectId(id)) };
      }

      if (courses && courses.length > 0) {
        enrollmentMatchStage.course = { $in: courses.map(id => new mongoose.Types.ObjectId(id)) };
      }

      const enrollments = await StudentEnrollment.find(enrollmentMatchStage)
        .populate('student', 'name')
        .populate('course', 'name')
        .populate('teacher', 'name commissionRate');

      // Get payments for these enrollments
      const studentIds = [...new Set(enrollments.map(e => e.student._id))];
      const courseIds = [...new Set(enrollments.map(e => e.course._id))];

      const payments = await FeePayment.find({
        company: companyId,
        student: { $in: studentIds },
        paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: 'active'
      });

      // Process commissions by teacher
      const teacherData = {};
      let totalCommission = 0;

      for (const enrollment of enrollments) {
        if (!enrollment.teacher) continue;

        const teacherId = enrollment.teacher._id.toString();
        
        if (!teacherData[teacherId]) {
          teacherData[teacherId] = {
            teacher: enrollment.teacher,
            courses: {},
            totalFeesCollected: 0,
            totalCommission: 0,
            studentCount: 0
          };
        }

        const courseId = enrollment.course._id.toString();
        
        if (!teacherData[teacherId].courses[courseId]) {
          teacherData[teacherId].courses[courseId] = {
            course: enrollment.course,
            feesCollected: 0,
            commission: 0,
            students: []
          };
        }

        // Get payments for this student in the period
        const studentPayments = payments.filter(payment => 
          payment.student.toString() === enrollment.student._id.toString()
        );

        const totalStudentPayments = studentPayments.reduce((sum, p) => sum + p.amount, 0);
        const commissionRate = enrollment.teacher.commissionRate || 0;
        const commissionAmount = (totalStudentPayments * commissionRate) / 100;

        teacherData[teacherId].courses[courseId].feesCollected += totalStudentPayments;
        teacherData[teacherId].courses[courseId].commission += commissionAmount;
        teacherData[teacherId].courses[courseId].students.push({
          student: enrollment.student,
          payments: totalStudentPayments,
          commission: commissionAmount
        });

        teacherData[teacherId].totalFeesCollected += totalStudentPayments;
        teacherData[teacherId].totalCommission += commissionAmount;
        teacherData[teacherId].studentCount += 1;

        totalCommission += commissionAmount;
      }

      const reportData = {
        summary: {
          totalTeachers: Object.keys(teacherData).length,
          totalCommission: totalCommission,
          totalFeesCollected: Object.values(teacherData).reduce((sum, t) => sum + t.totalFeesCollected, 0)
        },
        teacherBreakdown: Object.values(teacherData)
      };

      // Save report to database
      const report = new FeeReport({
        company: companyId,
        reportType: 'teacher_commission',
        reportName: `Teacher Commission Report - ${startDate} to ${endDate}`,
        generatedBy: userId,
        period: { startDate: new Date(startDate), endDate: new Date(endDate) },
        filters: { teachers, courses },
        data: reportData
      });

      await report.save();

      return {
        report: report,
        data: reportData
      };

    } catch (error) {
      throw error;
    }
  }

  getDateKey(date, groupBy) {
    const d = new Date(date);
    
    switch (groupBy) {
      case 'daily':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      case 'weekly':
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return `${weekStart.getFullYear()}-W${Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / 604800000)}`;
      
      case 'monthly':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      default:
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  async getSavedReports(companyId, filters = {}) {
    const {
      reportType,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = filters;

    const query = { company: companyId };

    if (reportType) {
      query.reportType = reportType;
    }

    if (startDate || endDate) {
      query['period.startDate'] = {};
      if (startDate) query['period.startDate'].$gte = new Date(startDate);
      if (endDate) query['period.endDate'].$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const reports = await FeeReport.find(query)
      .populate('generatedBy', 'name')
      .sort({ generatedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FeeReport.countDocuments(query);

    return {
      reports: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getReportById(companyId, reportId) {
    const report = await FeeReport.findOne({
      _id: reportId,
      company: companyId
    })
    .populate('generatedBy', 'name')
    .populate('filters.students', 'name')
    .populate('filters.courses', 'name')
    .populate('filters.batches', 'name')
    .populate('filters.teachers', 'name');

    if (!report) {
      throw new Error('Report not found');
    }

    return report;
  }

  async deleteReport(companyId, reportId) {
    const report = await FeeReport.findOneAndDelete({
      _id: reportId,
      company: companyId
    });

    if (!report) {
      throw new Error('Report not found');
    }

    return report;
  }
}

export default new FeeReportingService();
