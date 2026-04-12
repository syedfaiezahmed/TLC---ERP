const cacheStore = new Map();

export const getCache = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (entry.expireAt && entry.expireAt < Date.now()) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
};

export const setCache = (key, value, ttlSeconds = 10) => {
  const expireAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  cacheStore.set(key, { value, expireAt });
};

export const makeKey = (scope, params = {}) => {
  const serialized = JSON.stringify(params);
  return `${scope}:${serialized}`;
};
