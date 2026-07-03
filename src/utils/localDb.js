// Local database using localStorage
// Persists products, transactions, and users across sessions

const KEYS = {
  products:     'pos_v2_products',
  transactions: 'pos_v2_transactions',
  users:        'pos_v2_users',
};

export function dbLoad(key) {
  try {
    const raw = localStorage.getItem(KEYS[key]);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function dbSave(key, data) {
  try {
    localStorage.setItem(KEYS[key], JSON.stringify(data));
  } catch (e) {
    console.error('[LocalDB] Save failed for key:', key, e);
  }
}

export function dbClear(key) {
  localStorage.removeItem(KEYS[key]);
}

export function dbClearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

// Initialize a key with seedData only if it hasn't been set yet
export function dbInit(key, seedData) {
  if (dbLoad(key) === null) {
    dbSave(key, seedData);
  }
}
