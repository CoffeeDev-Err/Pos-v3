import { useState } from 'react';

const ROLE_LABELS = { superadmin: 'Super Admin', admin: 'Admin', cashier: 'Cashier' };
const ROLE_COLORS = { superadmin: '#dc3545', admin: '#fd7e14', cashier: '#198754' };

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', icon: 'bi-speedometer2', label: 'Dashboard', roles: ['superadmin', 'admin'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { key: 'pos',          icon: 'bi-cart3',               label: 'POS / Sales',   roles: ['superadmin', 'admin', 'cashier'] },
      { key: 'orders',       icon: 'bi-journal-text',        label: 'Orders',         roles: ['superadmin', 'admin', 'cashier'] },
      { key: 'credits',      icon: 'bi-credit-card-2-front', label: 'Credit Ledger', roles: ['superadmin', 'admin'] },
      { key: 'transactions', icon: 'bi-receipt-cutoff',      label: 'Transactions',  roles: ['superadmin', 'admin'] },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { key: 'products',  icon: 'bi-box-seam',        label: 'Products',  roles: ['superadmin', 'admin'] },
      { key: 'inventory', icon: 'bi-clipboard2-data', label: 'Inventory', roles: ['superadmin', 'admin'] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { key: 'reports', icon: 'bi-bar-chart-line', label: 'Reports', roles: ['superadmin', 'admin'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { key: 'users',    icon: 'bi-people', label: 'Users',    roles: ['superadmin'] },
      { key: 'settings', icon: 'bi-gear',   label: 'Settings', roles: ['superadmin'] },
    ],
  },
];

const NAV_ITEMS_FLAT = NAV_GROUPS.flatMap(g => g.items);

export default function Layout({ children, currentUser, currentPage, setCurrentPage, onLogout, theme, onToggleTheme }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowed = NAV_ITEMS_FLAT.filter(n => n.roles.includes(currentUser.role));

  const navigate = (key) => {
    setCurrentPage(key);
    setSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <i className="bi bi-shop-window me-2"></i>
          <span className="sidebar-brand">CARREN'S STORE</span>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="user-name">{currentUser.name}</div>
            <div className="user-role" style={{ color: ROLE_COLORS[currentUser.role] }}>
              {ROLE_LABELS[currentUser.role]}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {NAV_GROUPS.map(group => {
              const visibleItems = group.items.filter(n => n.roles.includes(currentUser.role));
              if (!visibleItems.length) return null;
              return (
                <li key={group.label} className="nav-group">
                  <span className="nav-group-label">{group.label}</span>
                  <ul className="nav-sublist">
                    {visibleItems.map(item => (
                      <li key={item.key}>
                        <button
                          className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
                          onClick={() => navigate(item.key)}
                        >
                          <i className={`bi ${item.icon} nav-icon`}></i>
                          <span>{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={onLogout}>
            <i className="bi bi-box-arrow-left nav-icon"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-wrapper">
        {/* Top header */}
        <header className="top-header">
          <button
            className="btn btn-light btn-sm d-lg-none me-2"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <i className="bi bi-list fs-5"></i>
          </button>
          <div className="header-title">
            {allowed.find(n => n.key === currentPage)?.label || 'Dashboard'}
          </div>
          <div className="header-right d-flex align-items-center gap-3">
            <button
              className="btn btn-sm theme-toggle"
              onClick={onToggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`}></i>
            </button>
            <span className="d-none d-md-block text-muted small">
              <i className="bi bi-calendar3 me-1"></i>
              {new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <div className="d-flex align-items-center gap-2">
              <div className="header-avatar">{currentUser.name.charAt(0)}</div>
              <span className="d-none d-sm-block fw-semibold small">{currentUser.name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content page-transition" data-page={currentPage} key={currentPage}>
          {children}
        </main>
      </div>
    </div>
  );
}
