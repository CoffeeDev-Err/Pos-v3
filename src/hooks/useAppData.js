import { useCallback, useEffect, useState } from 'react';
import {
  fetchProducts,
  fetchCategories,
  fetchTransactions,
  fetchUsers,
  fetchSettings,
  fetchAuditLogs,
  addAuditLog,
  fetchStockMovements,
  fetchExpenses,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  deleteCategory,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  createTransaction,
  createStockMovement,
  createExpense,
  updateSettings,
  fetchOrders,
  createOrder,
  updateOrder,
  acquireOrderEditLock,
  releaseOrderEditLock,
  fetchCredits,
  addCreditPayment,
  updateCreditDueDate,
  voidTransaction,
} from '../utils/api';

const DEFAULT_SETTINGS = {
  storeName: "CARREN'S STORE",
  address: 'Urdaneta, Ilocos',
  phone: '09XX-XXX-XXXX',
  receiptFooter: 'Salamat sa inyong pagbili! Please come again :)',
};

/**
 * Centralized data store and actions for the POS app.
 * Keeps fetch logic in one place while preserving current API behavior.
 */
export function useAppData(currentUser) {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [orders, setOrders] = useState([]);
  const [credits, setCredits] = useState([]);

  const safeFetch = useCallback(async (fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.status === 403) return fallback;
      throw err;
    }
  }, []);

  const loadData = useCallback(async (role) => {
    const canManage = role === 'superadmin' || role === 'admin';
    const isSuper = role === 'superadmin';

    const results = await Promise.all([
      safeFetch(fetchProducts, []),
      safeFetch(fetchCategories, []),
      canManage ? safeFetch(fetchTransactions, []) : Promise.resolve([]),
      canManage ? safeFetch(fetchStockMovements, []) : Promise.resolve([]),
      canManage ? safeFetch(fetchExpenses, []) : Promise.resolve([]),
      isSuper ? safeFetch(fetchUsers, []) : Promise.resolve([]),
      safeFetch(fetchSettings, DEFAULT_SETTINGS),
      isSuper ? safeFetch(fetchAuditLogs, []) : Promise.resolve([]),
      safeFetch(fetchOrders, []),
      canManage ? safeFetch(fetchCredits, []) : Promise.resolve([]),
    ]);

    setProducts(results[0]);
    setCategories(results[1]);
    setTransactions(results[2]);
    setStockMovements(results[3]);
    setExpenses(results[4]);
    setUsers(results[5]);
    setSettings(results[6] || DEFAULT_SETTINGS);
    setAuditLogs(results[7]);
    setOrders(results[8]);
    setCredits(results[9]);
  }, [safeFetch]);

  const resetData = useCallback(() => {
    setProducts([]);
    setTransactions([]);
    setUsers([]);
    setCategories([]);
    setStockMovements([]);
    setAuditLogs([]);
    setExpenses([]);
    setSettings(DEFAULT_SETTINGS);
    setOrders([]);
    setCredits([]);
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    if (currentUser?.role !== 'superadmin') return;
    const logs = await fetchAuditLogs();
    setAuditLogs(logs);
  }, [currentUser]);

  const refreshStockMovements = useCallback(async () => {
    if (currentUser?.role !== 'superadmin' && currentUser?.role !== 'admin') return;
    const rows = await fetchStockMovements();
    setStockMovements(rows);
  }, [currentUser]);

  const mergeProducts = useCallback((updates) => {
    if (!Array.isArray(updates) || updates.length === 0) return;
    setProducts(prev => {
      const map = new Map(updates.map(p => [p.id, p]));
      return prev.map(p => map.get(p.id) || p);
    });
  }, []);

  const logAction = useCallback(async (action) => {
    if (currentUser?.name) {
      try {
        await addAuditLog(currentUser.name, action);
      } catch {
        return;
      }
    }
  }, [currentUser]);

  const handleCreateProduct = useCallback(async (payload) => {
    const product = await createProduct(payload);
    setProducts(prev => [...prev, product]);
    setCategories(prev => (prev.includes(product.category) ? prev : [...prev, product.category]));
    await logAction(`Created product "${payload.name}"`);
    await refreshAuditLogs();
    return product;
  }, [logAction, refreshAuditLogs]);

  const handleUpdateProduct = useCallback(async (id, payload) => {
    const product = await updateProduct(id, payload);
    setProducts(prev => prev.map(p => (p.id === product.id ? product : p)));
    setCategories(prev => (prev.includes(product.category) ? prev : [...prev, product.category]));
    await logAction(`Updated product "${payload.name || id}"`);
    await refreshAuditLogs();
    return product;
  }, [logAction, refreshAuditLogs]);

  const handleDeleteProduct = useCallback(async (id, name) => {
    await deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    await logAction(`Deleted product "${name || id}"`);
    await refreshAuditLogs();
  }, [logAction, refreshAuditLogs]);

  const handleCreateCategory = useCallback(async (name) => {
    const res = await createCategory(name);
    setCategories(prev => (prev.includes(res.name) ? prev : [...prev, res.name]));
    await logAction(`Created category "${name}"`);
    await refreshAuditLogs();
    return res;
  }, [logAction, refreshAuditLogs]);

  const handleDeleteCategory = useCallback(async (name, options) => {
    await deleteCategory(name, options);
    setCategories(prev => prev.filter(c => c !== name));
    await logAction(`Deleted category "${name}"`);
    await refreshAuditLogs();
  }, [logAction, refreshAuditLogs]);

  const handleCreateUser = useCallback(async (payload) => {
    const user = await createUser(payload);
    setUsers(prev => [...prev, user]);
    await logAction(`Created user "${payload.name}" (${payload.role})`);
    await refreshAuditLogs();
    return user;
  }, [logAction, refreshAuditLogs]);

  const handleUpdateUser = useCallback(async (id, payload) => {
    const user = await updateUser(id, payload);
    setUsers(prev => prev.map(u => (u.id === user.id ? user : u)));
    await logAction(`Updated user "${payload.name || id}"`);
    await refreshAuditLogs();
    return user;
  }, [logAction, refreshAuditLogs]);

  const handleUpdateUserStatus = useCallback(async (id, payload) => {
    const user = await updateUserStatus(id, payload);
    setUsers(prev => prev.map(u => (u.id === user.id ? user : u)));
    await logAction(`${user.active ? 'Activated' : 'Deactivated'} user "${user.name}"`);
    await refreshAuditLogs();
    return user;
  }, [logAction, refreshAuditLogs]);

  const handleDeleteUser = useCallback(async (id, name) => {
    await deleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    await logAction(`Deleted user "${name || id}"`);
    await refreshAuditLogs();
  }, [logAction, refreshAuditLogs]);

  const handleCreateTransaction = useCallback(async (payload) => {
    const res = await createTransaction(payload);
    setTransactions(prev => [...prev, res.transaction]);
    mergeProducts(res.updatedProducts);
    if (res.credit) {
      setCredits(prev => [res.credit, ...prev]);
    }
    const txnRef = res.transaction?.orNumber || res.transaction?.id?.slice(-8) || 'N/A';
    const amount = Number(res.transaction?.subtotal || 0).toFixed(2);
    await logAction(`Created transaction OR #${txnRef} (PHP ${amount})`);
    await refreshAuditLogs();
    await refreshStockMovements();
    return res.transaction;
  }, [logAction, mergeProducts, refreshAuditLogs, refreshStockMovements]);

  const handleStockIn = useCallback(async (payload) => {
    // payload.type overrides the default 'stock-in' (e.g. 'harvest')
    const res = await createStockMovement({ type: 'stock-in', ...payload });
    setStockMovements(prev => [...prev, res.movement]);
    mergeProducts([res.product]);
    const productLabel = res?.product?.name || payload?.productName || payload?.productId || 'Unknown product';
    const inputLabel = (payload?.inputQty && payload?.inputUnit)
      ? `${payload.inputQty} ${payload.inputUnit}`
      : `${payload.qty}`;
    const baseLabel = payload?.baseUnit ? `${payload.qty} ${payload.baseUnit}` : `${payload.qty}`;
    await logAction(`Stock-in: ${inputLabel} -> ${baseLabel} "${productLabel}"`);
    await refreshAuditLogs();
    return res;
  }, [logAction, mergeProducts, refreshAuditLogs]);

  const handleCreateExpense = useCallback(async (payload) => {
    const expense = await createExpense(payload);
    setExpenses(prev => [expense, ...prev]);
    await logAction(`Created expense "${payload?.name || payload?.category || 'N/A'}" (PHP ${Number(payload?.amount || 0).toFixed(2)})`);
    await refreshAuditLogs();
    return expense;
  }, [logAction, refreshAuditLogs]);

  const handleSaveSettings = useCallback(async (payload) => {
    const updated = await updateSettings(payload);
    setSettings(updated);
    await logAction('Updated store settings');
    await refreshAuditLogs();
    return updated;
  }, [logAction, refreshAuditLogs]);

  const handleCreateOrder = useCallback(async (payload) => {
    const order = await createOrder(payload);
    setOrders(prev => [order, ...prev]);
    await logAction(`Created order for "${payload?.customer?.name || 'Walk-in'}" (PHP ${Number(order?.subtotal || 0).toFixed(2)})`);
    await refreshAuditLogs();
    return order;
  }, [logAction, refreshAuditLogs]);

  const handleUpdateOrder = useCallback(async (id, updates) => {
    const order = await updateOrder(id, {
      ...updates,
      __actor: currentUser ? { id: currentUser.id, name: currentUser.name } : null,
    });
    setOrders(prev => prev.map(o => o.id === id ? order : o));
    const fields = Object.keys(updates || {}).filter(k => k !== '__actor');
    const hasItemEdit = fields.includes('items') || fields.includes('subtotal');
    const verb = hasItemEdit ? 'Edited' : 'Updated';
    const ref = String(id || '').slice(-8) || id;
    const readableFields = fields
      .map(field => {
        if (field === 'items') return 'items/qty';
        if (field === 'subtotal') return 'total amount';
        if (field === 'status') return updates?.status ? `status: ${updates.status}` : 'status';
        if (field === 'paymentMethod') return updates?.paymentMethod ? `payment: ${updates.paymentMethod}` : 'payment';
        if (field === 'dueDate') return updates?.dueDate ? `due date: ${updates.dueDate}` : 'due date';
        if (field === 'declineReason') return 'decline reason';
        if (field === 'cash') return 'cash received';
        if (field === 'change') return 'change';
        if (field === 'orNumber') return 'OR number';
        return field;
      })
      .filter(Boolean);
    await logAction(`${verb} order #${ref}${readableFields.length ? ` (${readableFields.join(', ')})` : ''}`);
    await refreshAuditLogs();
    return order;
  }, [currentUser, logAction, refreshAuditLogs]);

  const handleAcquireOrderEditLock = useCallback(async (id) => {
    const order = await acquireOrderEditLock(
      id,
      currentUser ? { id: currentUser.id, name: currentUser.name } : null,
      5
    );
    setOrders(prev => prev.map(o => o.id === id ? order : o));
    return order;
  }, [currentUser]);

  const handleReleaseOrderEditLock = useCallback(async (id) => {
    const order = await releaseOrderEditLock(
      id,
      currentUser ? { id: currentUser.id, name: currentUser.name } : null
    );
    if (order) {
      setOrders(prev => prev.map(o => o.id === id ? order : o));
    }
    return order;
  }, [currentUser]);

  const handleAddCreditPayment = useCallback(async (id, amount, note) => {
    const credit = await addCreditPayment(id, amount, note);
    setCredits(prev => prev.map(c => c.id === id ? credit : c));
    const ref = String(id || '').slice(-8) || id;
    await logAction(`Added credit payment to #${ref} (PHP ${Number(amount || 0).toFixed(2)})`);
    await refreshAuditLogs();
    return credit;
  }, [logAction, refreshAuditLogs]);

  const handleUpdateCreditDueDate = useCallback(async (id, dueDate) => {
    const credit = await updateCreditDueDate(id, dueDate);
    setCredits(prev => prev.map(c => c.id === id ? credit : c));
    const ref = String(id || '').slice(-8) || id;
    await logAction(`Updated credit due date for #${ref} to ${dueDate}`);
    await refreshAuditLogs();
    return credit;
  }, [logAction, refreshAuditLogs]);

  const handleVoidTransaction = useCallback(async (id, reason) => {
    const { transaction, updatedProducts } = await voidTransaction(id, reason);
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'void', voidReason: reason, voidedAt: transaction.voidedAt } : t));
    if (updatedProducts?.length) {
      setProducts(prev => prev.map(p => {
        const updated = updatedProducts.find(u => u.id === p.id);
        return updated ? { ...p, stock: updated.stock } : p;
      }));
    }
    const ref = transaction?.orNumber || String(id || '').slice(-8) || id;
    await logAction(`Voided transaction OR #${ref}${reason ? ` (Reason: ${reason})` : ''}`);
    await refreshAuditLogs();
    return transaction;
  }, [logAction, refreshAuditLogs]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const canManage = currentUser.role === 'superadmin' || currentUser.role === 'admin';
    if (!canManage) return undefined;

    const poll = async () => {
      try {
        const [nextProducts, nextCategories, nextTransactions, nextMovements, nextExpenses, nextAuditLogs, nextOrders, nextCredits] = await Promise.all([
          fetchProducts(),
          fetchCategories(),
          fetchTransactions(),
          fetchStockMovements(),
          fetchExpenses(),
          currentUser.role === 'superadmin' ? fetchAuditLogs() : Promise.resolve([]),
          fetchOrders(),
          fetchCredits(),
        ]);

        setProducts(nextProducts);
        setCategories(nextCategories);
        setTransactions(nextTransactions);
        setStockMovements(nextMovements);
        setExpenses(nextExpenses);
        if (currentUser.role === 'superadmin') setAuditLogs(nextAuditLogs);
        setOrders(nextOrders);
        setCredits(nextCredits);
      } catch {
        // ignore polling errors
      }
    };

    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [currentUser]);

  return {
    products,
    transactions,
    users,
    categories,
    stockMovements,
    auditLogs,
    expenses,
    settings,
    orders,
    credits,
    loadData,
    resetData,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleCreateCategory,
    handleDeleteCategory,
    handleCreateUser,
    handleUpdateUser,
    handleUpdateUserStatus,
    handleDeleteUser,
    handleCreateTransaction,
    handleStockIn,
    handleCreateExpense,
    handleSaveSettings,
    handleCreateOrder,
    handleUpdateOrder,
    handleAcquireOrderEditLock,
    handleReleaseOrderEditLock,
    handleAddCreditPayment,
    handleUpdateCreditDueDate,
    handleVoidTransaction,
  };
}
