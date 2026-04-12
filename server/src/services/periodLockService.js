import PeriodLock from '../models/PeriodLock.js';

export const assertPeriodOpen = async (companyId, date) => {
  if (!companyId) return;
  const txDate = date ? new Date(date) : new Date();
  const lock = await PeriodLock.findOne({ company: companyId }).lean();
  if (!lock?.lockedUntil) return;
  const lockedUntil = new Date(lock.lockedUntil);
  if (txDate <= lockedUntil) {
    const d = lockedUntil.toISOString().slice(0, 10);
    throw new Error(`Posting is locked up to ${d}`);
  }
};

