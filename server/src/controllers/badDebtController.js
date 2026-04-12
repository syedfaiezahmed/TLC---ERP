import badDebtService from '../services/badDebtService.js';
import BadDebt from '../models/BadDebt.js';

class BadDebtController {
  async markAsBadDebt(req, res) {
    try {
      // Accept 'reason' (frontend) or 'writeOffReason' (API direct calls)
      const { feeId, voucherId, writeOffReason, reason, notes } = req.body;
      const companyId = req.user.company;
      const userId = req.user._id;

      const finalReason = writeOffReason || reason;

      if (!finalReason) {
        return res.status(400).json({
          success: false,
          message: 'Write-off reason is required',
        });
      }

      if (!feeId && !voucherId) {
        return res.status(400).json({
          success: false,
          message: 'Either Fee ID or Voucher ID is required',
        });
      }

      const result = await badDebtService.markAsBadDebt(
        feeId || null,
        finalReason + (notes ? ` — ${notes}` : ''),
        companyId,
        userId,
        voucherId || null
      );

      res.json({
        success: true,
        message: result.message,
        badDebt: result.badDebt
      });

    } catch (error) {
      console.error('Error marking as bad debt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark as bad debt',
        error: error.message
      });
    }
  }

  async recoverBadDebt(req, res) {
    try {
      const { badDebtId } = req.params;
      const { recoveryAmount, recoveryNotes } = req.body;
      const companyId = req.user.company;
      const userId = req.user._id;

      if (!recoveryAmount || !recoveryNotes) {
        return res.status(400).json({
          success: false,
          message: 'Recovery amount and notes are required'
        });
      }

      const result = await badDebtService.recoverBadDebt(
        badDebtId,
        recoveryAmount,
        recoveryNotes,
        companyId,
        userId
      );

      res.json({
        success: true,
        message: result.message,
        badDebt: result.badDebt
      });

    } catch (error) {
      console.error('Error recovering bad debt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to recover bad debt',
        error: error.message
      });
    }
  }

  async getBadDebts(req, res) {
    try {
      const filters = req.query;
      const companyId = req.user.company;

      const result = await badDebtService.getBadDebts(companyId, filters);

      res.json({
        success: true,
        badDebts: result.badDebts,
        pagination: result.pagination
      });

    } catch (error) {
      console.error('Error fetching bad debts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bad debts',
        error: error.message
      });
    }
  }

  async getBadDebtSummary(req, res) {
    try {
      const filters = req.query;
      const companyId = req.user.company;

      const result = await badDebtService.getBadDebtSummary(companyId, filters);

      res.json({
        success: true,
        summary: result
      });

    } catch (error) {
      console.error('Error fetching bad debt summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bad debt summary',
        error: error.message
      });
    }
  }

  async getStudentBadDebtHistory(req, res) {
    try {
      const { studentId } = req.params;
      const companyId = req.user.company;

      const result = await badDebtService.getStudentBadDebtHistory(studentId, companyId);

      res.json({
        success: true,
        badDebts: result.badDebts,
        summary: result.summary
      });

    } catch (error) {
      console.error('Error fetching student bad debt history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student bad debt history',
        error: error.message
      });
    }
  }

  async bulkMarkAsBadDebt(req, res) {
    try {
      const { feeIds, writeOffReason } = req.body;
      const companyId = req.user.company;
      const userId = req.user._id;

      if (!Array.isArray(feeIds) || feeIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Fee IDs array is required'
        });
      }

      if (!writeOffReason) {
        return res.status(400).json({
          success: false,
          message: 'Write-off reason is required'
        });
      }

      const result = await badDebtService.bulkMarkAsBadDebt(
        feeIds,
        writeOffReason,
        companyId,
        userId
      );

      res.json({
        success: true,
        message: result.message,
        totalWrittenOff: result.totalWrittenOff,
        results: result.results
      });

    } catch (error) {
      console.error('Error bulk marking as bad debt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk mark as bad debt',
        error: error.message
      });
    }
  }

  async reverseBadDebt(req, res) {
    try {
      const { badDebtId } = req.params;
      const { reverseReason } = req.body;
      const companyId = req.user.company;
      const userId = req.user._id;

      if (!reverseReason) {
        return res.status(400).json({
          success: false,
          message: 'Reverse reason is required'
        });
      }

      const result = await badDebtService.reverseBadDebt(
        badDebtId,
        reverseReason,
        companyId,
        userId
      );

      res.json({
        success: true,
        message: result.message,
        badDebt: result.badDebt
      });

    } catch (error) {
      console.error('Error reversing bad debt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reverse bad debt',
        error: error.message
      });
    }
  }

  async getBadDebtDetails(req, res) {
    try {
      const { badDebtId } = req.params;
      const companyId = req.user.company;

      const badDebt = await BadDebt.findOne({
        _id: badDebtId,
        company: companyId
      })
      .populate('student', 'name email phone address')
      .populate('fee', 'feeNumber date totalAmount items status')
      .populate('voucher', 'voucherNumber dueDate totalFee')
      .populate('approvedBy', 'name')
      .populate({
        path: 'fee.items.course',
        select: 'name'
      });

      if (!badDebt) {
        return res.status(404).json({
          success: false,
          message: 'Bad debt not found'
        });
      }

      res.json({
        success: true,
        badDebt: badDebt
      });

    } catch (error) {
      console.error('Error fetching bad debt details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bad debt details',
        error: error.message
      });
    }
  }

  async updateBadDebt(req, res) {
    try {
      const { badDebtId } = req.params;
      const updateData = req.body;
      const companyId = req.user.company;

      const badDebt = await BadDebt.findOne({
        _id: badDebtId,
        company: companyId
      });

      if (!badDebt) {
        return res.status(404).json({
          success: false,
          message: 'Bad debt not found'
        });
      }

      // Allow updating only certain fields
      const allowedUpdates = ['writeOffReason', 'recoveryNotes'];
      const updates = {};

      for (const field of allowedUpdates) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      Object.assign(badDebt, updates);
      await badDebt.save();

      res.json({
        success: true,
        message: 'Bad debt updated successfully',
        badDebt: badDebt
      });

    } catch (error) {
      console.error('Error updating bad debt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update bad debt',
        error: error.message
      });
    }
  }

  async getBadDebtReport(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const companyId = req.user.company;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const result = await badDebtService.getBadDebtReport(
        companyId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        report: result
      });

    } catch (error) {
      console.error('Error generating bad debt report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate bad debt report',
        error: error.message
      });
    }
  }

  async deleteBadDebt(req, res) {
    try {
      const { badDebtId } = req.params;
      const companyId = req.user.company;

      const badDebt = await BadDebt.findOne({
        _id: badDebtId,
        company: companyId
      });

      if (!badDebt) {
        return res.status(404).json({
          success: false,
          message: 'Bad debt not found'
        });
      }

      if (badDebt.status === 'recovered') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete recovered bad debt'
        });
      }

      await BadDebt.findByIdAndDelete(badDebtId);

      res.json({
        success: true,
        message: 'Bad debt deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting bad debt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete bad debt',
        error: error.message
      });
    }
  }
}

export default new BadDebtController();
