import { useState } from 'react';

export default function ProductBreakdownCards({ topSellingByAmount, topMovingByQty, formatCurrency }) {
  const [activeTab, setActiveTab] = useState('sales');

  return (
    <div className="col-lg-5">
      <div className="card-custom">
        <div className="card-header-custom">
          <div className="d-flex gap-2">
            <button
              className={`breakdown-tab ${activeTab === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveTab('sales')}
            >
              <i className="bi bi-bar-chart"></i>Sales Breakdown
            </button>
            <button
              className={`breakdown-tab ${activeTab === 'moving' ? 'active' : ''}`}
              onClick={() => setActiveTab('moving')}
            >
              <i className="bi bi-activity"></i>Top Moving
            </button>
          </div>
        </div>

        <div key={activeTab} className="card-body p-0 breakdown-scroll">
          {activeTab === 'sales' ? (
            topSellingByAmount.length === 0 ? (
              <div className="empty-state py-4"><i className="bi bi-inbox fs-2 text-muted"></i><p className="text-muted small mt-2">No data</p></div>
            ) : (
              <ul className="list-group list-group-flush">
                {topSellingByAmount.map((item, i) => {
                  const pct = topSellingByAmount[0].amount > 0 ? (item.amount / topSellingByAmount[0].amount) * 100 : 0;
                  return (
                    <li key={item.name} className="list-group-item py-2">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="small fw-semibold">#{i + 1} {item.name}</span>
                        <span className="small text-success">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1 report-progress">
                          <div className="progress-bar bg-secondary" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="text-muted small">{item.qty}x</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            topMovingByQty.length === 0 ? (
              <div className="empty-state py-4"><i className="bi bi-inbox fs-2 text-muted"></i><p className="text-muted small mt-2">No data</p></div>
            ) : (
              <ul className="list-group list-group-flush">
                {topMovingByQty.map((item, i) => (
                  <li key={item.name} className="list-group-item py-2 d-flex align-items-center justify-content-between">
                    <span className="small fw-semibold">#{i + 1} {item.name}</span>
                    <span className="badge bg-light text-dark border">{item.qty} pcs</span>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}
