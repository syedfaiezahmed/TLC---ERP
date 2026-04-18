import Ledger from '../models/Ledger.js';

/**
 * Recalculate ledger balances for a company or specific student/account
 * Optimized with BulkWrite for performance
 * 
 * @param {string} companyId - The company ID
 * @param {string} [studentId] - Optional: Recalculate only for a specific student (usually for AR)
 * @param {string} [accountName] - Optional: Recalculate only for a specific account type
 * @param {string} [teacherId] - Optional: Recalculate only for a specific teacher (usually for AP)
 */
const recalculateLedger = async (companyId, studentId = null, accountName = null, teacherId = null) => {
    if (!companyId) throw new Error('recalculateLedger: companyId is required');
    if (!studentId && !accountName && !teacherId) {
        // Calling with no filter would mix all accounts and produce a meaningless balance
        throw new Error('recalculateLedger: at least one of studentId, accountName, or teacherId is required');
    }

    let query = { company: companyId };
    
    // If specific student, we usually care about their Accounts Receivable history
    if (studentId) {
        query.student = studentId;
        if (!accountName) {
            query.accountName = 'Accounts Receivable';
        }
    }

    // If specific teacher, we usually care about their Accounts Payable history
    if (teacherId) {
        query.teacher = teacherId;
        if (!accountName) {
            query.accountName = 'Accounts Payable';
        }
    }

    // If specific account name provided (e.g. 'Cash', 'Sales Revenue')
    if (accountName) {
        query.accountName = accountName;
    }

    // Fetch entries sorted chronologically
    const allEntries = await Ledger.find(query)
        .sort({ date: 1, createdAt: 1 })
        .lean();
    
    let runningBalance = 0;
    const bulkOps = [];

    for (const item of allEntries) {
        // Standard Accounting Equation:
        // Assets & Expenses: Debit normal (+), Credit (-)
        // Liabilities, Equity & Revenue: Credit normal (+), Debit (-)
        
        const isDebitNormal = ['asset', 'expense'].includes(item.accountType?.toLowerCase());
        
        if (isDebitNormal) {
            runningBalance += (item.debit || 0) - (item.credit || 0);
        } else {
            runningBalance += (item.credit || 0) - (item.debit || 0);
        }
        
        // Update entry with the calculated running balance for THAT account/context
        bulkOps.push({
            updateOne: {
                filter: { _id: item._id },
                update: { $set: { balance: Number(runningBalance.toFixed(2)) } }
            }
        });
        
        // BATCH PROCESSING: Execute in chunks of 500 to avoid memory overflow on massive ledgers
        if (bulkOps.length >= 500) {
            await Ledger.bulkWrite(bulkOps);
            bulkOps.length = 0; // Clear array
        }
    }

    if (bulkOps.length > 0) {
        await Ledger.bulkWrite(bulkOps);
    }
};

export { recalculateLedger };
