import mongoose from 'mongoose';
import FeeVoucher from '../models/FeeVoucher.js';
import FeePayment from '../models/FeePayment.js';

/**
 * CA-correct voucher heal — in two phases.
 *
 * Phase 1 (TRUTH SYNC): Rebuild `voucher.paidAmount` from the SUM of all ACTIVE
 *   FeePayment records. FeePayment is the source of truth; voucher.paidAmount is
 *   just a cache that can drift (failed saves, historical bugs, race conditions).
 *
 * Phase 2 (STATUS): Recompute `voucher.status` from paidAmount + dueDate:
 *   - paidAmount >= totalFee - 0.5   → 'paid'     (base covered; late fee may be waived)
 *   - paidAmount > 0 AND past due    → 'overdue'
 *   - paidAmount > 0                 → 'partial'
 *   - paidAmount == 0 AND past due   → 'overdue'
 *   - otherwise                      → 'pending'
 *
 * Preserves 'cancelled' (used for bad-debt write-offs).
 * Backfills paidDate on vouchers that become paid.
 *
 * Call this:
 *   • at the top of voucher-list / voucher-stats endpoints
 *   • after any payment creation / deletion / refund
 *   • after bulk operations that may leave voucher state stale
 *
 * @param {string|ObjectId} companyId
 */
export const healVoucherStatuses = async (companyId) => {
  const now = new Date();
  try {
    const companyObjId = new mongoose.Types.ObjectId(companyId);

    // ── PHASE 1: Rebuild paidAmount from FeePayment records ────────────────
    const paymentSums = await FeePayment.aggregate([
      { $match: { company: companyObjId, status: 'active', voucher: { $ne: null } } },
      { $group: { _id: '$voucher', totalPaid: { $sum: '$amount' } } },
    ]);

    const touchedVoucherIds = paymentSums.map((p) => p._id);

    if (paymentSums.length > 0) {
      const bulkOps = paymentSums.map((p) => ({
        updateOne: {
          filter: { _id: p._id, company: companyObjId },
          update: { $set: { paidAmount: p.totalPaid } },
        },
      }));
      const bulkRes = await FeeVoucher.bulkWrite(bulkOps, { ordered: false });
      console.log(`[healVoucherStatuses] Phase 1: paidAmount rebuilt for ${bulkRes.modifiedCount || 0} vouchers (${paymentSums.length} payment groups)`);
    }

    // Reset paidAmount = 0 on vouchers that have no active payments
    const resetRes = await FeeVoucher.updateMany(
      {
        company: companyObjId,
        _id: { $nin: touchedVoucherIds },
        status: { $ne: 'cancelled' },
        paidAmount: { $gt: 0 },
      },
      { $set: { paidAmount: 0 } }
    );
    if (resetRes.modifiedCount > 0) {
      console.log(`[healVoucherStatuses] Phase 1: reset paidAmount=0 on ${resetRes.modifiedCount} orphan vouchers`);
    }

    // ── PHASE 2: Recompute status from the fresh paidAmount ────────────────
    const statusRes = await FeeVoucher.updateMany(
      { company: companyObjId, status: { $ne: 'cancelled' } },
      [
        {
          $set: {
            status: {
              $switch: {
                branches: [
                  {
                    case: { $gte: [{ $ifNull: ['$paidAmount', 0] }, { $subtract: ['$totalFee', 0.5] }] },
                    then: 'paid',
                  },
                  {
                    case: {
                      $and: [
                        { $gt: [{ $ifNull: ['$paidAmount', 0] }, 0] },
                        { $lt: ['$dueDate', now] },
                      ],
                    },
                    then: 'overdue',
                  },
                  { case: { $gt: [{ $ifNull: ['$paidAmount', 0] }, 0] }, then: 'partial' },
                  { case: { $lt: ['$dueDate', now] }, then: 'overdue' },
                ],
                default: 'pending',
              },
            },
          },
        },
      ]
    );
    console.log(`[healVoucherStatuses] Phase 2: status recomputed on ${statusRes.modifiedCount || 0} vouchers`);

    // Backfill paidDate on vouchers that just became paid
    await FeeVoucher.updateMany(
      {
        company: companyObjId,
        status: 'paid',
        $or: [{ paidDate: null }, { paidDate: { $exists: false } }],
      },
      { $set: { paidDate: now } }
    );

    return { ok: true };
  } catch (err) {
    console.error('[healVoucherStatuses] FAILED:', err.message, err.stack);
    return { ok: false, error: err.message };
  }
};

export default healVoucherStatuses;
