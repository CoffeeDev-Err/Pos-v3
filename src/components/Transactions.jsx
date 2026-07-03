import { useState, useMemo } from 'react';
import { printViaBluetooth } from '../utils/escpos';

const TYPE_LABELS = {
  cash: 'Cash',
  gcash: 'GCash',
  bank: 'Bank Transfer',
  credit: 'Credit',
  paylater: 'Pay Later',
};

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function Transactions({ transactions, orders, settings, onVoidTransaction }) {
  const [activeTab, setActiveTab] = useState('completed');
  const [rangeMode, setRangeMode] = useState('today');
  const [singleDate, setSingleDate] = useState(todayStr);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [searchName, setSearchName] = useState('');

  const [viewItem, setViewItem] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState('');

  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  // ---- filtering helpers ----
  const inDateRange = (dateStr) => {
    if (!dateStr) return false;
    const d = dateStr.substring(0, 10);
    const today = todayStr();
    if (rangeMode === 'today') return d === today;
    if (rangeMode === 'single') return d === singleDate;
    if (rangeMode === 'range') return d >= dateFrom && d <= dateTo;
    return true;
  };

  const matchesName = (item) => {
    const q = searchName.trim().toLowerCase();
    if (!q) return true;
    const name = (item.customer?.name || item.customerName || '').toLowerCase();
    return name.includes(q);
  };

  // ---- tab data ----
  const completedTxns = useMemo(() =>
    (transactions || []).filter(t => (!t.status || t.status === 'completed') && inDateRange(t.date) && matchesName(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, rangeMode, singleDate, dateFrom, dateTo, searchName]
  );

  const voidTxns = useMemo(() =>
    (transactions || []).filter(t => t.status === 'void' && inDateRange(t.date) && matchesName(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, rangeMode, singleDate, dateFrom, dateTo, searchName]
  );

  const pendingOrders = useMemo(() =>
    (orders || []).filter(o => o.status === 'pending' && inDateRange(o.date) && matchesName(o)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, rangeMode, singleDate, dateFrom, dateTo, searchName]
  );

  const onProcessOrders = useMemo(() =>
    (orders || []).filter(o => o.status === 'onprocess' && inDateRange(o.date) && matchesName(o)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, rangeMode, singleDate, dateFrom, dateTo, searchName]
  );

  const TABS = [
    { key: 'pending',    label: 'Pending',    count: pendingOrders.length,    data: pendingOrders,    badge: 'bg-warning text-dark' },
    { key: 'onprocess',  label: 'On Process', count: onProcessOrders.length,  data: onProcessOrders,  badge: 'bg-primary' },
    { key: 'completed',  label: 'Completed',  count: completedTxns.length,    data: completedTxns,    badge: 'bg-success' },
    { key: 'void',       label: 'Void',       count: voidTxns.length,         data: voidTxns,         badge: 'bg-secondary' },
  ];

  const activeData = TABS.find(t => t.key === activeTab)?.data || [];

  // ---- receipt print ----
  const handlePrint = async (item) => {
    setIsPrinting(true);
    setPrintStatus('');
    try {
      await printViaBluetooth({
        storeName: settings?.storeName,
        address: settings?.address,
        phone: settings?.phone,
        footer: settings?.receiptFooter,
        orNumber: item.orNumber,
        txnId: item.id,
        date: item.date,
        time: item.time,
        cashierName: item.cashierName,
        items: item.items,
        total: item.subtotal,
        paymentMethod: item.paymentMethod,
        cash: item.cash,
        change: item.change,
        customer: item.customer,
      }, setPrintStatus);
    } catch (err) {
      setPrintStatus('Error: ' + err.message);
    } finally {
      setIsPrinting(false);
    }
  };

  // ---- void ----
  const openVoidModal = (txn) => {
    setVoidTarget(txn);
    setVoidReason('');
    setVoidError('');
    setShowVoidModal(true);
  };

  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      setVoidError('Void reason is required.');
      return;
    }
    setIsVoiding(true);
    setVoidError('');
    try {
      await onVoidTransaction(voidTarget.id, voidReason.trim());
      setShowVoidModal(false);
      setVoidTarget(null);
      if (viewItem?.id === voidTarget.id) setViewItem(null);
    } catch (err) {
      setVoidError(err.message || 'Failed to void transaction.');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="card-custom mb-3">
        <div className="p-3">
          <div className="row g-2 align-items-end">
            <div className="col-sm-auto">
              <label className="form-label small fw-semibold mb-1">Select Range</label>
              <select
                className="form-select form-select-sm"
                value={rangeMode}
                onChange={e => setRangeMode(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="single">Single Day</option>
                <option value="range">Date Range</option>
              </select>
            </div>
            {rangeMode === 'single' && (
              <div className="col-sm-auto">
                <label className="form-label small fw-semibold mb-1">Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                />
              </div>
            )}
            {rangeMode === 'range' && (
              <>
                <div className="col-sm-auto">
                  <label className="form-label small fw-semibold mb-1">From</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="col-sm-auto">
                  <label className="form-label small fw-semibold mb-1">To</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="col">
              <label className="form-label small fw-semibold mb-1">Search by Name</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Customer name..."
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card-custom">
        <div className="card-header-custom">
          <i className="bi bi-receipt-cutoff me-2"></i>Transactions &amp; Orders
        </div>
        <div className="p-3">
          {/* Status Tabs */}
          <div className="d-flex gap-2 mb-3 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`breakdown-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`badge ms-2 ${tab.badge}`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {activeData.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox fs-2 d-block mb-2"></i>
              No records found
            </div>
          ) : (
            <div className="table-responsive table-scroll-panel table-scroll-panel--page">
              <table className="table table-sm table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Receipt</th>
                    <th className="text-end">Amount</th>
                    {activeTab === 'completed' && <th></th>}
                    {activeTab === 'void' && <th>Void Reason</th>}
                  </tr>
                </thead>
                <tbody>
                  {activeData.map(item => (
                    <tr key={item.id}>
                      <td className="fw-semibold">
                        {item.customer?.name || item.customerName || <span className="text-muted">Walk-in</span>}
                      </td>
                      <td className="small text-muted">
                        {item.date}{item.time ? ` ${item.time}` : ''}
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {TYPE_LABELS[item.paymentMethod] || item.paymentMethod || '—'}
                        </span>
                      </td>
                      <td>
                        {(activeTab === 'completed' || activeTab === 'void') && (
                          <button
                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                            onClick={() => { setViewItem(item); setPrintStatus(''); }}
                          >
                            <i className="bi bi-receipt me-1"></i>View
                          </button>
                        )}
                      </td>
                      <td className="text-end fw-bold">
                        ₱{Number(item.subtotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {activeTab === 'completed' && (
                        <td>
                          <button
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            onClick={() => openVoidModal(item)}
                          >
                            Void
                          </button>
                        </td>
                      )}
                      {activeTab === 'void' && (
                        <td className="small text-muted">{item.voidReason || '—'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ---- Receipt Viewer Modal ---- */}
      {viewItem && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h5 className="modal-title fs-6">
                  <i className="bi bi-receipt me-2"></i>Receipt
                </h5>
                <button className="btn-close" onClick={() => { setViewItem(null); setPrintStatus(''); }} />
              </div>
              <div className="modal-body p-0">
                <div className="receipt-preview p-3">
                  <div className="text-center mb-2">
                    <strong className="fs-6">{settings?.storeName}</strong><br />
                    <small className="text-muted">{settings?.address}</small><br />
                    <small className="text-muted">{settings?.phone}</small>
                  </div>
                  <hr className="receipt-dashed" />
                  <div className="small mb-2">
                    <div className="d-flex justify-content-between fw-bold">
                      <span>OR #:</span>
                      <span>{viewItem.orNumber || viewItem.id?.slice(-8)?.toUpperCase()}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Date:</span><span>{viewItem.date}</span>
                    </div>
                    {viewItem.time && (
                      <div className="d-flex justify-content-between">
                        <span>Time:</span><span>{viewItem.time}</span>
                      </div>
                    )}
                    <div className="d-flex justify-content-between">
                      <span>Cashier:</span><span>{viewItem.cashierName || '—'}</span>
                    </div>
                  </div>
                  <hr className="receipt-dashed" />
                  <table className="w-100 small mb-2">
                    <tbody>
                      {(viewItem.items || []).map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div className="fw-semibold">
                              {item.name}{item.variantName ? ` (${item.variantName})` : ''}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                              {item.qty} {item.unit || 'pc'} × ₱{Number(item.price).toFixed(2)}
                            </div>
                          </td>
                          <td className="text-end fw-semibold">
                            ₱{Number(item.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr className="receipt-dashed" />
                  <div className="d-flex justify-content-between fw-bold mb-1">
                    <span>SUBTOTAL</span>
                    <span>₱{Number(viewItem.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span>Payment</span>
                    <span>{TYPE_LABELS[viewItem.paymentMethod] || viewItem.paymentMethod || 'Cash'}</span>
                  </div>
                  {(viewItem.paymentMethod === 'cash' || !viewItem.paymentMethod) && viewItem.cash != null && (
                    <>
                      <div className="d-flex justify-content-between small">
                        <span>Cash</span><span>₱{Number(viewItem.cash).toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between small text-success fw-semibold">
                        <span>Change</span><span>₱{Number(viewItem.change || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {viewItem.customer?.name && (
                    <>
                      <hr className="receipt-dashed" />
                      <div className="small text-muted">
                        <div className="fw-semibold text-dark mb-1">Customer</div>
                        <div>Name: {viewItem.customer.name}</div>
                        {viewItem.customer.contact && <div>Tel: {viewItem.customer.contact}</div>}
                        {viewItem.customer.address && <div>Address: {viewItem.customer.address}</div>}
                      </div>
                    </>
                  )}
                  {viewItem.status === 'void' && (
                    <>
                      <hr className="receipt-dashed" />
                      <div className="text-center small text-danger fw-bold">⚠ VOIDED</div>
                      {viewItem.voidReason && (
                        <div className="text-center small text-muted">Reason: {viewItem.voidReason}</div>
                      )}
                    </>
                  )}
                  <hr className="receipt-dashed" />
                  <div className="text-center small text-muted">
                    {settings?.receiptFooter || 'Salamat sa inyong pagbili!'}
                  </div>
                </div>
                {printStatus && (
                  <div className={`p-2 text-center small ${printStatus.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
                    {printStatus}
                  </div>
                )}
              </div>
              <div className="modal-footer flex-column gap-2 p-2">
                <button
                  className="btn btn-dark w-100"
                  onClick={() => handlePrint(viewItem)}
                  disabled={isPrinting}
                >
                  {isPrinting
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Printing...</>
                    : <><i className="bi bi-printer-fill me-2"></i>Print Receipt</>
                  }
                </button>
                <button
                  className="btn btn-outline-secondary w-100"
                  onClick={() => { setViewItem(null); setPrintStatus(''); }}
                >
                  <i className="bi bi-x-lg me-2"></i>Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Void Confirmation Modal ---- */}
      {showVoidModal && voidTarget && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header border-danger py-2">
                <h5 className="modal-title fs-6 text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>Void Transaction
                </h5>
                <button className="btn-close" onClick={() => setShowVoidModal(false)} disabled={isVoiding} />
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-3">
                  Void transaction for{' '}
                  <strong>{voidTarget.customer?.name || 'Walk-in'}</strong>?<br />
                  Amount:{' '}
                  <strong>
                    ₱{Number(voidTarget.subtotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </strong>
                  <br />
                  <span className="text-warning fw-semibold">Stock will be restored.</span>
                </p>
                <label className="form-label small fw-semibold mb-1">
                  Void Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  placeholder="Enter void reason..."
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                />
                {voidError && <div className="text-danger small mt-1">{voidError}</div>}
              </div>
              <div className="modal-footer py-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowVoidModal(false)}
                  disabled={isVoiding}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleConfirmVoid}
                  disabled={isVoiding || !voidReason.trim()}
                >
                  {isVoiding
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Voiding...</>
                    : 'Confirm Void'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
