import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import connectDB from './config/db.js';

import Company from './models/Company.js';

dotenv.config();

const importData = async () => {
  try {
    await connectDB();
    
    // Create or update Super Admin
    const superAdminEmail = 'thelearningcollegiate@gmail.com';
    let superAdmin = await User.findOne({ email: superAdminEmail });

    if (superAdmin) {
        superAdmin.password = 'tlc@admin123';
        superAdmin.name = 'TLC Admin';
        superAdmin.role = 'superadmin';
        await superAdmin.save();
        console.log(`Super Admin Updated: ${superAdminEmail}`);
    } else {
        superAdmin = new User({
            name: 'TLC Admin',
            email: superAdminEmail,
            password: 'tlc@admin123',
            role: 'superadmin',
          });
          await superAdmin.save();
          console.log(`Super Admin Created: ${superAdminEmail}`);
    }

    // Create single company (TLC)
    const tlcCompanyId = 'TLC-ERP-001';
    let tlcCompany = await Company.findOne({ companyId: tlcCompanyId });

    if (!tlcCompany) {
        tlcCompany = new Company({
            name: 'The Learning Collegiate',
            companyId: tlcCompanyId,
            address: 'Main Campus, TLC',
            contact: '+92 000 0000000',
            email: superAdminEmail,
            user: superAdmin._id
        });
        await tlcCompany.save();
        console.log('TLC Institute Created!');
    } else {
        tlcCompany.name = 'The Learning Collegiate';
        tlcCompany.user = superAdmin._id;
        await tlcCompany.save();
        console.log('TLC Institute Updated!');
    }

    // Link superadmin to the company
    superAdmin.company = tlcCompany._id;
    await superAdmin.save();

    console.log('Data Imported Successfully for Single-Institute Setup!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
};

importData();
