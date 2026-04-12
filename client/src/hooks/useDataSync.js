import { useState, useEffect, useCallback } from 'react';
import { saveToIDB, getFromIDB } from '../utils/offlineStorage';

const useDataSync = (fetchFunction, storeName, dependencies = [], interval = 5000) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const dependencyKey = JSON.stringify(dependencies);

  const fetchData = useCallback(async () => {
    try {
      if (!navigator.onLine) {
        setIsOffline(true);
        const cachedData = await getFromIDB(storeName);
        if (cachedData && cachedData.length > 0) {
            setData(cachedData);
        }
        setLoading(false);
        return;
      }

      setIsOffline(false);
      // Online: Fetch fresh data
      const response = await fetchFunction();
      const freshData = response.data; // Assuming axios response structure

      // Handle pagination wrapper { invoices: [], total: ... }
      const items = Array.isArray(freshData) ? freshData : (freshData.invoices || freshData.customers || freshData.products || []);
      
      if (items.length > 0) {
          setData(items);
          // Sync to local storage for offline use later
          saveToIDB(storeName, items);
      } else {
          // If empty from API, maybe we keep local cache? No, strict sync means empty.
          setData([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Data Sync Error:', err);
      setError(err);
      
      // Fallback to local storage on error
      const cachedData = await getFromIDB(storeName);
      if (cachedData && cachedData.length > 0) {
          setData(cachedData);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, storeName]);

  useEffect(() => {
    fetchData(); // Initial fetch

    const pollInterval = setInterval(() => {
      if (navigator.onLine) {
        fetchData();
      }
    }, interval);

    const handleOnline = () => {
        setIsOffline(false);
        fetchData();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData, interval, dependencyKey]);

  return { data, loading, error, isOffline, refetch: fetchData };
};

export default useDataSync;
