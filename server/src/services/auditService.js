import AuditLog from '../models/AuditLog.js';

const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const keys = Object.keys(clone);
  for (const k of keys) {
    if (k.toLowerCase().includes('password') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret')) {
      delete clone[k];
      continue;
    }
    const v = clone[k];
    if (v && typeof v === 'object') {
      clone[k] = sanitize(v);
    }
  }
  return clone;
};

export const logAudit = async ({ req, companyId, action, entityType, entityId, before, after }) => {
  try {
    const actor = req?.user?._id;
    const actorEmail = req?.user?.email;
    const actorRole = req?.user?.role;
    const ip = req?.headers?.['x-forwarded-for']?.toString()?.split(',')?.[0]?.trim() || req?.ip;
    const userAgent = req?.headers?.['user-agent'];

    await AuditLog.create({
      company: companyId,
      actor,
      actorEmail,
      actorRole,
      action,
      entityType,
      entityId,
      before: sanitize(before),
      after: sanitize(after),
      meta: {
        ip,
        userAgent,
        path: req?.originalUrl,
        method: req?.method,
      },
    });
  } catch (e) {
  }
};

