import { toLocalDateString } from '../utils/date';


export default function Dashboard({ products, transactions, currentUser }) {
  const today = toLocalDateString();
  const activeTxns = transactions.filter(t => t.status !== 'void');
  const todayTxns = activeTxns.filter(t => t.date === today);
  const todaySales = todayTxns.reduce((s, t) => s + t.subtotal, 0);
  const lowStock = products.filter(p => p.stock <= p.lowStockAlert);

  // Top selling items
  const salesMap = {};
  activeTxns.forEach(t => {
    t.items.forEach(item => {
      if (!salesMap[item.productId]) salesMap[item.productId] = { name: item.name, qty: 0, amount: 0 };
      salesMap[item.productId].qty += item.qty;
      salesMap[item.productId].amount += item.total;
    });
  });
  const topItems = Object.values(salesMap).sort((a, b) => b.amount - a.amount).slice(0, 5);

  const cards = [
    { label: "Today's Sales", value: `₱${todaySales.toLocaleString()}`, icon: 'bi-cash-stack', color: '#0f766e', bg: '#ccfbf1' },
    { label: 'Transactions Today', value: todayTxns.length, icon: 'bi-receipt', color: '#0d6efd', bg: '#cfe2ff' },
    { label: 'Total Products', value: products.length, icon: 'bi-box-seam', color: '#6610f2', bg: '#e0cffc' },
    { label: 'Low Stock Alerts', value: lowStock.length, icon: 'bi-exclamation-triangle', color: '#dc3545', bg: '#f8d7da' },
  ];

  return (
    <div>
      <div className="page-header mb-4">
        <div>
          <h4 className="mb-1">Good {getGreeting()}, {currentUser.name.split(' ')[0]}! 👋</h4>
          <p className="text-muted mb-0 small">Here's what's happening in your store today.</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        {cards.map(card => (
          <div className="col-6 col-lg-3" key={card.label}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
                <i className={`bi ${card.icon}`}></i>
              </div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {/* Recent Transactions */}
        <div className="col-lg-7">
          <div className="card-custom h-100">
            <div className="card-header-custom">
              <i className="bi bi-clock-history me-2"></i>Recent Transactions Today
            </div>
            <div className="card-body p-0">
              {todayTxns.length === 0 ? (
                <div className="empty-state py-4">
                  <i className="bi bi-inbox fs-1 text-muted"></i>
                  <p className="text-muted mt-2 mb-0">No transactions yet today</p>
                </div>
              ) : (
                <div className="table-responsive table-scroll-panel table-scroll-panel--dashboard">
                  <table className="table table-hover mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th>OR #</th>
                        <th>Time</th>
                        <th>Items</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayTxns.slice().reverse().map(txn => (
                        <tr key={txn.id}>
                          <td><code className="small">{txn.orNumber || txn.id?.slice(-8)}</code></td>
                          <td>{txn.time}</td>
                          <td>{txn.items.length} item{txn.items.length > 1 ? 's' : ''}</td>
                          <td className="text-end fw-semibold text-success">₱{txn.subtotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <td colSpan="3" className="fw-bold">Total Today</td>
                        <td className="text-end fw-bold text-success">₱{todaySales.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-lg-5">
          {/* Low Stock Alerts */}
          <div className="card-custom mb-3">
            <div className="card-header-custom text-danger">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>Low Stock Alerts
              <span className="badge bg-danger ms-2">{lowStock.length}</span>
            </div>
            <div className="card-body p-0">
              {lowStock.length === 0 ? (
                <div className="empty-state py-3">
                  <i className="bi bi-check-circle text-success fs-4"></i>
                  <p className="text-muted small mt-1 mb-0">All stock levels are OK</p>
                </div>
              ) : (
                <ul className="list-group list-group-flush">
                  {lowStock.map(p => (
                    <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <div>
                        <span className="small fw-semibold">{p.name}</span>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{p.category}</div>
                      </div>
                      <span className={`badge ${p.stock === 0 ? 'bg-danger' : 'bg-warning text-dark'}`}>
                        {p.stock} {p.hasVariants ? p.baseUnit : p.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Top Selling */}
          <div className="card-custom">
            <div className="card-header-custom">
              <i className="bi bi-trophy me-2 text-warning"></i>Top Selling Items
            </div>
            <div className="card-body p-0">
              <ul className="list-group list-group-flush">
                {topItems.map((item, i) => (
                  <li key={item.name} className="list-group-item d-flex justify-content-between align-items-center py-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge rounded-pill ${i === 0 ? 'bg-warning text-dark' : i === 1 ? 'bg-secondary' : 'bg-light text-dark'}`}>
                        #{i + 1}
                      </span>
                      <span className="small">{item.name}</span>
                    </div>
                    <span className="small text-success fw-semibold">₱{item.amount.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
