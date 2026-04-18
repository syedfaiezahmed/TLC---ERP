import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { Box, Toolbar, CircularProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCurrentCompany } from '../redux/companySlice';

import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

// Lazy Load Components
const Students = lazy(() => import('./Students'));
const Fees = lazy(() => import('./Fees'));
const CreateFee = lazy(() => import('./CreateFee'));
const FeePreview = lazy(() => import('./FeePreview'));
const Payments = lazy(() => import('./Payments'));
const Ledger = lazy(() => import('./Ledger'));
const Reports = lazy(() => import('./Reports'));
const FeeReports = lazy(() => import('./FeeReports'));
const Backup = lazy(() => import('./Backup'));
const Courses = lazy(() => import('./Courses'));
const Groups = lazy(() => import('./Groups'));
const Expenses = lazy(() => import('./Expenses'));
const Teachers = lazy(() => import('./Teachers'));
const Purchases = lazy(() => import('./Purchases'));
const CreatePurchase = lazy(() => import('./CreatePurchase'));
const Pays = lazy(() => import('./Pays'));
const DashboardOverview = lazy(() => import('./DashboardOverview'));
const CompanySettings = lazy(() => import('./CompanySettings'));
const ChartOfAccounts = lazy(() => import('./ChartOfAccounts'));
const PeriodLock = lazy(() => import('./PeriodLock'));
const AuditLogs = lazy(() => import('./AuditLogs'));
const FeeRefunds = lazy(() => import('./FeeRefunds'));
const PurchaseReturns = lazy(() => import('./PurchaseReturns'));
const PurchaseView = lazy(() => import('./PurchaseView'));
const EditPurchase = lazy(() => import('./EditPurchase'));
const UserManagement = lazy(() => import('./UserManagement'));
const Assets = lazy(() => import('./Assets'));
const Payroll = lazy(() => import('./Payroll'));
const Batches = lazy(() => import('./Batches'));
const Attendance = lazy(() => import('./Attendance'));
const Exams = lazy(() => import('./Exams'));
const Enquiries = lazy(() => import('./Enquiries'));
const FeeManagement = lazy(() => import('./FeeManagement'));
const EnrollmentManagement = lazy(() => import('./EnrollmentManagement'));

const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" height="200px">
    <CircularProgress size={32} thickness={4} />
  </Box>
);

const drawerWidth = 240;

const Dashboard = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { companyId } = useParams();
  const dispatch = useDispatch();
  const companies = useSelector((state) => state.companies.companies) || [];
  const loading = useSelector((state) => state.companies.loading);

  // Single-company mode: load the user's own company once from URL param.
  useEffect(() => {
      if (companyId) {
          dispatch(fetchCurrentCompany(companyId));
      }
  }, [companyId, dispatch]);

  const handleDrawerToggle = React.useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  if (loading && companies.length === 0) {
      return (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
              <CircularProgress />
          </Box>
      );
  }

  return (
    <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
      <Navbar drawerWidth={drawerWidth} handleDrawerToggle={handleDrawerToggle} />
      
      <Sidebar 
        drawerWidth={drawerWidth} 
        mobileOpen={mobileOpen} 
        handleDrawerToggle={handleDrawerToggle} 
      />

      <Box
        component="main"
        sx={{ flexGrow: 1, p: { xs: 2, md: 2 }, width: { sm: `calc(100% - ${drawerWidth}px)` }, minHeight: '100vh' }}
      >
        <Toolbar sx={{ minHeight: 64 }} />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="dashboard" element={<DashboardOverview />} />
            <Route path="students" element={<Students />} />
            <Route path="enquiries" element={<Enquiries />} />
            <Route path="courses" element={<Courses />} />
            <Route path="groups" element={<Groups />} />
            <Route path="batches" element={<Batches />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="exams" element={<Exams />} />
            <Route path="fees" element={<Fees />} />
            <Route path="fee-management" element={<FeeManagement />} />
            <Route path="enrollments" element={<EnrollmentManagement />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="purchases/create" element={<CreatePurchase />} />
            <Route path="purchases/:id" element={<PurchaseView />} />
            <Route path="purchases/edit/:id" element={<EditPurchase />} />
            <Route path="pays" element={<Pays />} />
            <Route path="fee-refunds" element={<FeeRefunds />} />
            <Route path="purchase-returns" element={<PurchaseReturns />} />
            <Route path="assets" element={<Assets />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="fees/create" element={<CreateFee />} />
            <Route path="fees/edit/:id" element={<CreateFee />} />
            <Route path="fees/:id/preview" element={<FeePreview />} />
            <Route path="payments" element={<Payments />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="coa" element={<ChartOfAccounts />} />
            <Route path="period-lock" element={<PeriodLock />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="reports" element={<Reports />} />
            <Route path="fee-reports" element={<FeeReports />} />
            <Route path="settings" element={<CompanySettings />} />
            <Route path="backup" element={<Backup />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="*" element={<DashboardOverview />} />
          </Routes>
        </Suspense>
      </Box>
    </Box>
  );
};

export default Dashboard;
