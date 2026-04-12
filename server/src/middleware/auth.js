import { protect, admin, superadmin, accountant, teacher, student, checkRole } from './authMiddleware.js';

// Create an authorize function that works like the old one
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Not authorized. Required roles: ${roles.join(', ')}` 
      });
    }

    next();
  };
};

export { protect, admin, superadmin, accountant, teacher, student, checkRole, authorize };
