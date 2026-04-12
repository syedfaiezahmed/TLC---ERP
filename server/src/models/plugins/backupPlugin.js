import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'backup.json');

// Helper to read/write (duplicated from DataService to avoid circular dep if any, or just import)
const readLocalBackup = () => {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return {};
    const data = fs.readFileSync(BACKUP_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
};

const writeLocalBackup = (collectionName, data) => {
  if (process.env.NODE_ENV === 'production') return;

  try {
    const backup = readLocalBackup();
    backup[collectionName] = data;
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    logger.info(`[BackupPlugin] Synced ${collectionName} to local storage`);
  } catch (error) {
    logger.error(`[BackupPlugin] Failed to sync ${collectionName}`, error);
  }
};

const backupPlugin = (schema, options) => {
  if (process.env.NODE_ENV === 'production') return;

  schema.post('save', async function (doc) {
    try {
      const modelName = this.constructor.modelName;
      // Fetch all docs to keep sync (expensive but requested "Sync")
      // Optimization: In real app, we'd append/update, but strictly syncing means fetching fresh state
      const allDocs = await this.constructor.find().lean();
      writeLocalBackup(modelName, allDocs);
    } catch (err) {
      logger.error('Backup post-save error', err);
    }
  });

  schema.post('findOneAndUpdate', async function (doc) {
      if (!doc) return;
      try {
        const modelName = this.model.modelName;
        const allDocs = await this.model.find().lean();
        writeLocalBackup(modelName, allDocs);
      } catch (err) {
        logger.error('Backup post-findOneAndUpdate error', err);
      }
  });
  
  schema.post('findOneAndDelete', async function (doc) {
      if (!doc) return;
      try {
        const modelName = this.model.modelName;
        const allDocs = await this.model.find().lean();
        writeLocalBackup(modelName, allDocs);
      } catch (err) {
        logger.error('Backup post-findOneAndDelete error', err);
      }
  });
};

export default backupPlugin;
