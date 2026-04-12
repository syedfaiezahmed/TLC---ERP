import Company from '../models/Company.js';
import User from '../models/User.js';
import { ensureDefaultAccounts } from '../services/accountSeedService.js';
import { canAccessCompany } from '../utils/companyAccess.js';

// @desc    Create a new company
// @route   POST /api/companies
// @access  Private/SuperAdmin
const createCompany = async (req, res) => {
  try {
    const { name, address, contact, email, website, taxId, logo, currency, adminEmail, adminPassword, adminName } = req.body;

    // 1. Generate Custom Company ID (ERP-YYYY-00X)
    const year = new Date().getFullYear();
    const count = await Company.countDocuments({ 
        companyId: new RegExp(`^ERP-${year}-`) 
    });
    const serialNumber = String(count + 1).padStart(4, '0');
    const customCompanyId = `ERP-${year}-${serialNumber}`;

    // 2. Create the company
    const company = new Company({
      name,
      companyId: customCompanyId,
      address,
      contact,
      email,
      website,
      taxId,
      logo,
      currency,
      user: req.user._id, // Tracks who created it (superadmin)
    });

    const createdCompany = await company.save();
    await ensureDefaultAccounts(createdCompany._id);

    // 3. Create the Company Admin user
    const user = new User({
        name: adminName || `${name} Admin`,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        company: createdCompany._id
    });

    await user.save();

    res.status(201).json({
        company: createdCompany,
        admin: {
            email: adminEmail,
            companyId: customCompanyId
        }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private/Admin
const getCompanies = async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      const companies = await Company.find({});
      return res.json(companies);
    }

    if (req.user.company) {
      const company = await Company.findById(req.user.company);
      return res.json(company ? [company] : []);
    }

    const companies = await Company.find({ user: req.user._id });
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get company by ID
// @route   GET /api/companies/:id
// @access  Private/Admin
const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized to view this company' });
    return res.json(company);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Private/Admin
const updateCompany = async (req, res) => {
  try {
    const { name, address, contact, email, website, taxId, logo, currency } = req.body;

    const company = await Company.findById(req.params.id);

    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized to update this company' });

    company.name = name || company.name;
    company.address = address || company.address;
    company.contact = contact || company.contact;
    company.email = email || company.email;
    company.website = website || company.website;
    company.taxId = taxId || company.taxId;
    company.logo = logo || company.logo;
    company.currency = currency || company.currency;

    const updatedCompany = await company.save();
    return res.json(updatedCompany);
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Private/Admin
const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized to delete this company' });

    await company.deleteOne();
    return res.json({ message: 'Company removed' });
  } catch (error) {
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

export {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
};
