import { normalizeError, notifyError } from './errors';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');

export function getAuthToken() {
  return localStorage.getItem('pos_token');
}

export function setAuthToken(token) {
  localStorage.setItem('pos_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('pos_token');
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    const normalized = notifyError(err, { context: 'api' });
    throw Object.assign(new Error(normalized.message), normalized);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed with status ${response.status}`;
    const normalized = normalizeError(
      Object.assign(new Error(message), { status: response.status, errors: data?.errors }),
      { context: 'api' }
    );
    throw Object.assign(new Error(normalized.message), normalized, { errors: data?.errors });
  }

  return data;
}

const queryString = (params) => {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  });
  const value = qs.toString();
  return value ? `?${value}` : '';
};

// ---- auth ----
export async function login(username, password) {
  return request('/login', { method: 'POST', body: { username, password } });
}

export async function fetchMe() {
  return request('/me');
}

export const changePassword = (currentPassword, newPassword) =>
  request('/change-password', { method: 'POST', body: { currentPassword, newPassword } });

// ---- products ----
export const fetchProducts = () => request('/products');
export const createProduct = (payload) => request('/products', { method: 'POST', body: payload });
export const updateProduct = (id, payload) => request(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
export const deleteProduct = (id) => request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- categories ----
export const fetchCategories = () => request('/categories');
export const createCategory = (name) => request('/categories', { method: 'POST', body: { name } });
export const deleteCategory = (name, options = {}) =>
  request(`/categories/${encodeURIComponent(name)}${queryString(options)}`, { method: 'DELETE' });

// ---- users ----
export const fetchUsers = () => request('/users');
export const createUser = (payload) => request('/users', { method: 'POST', body: payload });
export const updateUser = (id, payload) => request(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
export const updateUserStatus = (id, payload) => request(`/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: payload });
export const deleteUser = (id) => request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- transactions ----
export const fetchTransactions = () => request('/transactions');
export const createTransaction = (payload) => request('/transactions', { method: 'POST', body: payload });
export const voidTransaction = (id, voidReason) =>
  request(`/transactions/${encodeURIComponent(id)}/void`, { method: 'POST', body: { voidReason } });

// ---- stock movements ----
export const fetchStockMovements = () => request('/stock-movements');
export const createStockMovement = async (payload) => {
  const res = await request('/stock-movements', { method: 'POST', body: payload });
  return { movement: res.movement, product: res.product || res.updatedProduct };
};

// ---- settings ----
export const fetchSettings = () => request('/settings');
export const updateSettings = (payload) => request('/settings', { method: 'PATCH', body: payload });

// ---- expenses ----
export const fetchExpenses = (from, to) => request(`/expenses${queryString({ from, to })}`);
export const createExpense = (payload) => request('/expenses', { method: 'POST', body: payload });

// ---- audit logs ----
export const fetchAuditLogs = () => request('/audit-logs');
export const addAuditLog = (user, action) => request('/audit-logs', { method: 'POST', body: { user, action } });

// ---- orders ----
export const fetchOrders = () => request('/orders');
export const createOrder = (payload) => request('/orders', { method: 'POST', body: payload });
export const updateOrder = (id, payload) => request(`/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
export const acquireOrderEditLock = (id, actor, ttlMinutes = 5) =>
  request(`/orders/${encodeURIComponent(id)}/lock`, { method: 'POST', body: { actor, ttlMinutes } });
export const releaseOrderEditLock = (id, actor = null) =>
  request(`/orders/${encodeURIComponent(id)}/lock`, { method: 'DELETE', body: { actor } });

// ---- credits ----
export const fetchCredits = () => request('/credits');
export const createCredit = (payload) => request('/credits', { method: 'POST', body: payload });
export const addCreditPayment = (id, amount, note = '') =>
  request(`/credits/${encodeURIComponent(id)}/payments`, { method: 'POST', body: { amount, note } });
export const updateCreditDueDate = (id, dueDate) =>
  request(`/credits/${encodeURIComponent(id)}/due-date`, { method: 'PATCH', body: { dueDate } });

// ---- one-time OR number migration ----
export const migrateOrNumbers = () => request('/migrate-or-numbers', { method: 'POST' });
