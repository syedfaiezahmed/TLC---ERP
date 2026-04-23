import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { CssBaseline, ThemeProvider, CircularProgress, Box } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import theme from './theme';

// Helper to retry lazy imports if they fail (e.g., due to deployment updates)
const lazyRetry = (componentImport) => {
  return new Promise((resolve, reject) => {
    // Check if we've already retried for this specific component in this session
    const componentName = componentImport.toString();
    const hasRetried = window.sessionStorage.getItem(`retry_${componentName}`);

    componentImport()
      .then((res) => {
        window.sessionStorage.removeItem(`retry_${componentName}`);
        resolve(res);
      })
      .catch((error) => {
        const isChunkError = error.message && (
             error.message.includes("Failed to fetch dynamically imported module") || 
             error.message.includes("Importing a module script failed")
        );
        
        if (isChunkError && !hasRetried) {
           window.sessionStorage.setItem(`retry_${componentName}`, 'true');
           window.location.reload();
        } else {
          reject(error);
        }
      });
  });
};

// Lazy Load Pages with Retry
const Login = lazy(() => lazyRetry(() => import('./pages/Login')));
const Dashboard = lazy(() => lazyRetry(() => import('./pages/Dashboard')));
const Expenses = lazy(() => lazyRetry(() => import('./pages/Expenses')));

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
    <CircularProgress color="primary" />
  </Box>
);

import { useSelector } from 'react-redux';

const RootRedirect = () => {
  const authData = useSelector((state) => state.auth.authData);
  
  if (!authData) return <Navigate to="/login" replace />;
  
  if (authData.company) {
    return <Navigate to={`/company/${authData.company}/dashboard`} replace />;
  }
  
  return <Navigate to="/login" replace />;
};

function App() {
  useEffect(() => {
    // Suppress benign ResizeObserver error
    const originalError = console.error;
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('ResizeObserver loop completed') || args[0].includes('ResizeObserver loop limit exceeded'))
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    const handleResizeObserverError = (e) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        e.stopImmediatePropagation();
      }
    };

    // Handle unhandled promise rejections to prevent crashes
    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('error', handleResizeObserverError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
        console.error = originalError;
        window.removeEventListener('error', handleResizeObserverError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/company/:companyId/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
      <ToastContainer position="bottom-right" theme="colored" />
    </ThemeProvider>
  );
}

export default App;
