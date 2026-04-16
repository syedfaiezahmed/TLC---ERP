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

    // ── PHASE 2: Recompute status via iterative bulkWrite ─────────────────
    // (Plain JS logic — guaranteed to work on any MongoDB version, no aggregation quirks.)
    const vouchers = await FeeVoucher.find(
      { company: companyObjId, status: { $ne: 'cancelled' } },
      { _id: 1, status: 1, paidAmount: 1, totalFee: 1, dueDate: 1, paidDate: 1 }
    ).lean();

    const statusBulkOps = [];
    let paidCount = 0, partialCount = 0, overdueCount = 0, pendingCount = 0;

    for (const v of vouchers) {
      const paidAmount = Number(v.paidAmount) || 0;
      const totalFee = Number(v.totalFee) || 0;
      const dueDate = v.dueDate ? new Date(v.dueDate) : null;
      const isPastDue = dueDate && dueDate < now;

      let newStatus;
      if (paidAmount >= totalFee - 0.5) newStatus = 'paid';
      else if (paidAmount > 0 && isPastDue) newStatus = 'overdue';
      else if (paidAmount > 0) newStatus = 'partial';
      else if (isPastDue) newStatus = 'overdue';
      else newStatus = 'pending';

      if (newStatus === 'paid') paidCount++;
      else if (newStatus === 'partial') partialCount++;
      else if (newStatus === 'overdue') overdueCount++;
      else pendingCount++;

      if (newStatus !== v.status || (newStatus === 'paid' && !v.paidDate)) {
        const update = { status: newStatus };
        if (newStatus === 'paid' && !v.paidDate) update.paidDate = now;
        statusBulkOps.push({
          updateOne: {
            filter: { _id: v._id },
            update: { $set: update },
          },
        });
      }
    }

    if (statusBulkOps.length > 0) {
      const statusRes = await FeeVoucher.bulkWrite(statusBulkOps, { ordered: false });
      console.log(`[healVoucherStatuses] Phase 2: ${statusRes.modifiedCount} vouchers changed status (scanned ${vouchers.length}: paid=${paidCount}, partial=${partialCount}, overdue=${overdueCount}, pending=${pendingCount})`);
    } else {
      console.log(`[healVoucherStatuses] Phase 2: no status changes needed (scanned ${vouchers.length})`);
    }

    return { ok: true, scanned: vouchers.length, statusChanges: statusBulkOps.length };
  } catch (err) {
    console.error('[healVoucherStatuses] FAILED:', err.message, err.stack);
    return { ok: false, error: err.message };
  }
};

export default healVoucherStatuses;
