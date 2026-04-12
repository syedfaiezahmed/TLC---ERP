import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const PrivateRoute = ({ children }) => {
  const { authData } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!authData) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default React.memo(PrivateRoute);
