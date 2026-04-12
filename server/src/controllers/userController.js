import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Company from '../models/Company.js';

// Generate JWT
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
  try {
    const email = req.body.email || '';
    const password = req.body.password || '';
    const companyId = req.body.companyId;
    
    console.log(`Login attempt for: ${email}`);

    // Super Admin Bypass (thelearningcollegiate@gmail.com / tlc@admin123)
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPassword = password.trim();
    
    if (normalizedEmail === 'thelearningcollegiate@gmail.com' && normalizedPassword === 'tlc@admin123') {
        console.log('Super Admin bypass triggered for:', normalizedEmail);
        
        // Find or create the superadmin user in the database
        let user = await User.findOne({ email: 'thelearningcollegiate@gmail.com', role: 'superadmin' });
        
        // Always link to the primary TLC company
        const company = await Company.findOne().sort({ createdAt: 1 });
        if (!company) {
            console.error('No company found for Super Admin');
            // We should probably seed first, but for now just fail if no company exists
        }

        if (!user) {
            console.log('Super Admin not found in DB during bypass, creating...');
            user = await User.create({
                name: 'TLC Admin',
                email: 'thelearningcollegiate@gmail.com',
                password: 'tlc@admin123',
                role: 'superadmin',
                company: company?._id
            });
        } else if (!user.company && company) {
            user.company = company._id;
            await user.save();
        }
        
        const token = generateToken(user._id);
        console.log('Super Admin bypass successful, returning token with company:', company?.name);
        return res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            company: user.company, // Include company in response
            token: token,
        });
    }

    // Regular Login Flow
    let user;
    if (email.toLowerCase() === 'thelearningcollegiate@gmail.com') {
        // Only Super Admin can use this email
        user = await User.findOne({ email: 'thelearningcollegiate@gmail.com', role: 'superadmin' });
    } else {
        // Regular Admin/User login - If companyId not provided, default to first company for single-vendor mode
        let company;
        if (!companyId) {
            company = await Company.findOne().sort({ createdAt: 1 }); // Get first created company
            if (!company) {
                return res.status(400).json({ message: 'No institute setup found. Please contact super admin.' });
            }
        } else {
            // Find company by custom companyId (Case-Insensitive)
            company = await Company.findOne({ 
                companyId: { $regex: new RegExp(`^${companyId}$`, 'i') } 
            });
            if (!company) {
                return res.status(401).json({ message: 'Invalid Institute ID' });
            }
        }

        user = await User.findOne({ email, company: company._id });
    }

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
        return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }

    if (await user.matchPassword(normalizedPassword)) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            company: user.company,
            token: generateToken(user._id),
        });
    } else {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Auth Error:', error);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({ 
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? null : error.stack,
    });
  }
};

// @desc    Register a new user (Admin only initially or seed)
// @route   POST /api/users
// @access  Public (for initial setup)
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      return res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update user status (Suspend/Activate)
// @route   PUT /api/users/:id/status
// @access  Private/SuperAdmin
const updateUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = req.body.isActive;
    await user.save();
    res.json({ message: `User ${user.isActive ? 'activated' : 'suspended'} successfully` });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update user password (Admin reset)
// @route   PUT /api/users/:id/password
// @access  Private/SuperAdmin
const updateUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = req.body.password;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).populate('company', 'name');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export { authUser, registerUser, updateUserStatus, updateUserPassword, getUsers };