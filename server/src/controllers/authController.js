import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password, companyId } = req.body;

  let user;
  
  if (email === 'thelearningcollegiate@gmail.com') {
      // Potential Super Admin login
      user = await User.findOne({ email, role: 'superadmin' });
  } else {
      // Regular Admin/User login - Requires Company ID
      if (!companyId) {
          return res.status(400).json({ message: 'Company ID is required for regular login' });
      }
      user = await User.findOne({ email, company: companyId });
  }

  if (user && (await user.matchPassword(password))) {
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
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public (Should be protected in production or disabled after first admin creation)
const registerUser = asyncHandler(async (req, res) => {
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
      company: user.company,
      token: generateToken(user._id),
    });
  } else {
    return res.status(400).json({ message: 'Invalid user data' });
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
    });
  } else {
    return res.status(404).json({ message: 'User not found' });
  }
});

export { authUser, registerUser, getUserProfile };
