import { EventEmitter } from 'events';

class BackupEventEmitter extends EventEmitter {}

export const backupEvents = new BackupEventEmitter();

export const queueCompanyBackupEvent = (companyId) => {
    backupEvents.emit('queueBackup', companyId);
};
