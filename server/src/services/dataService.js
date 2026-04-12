import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'backup.json');

// Ensure data directory exists in development
if (process.env.NODE_ENV !== 'production') {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Helper to read local backup
 */
const readLocalBackup = () => {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return {};
    const data = fs.readFileSync(BACKUP_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to read local backup', error);
    return {};
  }
};

/**
 * Helper to write local backup
 */
const writeLocalBackup = (collectionName, data) => {
  if (process.env.NODE_ENV === 'production') return; // Skip in Vercel/Prod

  try {
    const backup = readLocalBackup();
    backup[collectionName] = data;
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    logger.info(`Local backup updated for ${collectionName}`);
  } catch (error) {
    logger.error('Failed to write local backup', error);
  }
};

const DataService = {
  /**
   * Create a new document
   * @param {Model} model Mongoose Model
   * @param {Object} data Data to create
   */
  create: async (model, data) => {
    try {
      const doc = await model.create(data);
      
      // Sync to local backup (Dev only)
      if (process.env.NODE_ENV !== 'production') {
        const allDocs = await model.find().lean();
        writeLocalBackup(model.modelName, allDocs);
      }
      
      return doc;
    } catch (error) {
      logger.error(`MongoDB Create Failed for ${model.modelName}`, error);
      // Fallback logic could go here for Dev
      throw error; 
    }
  },

  /**
   * Find documents
   * @param {Model} model Mongoose Model
   * @param {Object} query Query object
   */
  find: async (model, query = {}) => {
    try {
      const docs = await model.find(query).sort({ createdAt: -1 });
      return docs;
    } catch (error) {
      logger.error(`MongoDB Find Failed for ${model.modelName}`, error);
      
      // Fallback to local backup in Dev
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Switching to local backup for read operation');
        const backup = readLocalBackup();
        const collection = backup[model.modelName] || [];
        // Simple filtering (not full Mongoose query support)
        return collection; 
      }
      throw error;
    }
  },

  /**
   * Find one document
   * @param {Model} model 
   * @param {Object} query 
   */
  findOne: async (model, query) => {
    try {
      return await model.findOne(query);
    } catch (error) {
      logger.error(`MongoDB FindOne Failed for ${model.modelName}`, error);
      if (process.env.NODE_ENV !== 'production') {
        const backup = readLocalBackup();
        const collection = backup[model.modelName] || [];
        return collection.find(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
        });
      }
      throw error;
    }
  },

  /**
   * Update a document
   * @param {Model} model 
   * @param {String} id 
   * @param {Object} update 
   */
  update: async (model, id, update) => {
    try {
      const doc = await model.findByIdAndUpdate(id, update, { new: true });
      
      if (process.env.NODE_ENV !== 'production') {
        const allDocs = await model.find().lean();
        writeLocalBackup(model.modelName, allDocs);
      }
      return doc;
    } catch (error) {
      logger.error(`MongoDB Update Failed for ${model.modelName}`, error);
      throw error;
    }
  },

  /**
   * Delete a document
   * @param {Model} model 
   * @param {String} id 
   */
  delete: async (model, id) => {
    try {
      const doc = await model.findByIdAndDelete(id);
      
      if (process.env.NODE_ENV !== 'production') {
        const allDocs = await model.find().lean();
        writeLocalBackup(model.modelName, allDocs);
      }
      return doc;
    } catch (error) {
      logger.error(`MongoDB Delete Failed for ${model.modelName}`, error);
      throw error;
    }
  }
};

export default DataService;
