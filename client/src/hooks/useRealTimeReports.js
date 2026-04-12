import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchFeeCollectionReport, fetchPendingFeesReport, fetchStudentLedgerReport, fetchSummaryReport, fetchVoucherReport } from '../redux/feeReportsSlice';
import realTimeReportService from '../services/realTimeReportService';

export const useRealTimeReports = (companyId, activeTab, filters) => {
  const dispatch = useDispatch();
  const { token } = useSelector(state => state.auth);
  const subscriptionsRef = useRef(new Map());
  const refreshTimeoutRef = useRef(null);
  const lastUpdateRef = useRef({});

  // Debounced refresh function
  const debouncedRefresh = useCallback((reportType, delay = 1000) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshReport(reportType);
    }, delay);
  }, []);

  // Refresh specific report
  const refreshReport = useCallback((reportType) => {
    if (!companyId) return;

    const params = {
      companyId,
      ...filters,
      page: filters.page,
      limit: filters.limit
    };

    // Remove empty values
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    try {
      switch (reportType) {
        case 'fee-collection':
          dispatch(fetchFeeCollectionReport(params));
          break;
        case 'pending-fees':
          dispatch(fetchPendingFeesReport(params));
          break;
        case 'student-ledger':
          // Only refresh if student is selected
          if (filters.studentId) {
            dispatch(fetchStudentLedgerReport({ 
              companyId, 
              studentId: filters.studentId,
              ...params 
            }));
          }
          break;
        case 'summary':
          dispatch(fetchSummaryReport(params));
          break;
        case 'vouchers':
          dispatch(fetchVoucherReport(params));
          break;
        default:
          // Refresh all reports if type is not specified
          dispatch(fetchFeeCollectionReport(params));
          dispatch(fetchPendingFeesReport(params));
          dispatch(fetchSummaryReport(params));
          dispatch(fetchVoucherReport(params));
          if (filters.studentId) {
            dispatch(fetchStudentLedgerReport({ 
              companyId, 
              studentId: filters.studentId,
              ...params 
            }));
          }
      }
    } catch (error) {
      console.error('Error refreshing report:', error);
    }
  }, [companyId, filters, dispatch]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!token || !companyId) return;

    // Connect to real-time service
    realTimeReportService.connect(token, companyId);

    // Subscribe to relevant events
    const subscriptions = [];

    // Fee payment updates affect fee collection and summary
    const unsubscribePayment = realTimeReportService.subscribe('fee-payment', (data) => {
      console.log('Fee payment updated:', data);
      lastUpdateRef.current['fee-payment'] = Date.now();
      
      // Refresh fee collection and summary reports
      debouncedRefresh('fee-collection');
      debouncedRefresh('summary');
      
      // If it's for the selected student, refresh student ledger
      if (filters.studentId && data.studentId === filters.studentId) {
        debouncedRefresh('student-ledger');
      }
    });
    subscriptions.push(unsubscribePayment);

    // Fee updates affect pending fees and student ledger
    const unsubscribeFee = realTimeReportService.subscribe('fee', (data) => {
      console.log('Fee updated:', data);
      lastUpdateRef.current['fee'] = Date.now();
      
      // Refresh pending fees and summary
      debouncedRefresh('pending-fees');
      debouncedRefresh('summary');
      
      // If it's for the selected student, refresh student ledger
      if (filters.studentId && data.studentId === filters.studentId) {
        debouncedRefresh('student-ledger');
      }
    });
    subscriptions.push(unsubscribeFee);

    // Voucher updates affect voucher report
    const unsubscribeVoucher = realTimeReportService.subscribe('voucher', (data) => {
      console.log('Voucher updated:', data);
      lastUpdateRef.current['voucher'] = Date.now();
      debouncedRefresh('vouchers');
    });
    subscriptions.push(unsubscribeVoucher);

    // Student updates affect student ledger if selected
    const unsubscribeStudent = realTimeReportService.subscribe('student', (data) => {
      console.log('Student updated:', data);
      lastUpdateRef.current['student'] = Date.now();
      
      if (filters.studentId && data.studentId === filters.studentId) {
        debouncedRefresh('student-ledger');
      }
    });
    subscriptions.push(unsubscribeStudent);

    // Company-wide updates refresh all reports
    const unsubscribeCompany = realTimeReportService.subscribe('company', (data) => {
      console.log('Company data updated:', data);
      lastUpdateRef.current['company'] = Date.now();
      
      // Refresh all reports with a longer delay to allow server to process
      debouncedRefresh('all', 2000);
    });
    subscriptions.push(unsubscribeCompany);

    // Connection errors
    const unsubscribeError = realTimeReportService.subscribe('connection-error', (data) => {
      console.error('Real-time connection error:', data);
      // Could show a notification to user here
    });
    subscriptions.push(unsubscribeError);

    // Store subscriptions for cleanup
    subscriptionsRef.current = new Map(subscriptions.map((unsubscribe, index) => [index, unsubscribe]));

    return () => {
      // Cleanup subscriptions
      subscriptionsRef.current.forEach(unsubscribe => {
        unsubscribe();
      });
      subscriptionsRef.current.clear();
      
      // Clear timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [token, companyId, filters.studentId, debouncedRefresh]);

  // Manual refresh function
  const manualRefresh = useCallback((reportType = 'all') => {
    console.log('Manual refresh triggered for:', reportType);
    refreshReport(reportType);
  }, [refreshReport]);

  // Force refresh all reports
  const refreshAll = useCallback(() => {
    console.log('Refreshing all reports');
    refreshReport('all');
  }, [refreshReport]);

  // Get last update times
  const getLastUpdate = useCallback((eventType) => {
    return lastUpdateRef.current[eventType] || null;
  }, []);

  // Check if real-time is connected
  const isConnected = useCallback(() => {
    return realTimeReportService.isConnected();
  }, []);

  return {
    manualRefresh,
    refreshAll,
    getLastUpdate,
    isConnected,
    isRealTimeEnabled: true
  };
};

export default useRealTimeReports;
