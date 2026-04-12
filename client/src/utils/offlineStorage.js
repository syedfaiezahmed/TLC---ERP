import { openDB } from 'idb';

const DB_NAME = 'AccountingAppDB';
const DB_VERSION = 1;

const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('invoices')) {
        db.createObjectStore('invoices', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('ledger')) {
        db.createObjectStore('ledger', { keyPath: '_id' });
      }
      // Add more stores as needed
    },
  });
};

export const saveToIDB = async (storeName, data) => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    // Clear old data for simple sync strategy (or merge?)
    // For simplicity, we'll replace the store content or update items.
    // If data is an array, we clear and add all (simplest for full list sync)
    if (Array.isArray(data)) {
        await tx.store.clear(); // Careful: clears pagination state if not handled
        for (const item of data) {
            await tx.store.put(item);
        }
    } else {
        await tx.store.put(data);
    }
    await tx.done;
  } catch (error) {
    console.error(`Failed to save to IDB (${storeName}):`, error);
  }
};

export const getFromIDB = async (storeName) => {
  try {
    const db = await initDB();
    return await db.getAll(storeName);
  } catch (error) {
    console.error(`Failed to get from IDB (${storeName}):`, error);
    return [];
  }
};
