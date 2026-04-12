const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: './server/.env' });

// Import models
const Company = require('./server/src/models/Company.js');
const Customer = require('./server/src/models/Customer.js');
const Invoice = require('./server/src/models/Invoice.js');
const Ledger = require('./server/src/models/Ledger.js');
const User = require('./server/src/models/User.js');
const Product = require('./server/src/models/Product.js');

const checkData = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB successfully!');

        console.log('\n=== CURRENT DATABASE STATUS ===');
        
        // Check each collection
        const users = await User.countDocuments();
        const companies = await Company.countDocuments();
        const customers = await Customer.countDocuments();
        const invoices = await Invoice.countDocuments();
        const ledger = await Ledger.countDocuments();
        const products = await Product.countDocuments();

        console.log(`Users: ${users}`);
        console.log(`Companies: ${companies}`);
        console.log(`Customers: ${customers}`);
        console.log(`Invoices: ${invoices}`);
        console.log(`Ledger Entries: ${ledger}`);
        console.log(`Products: ${products}`);

        if (users === 0 && companies === 0 && customers === 0) {
            console.log('\n⚠️  WARNING: Database appears to be empty!');
        } else {
            console.log('\n✅ Some data exists in the database.');
        }

        console.log('\n=== CHECKING BACKUP FILES ===');
        
        // Check backup files
        const backupFiles = [
            './server/backups/backup_2026-02-18T19-00-43.158Z.json',
            './server/backups/backup_2026-02-16T19-01-16.979Z.json'
        ];

        for (const file of backupFiles) {
            try {
                const backupData = JSON.parse(fs.readFileSync(file, 'utf8'));
                console.log(`\n📁 Backup file found: ${file}`);
                console.log(`   IV: ${backupData.iv}`);
                console.log(`   Encrypted data length: ${backupData.encryptedData.length}`);
            } catch (error) {
                console.log(`\n❌ Error reading backup file ${file}: ${error.message}`);
            }
        }

        console.log('\n=== RECOMMENDATIONS ===');
        if (users === 0 && companies === 0) {
            console.log('1. Database is empty - consider restoring from backup');
            console.log('2. Use the backup restore endpoint to recover data');
            console.log('3. Most recent backup contains data from Feb 18, 2026');
        }

    } catch (error) {
        console.error('Error checking data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

checkData();