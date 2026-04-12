import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      return next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    return next();
  } else {
    return res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

const superadmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    return next();
  } else {
    return res.status(401).json({ message: 'Not authorized as a superadmin' });
  }
};

const accountant = (req, res, next) => {
  if (req.user && ['superadmin', 'admin', 'accountant'].includes(req.user.role)) {
    return next();
  } else {
    return res.status(401).json({ message: 'Not authorized - Accountant access required' });
  }
};

const teacher = (req, res, next) => {
  if (req.user && ['superadmin', 'admin', 'teacher'].includes(req.user.role)) {
    return next();
  } else {
    return res.status(401).json({ message: 'Not authorized - Teacher access required' });
  }
};

const student = (req, res, next) => {
  if (req.user && ['superadmin', 'admin', 'student'].includes(req.user.role)) {
    return next();
  } else {
    return res.status(401).json({ message: 'Not authorized - Student access required' });
  }
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (req.user && allowedRoles.includes(req.user.role)) {
      return next();
    } else {
      return res.status(403).json({ message: `Access denied. Required roles: ${allowedRoles.join(', ')}` });
    }
  };
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized, user not found' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `Not authorized. Required roles: ${roles.join(', ')}` });
  }

  return next();
};

export { protect, admin, superadmin, accountant, teacher, student, checkRole, authorize };
