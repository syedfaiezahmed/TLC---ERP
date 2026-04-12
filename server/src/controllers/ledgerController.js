import Ledger from '../models/Ledger.js';
import Company from '../models/Company.js';
import { recalculateLedger } from '../services/ledgerService.js';
import { postJournal } from '../services/journalService.js';
import { assertPeriodOpen } from '../services/periodLockService.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import { logAudit } from '../services/auditService.js';

// @desc    Add a new ledger entry
// @route   POST /api/ledger
// @access  Private/Admin
const addLedgerEntry = async (req, res) => {
  try {
    const {
      companyId,
      studentId,
      feeId,
      date,
      description,
      debit,
      credit,
      type,
      accountName,
      accountType
    } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    try { await assertPeriodOpen(companyId, date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    let query = { company: companyId };
    if (accountName) {
        query.accountName = accountName;
    } else if (studentId) {
        query.student = studentId;
    }

    const lastEntry = await Ledger.findOne(query)
      .sort({ date: -1, createdAt: -1 });

    let previousBalance = lastEntry ? lastEntry.balance : 0;
    
    const debitVal = Number(debit) || 0;
    const creditVal = Number(credit) || 0;

    const isDebitNormal = ['asset', 'expense'].includes(accountType?.toLowerCase());
    
    let movement = 0;
    if (isDebitNormal) {
        movement = debitVal - creditVal;
    } else {
        movement = creditVal - debitVal;
    }

    const newBalance = Number((previousBalance + movement).toFixed(2));

    const ledgerEntry = new Ledger({
      company: companyId,
      student: studentId,
      fee: feeId,
      date,
      description,
      debit: debitVal,
      credit: creditVal,
      balance: newBalance,
      type,
      accountName,
      accountType
    });

    const createdEntry = await ledgerEntry.save();
    try { await logAudit({ req, companyId, action: 'create', entityType: 'ledger', entityId: createdEntry._id, before: null, after: createdEntry }); } catch(_) {}
    return res.status(201).json(createdEntry);
  } catch (error) {
    console.error('[addLedgerEntry]', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Get ledger entries
// @route   GET /api/ledger/company/:companyId
// @access  Private/Admin
const getLedger = async (req, res) => {
  try {
    const { companyId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const { startDate, endDate, accountName, studentId, search, type } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    let query = { company: companyId };

    if (startDate && endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date = { $gte: new Date(startDate), $lte: end };
    }
    
    if (accountName) {
        query.accountName = accountName;
    }
    
    if (type && type !== 'all') {
        if (type === 'debit') {
            query.debit = { $gt: 0 };
        } else if (type === 'credit') {
            query.credit = { $gt: 0 };
        }
    }
    
    if (studentId) {
        query.student = studentId;
    }

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { description: searchRegex },
            { reference: searchRegex },
            { accountName: searchRegex }
        ];
    }

    const [entries, total] = await Promise.all([
        Ledger.find(query)
            .select('date description debit credit balance type accountName referenceType referenceId student fee')
            .populate('student', 'name')
            .populate('fee', 'feeNumber')
            .sort({ date: 1, createdAt: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Ledger.countDocuments(query)
    ]);

    res.json({
        entries,
        page,
        pages: Math.ceil(total / limit),
        total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update ledger entry
// @route   PUT /api/ledger/:id
// @access  Private/Admin
const updateLedgerEntry = async (req, res) => {
    try {
        const entry = await Ledger.findById(req.params.id).populate('company');
        
        if (!entry) return res.status(404).json({ message: 'Entry not found' });
        if (!canAccessCompany(req.user, entry.company)) return res.status(401).json({ message: 'Not authorized' });

        const { description, debit, credit, date } = req.body;

        try { await assertPeriodOpen(entry.company._id, date || entry.date); } catch(lockErr) {
          return res.status(403).json({ message: lockErr.message });
        }

        const before = entry.toObject();
        if (description) entry.description = description;
        if (date) entry.date = date;
        
        if (debit !== undefined) entry.debit = Number(debit);
        if (credit !== undefined) entry.credit = Number(credit);

        await entry.save();
        try { await logAudit({ req, companyId: entry.company._id, action: 'update', entityType: 'ledger', entityId: entry._id, before, after: entry.toObject() }); } catch(_) {}

        if (debit !== undefined || credit !== undefined || date) {
            const accountName = entry.accountName || null;
            const studentId = entry.student || null;
            try { await recalculateLedger(entry.company._id, studentId, accountName); } catch(lErr) { console.error('[updateLedger]', lErr.message); }
        }

        return res.json({ message: 'Entry updated and ledger recalculated' });

    } catch (error) {
        console.error('[updateLedgerEntry]', error.message);
        if (!res.headersSent) return res.status(400).json({ message: error.message });
    }
}

// @desc    Delete ledger entry
// @route   DELETE /api/ledger/:id
// @access  Private/Admin
const deleteLedgerEntry = async (req, res) => {
    try {
        const entry = await Ledger.findById(req.params.id).populate('company');
        
        if (!entry) return res.status(404).json({ message: 'Entry not found' });
        if (!canAccessCompany(req.user, entry.company)) return res.status(401).json({ message: 'Not authorized' });

        try { await assertPeriodOpen(entry.company._id, entry.date); } catch(lockErr) {
          return res.status(403).json({ message: lockErr.message });
        }

        const companyId = entry.company._id;
        const studentId = entry.student;
        const accountName = entry.accountName;

        const before = entry.toObject();
        await entry.deleteOne();
        try { await logAudit({ req, companyId: entry.company._id, action: 'delete', entityType: 'ledger', entityId: entry._id, before, after: null }); } catch(_) {}
        try { await recalculateLedger(companyId, studentId, accountName); } catch(lErr) { console.error('[deleteLedger]', lErr.message); }

        return res.json({ message: 'Entry deleted and ledger recalculated' });

    } catch (error) {
        console.error('[deleteLedgerEntry]', error.message);
        if (!res.headersSent) return res.status(400).json({ message: error.message });
    }
}

// @desc    Add a new balanced journal entry
// @route   POST /api/ledger/journal
// @access  Private/Admin
const addJournalEntry = async (req, res) => {
  try {
    const {
      companyId,
      date,
      description,
      reference,
      lines // Array of { accountName, accountType, debit, credit, studentId, teacherId }
    } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    try { await assertPeriodOpen(companyId, date); } catch(lockErr) {
      return res.status(403).json({ message: lockErr.message });
    }

    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ message: 'A journal entry must have at least 2 lines' });
    }

    const meta = {
      companyId,
      date,
      description,
      reference,
      referenceType: 'journal_voucher'
    };

    const journalLines = lines.map(line => ({
      accountName: line.accountName,
      accountType: line.accountType || 'asset',
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      student: line.studentId || line.student || undefined,
      teacher: line.teacherId || line.teacher || undefined,
      description: line.description || description || 'Manual Journal Entry',
      type: 'journal_voucher'
    }));

    const created = await postJournal(meta, journalLines);
    
    const affectedAccounts = [...new Set(journalLines.map(l => l.accountName))];
    const affectedStudents = [...new Set(journalLines.filter(l => l.student).map(l => l.student))];
    const affectedTeachers = [...new Set(journalLines.filter(l => l.teacher).map(l => l.teacher))];

    for (const acc of affectedAccounts) {
        await recalculateLedger(companyId, null, acc);
    }
    for (const studentId of affectedStudents) {
        await recalculateLedger(companyId, studentId);
    }
    for (const teacherId of affectedTeachers) {
        await recalculateLedger(companyId, null, null, teacherId);
    }

    await logAudit({ req, companyId, action: 'create', entityType: 'journal_voucher', entityId: created[0].journalId, before: null, after: created });

    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Sync/Recalculate entire ledger for a company
// @route   POST /api/ledger/sync/:companyId
// @access  Private/Admin
const syncLedger = async (req, res) => {
    try {
        const { companyId } = req.params;

        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ message: 'Company not found' });
        if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

        // Get all unique students in this company's ledger
        const uniqueStudents = await Ledger.distinct('student', { company: companyId, student: { $ne: null } });
        
        // Get all unique account names in this company's ledger (excluding student-specific ones if any)
        const uniqueAccounts = await Ledger.distinct('accountName', { company: companyId, accountName: { $ne: null } });

        // Recalculate for each context
        for (const studentId of uniqueStudents) {
            await recalculateLedger(companyId, studentId, 'Accounts Receivable');
        }

        for (const accountName of uniqueAccounts) {
            await recalculateLedger(companyId, null, accountName);
        }

        res.json({ message: 'Ledger synchronization complete' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export {
  addLedgerEntry,
  getLedger,
  updateLedgerEntry,
  deleteLedgerEntry,
  addJournalEntry,
  syncLedger
};
