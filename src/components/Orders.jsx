import { useCallback, useEffect, useState } from 'react';
import { openCashDrawerViaBluetooth, printViaBluetooth } from '../utils/escpos';
import { getErrorMessage, isErrorStatusMessage, notifyError } from '../utils/errors';
import '../styles/receipt.css';

function normalizeMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function resolveAutoPricing(product, item = null, qty = 1) {
  if (!product) return null;
  const src = item?.variantId
    ? (product.variants || []).find(v => String(v.id) === String(item.variantId)) || product
    : product;
  const priceRetail = normalizeMoney(src.priceRetail ?? src.price ?? item?.price ?? 0);
  const priceWholesale = normalizeMoney(src.priceWholesale ?? priceRetail);
  const threshold = Number(src.wholesaleQtyThreshold ?? product.wholesaleQtyThreshold ?? 0);
  const tier = (threshold > 0 && Number(qty) >= threshold) ? 'wholesale' : 'retail';
  const price = tier === 'wholesale' ? priceWholesale : priceRetail;
  return { price, tier };
}

function OrderCard({ order }) {
  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <div className="fw-semibold">{order.customer?.name || 'Walk-in'}</div>
          <div className="small text-muted">{order.customer?.contact}{order.customer?.address ? ` · ${order.customer.address}` : ''}</div>
        </div>
        <div className="text-end">
          <div className="fw-bold text-dark">₱{(order.subtotal || 0).toLocaleString()}</div>
          <div className="small text-muted">{order.date} {order.time}</div>
        </div>
      </div>
      {order.notes && (
        <div className="small text-muted fst-italic mb-2">"{order.notes}"</div>
      )}
      {order.dueDate && (
        <div className="small text-warning mb-1">
          <i className="bi bi-calendar-event me-1"></i>Due: {order.dueDate}
        </div>
      )}
      <div className="border-top pt-2 mt-1">
        {(order.items || []).map((item, i) => (
          <div key={i} className="d-flex justify-content-between small text-muted">
            <span>{item.qty}× {item.name}{item.variantName ? ` (${item.variantName})` : ''}</span>
            <span>₱{item.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Orders({
  orders,
  products,
  currentUser,
  settings,
  onUpdateOrder,
  onCreateTransaction,
  onAcquireOrderEditLock,
  onReleaseOrderEditLock,
}) {
  const [activeTab, setActiveTab]           = useState('pending');
  const [selectedOrder, setSelectedOrder]   = useState(null);
  const [showPayModal, setShowPayModal]     = useState(false);
  const [payMethod, setPayMethod]           = useState('cash');
  const [cashInput, setCashInput]           = useState('');
  const [dueDate, setDueDate]               = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineOrder, setDeclineOrder]     = useState(null);
  const [declineReason, setDeclineReason]   = useState('');
  const [viewOrder, setViewOrder]           = useState(null);
  const [viewReceiptOrder, setViewReceiptOrder] = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [printStatus, setPrintStatus]       = useState('');
  const [isPrinting, setIsPrinting]         = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editingOrder, setEditingOrder]     = useState(null);
  const [lockedOrderId, setLockedOrderId]   = useState(null);
  const [editItems, setEditItems]           = useState([]);
  const [editQtyInputs, setEditQtyInputs]   = useState({});
  const [editError, setEditError]           = useState('');
  const [editSaving, setEditSaving]         = useState(false);
  const [addProductId, setAddProductId]     = useState('');
  const [addVariantId, setAddVariantId]     = useState('');
  const [addQty, setAddQty]                 = useState('1');

  const pendingOrders   = (orders || []).filter(o => o.status === 'pending');
  const onProcessOrders = (orders || []).filter(o => o.status === 'onprocess');
  const completedOrders = (orders || []).filter(o => o.status === 'completed');

  const subtotal  = selectedOrder?.subtotal || 0;
  const cashPaid  = payMethod === 'cash' ? (parseFloat(cashInput) || 0) : subtotal;
  const changeDue = payMethod === 'cash' ? cashPaid - subtotal : 0;

  const editedSubtotal = normalizeMoney(
    editItems.reduce((sum, item) => sum + normalizeMoney(item.total), 0)
  );

  const isPayDisabled = () => {
    if (saving) return true;
    if (payMethod === 'cash') return !cashInput || changeDue < 0;
    if (payMethod === 'credit') return !dueDate;
    return false;
  };

  // ── Handlers ──────────────────────────────────────────────

  const handleAccept = async (order) => {
    setError('');
    try {
      await onUpdateOrder(order.id, { status: 'onprocess' });
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while accepting the order. Please try again.' }));
    }
  };

  const openDeclineModal = (order) => {
    setDeclineOrder(order);
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  const handleDecline = async () => {
    if (!declineOrder) return;
    setSaving(true);
    setError('');
    try {
      await onUpdateOrder(declineOrder.id, { status: 'cancelled', declineReason });
      setShowDeclineModal(false);
      setDeclineOrder(null);
      setDeclineReason('');
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while declining the order. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const openPayModal = (order) => {
    setSelectedOrder(order);
    setPayMethod('cash');
    setCashInput('');
    setDueDate('');
    setError('');
    setShowPayModal(true);
  };

  const openOrderView = (order) => {
    setViewOrder(order);
    setError('');
  };

  const closeOrderView = () => {
    setViewOrder(null);
  };

  const openEditFromView = (order) => {
    closeOrderView();
    openEditModal(order);
  };

  const openPayFromView = (order) => {
    closeOrderView();
    openPayModal(order);
  };

  const acceptFromView = async (order) => {
    await handleAccept(order);
    closeOrderView();
  };

  const declineFromView = (order) => {
    closeOrderView();
    openDeclineModal(order);
  };

  const releaseEditLock = useCallback(async (orderId) => {
    if (!orderId || !onReleaseOrderEditLock) return;
    try {
      await onReleaseOrderEditLock(orderId);
    } catch {
      // lock release is best-effort
    }
  }, [onReleaseOrderEditLock]);

  const openEditModal = async (order) => {
    setError('');
    if (onAcquireOrderEditLock) {
      try {
        await onAcquireOrderEditLock(order.id);
        setLockedOrderId(order.id);
      } catch (err) {
        setError(getErrorMessage(err, { fallback: 'This order is currently being edited by another user. Please try again later.' }));
        return;
      }
    }

    const seededItems = (order.items || []).map(item => {
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      const price = normalizeMoney(item.price);
      return {
        ...item,
        qty,
        price,
        priceTier: item.priceTier || 'retail',
        total: normalizeMoney(item.total || qty * price),
      };
    });
    setEditingOrder(order);
    setEditItems(seededItems);
    setEditQtyInputs({});
    setEditError('');
    setAddProductId('');
    setAddVariantId('');
    setAddQty('1');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (editSaving) return;
    const toRelease = lockedOrderId;
    setShowEditModal(false);
    setEditingOrder(null);
    setLockedOrderId(null);
    setEditItems([]);
    setEditQtyInputs({});
    setEditError('');
    releaseEditLock(toRelease);
  };

  useEffect(() => {
    return () => {
      if (lockedOrderId) {
        releaseEditLock(lockedOrderId);
      }
    };
  }, [lockedOrderId, releaseEditLock]);

  const updateEditItem = (idx, updates) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, ...updates };
      const qty = Math.max(1, parseInt(next.qty, 10) || 1);
      const product = (products || []).find(p => String(p.id) === String(next.productId));
      const auto = resolveAutoPricing(product, next, qty);
      const price = normalizeMoney(auto?.price ?? next.price);
      const priceTier = auto?.tier || next.priceTier || 'retail';
      return { ...next, qty, priceTier, price, total: normalizeMoney(qty * price) };
    }));
  };

  const removeEditItem = (idx) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
    setEditQtyInputs({});
  };

  const handleAddItemToEdit = () => {
    setEditError('');
    const product = (products || []).find(p => String(p.id) === String(addProductId));
    if (!product) {
      setEditError('Select a product first.');
      return;
    }

    const isVariant = !!product.hasVariants;
    const variant = isVariant
      ? (product.variants || []).find(v => String(v.id) === String(addVariantId))
      : null;

    if (isVariant && !variant) {
      setEditError('Select a variant for this product.');
      return;
    }

    const qtyToAdd = Math.max(1, parseInt(addQty, 10) || 1);
    const key = `${product.id}:${variant?.id || 'base'}`;

    setEditItems(prev => {
      const idx = prev.findIndex(i => `${i.productId}:${i.variantId || 'base'}` === key);
      if (idx >= 0) {
        return prev.map((i, row) => {
          if (row !== idx) return i;
          const qty = (parseInt(i.qty, 10) || 0) + qtyToAdd;
          const auto = resolveAutoPricing(product, i, qty);
          const price = normalizeMoney(auto?.price ?? i.price);
          return { ...i, qty, priceTier: auto?.tier || i.priceTier || 'retail', price, total: normalizeMoney(qty * price) };
        });
      }

      const seeded = {
        productId: product.id,
        variantId: variant?.id || null,
        price: 0,
      };
      const auto = resolveAutoPricing(product, seeded, qtyToAdd);
      const resolvedPrice = normalizeMoney(auto?.price ?? 0);

      return [...prev, {
        productId: product.id,
        name: product.name,
        variantId: variant?.id || null,
        variantName: variant?.name || null,
        unit: variant?.unit || product.unit || product.baseUnit || 'pc',
        conversionRate: Number(variant?.conversionRate ?? product.conversionRate ?? 1) || 1,
        qty: qtyToAdd,
        priceTier: auto?.tier || 'retail',
        price: resolvedPrice,
        cost: normalizeMoney((variant || product).cost || 0),
        total: normalizeMoney(qtyToAdd * resolvedPrice),
      }];
    });
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrder) return;
    if (editItems.length === 0) {
      setEditError('Order must have at least one item.');
      return;
    }

    setEditSaving(true);
    setEditError('');

    try {
      const requiredByProduct = new Map();
      for (const item of editItems) {
        const baseNeed = (Number(item.qty) || 0) * (Number(item.conversionRate) || 1);
        const key = String(item.productId);
        requiredByProduct.set(key, (requiredByProduct.get(key) || 0) + baseNeed);
      }

      const stockErrors = [];
      requiredByProduct.forEach((required, productId) => {
        const product = (products || []).find(p => String(p.id) === productId);
        if (!product) return;
        const available = Number(product.stock || 0);
        if (required > available) {
          stockErrors.push(`${product.name}: need ${required}, only ${available} ${product.baseUnit || product.unit || 'units'} left`);
        }
      });

      if (stockErrors.length > 0) {
        setEditError('Insufficient stock for edited order:\n' + stockErrors.join('\n'));
        setEditSaving(false);
        return;
      }

      const normalizedItems = editItems.map(item => {
        const qty = Math.max(1, parseInt(item.qty, 10) || 1);
        const product = (products || []).find(p => String(p.id) === String(item.productId));
        const auto = resolveAutoPricing(product, item, qty);
        const price = normalizeMoney(auto?.price ?? item.price);
        return { ...item, qty, priceTier: auto?.tier || item.priceTier || 'retail', price, total: normalizeMoney(qty * price) };
      });

      const nextSubtotal = normalizeMoney(normalizedItems.reduce((sum, item) => sum + item.total, 0));

      await onUpdateOrder(editingOrder.id, {
        items: normalizedItems,
        subtotal: nextSubtotal,
      });

      if (selectedOrder && selectedOrder.id === editingOrder.id) {
        setSelectedOrder(prev => prev ? { ...prev, items: normalizedItems, subtotal: nextSubtotal } : prev);
      }

      closeEditModal();
    } catch (err) {
      setEditError(getErrorMessage(err, { fallback: 'An error occurred while updating the order. Please try again.' }));
    } finally {
      setEditSaving(false);
    }
  };

  const handleCompletePayment = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setError('');

    // Validate stock availability before processing
    const stockErrors = [];
    for (const item of selectedOrder.items || []) {
      const product = (products || []).find(p => String(p.id) === String(item.productId));
      if (product) {
        const requiredBase = Number(item.qty || 0) * (Number(item.conversionRate) || 1);
        if ((product.stock || 0) < requiredBase) {
          const label = item.variantName ? `${item.name} (${item.variantName})` : item.name;
          stockErrors.push(`${label}: need ${requiredBase}, only ${product.stock || 0} ${product.baseUnit || product.unit || 'units'} left`);
        }
      }
    }
    if (stockErrors.length > 0) {
      setError('The following items have insufficient stock:\n' + stockErrors.join('\n'));
      setSaving(false);
      return;
    }
    try {
      const now = new Date();
      const completedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Create transaction first so we get the sequential OR number
      const txn = await onCreateTransaction({
        items: selectedOrder.items,
        cash: cashPaid,
        change: changeDue,
        cashierId: currentUser.id,
        paymentMethod: payMethod,
        customer: selectedOrder.customer,
        dueDate: payMethod === 'credit' ? dueDate : '',
        orderId: selectedOrder.id,
      });

      // Update order with completed status + OR number from the transaction
      await onUpdateOrder(selectedOrder.id, {
        status: 'completed',
        paymentMethod: payMethod,
        dueDate: payMethod === 'credit' ? dueDate : '',
        completedAt,
        cash: cashPaid,
        change: changeDue,
        orNumber: txn?.orNumber || '',
      });

      if (payMethod === 'cash') {
        openCashDrawerViaBluetooth().catch(() => {});
      }

      setShowPayModal(false);
      setSelectedOrder(null);
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while completing the payment. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const handlePrintReceipt = async (order) => {
    setIsPrinting(true);
    setPrintStatus('');
    try {
      await printViaBluetooth({
        storeName:     settings.storeName,
        address:       settings.address,
        phone:         settings.phone,
        footer:        settings.receiptFooter,
        orNumber:      order.orNumber,
        txnId:         order.id,
        date:          order.completedAt || order.date,
        time:          order.time,
        cashierName:   order.cashierName,
        items:         order.items,
        total:         order.subtotal,
        paymentMethod: order.paymentMethod,
        cash:          order.cash || order.subtotal,
        change:        order.change || 0,
        customer:      order.customer,
      }, setPrintStatus);
    } catch (err) {
      const normalized = notifyError(err, { context: 'bluetooth-print' });
      setPrintStatus(normalized.message);
    } finally {
      setIsPrinting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  const addProduct = (products || []).find(p => String(p.id) === String(addProductId));
  const addProductVariants = addProduct?.hasVariants ? (addProduct.variants || []) : [];

  const TABS = [
    { key: 'pending',   label: 'Pending',    icon: 'bi-clock',        count: pendingOrders.length,   badge: 'bg-warning text-dark' },
    { key: 'onprocess', label: 'On Process', icon: 'bi-arrow-repeat', count: onProcessOrders.length, badge: 'bg-primary' },
    { key: 'completed', label: 'Completed',  icon: 'bi-check-circle', count: completedOrders.length, badge: 'bg-success' },
  ];

  return (
    <div>
      <div className="card-custom mb-4">
        <div className="card-header-custom">
          <i className="bi bi-journal-text me-2"></i>Orders
        </div>
        <div className="p-3">
          {error && (
            <div className="alert alert-danger py-2 small mb-3" role="alert" onClick={() => setError('')}>
              <i className="bi bi-exclamation-circle me-1"></i>{error}
            </div>
          )}

          {/* Tabs */}
          <div className="d-flex gap-2 mb-4 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`breakdown-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <i className={`bi ${tab.icon} me-1`}></i>
                {tab.label}
                {tab.count > 0 && (
                  <span className={`badge ms-2 ${tab.badge}`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Pending ── */}
          {activeTab === 'pending' && (
            pendingOrders.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox fs-2 d-block mb-2"></i>No pending orders
              </div>
            ) : (
              pendingOrders.map(order => (
                <div key={order.id} className="border rounded mb-3">
                  <OrderCard order={order} />
                  <div className="px-3 pb-3 d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => openOrderView(order)}>
                      <i className="bi bi-eye me-1"></i>View
                    </button>
                    <button className="btn btn-sm btn-success flex-fill" onClick={() => handleAccept(order)}>
                      <i className="bi bi-check-circle me-1"></i>Accept
                    </button>
                    <button className="btn btn-sm btn-outline-danger flex-fill" onClick={() => openDeclineModal(order)}>
                      <i className="bi bi-x-circle me-1"></i>Decline
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {/* ── On Process ── */}
          {activeTab === 'onprocess' && (
            onProcessOrders.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox fs-2 d-block mb-2"></i>No orders in process
              </div>
            ) : (
              onProcessOrders.map(order => (
                <div key={order.id} className="border rounded mb-3">
                  <OrderCard order={order} />
                  <div className="px-3 pb-3 d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => openOrderView(order)}>
                      <i className="bi bi-eye me-1"></i>View
                    </button>
                    <button className="btn btn-sm btn-process flex-fill" onClick={() => openPayModal(order)}>
                      <i className="bi bi-check-circle me-1"></i>Ready — Pay
                    </button>
                    <button className="btn btn-sm btn-outline-danger flex-fill" onClick={() => openDeclineModal(order)}>
                      <i className="bi bi-x-circle me-1"></i>Decline
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {/* ── Completed ── */}
          {activeTab === 'completed' && (
            completedOrders.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox fs-2 d-block mb-2"></i>No completed orders
              </div>
            ) : (
              completedOrders.map(order => (
                <div key={order.id} className="border rounded mb-3">
                  <OrderCard order={order} />
                  <div className="px-3 pb-3 d-flex gap-2">
                    <button
                      className="btn btn-sm btn-outline-secondary flex-fill"
                      onClick={() => openCashDrawerViaBluetooth().catch(() => {})}
                    >
                      <i className="bi bi-cash me-1"></i>Cash Drawer
                    </button>
                    <button
                      className="btn btn-sm btn-outline-dark flex-fill"
                      onClick={() => { setViewReceiptOrder(order); setPrintStatus(''); }}
                    >
                      <i className="bi bi-receipt me-1"></i>View Receipt
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* ── View Order Modal ── */}
      {viewOrder && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-eye me-2"></i>View Order
                </h5>
                <button className="btn-close" onClick={closeOrderView} />
              </div>
              <div className="modal-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div className="fw-semibold fs-6">{viewOrder.customer?.name || 'Walk-in'}</div>
                    <div className="small text-muted">{viewOrder.customer?.contact}{viewOrder.customer?.address ? ` · ${viewOrder.customer.address}` : ''}</div>
                    {viewOrder.notes && <div className="small fst-italic text-muted mt-1">"{viewOrder.notes}"</div>}
                    {viewOrder.dueDate && (
                      <div className="small text-warning mt-1">
                        <i className="bi bi-calendar-event me-1"></i>Due: {viewOrder.dueDate}
                      </div>
                    )}
                  </div>
                  <div className="text-end">
                    <div className="small text-muted text-uppercase">Status</div>
                    <div className="fw-semibold text-capitalize">{viewOrder.status}</div>
                    <div className="mt-1 fw-bold fs-5">₱{Number(viewOrder.subtotal || 0).toFixed(2)}</div>
                  </div>
                </div>

                {(viewOrder.updatedByName || viewOrder.updatedAtText) && (
                  <div className="small text-muted mb-2">
                    Last updated:
                    {viewOrder.updatedByName ? ` ${viewOrder.updatedByName}` : ''}
                    {viewOrder.updatedAtText ? ` · ${viewOrder.updatedAtText}` : ''}
                  </div>
                )}

                {viewOrder.editLock?.byName && Number(viewOrder.editLock?.expiresAtMs || 0) > Date.now() && (
                  <div className="alert alert-warning py-2 small mb-2">
                    <i className="bi bi-lock me-1"></i>
                    Editing lock: currently held by {viewOrder.editLock.byName}.
                  </div>
                )}

                <hr className="my-2" />
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Item</th>
                        <th className="text-end">Qty</th>
                        <th className="text-end">Unit Price</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewOrder.items || []).map((item, idx) => (
                        <tr key={`${item.productId || item.name}-${item.variantId || 'base'}-${idx}`}>
                          <td>
                            <div className="fw-semibold">{item.name}{item.variantName ? ` (${item.variantName})` : ''}</div>
                            <div className="small text-muted">{item.unit || 'pc'}</div>
                          </td>
                          <td className="text-end">{item.qty}</td>
                          <td className="text-end">
                            ₱{Number(item.price || 0).toFixed(2)}
                            {item.priceTier === 'wholesale' && <span className="badge bg-warning text-dark ms-1">W/S</span>}
                          </td>
                          <td className="text-end fw-semibold">₱{Number(item.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer d-flex gap-2">
                {(viewOrder.status === 'pending' || viewOrder.status === 'onprocess') && (
                  <button className="btn btn-outline-secondary" onClick={() => openEditFromView(viewOrder)}>
                    <i className="bi bi-pencil-square me-1"></i>Edit
                  </button>
                )}
                {viewOrder.status === 'pending' && (
                  <button className="btn btn-success" onClick={() => acceptFromView(viewOrder)}>
                    <i className="bi bi-check-circle me-1"></i>Accept
                  </button>
                )}
                {viewOrder.status === 'onprocess' && (
                  <button className="btn btn-process" onClick={() => openPayFromView(viewOrder)}>
                    <i className="bi bi-check-circle me-1"></i>Ready — Pay
                  </button>
                )}
                {(viewOrder.status === 'pending' || viewOrder.status === 'onprocess') && (
                  <button className="btn btn-outline-danger" onClick={() => declineFromView(viewOrder)}>
                    <i className="bi bi-x-circle me-1"></i>Decline
                  </button>
                )}
                <button className="btn btn-outline-secondary ms-auto" onClick={closeOrderView}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Order Modal ── */}
      {showEditModal && editingOrder && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-pencil-square me-2"></i>Edit Order Before Payment
                </h5>
                <button className="btn-close" onClick={closeEditModal} />
              </div>
              <div className="modal-body">
                <div className="small text-muted mb-2">
                  Customer: <span className="fw-semibold text-dark">{editingOrder.customer?.name || 'Walk-in'}</span>
                </div>

                {editError && (
                  <div className="alert alert-danger py-2 small">{editError}</div>
                )}

                {editItems.length === 0 ? (
                  <div className="text-center text-muted py-3 border rounded mb-3">No items in this order.</div>
                ) : (
                  <div className="table-responsive mb-3">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th style={{ width: 90 }}>Qty</th>
                          <th style={{ width: 140 }}>Unit Price</th>
                          <th style={{ width: 120 }}>Total</th>
                          <th style={{ width: 70 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editItems.map((item, idx) => (
                          <tr key={`${item.productId || item.name}-${item.variantId || 'base'}-${idx}`}>
                            <td>
                              <div className="fw-semibold">{item.name}{item.variantName ? ` (${item.variantName})` : ''}</div>
                              <div className="small text-muted">{item.unit || 'pc'}</div>
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-control form-control-sm order-edit-qty-input"
                                value={editQtyInputs[idx] ?? String(item.qty)}
                                onChange={e => {
                                  const raw = e.target.value;
                                  setEditQtyInputs(prev => ({ ...prev, [idx]: raw }));
                                  if (raw.trim() === '') return;
                                  const parsed = parseInt(raw, 10);
                                  if (!Number.isNaN(parsed) && parsed > 0) {
                                    updateEditItem(idx, { qty: parsed });
                                  }
                                }}
                                onBlur={e => {
                                  setEditQtyInputs(prev => {
                                    const next = { ...prev };
                                    delete next[idx];
                                    return next;
                                  });
                                  const parsed = parseInt(e.target.value, 10);
                                  if (!Number.isNaN(parsed) && parsed > 0) {
                                    updateEditItem(idx, { qty: parsed });
                                  }
                                }}
                                onFocus={e => e.target.select()}
                                onClick={e => e.target.select()}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                              />
                            </td>
                            <td>
                              <div className="d-flex align-items-center justify-content-end gap-2 small">
                                {item.priceTier === 'wholesale' && <span className="badge bg-warning text-dark">W/S</span>}
                                <span className="fw-semibold">₱{normalizeMoney(item.price).toFixed(2)}</span>
                              </div>
                            </td>
                            <td className="text-end fw-semibold">₱{normalizeMoney(item.total).toFixed(2)}</td>
                            <td className="text-center">
                              <button className="btn btn-sm btn-outline-danger" onClick={() => removeEditItem(idx)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border rounded p-3 order-edit-add-box">
                  <div className="fw-semibold mb-2">Add Product</div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label small mb-1">Product</label>
                      <select
                        className="form-select form-select-sm"
                        value={addProductId}
                        onChange={e => {
                          setAddProductId(e.target.value);
                          setAddVariantId('');
                        }}
                      >
                        <option value="">Select product</option>
                        {(products || []).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small mb-1">Variant</label>
                      <select
                        className="form-select form-select-sm"
                        value={addVariantId}
                        onChange={e => setAddVariantId(e.target.value)}
                        disabled={!addProduct?.hasVariants}
                      >
                        <option value="">{addProduct?.hasVariants ? 'Select variant' : 'No variant'}</option>
                        {addProductVariants.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small mb-1">Qty</label>
                      <input
                        type="number"
                        className="form-control form-control-sm order-edit-qty-input"
                        min="1"
                        value={addQty}
                        onChange={e => setAddQty(e.target.value)}
                        onFocus={e => e.target.select()}
                        onClick={e => e.target.select()}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                    </div>
                    <div className="col-md-2 d-grid">
                      <label className="form-label small mb-1 text-transparent">Add</label>
                      <button className="btn btn-sm btn-outline-primary" onClick={handleAddItemToEdit}>
                        <i className="bi bi-plus-lg me-1"></i>Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="fw-semibold">Updated Subtotal</span>
                  <span className="fs-5 fw-bold">₱{editedSubtotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={closeEditModal} disabled={editSaving}>Cancel</button>
                <button className="btn btn-dark" onClick={handleSaveEditedOrder} disabled={editSaving}>
                  {editSaving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    : <><i className="bi bi-check2 me-1"></i>Save Changes</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPayModal && selectedOrder && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-credit-card me-2"></i>Complete Payment</h5>
                <button className="btn-close" onClick={() => setShowPayModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3 p-3 bg-light rounded">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="small text-muted">Customer</span>
                    <span className="small fw-semibold">{selectedOrder.customer?.name}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="small text-muted">Amount Payable</span>
                    <span className="fw-bold">₱{(selectedOrder.subtotal || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="mb-3">
                  {[
                    { value: 'cash',   label: 'Cash' },
                    { value: 'gcash',  label: 'GCash' },
                    { value: 'bank',   label: 'Bank Transfer' },
                    { value: 'credit', label: 'Credit' },
                  ].map(({ value, label }) => (
                    <div key={value} className="form-check mb-1">
                      <input className="form-check-input" type="radio" id={`opm-${value}`}
                        checked={payMethod === value}
                        onChange={() => { setPayMethod(value); setCashInput(''); setDueDate(''); }} />
                      <label className="form-check-label small" htmlFor={`opm-${value}`}>{label}</label>
                    </div>
                  ))}
                </div>
                {payMethod === 'cash' && (
                  <div className="mb-2">
                    <label className="form-label small fw-semibold mb-1">Cash Received (₱)</label>
                    <input type="number" className="form-control text-end fw-bold"
                      placeholder="0.00" value={cashInput}
                      onChange={e => setCashInput(e.target.value)} min="0" />
                    {cashInput && (
                      <div className={`change-display mt-2 ${changeDue < 0 ? 'insufficient' : ''}`}>
                        <span>{changeDue < 0 ? '⚠ Insufficient' : 'Change'}</span>
                        <span className="fw-bold fs-5">
                          {changeDue < 0 ? `-₱${Math.abs(changeDue).toFixed(2)}` : `₱${changeDue.toFixed(2)}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {payMethod === 'credit' && (
                  <div className="mb-2">
                    <label className="form-label small fw-semibold mb-1">Due Date *</label>
                    <input type="date" className="form-control"
                      value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                )}
                {error && <div className="alert alert-danger py-2 small mt-2">{error}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button className="btn btn-process" disabled={isPayDisabled()} onClick={handleCompletePayment}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                    : 'Complete Payment'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Decline Modal ── */}
      {showDeclineModal && declineOrder && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-danger">
                  <i className="bi bi-x-circle me-2"></i>Decline Order
                </h5>
                <button className="btn-close" onClick={() => setShowDeclineModal(false)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-2">
                  Reason for declining order from <strong>{declineOrder.customer?.name}</strong>?
                </p>
                <textarea className="form-control form-control-sm" rows={3}
                  placeholder="Enter reason (optional)..."
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowDeclineModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleDecline}>
                  {saving ? 'Declining...' : 'Decline Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {viewReceiptOrder && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-receipt me-2"></i>Receipt</h5>
                <button className="btn-close" onClick={() => { setViewReceiptOrder(null); setPrintStatus(''); }} />
              </div>
              <div className="modal-body p-0">
                <div className="receipt-preview p-3">
                  <div className="text-center mb-2">
                    <strong className="fs-6">{settings.storeName}</strong><br />
                    <small className="text-muted">{settings.address}</small><br />
                    <small className="text-muted">{settings.phone}</small>
                  </div>
                  <hr className="receipt-dashed" />
                  <div className="small mb-2">
                    <div className="d-flex justify-content-between fw-bold"><span>OR #:</span><span>{viewReceiptOrder.orNumber || viewReceiptOrder.id?.slice(-8)}</span></div>
                    <div className="d-flex justify-content-between"><span>Date:</span><span>{viewReceiptOrder.completedAt || viewReceiptOrder.date}</span></div>
                    <div className="d-flex justify-content-between"><span>Cashier:</span><span>{viewReceiptOrder.cashierName}</span></div>
                  </div>
                  <hr className="receipt-dashed" />
                  <table className="w-100 small mb-2">
                    <tbody>
                      {(viewReceiptOrder.items || []).map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div className="fw-semibold">{item.name}{item.variantName ? ` (${item.variantName})` : ''}</div>
                            <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                              {item.qty} {item.unit} &times; &#8369;{Number(item.price).toFixed(2)}
                            </div>
                          </td>
                          <td className="text-end fw-semibold">&#8369;{Number(item.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr className="receipt-dashed" />
                  <div className="d-flex justify-content-between fw-bold mb-1"><span>SUBTOTAL</span><span>&#8369;{Number(viewReceiptOrder.subtotal).toFixed(2)}</span></div>
                  <div className="d-flex justify-content-between small"><span>Payment</span><span className="text-capitalize">{viewReceiptOrder.paymentMethod || 'cash'}</span></div>
                  {(viewReceiptOrder.paymentMethod === 'cash' || !viewReceiptOrder.paymentMethod) && viewReceiptOrder.cash != null && (
                    <>
                      <div className="d-flex justify-content-between small"><span>Cash</span><span>&#8369;{Number(viewReceiptOrder.cash).toFixed(2)}</span></div>
                      <div className="d-flex justify-content-between small text-success fw-semibold"><span>Change</span><span>&#8369;{Number(viewReceiptOrder.change || 0).toFixed(2)}</span></div>
                    </>
                  )}
                  {viewReceiptOrder.customer?.name && (
                    <>
                      <hr className="receipt-dashed" />
                      <div className="small text-muted">
                        <div className="fw-semibold text-dark mb-1">Customer</div>
                        {viewReceiptOrder.customer.name && <div>Name: {viewReceiptOrder.customer.name}</div>}
                        {viewReceiptOrder.customer.contact && <div>Tel: {viewReceiptOrder.customer.contact}</div>}
                        {viewReceiptOrder.customer.address && <div>Address: {viewReceiptOrder.customer.address}</div>}
                      </div>
                    </>
                  )}
                  <hr className="receipt-dashed" />
                  <div className="text-center small text-muted">{settings.receiptFooter || 'Salamat sa inyong pagbili!'}</div>
                </div>
                {printStatus && (
                  <div className={`p-2 text-center small ${isErrorStatusMessage(printStatus) ? 'text-danger' : 'text-success'}`}>
                    {printStatus}
                  </div>
                )}
              </div>
              <div className="modal-footer flex-column gap-2 p-2">
                <button className="btn btn-dark w-100"
                  onClick={() => handlePrintReceipt(viewReceiptOrder)}
                  disabled={isPrinting}
                >
                  {isPrinting
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Printing...</>
                    : <><i className="bi bi-printer-fill me-2"></i>Print Receipt</>
                  }
                </button>
                <button className="btn btn-outline-secondary w-100"
                  onClick={() => { setViewReceiptOrder(null); setPrintStatus(''); }}
                >
                  <i className="bi bi-check2 me-2"></i>Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
