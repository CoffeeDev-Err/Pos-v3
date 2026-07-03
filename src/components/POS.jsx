import { useState, useRef } from 'react';
import '../styles/pos.css';
import '../styles/receipt.css';
import { printViaBluetooth, openCashDrawerViaBluetooth } from '../utils/escpos';
import { getErrorMessage, isErrorStatusMessage, notifyError } from '../utils/errors';

// Known category visual config — fallback palette for custom categories
const KNOWN_CONFIG = {
  'Eggs':        { color: '#f59e0b' },
  'Mantika':     { color: '#3b82f6' },
  'Daily Needs': { color: '#10b981' },
};
const PALETTE = [
  { color: '#8b5cf6' },
  { color: '#ef4444' },
  { color: '#f97316' },
  { color: '#06b6d4' },
  { color: '#84cc16' },
  { color: '#ec4899' },
];
const getCatConfig = (cat, allCats) => {
  if (KNOWN_CONFIG[cat]) return KNOWN_CONFIG[cat];
  const idx = allCats.indexOf(cat);
  return PALETTE[idx % PALETTE.length];
};

// BLE service UUIDs commonly used for data transfer from POS terminals
const POS_BLE_PROFILES = [
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', characteristic: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', characteristic: '0000ff02-0000-1000-8000-00805f9b34fb' },
];

export default function POS({ products, currentUser, categories, settings, onCreateTransaction, onCreateOrder }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Incoming transaction from POS machine (via Bluetooth or manual confirm)
  const [incomingCart, setIncomingCart] = useState([]);
  const [cashInput, setCashInput]       = useState('');
  const [showReceipt, setShowReceipt]   = useState(false);
  const [lastTxn, setLastTxn]           = useState(null);
  const [printStatus, setPrintStatus]   = useState('');
  const [isPrinting, setIsPrinting]     = useState(false);
  const [processError, setProcessError] = useState('');
  const [variantPick, setVariantPick]   = useState(null); // { product } or null
  const [priceTier, setPriceTier]       = useState('retail'); // 'retail' | 'wholesale'
  const [qtyInputs, setQtyInputs]       = useState({}); // { cartKey: displayString }

  // Multi-step transaction flow
  const [posStep, setPosStep]           = useState('cart'); // 'cart' | 'review' | 'customer' | 'payment'
  const [customerForm, setCustomerForm] = useState({ name: '', contact: '', address: '', notes: '' });
  const [payNowMethod, setPayNowMethod] = useState('cash'); // 'cash' | 'gcash' | 'bank' | 'credit' | 'paylater'
  const [dueDate, setDueDate]           = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPayLaterModal, setShowPayLaterModal] = useState(false);
  const [lastPayLaterOrder, setLastPayLaterOrder] = useState(null);

  // Bluetooth POS device state
  const [btStatus, setBtStatus]   = useState('disconnected'); // disconnected | connecting | connected | error
  const btDeviceRef = useRef(null);
  const btCharRef   = useRef(null);
  const rxBufferRef = useRef('');

  const catTabs = ['All', ...categories];
  const filtered = products.filter(p => {
    const catMatch  = activeCategory === 'All' || p.category === activeCategory;
    const nameMatch = p.name.toLowerCase().includes(search.toLowerCase());
    return catMatch && nameMatch;
  });

  const groupedProducts = categories.reduce((acc, cat) => {
    const items = filtered.filter(p => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  /* ═══════════════════════════════════════════
     BLUETOOTH — Connect to Physical POS Machine
     The POS machine acts as BLE peripheral and
     sends JSON transaction data when finalized.
     Format: {"items":[{"name":"...","price":8,"qty":2,"total":16}],"cash":20,"change":4}
  ═══════════════════════════════════════════ */
  const connectPosMachine = async () => {
    if (!navigator.bluetooth) {
      setBtStatus('error');
      return;
    }

    setBtStatus('connecting');

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: POS_BLE_PROFILES.map(p => p.service),
      });

      btDeviceRef.current = device;

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('disconnected');
        btCharRef.current = null;
      });

      const server = await device.gatt.connect();
      let characteristic = null;

      for (const profile of POS_BLE_PROFILES) {
        try {
          const svc = await server.getPrimaryService(profile.service);
          characteristic = await svc.getCharacteristic(profile.characteristic);
          break;
        } catch { continue; }
      }

      if (!characteristic) {
        device.gatt.disconnect();
        setBtStatus('error');
        return;
      }

      btCharRef.current = characteristic;

      // Listen for incoming data (the POS machine sends transaction JSON)
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const chunk = new TextDecoder().decode(event.target.value);
        rxBufferRef.current += chunk;
        // Transactions are terminated with newline or are complete JSON
        try {
          const parsed = JSON.parse(rxBufferRef.current.trim());
          rxBufferRef.current = '';
          handleIncomingTransaction(parsed);
        } catch {
          // Not yet a complete JSON — keep buffering
        }
      });

      setBtStatus('connected');
    } catch {
      setBtStatus('error');
    }
  };

  const disconnectPosMachine = () => {
    if (btDeviceRef.current?.gatt?.connected) {
      btDeviceRef.current.gatt.disconnect();
    }
    setBtStatus('disconnected');
    btCharRef.current = null;
  };

  /* ═══════════════════════════════════════════
     Handle incoming transaction from POS machine
     Expected format:
     {
       items: [{ name, price, qty, total }],
       cash: number,
       change: number
     }
  ═══════════════════════════════════════════ */
  const handleIncomingTransaction = (data) => {
    if (data?.items?.length > 0) {
      setIncomingCart(data.items);
      setCashInput(String(data.cash || ''));
    }
  };

  // Derived totals
  const subtotal = incomingCart.reduce((s, i) => s + i.total, 0);
  const cash     = parseFloat(cashInput) || 0;
  const change   = cash - subtotal;

  const removeItem = (idx) => setIncomingCart(prev => prev.filter((_, i) => i !== idx));

  const setCartQty = (idx, raw) => {
    const newQty = parseInt(raw, 10);
    if (!raw || isNaN(newQty)) return;
    if (newQty <= 0) { removeItem(idx); return; }
    updateCartQtyTo(idx, newQty);
  };

  const updateCartQty = (idx, delta) => {
    const currentQty = incomingCart[idx]?.qty || 0;
    updateCartQtyTo(idx, currentQty + delta);
  };

  const updateCartQtyTo = (idx, newQty) => {
    setIncomingCart(prev => {
      const item = prev[idx];
      if (!item) return prev;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);

      const product = (products || []).find(p => String(p.id) === String(item.productId));
      if (product) {
        // Stock check against other cart lines for the same product
        const otherBaseUnits = prev
          .filter((_, i) => i !== idx)
          .filter(i => String(i.productId) === String(item.productId))
          .reduce((sum, i) => sum + i.qty * (Number(i.conversionRate) || 1), 0);
        const requiredBase = newQty * (Number(item.conversionRate) || 1);
        if (otherBaseUnits + requiredBase > (product.stock || 0)) return prev;

        // Re-evaluate wholesale threshold
        const src = item.variantId
          ? (product.variants?.find(v => v.id === item.variantId) || product)
          : product;
        const priceRetail    = Number(src.priceRetail ?? src.price ?? item.price);
        const priceWholesale = Number(src.priceWholesale ?? priceRetail);
        const threshold      = Number(src.wholesaleQtyThreshold ?? product.wholesaleQtyThreshold ?? 0);
        const tier = priceTier === 'wholesale'
          ? 'wholesale'
          : (threshold > 0 && newQty >= threshold ? 'wholesale' : 'retail');
        const resolvedPrice = tier === 'wholesale' ? priceWholesale : priceRetail;

        const next = [...prev];
        next[idx] = { ...item, qty: newQty, price: resolvedPrice, priceTier: tier, total: Number((newQty * resolvedPrice).toFixed(2)) };
        return next;
      }

      // Fallback: no product found, keep same unit price
      const next = [...prev];
      next[idx] = { ...item, qty: newQty, total: Number((newQty * item.price).toFixed(2)) };
      return next;
    });
  };

  const resetCart = () => {
    setIncomingCart([]);
    setCashInput('');
    setPosStep('cart');
    setCustomerForm({ name: '', contact: '', address: '', notes: '' });
    setPayNowMethod('cash');
    setDueDate('');
    setProcessError('');
    setQtyInputs({});
  };

  const isProcessDisabled = () => {
    if (incomingCart.length === 0 || isProcessing) return true;
    if (payNowMethod === 'cash') return !cashInput || change < 0;
    if (payNowMethod === 'credit') return !dueDate;
    return false;
  };

  const handleProcessPayment = async () => {
    if (incomingCart.length === 0) return;
    setProcessError('');
    setIsProcessing(true);
    try {
      if (payNowMethod === 'paylater') {
        const order = await onCreateOrder({
          items: incomingCart.map(i => ({ ...i })),
          customer: customerForm,
          notes: customerForm.notes,
          paymentMethod: 'paylater',
          dueDate,
          cashierId: currentUser.id,
          status: 'pending',
        });
        setLastPayLaterOrder(order);
        setShowPayLaterModal(true);
        resetCart();
      } else {
        const cashPaid = payNowMethod === 'cash' ? (parseFloat(cashInput) || 0) : subtotal;
        const changeDue = payNowMethod === 'cash' ? cashPaid - subtotal : 0;
        const txn = await onCreateTransaction({
          items: incomingCart.map(i => ({ ...i })),
          cash: cashPaid,
          change: changeDue,
          cashierId: currentUser.id,
          paymentMethod: payNowMethod,
          customer: customerForm,
          dueDate: payNowMethod === 'credit' ? dueDate : '',
        });
        if (payNowMethod === 'cash') {
          openCashDrawerViaBluetooth().catch(() => {});
        }
        setLastTxn(txn);
        setShowReceipt(true);
        resetCart();
      }
    } catch (err) {
      setProcessError(getErrorMessage(err, { fallback: 'An error occurred while processing the transaction. Please try again.' }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddProduct = (product, variant = null) => {
    // Resolve prices from variant or product, with backward-compat fallback to `price`
    const src = variant || product;
    const priceRetail    = Number(src.priceRetail ?? src.price ?? 0);
    const priceWholesale = Number(src.priceWholesale ?? priceRetail);
    const unit           = variant ? variant.unit                   : product.unit;
    const conversionRate = variant ? (Number(variant.conversionRate) || 1) : (Number(product.conversionRate) || 1);
    const variantId      = variant ? variant.id   : null;
    const variantName    = variant ? variant.name : null;

    // Helper: resolve tier for a given qty (auto-wholesale threshold)
    const resolveTier = (qty) => {
      if (priceTier === 'wholesale') return 'wholesale';
      const threshold = Number(src.wholesaleQtyThreshold) || 0;
      return (threshold > 0 && qty >= threshold) ? 'wholesale' : 'retail';
    };

    // Stock check: for variant products stock is in base units shared across all variants.
    const inCartBaseUnits = incomingCart
      .filter(i => i.productId === product.id)
      .reduce((sum, i) => sum + (i.qty * (Number(i.conversionRate) || 1)), 0);
    const availableBaseUnits = (product.stock || 0) - inCartBaseUnits;

    if (availableBaseUnits < conversionRate) {
      setProcessError('Insufficient stock. This item cannot be added to the cart.');
      return;
    }

    setProcessError('');
    setPosStep('cart');
    setIncomingCart(prev => {
      // Cart key: productId-variantId for variants, productId alone otherwise
      const cartKey = variantId ? `${product.id}-${variantId}` : String(product.id);
      const idx = prev.findIndex(i => {
        const k = i.variantId ? `${i.productId}-${i.variantId}` : String(i.productId);
        return k === cartKey;
      });

      if (idx >= 0) {
        const nextQty = prev[idx].qty + 1;
        const otherBaseUnits = inCartBaseUnits - prev[idx].qty * conversionRate;
        if (otherBaseUnits + nextQty * conversionRate > product.stock) {
          setProcessError('Insufficient stock. The requested quantity exceeds available stock.');
          return prev;
        }
        const tier = resolveTier(nextQty);
        const resolvedPrice = tier === 'wholesale' ? priceWholesale : priceRetail;
        const next = [...prev];
        next[idx] = { ...next[idx], qty: nextQty, price: resolvedPrice, priceTier: tier, total: Number((nextQty * resolvedPrice).toFixed(2)) };
        return next;
      }
      const tier = resolveTier(1);
      const resolvedPrice = tier === 'wholesale' ? priceWholesale : priceRetail;
      const unitCost = Number(src.cost || 0);
      return [...prev, {
        productId: product.id,
        name:      product.name,
        variantId,
        variantName,
        price:     resolvedPrice,
        priceTier: tier,
        cost:      unitCost,
        unit,
        conversionRate,
        qty:   1,
        total: Number(resolvedPrice),
      }];
    });
  };

  const handlePrintBT = async () => {
    if (!lastTxn) return;
    setIsPrinting(true);
    setPrintStatus('');
    try {
      await printViaBluetooth({
        storeName:     settings.storeName,
        address:       settings.address,
        phone:         settings.phone,
        footer:        settings.receiptFooter,
        orNumber:      lastTxn.orNumber,
        txnId:         lastTxn.id,
        date:          lastTxn.date,
        time:          lastTxn.time,
        cashierName:   lastTxn.cashierName,
        items:         lastTxn.items,
        total:         lastTxn.subtotal,
        paymentMethod: lastTxn.paymentMethod,
        cash:          lastTxn.cash,
        change:        lastTxn.change,
        customer:      lastTxn.customer,
      }, setPrintStatus);
    } catch (err) {
      const normalized = notifyError(err, { context: 'bluetooth-print' });
      setPrintStatus(normalized.message);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="pos-layout">

      {/* ═════════════ LEFT: Product Reference Panel ═════════════ */}
      <div className="pos-products">
        <div className="pos-products-header">
          <div className="pos-products-title">
            <i className="bi bi-grid-3x3-gap me-2"></i>Product Reference
          </div>
          <div className="d-flex gap-2 align-items-center">
            <div className="btn-group btn-group-sm" role="group" aria-label="Price tier">
              <button
                type="button"
                className={`btn ${priceTier === 'retail' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setPriceTier('retail')}
                title="Retail pricing"
              >Retail</button>
              <button
                type="button"
                className={`btn ${priceTier === 'wholesale' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
                onClick={() => setPriceTier('wholesale')}
                title="Wholesale pricing"
              >W/S</button>
            </div>
            <div className="input-group input-group-sm" style={{ maxWidth: 200 }}>
              <span className="input-group-text bg-light"><i className="bi bi-search text-muted" style={{ fontSize: '0.7rem' }}></i></span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="category-tabs mb-2">
          {catTabs.map(cat => (
            <button
              key={cat}
              className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === 'All' ? <i className="bi bi-grid me-1"></i> : null}
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="pos-products-scroll">
          {activeCategory === 'All' ? (
            Object.keys(groupedProducts).length === 0 ? (
              <div className="text-center text-muted py-4 small">
                <i className="bi bi-box-seam fs-2 d-block mb-2"></i>No products found
              </div>
            ) : (
              Object.entries(groupedProducts).map(([cat, items]) => {
                const cfg = getCatConfig(cat, categories);
                return (
                  <div key={cat} className="category-group mb-3">
                    <div className="category-group-header" style={{ borderLeftColor: cfg.color }}>
                      <span className="category-group-name">{cat}</span>
                      <span className="category-group-count">{items.length}</span>
                    </div>
                    <div className="product-grid">
                      {items.map(p => renderCard(p))}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div className="product-grid">
              {filtered.map(p => renderCard(p))}
              {filtered.length === 0 && (
                <div className="col-span-all text-center text-muted py-4 small">
                  <i className="bi bi-box-seam fs-2 d-block mb-2"></i>No items
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═════════════ RIGHT: Transaction Panel ═════════════ */}
      <div className="pos-cart">

        {/* Cart Header */}
        <div className="cart-header">
          <i className={`bi ${posStep === 'cart' ? 'bi-receipt' : posStep === 'review' ? 'bi-eye' : posStep === 'customer' ? 'bi-person' : 'bi-credit-card'} me-2`}></i>
          {posStep === 'cart' ? 'Current Transaction' : posStep === 'review' ? 'Review Order' : posStep === 'customer' ? 'Customer Details' : 'Payment'}
          <div className="d-flex gap-1 ms-auto">
            {btStatus !== 'connected' ? (
              <button
                className="btn btn-sm btn-primary"
                onClick={connectPosMachine}
                disabled={btStatus === 'connecting'}
              >
                {btStatus === 'connecting'
                  ? <><span className="spinner-border spinner-border-sm me-1"></span></>
                  : <><i className="bi bi-bluetooth me-1"></i></>
                }
                Bluetooth
              </button>
            ) : (
              <button className="btn btn-sm btn-outline-danger" onClick={disconnectPosMachine}>
                <i className="bi bi-bluetooth me-1"></i>
                Bluetooth
              </button>
            )}
            {incomingCart.length > 0 && posStep === 'cart' && (
              <button className="btn btn-link text-danger p-0 small" onClick={resetCart}>
                <i className="bi bi-trash me-1"></i>Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Step: CART ── */}
        {posStep === 'cart' && (
          <>
            {processError && (
              <div className="alert alert-danger py-2 small mt-2 mx-2">
                <i className="bi bi-exclamation-circle me-1"></i>{processError}
              </div>
            )}
            <div className="cart-items">
              {incomingCart.length === 0 ? (
                <div className="empty-cart">
                  <i className="bi bi-pc-display-horizontal fs-1 text-muted"></i>
                  <p className="text-muted mt-2 mb-0 small">
                    No transaction received yet.<br />
                    Connect the POS machine via Bluetooth<br />to sync items automatically.
                  </p>
                </div>
              ) : (
                incomingCart.map((item, idx) => (
                  <div key={idx} className="cart-item">
                    <div className="cart-item-info">
                      <div className="cart-item-name">
                        {item.name}
                        {item.variantName && (
                          <span className="text-muted small ms-1">({item.variantName})</span>
                        )}
                      </div>
                      <div className="cart-item-price text-muted small">
                        ₱{item.price}/{item.unit || 'pc'}
                        {item.priceTier === 'wholesale' && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.6rem' }}>W/S</span>}
                      </div>
                    </div>
                    <div className="cart-item-controls">
                      <button className="qty-btn" onClick={() => updateCartQty(idx, -1)} aria-label="Decrease">
                        <i className="bi bi-dash"></i>
                      </button>
                      <input
                        type="number"
                        className="qty-val qty-input"
                        value={qtyInputs[idx] ?? item.qty}
                        min="1"
                        onChange={e => {
                          setQtyInputs(prev => ({ ...prev, [idx]: e.target.value }));
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) setCartQty(idx, val);
                        }}
                        onFocus={e => e.target.select()}
                        onBlur={e => {
                          setQtyInputs(prev => { const n = { ...prev }; delete n[idx]; return n; });
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) setCartQty(idx, val);
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                        style={{ width: '2.5rem', textAlign: 'center', border: '1.5px solid #dee2e6', borderRadius: 6, background: 'transparent', fontSize: '0.875rem', fontWeight: 800, padding: '1px 2px' }}
                      />
                      <button className="qty-btn" onClick={() => updateCartQty(idx, 1)} aria-label="Increase">
                        <i className="bi bi-plus"></i>
                      </button>
                      <span className="cart-item-total ms-1">₱{item.total}</span>
                      <button
                        className="btn btn-link text-danger p-0 ms-1"
                        onClick={() => removeItem(idx)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <i className="bi bi-x-circle-fill"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="cart-payment">
              <div className="d-flex justify-content-between mb-2">
                <span className="fs-6 fw-semibold">Total</span>
                <span className="fs-5 fw-bold text-dark">₱{subtotal.toLocaleString()}</span>
              </div>
              <button
                className="btn btn-process w-100 mt-2"
                onClick={() => setPosStep('review')}
                disabled={incomingCart.length === 0}
              >
                <i className="bi bi-eye-fill me-2"></i>Review Order
              </button>
            </div>
          </>
        )}

        {/* ── Step: REVIEW ── */}
        {posStep === 'review' && (
          <>
            <div className="cart-items">
              {incomingCart.map((item, idx) => (
                <div key={idx} className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name">
                      {item.name}
                      {item.variantName && <span className="text-muted small ms-1">({item.variantName})</span>}
                    </div>
                    <div className="cart-item-price text-muted small">
                      ₱{item.price} × {item.qty} {item.unit && <span>({item.unit})</span>}
                      {item.priceTier === 'wholesale' && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.6rem' }}>W/S</span>}
                    </div>
                  </div>
                  <div className="cart-item-controls">
                    <span className="cart-item-total">₱{item.total}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-payment">
              <div className="d-flex justify-content-between mb-3">
                <span className="fs-6 fw-semibold">Total</span>
                <span className="fs-5 fw-bold text-dark">₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary flex-fill" onClick={() => setPosStep('cart')}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button className="btn btn-dark flex-fill" onClick={() => setPosStep('customer')}>
                  Proceed<i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step: CUSTOMER ── */}
        {posStep === 'customer' && (
          <>
            <div className="cart-items p-3">
              <h6 className="mb-3 fw-semibold"><i className="bi bi-person me-2"></i>Customer Details</h6>
              <div className="mb-2">
                <label className="form-label small fw-semibold mb-1">Name <span className="text-danger">*</span></label>
                <input type="text" className="form-control form-control-sm"
                  value={customerForm.name}
                  onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Customer name" />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold mb-1">Contact Number <span className="text-danger">*</span></label>
                <input type="tel" className="form-control form-control-sm"
                  value={customerForm.contact}
                  onChange={e => setCustomerForm(f => ({ ...f, contact: e.target.value }))}
                  placeholder="09XX-XXX-XXXX" />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold mb-1">Address <span className="text-danger">*</span></label>
                <input type="text" className="form-control form-control-sm"
                  value={customerForm.address}
                  onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Address" />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold mb-1">Notes <span className="text-muted">(Optional)</span></label>
                <textarea className="form-control form-control-sm" rows={2}
                  value={customerForm.notes}
                  onChange={e => setCustomerForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Order notes..." />
              </div>
            </div>
            <div className="cart-payment">
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary flex-fill" onClick={() => setPosStep('review')}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button
                  className="btn btn-dark flex-fill"
                  disabled={!customerForm.name || !customerForm.contact || !customerForm.address}
                  onClick={() => setPosStep('payment')}
                >
                  Confirm<i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step: PAYMENT ── */}
        {posStep === 'payment' && (
          <>
            <div className="cart-items p-3">
              <div className="mb-1 fw-semibold small"><i className="bi bi-credit-card me-2"></i>Payment Options</div>
              <div className="small text-muted mb-3">Total: <strong>₱{subtotal.toLocaleString()}</strong></div>

              <div className="mb-3">
                <div className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>Pay Now</div>
                {[
                  { value: 'cash',   label: 'Cash' },
                  { value: 'gcash',  label: 'GCash' },
                  { value: 'bank',   label: 'Bank Transfer' },
                  { value: 'credit', label: 'Credit' },
                ].map(({ value, label }) => (
                  <div key={value} className="form-check mb-1">
                    <input className="form-check-input" type="radio" id={`pm-${value}`}
                      checked={payNowMethod === value}
                      onChange={() => { setPayNowMethod(value); setDueDate(''); }} />
                    <label className="form-check-label small" htmlFor={`pm-${value}`}>{label}</label>
                  </div>
                ))}
                {payNowMethod === 'cash' && (
                  <div className="mt-2 ms-3">
                    <label className="form-label small fw-semibold mb-1">Cash Received (₱)</label>
                    <input type="number" className="form-control form-control-sm text-end fw-bold"
                      placeholder="0.00" value={cashInput}
                      onChange={e => setCashInput(e.target.value)} min="0" />
                    {cashInput && (
                      <div className={`change-display mt-1 ${change < 0 ? 'insufficient' : ''}`}>
                        <span className="small">{change < 0 ? '⚠ Insufficient' : 'Change'}</span>
                        <span className="fw-bold">{change < 0 ? `-₱${Math.abs(change).toFixed(2)}` : `₱${change.toFixed(2)}`}</span>
                      </div>
                    )}
                  </div>
                )}
                {payNowMethod === 'credit' && (
                  <div className="mt-2 ms-3">
                    <label className="form-label small fw-semibold mb-1">Due Date <span className="text-danger">*</span></label>
                    <input type="date" className="form-control form-control-sm"
                      value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <div className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>Pay Later</div>
                <div className="form-check mb-1">
                  <input className="form-check-input" type="radio" id="pm-paylater"
                    checked={payNowMethod === 'paylater'}
                    onChange={() => { setPayNowMethod('paylater'); setDueDate(''); }} />
                  <label className="form-check-label small" htmlFor="pm-paylater">
                    Consignment / Reservation
                  </label>
                </div>
                {payNowMethod === 'paylater' && (
                  <div className="mt-2 ms-3">
                    <label className="form-label small fw-semibold mb-1">Due Date <span className="text-muted">(Optional)</span></label>
                    <input type="date" className="form-control form-control-sm"
                      value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="cart-payment">
              {processError && (
                <div className="alert alert-danger py-2 small mb-2">
                  <i className="bi bi-exclamation-circle me-1"></i>{processError}
                </div>
              )}
              <div className="d-flex gap-2 mb-2">
                <button className="btn btn-outline-secondary flex-fill" onClick={() => setPosStep('customer')}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
              </div>
              <button
                className={`btn w-100 ${payNowMethod === 'paylater' ? 'btn-warning text-dark' : 'btn-process'}`}
                onClick={handleProcessPayment}
                disabled={isProcessDisabled()}
              >
                {isProcessing
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                  : payNowMethod === 'paylater'
                    ? <><i className="bi bi-clock me-2"></i>Place Order (Pay Later)</>
                    : <><i className="bi bi-check-circle-fill me-2"></i>Complete Payment</>
                }
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═════════════ Variant Picker Modal ═════════════ */}
      {variantPick && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-grid-3x3-gap me-2"></i>{variantPick.product.name}
                </h5>
                <button className="btn-close" onClick={() => setVariantPick(null)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3">Select a size or type:</p>
                <div className="d-flex flex-column gap-2">
                  {(variantPick.product.variants || []).map(v => {
                    const convRate = Number(v.conversionRate) || 1;
                    const inCart = incomingCart
                      .filter(i => i.productId === variantPick.product.id)
                      .reduce((s, i) => s + i.qty * (Number(i.conversionRate) || 1), 0);
                    const avail = variantPick.product.stock - inCart;
                    const sellableQty = Math.floor(avail / convRate);
                    const isOut = sellableQty <= 0;
                    return (
                      <button
                        key={v.id}
                        className={`btn btn-outline-secondary text-start ${isOut ? 'disabled opacity-50' : ''}`}
                        disabled={isOut}
                        onClick={() => {
                          handleAddProduct(variantPick.product, v);
                          setVariantPick(null);
                        }}
                      >
                        <div className="fw-semibold">{v.name}</div>
                        <div className="small text-muted">
                          {(() => {
                            const retail = Number(v.priceRetail ?? v.price ?? 0);
                            const wholesale = Number(v.priceWholesale ?? retail);
                            return priceTier === 'wholesale'
                              ? <><span className="text-warning fw-semibold">₱{wholesale.toFixed(2)}</span> <span className="text-muted">(W/S)</span></>
                              : <span>₱{retail.toFixed(2)}</span>;
                          })()} / {v.unit}
                          {' · '}
                          {isOut ? <span className="text-danger">Out of stock</span> : <span>{sellableQty} available</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary w-100" onClick={() => setVariantPick(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════ Receipt Modal ═════════════ */}
      {showReceipt && lastTxn && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-check-circle-fill me-2"></i>Transaction Complete!
                </h5>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowReceipt(false)}
                  aria-label="Close receipt"
                ></button>
              </div>
              <div className="modal-body p-0">
                <div className="receipt-preview">
                  <div className="text-center mb-2">
                    <strong className="fs-6">{settings.storeName}</strong><br />
                    <small className="text-muted">{settings.address}</small><br />
                    <small className="text-muted">{settings.phone}</small>
                  </div>
                  <hr className="receipt-dashed" />
                  <div className="receipt-info">
                    <div className="d-flex justify-content-between small fw-bold"><span>OR #:</span><span>{lastTxn.orNumber || lastTxn.id?.slice(-8)}</span></div>
                    <div className="d-flex justify-content-between small"><span>Date:</span><span>{lastTxn.date}</span></div>
                    <div className="d-flex justify-content-between small"><span>Time:</span><span>{lastTxn.time}</span></div>
                    <div className="d-flex justify-content-between small"><span>Cashier:</span><span>{lastTxn.cashierName}</span></div>
                  </div>
                  <hr className="receipt-dashed" />
                  <table className="w-100 small">
                    <tbody>
                      {lastTxn.items.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div className="fw-semibold">{item.name}{item.variantName ? ` (${item.variantName})` : ''}</div>
                            <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                              {item.qty} {item.unit || ''} &times; &#8369;{Number(item.price).toFixed(2)}
                            </div>
                          </td>
                          <td className="text-end fw-semibold">&#8369;{Number(item.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr className="receipt-dashed" />
                  <div className="d-flex justify-content-between fw-bold"><span>SUBTOTAL</span><span>&#8369;{Number(lastTxn.subtotal).toFixed(2)}</span></div>
                  <div className="d-flex justify-content-between small"><span>Payment</span><span className="text-capitalize">{lastTxn.paymentMethod || 'cash'}</span></div>
                  {(lastTxn.paymentMethod === 'cash' || !lastTxn.paymentMethod) && (
                    <>
                      <div className="d-flex justify-content-between small"><span>Cash</span><span>&#8369;{Number(lastTxn.cash).toFixed(2)}</span></div>
                      <div className="d-flex justify-content-between small text-success fw-semibold"><span>Change</span><span>&#8369;{Number(lastTxn.change).toFixed(2)}</span></div>
                    </>
                  )}
                  {lastTxn.customer?.name && (
                    <>
                      <hr className="receipt-dashed" />
                      <div className="small text-muted">
                        <div className="fw-semibold text-dark mb-1">Customer</div>
                        {lastTxn.customer.name && <div>Name: {lastTxn.customer.name}</div>}
                        {lastTxn.customer.contact && <div>Tel: {lastTxn.customer.contact}</div>}
                        {lastTxn.customer.address && <div>Address: {lastTxn.customer.address}</div>}
                      </div>
                    </>
                  )}
                  <hr className="receipt-dashed" />
                  <div className="text-center small text-muted">{settings.receiptFooter || 'Salamat sa inyong pagbili!'}</div>
                </div>
                {printStatus && (
                  <div className={`p-2 text-center small ${isErrorStatusMessage(printStatus) ? 'text-danger bg-danger-subtle' : 'text-success bg-success-subtle'}`}>
                    {printStatus}
                  </div>
                )}
              </div>
              <div className="modal-footer flex-column gap-2 p-2">
                <button className="btn btn-dark w-100" onClick={handlePrintBT} disabled={isPrinting}>
                  {isPrinting
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Printing...</>
                    : <><i className="bi bi-printer-fill me-2"></i>Print Receipt (Bluetooth)</>
                  }
                </button>
                <button className="btn btn-outline-secondary w-100" onClick={() => { setShowReceipt(false); setLastTxn(null); setPrintStatus(''); }}>
                  <i className="bi bi-check2 me-2"></i>Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay Later Success Modal */}
      {showPayLaterModal && lastPayLaterOrder && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--accent)', color: '#fff' }}>
                <h5 className="modal-title">
                  <i className="bi bi-clock-fill me-2"></i>Order Placed!
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setShowPayLaterModal(false)} />
              </div>
              <div className="modal-body">
                <p className="mb-1 small">
                  Order for <strong>{lastPayLaterOrder.customer?.name}</strong> has been placed as <strong>Pending</strong>.
                </p>
                <p className="mb-0 small text-muted">
                  Go to <strong>Orders</strong> to accept and process it.
                </p>
                {lastPayLaterOrder.dueDate && (
                  <p className="mb-0 small text-warning mt-1">
                    <i className="bi bi-calendar-event me-1"></i>Due: {lastPayLaterOrder.dueDate}
                  </p>
                )}
              </div>
              <div className="modal-footer p-2">
                <button className="btn btn-process w-100" onClick={() => setShowPayLaterModal(false)}>
                  <i className="bi bi-check2 me-2"></i>OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Compact product reference card
  function renderCard(product) {
    const isLow = product.stock > 0 && product.stock <= product.lowStockAlert;
    const isOut = product.stock <= 0;
    const productName = product.name.replace(/ *\([^)]*\) */g, " ");
    const isVariant   = product.hasVariants;

    // For variant products, show stock in base units
    const stockLabel  = isVariant
      ? `${product.stock} ${product.baseUnit || 'pc'}`
      : product.stock;
    const priceLabel  = isVariant
      ? (() => {
          const prices = (product.variants || []).map(v =>
            priceTier === 'wholesale'
              ? Number(v.priceWholesale ?? v.priceRetail ?? v.price ?? 0)
              : Number(v.priceRetail ?? v.price ?? 0)
          );
          const minP = Math.min(...prices);
          return priceTier === 'wholesale' ? `W/S ₱${minP.toFixed(2)}` : `from ₱${minP.toFixed(2)}`;
        })()
      : (() => {
          const retail = Number(product.priceRetail ?? product.price ?? 0);
          const wholesale = Number(product.priceWholesale ?? retail);
          return priceTier === 'wholesale' ? `W/S ₱${wholesale.toFixed(2)}` : `₱${retail.toFixed(2)}`;
        })();

    return (
      <div
        key={product.id}
        className={`product-card-ref ${isOut ? 'out-of-stock' : ''} ${isLow ? 'low-stock' : ''} ${selectedProductId === product.id ? 'selected' : ''}`}
        title={product.name}
        role="button"
        tabIndex={isOut ? -1 : 0}
        aria-disabled={isOut}
        onClick={() => {
          if (!isOut) {
            setSelectedProductId(product.id);
            if (product.hasVariants) {
              setVariantPick({ product });
            } else {
              handleAddProduct(product);
            }
          }
        }}
        onKeyDown={(e) => {
          if (isOut) return;
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedProductId(product.id);
            if (product.hasVariants) {
              setVariantPick({ product });
            } else {
              handleAddProduct(product);
            }
          }
        }}
      >
        <div className="pcr-name">{productName}</div>
        <div className="pcr-price">{priceLabel}</div>
        {isVariant && <div className="pcr-unit text-muted" style={{ fontSize: '0.6rem', color: 'var(--accent)' }}>tap to pick variant</div>}
        {!isVariant && <div className="pcr-unit text-muted">/{product.unit}</div>}
        {isOut ? (
          <span className="stock-badge out">OUT</span>
        ) : isLow ? (
          <span className="stock-badge low">{stockLabel}</span>
        ) : (
          <span className="stock-badge ok">{stockLabel}</span>
        )}
      </div>
    );
  }
}
