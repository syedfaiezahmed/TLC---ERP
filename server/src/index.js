import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars immediately
dotenv.config();

// Critical Environment Check
if (!process.env.MONGO_URI) {
    console.error('FATAL ERROR: MONGO_URI is not defined.');
    // In Vercel, we can't exit, but we should log clearly.
}
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined.');
}

import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import connectDB from './config/db.js';
import mongoose from 'mongoose';

import userRoutes from './routes/userRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import feeRoutes from './routes/feeRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import expenseCategoryRoutes from './routes/expenseCategoryRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import periodLockRoutes from './routes/periodLockRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import feeRefundRoutes from './routes/feeRefundRoutes.js';
import purchaseReturnRoutes from './routes/purchaseReturnRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import examRoutes from './routes/examRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js';
import voucherRoutes from './routes/voucherRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import enhancedVoucherRoutes from './routes/enhancedVoucherRoutes.js';
import feeCollectionRoutes from './routes/feeCollectionRoutes.js';
import badDebtRoutes from './routes/badDebtRoutes.js';
import feeReportRoutes from './routes/feeReportRoutes.js';
import pdfVoucherRoutes from './routes/pdfVoucherRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import teacherClassLogRoutes from './routes/teacherClassLogRoutes.js';
import qrAttendanceRoutes from './routes/qrAttendanceRoutes.js';
import { scheduleBackups } from './controllers/backupController.js';


// Load env vars - Already loaded at top
// dotenv.config();

// Connect to database
// connectDB(); // REMOVED: Do not fire and forget. We await it in middleware.

const app = express();

// Middleware
app.use(compression()); // Compress all responses
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(helmet());
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Database Connection Middleware
// This ensures that for every request, the DB connection is established (or reused)
// BEFORE the route handler is executed.
app.use(async (req, res, next) => {
  if (!process.env.MONGO_URI) {
    return res.status(503).json({
      message: 'MONGO_URI is not configured.',
      fix: 'Add MONGO_URI to Vercel Project Settings → Environment Variables and redeploy.'
    });
  }
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database Connection Failed:", error.message);
    res.status(503).json({ message: "Database connection failed. Check MONGO_URI and MongoDB Atlas IP whitelist.", error: error.message });
  }
});

// Debugging Middleware to log request path
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Health Check Route (Database Connectivity Test)
app.get('/api/health', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    // Attempt a simple ping
    if (state === 1) {
        await mongoose.connection.db.admin().ping();
        res.status(200).json({ status: 'ok', database: 'connected', latency: 'low' });
    } else {
        res.status(503).json({ status: 'error', database: states[state] });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Routes (Support both /api prefix and root paths for Vercel flexibility)
const routes = [
  { path: '/users', handler: userRoutes },
  { path: '/companies', handler: companyRoutes },
  { path: '/students', handler: studentRoutes },
  { path: '/fees', handler: feeRoutes },
  { path: '/ledger', handler: ledgerRoutes },
  { path: '/backup', handler: backupRoutes },
  { path: '/reports', handler: reportRoutes },
  { path: '/courses', handler: courseRoutes },
  { path: '/groups', handler: groupRoutes },
  { path: '/expenses', handler: expenseRoutes },
  { path: '/expense-categories', handler: expenseCategoryRoutes },
  { path: '/teachers', handler: teacherRoutes },
  { path: '/purchases', handler: purchaseRoutes },
  { path: '/period-lock', handler: periodLockRoutes },
  { path: '/audit', handler: auditRoutes },
  { path: '/fee-refunds', handler: feeRefundRoutes },
  { path: '/purchase-returns', handler: purchaseReturnRoutes },
  { path: '/accounts', handler: accountRoutes },
  { path: '/batches', handler: batchRoutes },
  { path: '/attendance', handler: attendanceRoutes },
  { path: '/exams', handler: examRoutes },
  { path: '/enquiries', handler: enquiryRoutes },
  { path: '/enrollments', handler: enrollmentRoutes },
  { path: '/vouchers', handler: voucherRoutes },
  { path: '/enhanced-vouchers', handler: enhancedVoucherRoutes },
  { path: '/fee-collection', handler: feeCollectionRoutes },
  { path: '/bad-debts', handler: badDebtRoutes },
  { path: '/fee-reports', handler: feeReportRoutes },
  { path: '/pdf-vouchers', handler: pdfVoucherRoutes },
  { path: '/payroll', handler: payrollRoutes },
  { path: '/assets', handler: assetRoutes },
  { path: '/class-logs', handler: teacherClassLogRoutes },
  { path: '/qr-attendance', handler: qrAttendanceRoutes },
];

routes.forEach(route => {
  app.use(`/api${route.path}`, route.handler); // Standard
  app.use(route.path, route.handler);          // Fallback if prefix is stripped
});

// Start Backup Scheduler (optional)
if (process.env.ENABLE_BACKUP_SCHEDULER === 'true') {
  scheduleBackups();
}

app.get('/', (req, res) => {
  res.json({
    message: 'Ultimate Coaching Management ERP API is running',
    environment: process.env.NODE_ENV,
    checks: {
        mongo_defined: !!process.env.MONGO_URI,
        jwt_defined: !!process.env.JWT_SECRET
    }
  });
});
app.get('/api', (req, res) => {
  res.json({
    message: 'Ultimate Coaching Management ERP API is running (at /api)',
    environment: process.env.NODE_ENV,
    checks: {
        mongo_defined: !!process.env.MONGO_URI,
        jwt_defined: !!process.env.JWT_SECRET
    }
  });
});

// ── Dev only: 404 handler ────────────────────────────────────────────────────
// In production (Vercel), static files are served by CDN — not by Express.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err); // Log the full error
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
}

export default app;
