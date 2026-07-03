import { useMemo, useState } from 'react';

// Products whose name contains "egg" are considered harvest/poultry products
const isPoultryProduct = (p) => p.name.toLowerCase().includes('egg');

const formatQty = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};

/**
 * Formats stock display to show full packaging units + partial base units.
 * Example: 370 kg with 25kg/sack → "14 sacks + 20 kg"
 */
function formatStockDisplay(product) {
  if (!product) return '0';
  
  const stock = Number(product.stock || 0);
  const baseUnit = product.hasVariants 
    ? (product.baseUnit || 'pc')
    : (product.baseUnit || product.unit || 'pc');

  // Find the largest variant/conversion unit
  let largestVariant = null;
  let largestRate = 0;

  if (product.hasVariants && Array.isArray(product.variants)) {
    product.variants.forEach(v => {
      const rate = Number(v.conversionRate || 0);
      if (rate > largestRate) {
        largestRate = rate;
        largestVariant = {
          name: v.name,
          unit: v.unit || baseUnit,
          rate: rate,
        };
      }
    });
  } else if (product.conversionRate && Number(product.conversionRate) > 1) {
    largestRate = Number(product.conversionRate);
    largestVariant = {
      name: product.unit || 'pack',
      unit: product.unit || 'pack',
      rate: largestRate,
    };
  }

  // If there's a packaging unit, show breakdown
  if (largestVariant && largestRate > 1) {
    const fullUnits = Math.floor(stock / largestRate);
    const partialUnits = stock % largestRate;
    
    if (fullUnits === 0) {
      // Only partial units
      return `${formatQty(partialUnits)} ${baseUnit}`;
    } else if (partialUnits === 0) {
      // Only full units
      return `${fullUnits} ${largestVariant.unit}`;
    } else {
      // Both full and partial
      return `${fullUnits} ${largestVariant.unit} + ${formatQty(partialUnits)} ${baseUnit}`;
    }
  }

  // No packaging unit, show base only
  return `${formatQty(stock)} ${baseUnit}`;
}

function getStockInUnitOptions(product) {
  if (!product) return [];

  const baseUnit = product.hasVariants
    ? (product.baseUnit || 'pc')
    : (product.baseUnit || product.unit || 'pc');

  const options = [{
    key: 'base',
    label: `${baseUnit} (base unit)`,
    unit: baseUnit,
    multiplier: 1,
  }];

  if (product.hasVariants) {
    (product.variants || []).forEach(v => {
      const mult = Number(v.conversionRate) || 1;
      options.push({
        key: `variant:${v.id}`,
        label: `${v.name} (${v.unit})`,
        unit: v.unit || baseUnit,
        multiplier: mult,
      });
    });
  } else {
    const mult = Number(product.conversionRate) || 1;
    if (product.unit && product.unit !== baseUnit && mult > 0) {
      options.push({
        key: 'main-unit',
        label: `${product.unit}`,
        unit: product.unit,
        multiplier: mult,
      });
    }
  }

  return options;
}

export default function Inventory({ products, categories, stockMovements, onStockIn, currentUser }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showStockIn, setShowStockIn] = useState(false);
  const [openCategories, setOpenCategories] = useState({});
  const [stockInForm, setStockInForm] = useState({ productId: '', unitKey: 'base', qty: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showHarvest, setShowHarvest] = useState(false);
  const [harvestForm, setHarvestForm] = useState({ productId: '', qty: '', variantQtys: {}, note: 'Harvest' });
  const [harvestSaving, setHarvestSaving] = useState(false);
  const [harvestError, setHarvestError] = useState('');

  const lowStock = products.filter(p => p.stock <= p.lowStockAlert);
  const outOfStock = products.filter(p => p.stock === 0);

  const filtered = products.filter(p => {
    const cat = catFilter === 'All' || p.category === catFilter;
    const s = p.name.toLowerCase().includes(search.toLowerCase());
    return cat && s;
  });

  const handleStockIn = async () => {
    const product = products.find(p => String(p.id) === String(stockInForm.productId));
    if (!product || !stockInForm.qty) return;

    const inputQty = Number(stockInForm.qty || 0);
    if (!Number.isFinite(inputQty) || inputQty <= 0) {
      setError('Please enter a valid stock-in quantity.');
      return;
    }

    const unitOptions = getStockInUnitOptions(product);
    const selectedUnit = unitOptions.find(u => u.key === stockInForm.unitKey) || unitOptions[0];
    if (!selectedUnit) {
      setError('No valid stock-in unit is configured for this product.');
      return;
    }

    const baseUnit = product.hasVariants
      ? (product.baseUnit || 'pc')
      : (product.baseUnit || product.unit || 'pc');
    const baseQty = Number((inputQty * Number(selectedUnit.multiplier || 1)).toFixed(4));
    const conversionText = Number(selectedUnit.multiplier || 1) !== 1
      ? `${formatQty(inputQty)} ${selectedUnit.unit} x ${formatQty(selectedUnit.multiplier)} = ${formatQty(baseQty)} ${baseUnit}`
      : `${formatQty(baseQty)} ${baseUnit}`;

    setSaving(true);
    setError('');

    try {
      const now = new Date();
      await onStockIn({
        productId: product.id,
        product: product.name,
        qty: baseQty,
        inputQty,
        inputUnit: selectedUnit.unit,
        inputMultiplier: Number(selectedUnit.multiplier || 1),
        baseUnit,
        note: `${stockInForm.note || 'Manual stock-in'} (${conversionText})`,
        date: now.toISOString().slice(0, 10),
        time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      });
      setStockInForm({ productId: '', unitKey: 'base', qty: '', note: '' });
      setShowStockIn(false);
    } catch (err) {
      setError(err.message || 'An error occurred while recording the stock entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleHarvest = async () => {
    const product = products.find(p => String(p.id) === String(harvestForm.productId));
    if (!product) return;

    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const inputBy = currentUser?.name || '';

    setHarvestSaving(true);
    setHarvestError('');

    try {
      if (product.hasVariants) {
        // Save one movement per variant that has a qty > 0
        const entries = (product.variants || [])
          .map(v => ({ variant: v, qty: parseInt(harvestForm.variantQtys[v.id] || 0) }))
          .filter(e => e.qty > 0);
        if (entries.length === 0) {
          setHarvestError('Enter at least one harvest quantity.');
          return;
        }
        for (const { variant, qty } of entries) {
          await onStockIn({
            productId: product.id,
            product: product.name,
            variant: variant.name,
            qty,
            note: harvestForm.note || 'Harvest',
            type: 'harvest',
            inputBy,
            date,
            time,
          });
        }
      } else {
        if (!harvestForm.qty || parseInt(harvestForm.qty) <= 0) return;
        await onStockIn({
          productId: product.id,
          product: product.name,
          variant: 'none',
          qty: parseInt(harvestForm.qty),
          note: harvestForm.note || 'Harvest',
          type: 'harvest',
          inputBy,
          date,
          time,
        });
      }
      setHarvestForm({ productId: '', qty: '', variantQtys: {}, note: 'Harvest' });
      setShowHarvest(false);
    } catch (err) {
      setHarvestError(err.message || 'Failed to save harvest.');
    } finally {
      setHarvestSaving(false);
    }
  };

  const getStockStatus = (p) => {
    if (p.stock === 0) return { color: 'danger', label: 'Out of Stock' };
    if (p.stock <= p.lowStockAlert) return { color: 'warning', label: 'Low Stock' };
    return { color: 'success', label: 'In Stock' };
  };

  const activityGroups = useMemo(() => {
    const productCategoryById = new Map(products.map(p => [p.id, p.category]));
    const grouped = new Map();

    (stockMovements || [])
      .slice()
      .reverse()
      .forEach(movement => {
        const category = productCategoryById.get(movement.productId) || 'Uncategorized';
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(movement);
      });

    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, stockMovements]);

  return (
    <div>
      {/* Alert banners */}
      {outOfStock.length > 0 && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-circle-fill flex-shrink-0"></i>
          <div><strong>{outOfStock.length} product{outOfStock.length > 1 ? 's' : ''} out of stock:</strong> {outOfStock.map(p => p.name).join(', ')}</div>
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
          <div><strong>{lowStock.length} product{lowStock.length > 1 ? 's' : ''} running low:</strong> {lowStock.map(p => `${p.name} (${formatStockDisplay(p)} left)`).join(', ')}</div>
        </div>
      )}

      {/* Toolbar */}
      <div className="d-flex flex-wrap gap-2 mb-4 align-items-center justify-content-between">
        <div className="d-flex gap-2 flex-wrap flex-grow-1">
          <div className="input-group" style={{ maxWidth: 260 }}>
            <span className="input-group-text bg-light"><i className="bi bi-search text-muted"></i></span>
            <input className="form-control" placeholder="Search product..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ maxWidth: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success" onClick={() => setShowHarvest(true)}>
            <i className="bi bi-basket me-2"></i>Harvest Input
          </button>
          <button className="btn btn-dark" onClick={() => setShowStockIn(true)}>
            <i className="bi bi-plus-circle me-2"></i>Stock In
          </button>
        </div>
      </div>

      <div className="row g-3">
        {/* Inventory Table */}
        <div className="col-lg-8">
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-clipboard2-data me-2"></i>Stock Levels ({filtered.length})
            </div>
            <div className="table-responsive table-scroll-panel table-scroll-panel--inventory">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="text-center">Stock</th>
                    <th className="text-center">Alert At</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const status   = getStockStatus(p);
                    const pct      = Math.min(100, (p.stock / Math.max(p.lowStockAlert * 3, 1)) * 100);
                    const isVar    = p.hasVariants;
                    const stockUnit = isVar ? (p.baseUnit || 'pc') : p.unit;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="fw-semibold">{p.name}</span>
                          {isVar ? (
                            <div className="small mt-1">
                              {(p.variants || []).map(v => (
                                <span key={v.id} className="badge bg-info text-dark me-1 fw-normal" style={{ fontSize: '0.65rem' }}>
                                  {v.name}/{v.unit}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="small text-muted">{p.unit}</div>
                          )}
                        </td>
                        <td><span className="badge bg-light text-dark border small">{p.category}</span></td>
                        <td className="text-center">
                          <div className="fw-bold">{formatStockDisplay(p)}</div>
                          <div className="progress mt-1" style={{ height: 4, width: 60, margin: 'auto' }}>
                            <div className={`progress-bar bg-${status.color}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </td>
                        <td className="text-center text-muted small">{p.lowStockAlert} {stockUnit}</td>
                        <td className="text-center">
                          <span className={`badge bg-${status.color}${status.color === 'warning' ? ' text-dark' : ''}` }>
                            {status.label}
                          </span>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                            setStockInForm({ productId: String(p.id), qty: '', note: '' });
                            setShowStockIn(true);
                          }}>
                            <i className="bi bi-plus-lg me-1"></i>Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Stock History */}
        <div className="col-lg-4">
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-clock-history me-2"></i>Recent Stock Activity by Category
            </div>
            <div className="activity-accordion">
              {activityGroups.length > 0 ? (
                activityGroups.map(([category, movements]) => {
                  const isOpen = Boolean(openCategories[category]);
                  return (
                    <div key={category} className="activity-accordion-item">
                      <button
                        type="button"
                        className="activity-accordion-trigger"
                        onClick={() => setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                        aria-expanded={isOpen}
                      >
                        <span className="d-flex align-items-center gap-2 min-w-0">
                          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} flex-shrink-0`}></i>
                          <span className="text-truncate">{category}</span>
                        </span>
                        <span className="badge bg-light text-dark border flex-shrink-0">{movements.length}</span>
                      </button>
                      {isOpen && (
                        <div className="activity-accordion-body">
                          <ul className="list-group list-group-flush">
                            {movements.map(h => (
                              <li key={h.id} className="list-group-item py-2">
                                <div className="d-flex justify-content-between align-items-start gap-2">
                                  <div className="min-w-0">
                                    <div className="small fw-semibold text-truncate">
                                      {h.product}
                                      {h.variant && h.variant !== 'none' && (
                                        <span className="badge bg-info text-dark ms-1 fw-normal" style={{ fontSize: '0.6rem' }}>{h.variant}</span>
                                      )}
                                    </div>
                                    <div className="text-muted activity-meta">
                                      {h.note || 'Stock movement'} • {h.date} {h.time}
                                      {h.inputBy && <span className="ms-1">by {h.inputBy}</span>}
                                    </div>
                                  </div>
                                  <span className={`badge ${
                    h.type === 'harvest' ? 'bg-info text-dark' :
                    h.type === 'stock-in' ? 'bg-success' :
                    h.type === 'sale' ? 'bg-danger' : 'bg-warning text-dark'
                  }`}>
                    {(h.type === 'stock-in' || h.type === 'harvest') ? '+' : '-'}{formatQty(h.qty)}{h.unit ? ` ${h.unit}` : ''}
                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="activity-empty text-muted small">
                  No stock activity yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Harvest Input Modal */}
      {showHarvest && (() => {
        const poultryProducts = products.filter(isPoultryProduct);
        const selProd = products.find(p => String(p.id) === String(harvestForm.productId));
        const isVariant = selProd?.hasVariants;
        const totalHarvestPcs = isVariant
          ? (selProd?.variants || []).reduce((s, v) => s + (parseInt(harvestForm.variantQtys[v.id] || 0)), 0)
          : (parseInt(harvestForm.qty) || 0);
        const canSave = harvestForm.productId && (
          isVariant
            ? (selProd?.variants || []).some(v => parseInt(harvestForm.variantQtys[v.id] || 0) > 0)
            : parseInt(harvestForm.qty) > 0
        );
        return (
          <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-basket me-2 text-success"></i>Harvest Input</h5>
                  <button className="btn-close" onClick={() => { setShowHarvest(false); setHarvestError(''); }} aria-label="Close"></button>
                </div>
                <div className="modal-body">
                  {harvestError && (
                    <div className="alert alert-danger py-2 small">
                      <i className="bi bi-exclamation-circle me-1"></i>{harvestError}
                    </div>
                  )}

                  {/* Product selector — poultry only */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Select Product *</label>
                    {poultryProducts.length === 0 ? (
                      <div className="text-muted small">No egg/poultry products found.</div>
                    ) : (
                      <select
                        className="form-select"
                        value={harvestForm.productId}
                        onChange={e => setHarvestForm({ productId: e.target.value, qty: '', variantQtys: {}, note: harvestForm.note })}
                      >
                        <option value="">-- Choose product --</option>
                        {poultryProducts.map(p => {
                          const unit = p.hasVariants ? (p.baseUnit || 'pc') : p.unit;
                          return <option key={p.id} value={p.id}>{p.name} (stock: {p.stock.toLocaleString()} {unit})</option>;
                        })}
                      </select>
                    )}
                  </div>

                  {/* Qty inputs — per-variant for Chicken Eggs, single for Quail Eggs */}
                  {selProd && (
                    <div className="mb-3">
                      {isVariant ? (
                        <>
                          <label className="form-label fw-semibold">
                            Harvest Quantity per Size
                            <span className="text-muted fw-normal ms-1 small">(in pcs — leave blank if none)</span>
                          </label>
                          {(selProd.variants || []).map(v => (
                            <div key={v.id} className="d-flex align-items-center gap-2 mb-2">
                              <span className="badge bg-secondary text-white fw-semibold" style={{ minWidth: 64, textAlign: 'center' }}>{v.name}</span>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                placeholder="0"
                                min="0"
                                value={harvestForm.variantQtys[v.id] || ''}
                                onChange={e => setHarvestForm(prev => ({
                                  ...prev,
                                  variantQtys: { ...prev.variantQtys, [v.id]: e.target.value },
                                }))}
                              />
                              <span className="text-muted small flex-shrink-0">pcs</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <label className="form-label fw-semibold">
                            Quantity Harvested *
                            <span className="text-muted fw-normal ms-1 small">(in pcs)</span>
                          </label>
                          <input
                            type="number"
                            className="form-control"
                            value={harvestForm.qty}
                            onChange={e => setHarvestForm(prev => ({ ...prev, qty: e.target.value }))}
                            placeholder="e.g. 3000"
                            min="1"
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Note */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Note</label>
                    <input
                      className="form-control"
                      value={harvestForm.note}
                      onChange={e => setHarvestForm(prev => ({ ...prev, note: e.target.value }))}
                      placeholder="e.g. Morning harvest, Batch 1..."
                    />
                  </div>

                  {/* Summary preview */}
                  {selProd && totalHarvestPcs > 0 && (
                    <div className="alert alert-success py-2 small mb-0">
                      <i className="bi bi-basket me-1"></i>
                      +{totalHarvestPcs.toLocaleString()} pcs harvested
                      {' → '} New total stock: <strong>{((selProd.stock || 0) + totalHarvestPcs).toLocaleString()} pcs</strong>
                      {currentUser?.name && <span className="ms-2 text-muted">by {currentUser.name}</span>}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => { setShowHarvest(false); setHarvestError(''); }}>Cancel</button>
                  <button className="btn btn-success" onClick={handleHarvest} disabled={harvestSaving || !canSave}>
                    {harvestSaving
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                      : <><i className="bi bi-check2 me-2"></i>Save Harvest</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stock In Modal */}
      {showStockIn && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-plus-circle me-2"></i>Stock In — Add Delivery</h5>
                <button className="btn-close" onClick={() => setShowStockIn(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger py-2 small">
                    <i className="bi bi-exclamation-circle me-1"></i>{error}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Select Product *</label>
                  <select className="form-select" value={stockInForm.productId} onChange={e => setStockInForm({ ...stockInForm, productId: e.target.value, unitKey: 'base' })}>
                    <option value="">-- Choose product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Current: {formatStockDisplay(p)})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  {(() => {
                    const selProd = products.find(p => String(p.id) === String(stockInForm.productId));
                    const baseUnit = selProd?.hasVariants
                      ? (selProd.baseUnit || 'pc')
                      : (selProd?.baseUnit || selProd?.unit || '');
                    const unitOptions = selProd ? getStockInUnitOptions(selProd) : [];
                    const selectedUnit = unitOptions.find(u => u.key === stockInForm.unitKey) || unitOptions[0];
                    const inputQty = Number(stockInForm.qty || 0);
                    const baseQty = (selectedUnit && Number.isFinite(inputQty) && inputQty > 0)
                      ? Number((inputQty * Number(selectedUnit.multiplier || 1)).toFixed(4))
                      : 0;
                    return (
                      <>
                        <label className="form-label fw-semibold">Stock-in Unit</label>
                        <select
                          className="form-select mb-2"
                          value={stockInForm.unitKey}
                          onChange={e => setStockInForm({ ...stockInForm, unitKey: e.target.value })}
                          disabled={!selProd}
                        >
                          {unitOptions.map(opt => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label} {opt.multiplier !== 1 ? `(x${formatQty(opt.multiplier)} ${baseUnit})` : ''}
                            </option>
                          ))}
                        </select>
                        <label className="form-label fw-semibold">
                          Quantity to Add *
                          {selectedUnit?.unit && <span className="text-muted fw-normal ms-1">(in {selectedUnit.unit}s)</span>}
                        </label>
                        <input type="number" className="form-control" value={stockInForm.qty} onChange={e => setStockInForm({ ...stockInForm, qty: e.target.value })} placeholder="Enter quantity" min="0.001" step="0.001" />
                        {selProd?.hasVariants && (
                          <div className="text-muted small mt-1">
                            <i className="bi bi-info-circle me-1"></i>
                            This product has variants. System auto-converts your selected unit to base units.
                          </div>
                        )}
                        {selProd && selectedUnit && Number(stockInForm.qty || 0) > 0 && (
                          <div className="alert alert-info py-2 small mt-2 mb-0">
                            <i className="bi bi-arrow-left-right me-1"></i>
                            Conversion: {formatQty(stockInForm.qty)} {selectedUnit.unit} x {formatQty(selectedUnit.multiplier)} = <strong>{formatQty(baseQty)} {baseUnit}</strong>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Note / Source</label>
                  <input className="form-control" value={stockInForm.note} onChange={e => setStockInForm({ ...stockInForm, note: e.target.value })} placeholder="e.g. Supplier delivery, manual adjustment..." />
                </div>

                {stockInForm.productId && stockInForm.qty && (
                  <div className="alert alert-info py-2 small">
                    <i className="bi bi-info-circle me-1"></i>
                    {(() => {
                      const selProd = products.find(p => String(p.id) === String(stockInForm.productId));
                      const baseUnit = selProd?.hasVariants
                        ? (selProd.baseUnit || 'pc')
                        : (selProd?.baseUnit || selProd?.unit || 'unit');
                      const unitOptions = selProd ? getStockInUnitOptions(selProd) : [];
                      const selectedUnit = unitOptions.find(u => u.key === stockInForm.unitKey) || unitOptions[0];
                      const inputQty = Number(stockInForm.qty || 0);
                      const baseQty = (selectedUnit && Number.isFinite(inputQty) && inputQty > 0)
                        ? Number((inputQty * Number(selectedUnit.multiplier || 1)).toFixed(4))
                        : 0;
                      const newQty = Number(selProd?.stock || 0) + baseQty;
                      return <>New stock will be: <strong>{formatQty(newQty)} {baseUnit}</strong></>;
                    })()}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowStockIn(false)}>Cancel</button>
                <button className="btn btn-dark" onClick={handleStockIn} disabled={saving || !stockInForm.productId || !stockInForm.qty}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    : <><i className="bi bi-check2 me-2"></i>Confirm Stock In</>
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
