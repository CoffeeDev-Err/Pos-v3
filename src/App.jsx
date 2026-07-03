import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import LoadingSkeleton from './components/LoadingSkeleton';
import GlobalErrorToast from './components/GlobalErrorToast';
const Dashboard = lazy(() => import('./components/Dashboard'));
const POS = lazy(() => import('./components/POS'));
const Products = lazy(() => import('./components/Products'));
const Inventory = lazy(() => import('./components/Inventory'));
const Reports = lazy(() => import('./components/Reports'));
const Users = lazy(() => import('./components/Users'));
const Settings = lazy(() => import('./components/Settings'));
const Orders = lazy(() => import('./components/Orders'));
const CreditLedger = lazy(() => import('./components/CreditLedger'));
const Transactions = lazy(() => import('./components/Transactions'));

import {
  login as apiLogin,
  fetchMe,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  addAuditLog,
} from './utils/api';
import { useAppData } from './hooks/useAppData';
import { getErrorMessage, normalizeError } from './utils/errors';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [globalError, setGlobalError] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('pos_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  const {
    products,
    transactions,
    users,
    categories,
    stockMovements,
    auditLogs,
    expenses,
    settings,
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
    orders,
    handleCreateOrder,
    handleUpdateOrder,
    handleAcquireOrderEditLock,
    handleReleaseOrderEditLock,
    credits,
    handleAddCreditPayment,
    handleUpdateCreditDueDate,
    handleVoidTransaction,
  } = useAppData(currentUser);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const bootstrap = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { user } = await fetchMe();
        setCurrentUser(user);
        setCurrentPage(user.role === 'cashier' ? 'pos' : 'dashboard');
        await loadData(user.role);
      } catch {
        clearAuthToken();
        localStorage.removeItem('pos_user');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [loadData]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.theme = theme;
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  useEffect(() => {
    const onGlobalError = (event) => {
      setGlobalError(event.detail || normalizeError(event.error));
    };
    const onUnhandledRejection = (event) => {
      setGlobalError(normalizeError(event.reason));
    };
    const onWindowError = (event) => {
      setGlobalError(normalizeError(event.error || event.message));
    };

    window.addEventListener('app:error', onGlobalError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);
    return () => {
      window.removeEventListener('app:error', onGlobalError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
    };
  }, []);

  useEffect(() => {
    if (!globalError) return undefined;
    const timeoutId = setTimeout(() => setGlobalError(null), 6000);
    return () => clearTimeout(timeoutId);
  }, [globalError]);

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const handleLogin = async (username, password) => {
    setLoading(true);
    setLoadError('');
    try {
      const { user, token } = await apiLogin(username, password);
      setAuthToken(token);
      localStorage.setItem('pos_user', JSON.stringify(user));
      setCurrentUser(user);
      setCurrentPage(user.role === 'cashier' ? 'pos' : 'dashboard');
      await loadData(user.role);
      try {
        await addAuditLog(user.name || user.username || 'Unknown', `Logged in (${user.role || 'user'})`);
      } catch {
        // Best effort only; login should not fail when audit write fails.
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, { fallback: 'Login failed. Please check your credentials and try again.' }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    if (currentUser?.name) {
      addAuditLog(currentUser.name, `Logged out (${currentUser.role || 'user'})`).catch(() => {});
    }
    clearAuthToken();
    localStorage.removeItem('pos_user');
    sessionStorage.removeItem('pos_hidden_at');
    setCurrentUser(null);
    setCurrentPage('dashboard');
    setLoadError('');
    resetData();
  }, [currentUser, resetData]);

  // Auto-logout after 5 minutes of being away (tab hidden / phone locked / switched app)
  useEffect(() => {
    if (!currentUser) return;

    const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('pos_hidden_at', String(Date.now()));
      } else {
        const hiddenAt = sessionStorage.getItem('pos_hidden_at');
        if (hiddenAt && Date.now() - Number(hiddenAt) >= SESSION_TIMEOUT_MS) {
          sessionStorage.removeItem('pos_hidden_at');
          handleLogout();
        } else {
          sessionStorage.removeItem('pos_hidden_at');
        }
      }
    };

    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [currentUser, handleLogout]);

  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} loading={loading} error={loadError} theme={theme} onToggleTheme={toggleTheme} />
        <GlobalErrorToast error={globalError} onClose={() => setGlobalError(null)} />
      </>
    );
  }

  const handleUpdateUserWithSessionSync = async (id, payload) => {
    const updated = await handleUpdateUser(id, payload);
    if (currentUser?.id === id) {
      const merged = { ...currentUser, ...updated, id: currentUser.id };
      setCurrentUser(merged);
      localStorage.setItem('pos_user', JSON.stringify(merged));
    }
    return updated;
  };

  const renderPage = () => {
    const props = {
      products,
      transactions,
      users,
      categories,
      stockMovements,
      expenses,
      auditLogs,
      settings,
      currentUser,
      loading,
      onCreateProduct: handleCreateProduct,
      onUpdateProduct: handleUpdateProduct,
      onDeleteProduct: handleDeleteProduct,
      onCreateCategory: handleCreateCategory,
      onDeleteCategory: handleDeleteCategory,
      onCreateUser: handleCreateUser,
      onUpdateUser: handleUpdateUserWithSessionSync,
      onUpdateUserStatus: handleUpdateUserStatus,
      onDeleteUser: handleDeleteUser,
      onCreateTransaction: handleCreateTransaction,
      onStockIn: handleStockIn,
      onCreateExpense: handleCreateExpense,
      onSaveSettings: handleSaveSettings,
      orders,
      onCreateOrder: handleCreateOrder,
      onUpdateOrder: handleUpdateOrder,
      onAcquireOrderEditLock: handleAcquireOrderEditLock,
      onReleaseOrderEditLock: handleReleaseOrderEditLock,
      credits,
      onAddCreditPayment: handleAddCreditPayment,
      onUpdateCreditDueDate: handleUpdateCreditDueDate,
      onVoidTransaction: handleVoidTransaction,
    };

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...props} />;
      case 'pos':
        return <POS {...props} />;
      case 'products':
        return <Products {...props} />;
      case 'inventory':
        return <Inventory {...props} />;
      case 'reports':
        return <Reports {...props} />;
      case 'users':
        return <Users {...props} />;
      case 'settings':
        return <Settings {...props} />;
      case 'orders':
        return <Orders {...props} />;
      case 'credits':
        return <CreditLedger {...props} />;
      case 'transactions':
        return <Transactions {...props} />;
      default:
        return <Dashboard {...props} />;
    }
  };

  const skeletonVariant = {
    dashboard: 'dashboard',
    pos: 'pos',
    products: 'products',
    inventory: 'inventory',
    reports: 'reports',
    users: 'users',
    settings: 'settings',
    orders: 'page',
    credits: 'page',
    transactions: 'page',
  }[currentPage] || 'page';

  return (
    <Layout
      currentUser={currentUser}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {loading && (
        <LoadingSkeleton variant="banner" />
      )}
      {loadError && (
        <div className="alert alert-danger small mb-3">{loadError}</div>
      )}
      <Suspense fallback={<LoadingSkeleton variant={skeletonVariant} />}>
        {renderPage()}
      </Suspense>
      <GlobalErrorToast error={globalError} onClose={() => setGlobalError(null)} />
    </Layout>
  );
}
