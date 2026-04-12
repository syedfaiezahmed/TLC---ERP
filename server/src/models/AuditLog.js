import mongoose from 'mongoose';

const auditLogSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorEmail: {
      type: String,
    },
    actorRole: {
      type: String,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
    },
    meta: {
      ip: String,
      userAgent: String,
      path: String,
      method: String,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ company: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;

