const store = new Map();

export const getCache = (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expireAt && entry.expireAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
};

export const setCache = (key, value, ttlSeconds = 15) => {
  const expireAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  store.set(key, { value, expireAt });
};

export const makeKey = (scope, params = {}) => {
  const serialized = JSON.stringify(params);
  return `${scope}:${serialized}`;
};
