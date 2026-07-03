const UNITS = ['pc', 'tray', 'btl', 'pack', 'kg', 'sack', 'case', 'sachet', 'liter', 'box', 'dozen', 'crate'];

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function ProductModal({
  open,
  editProduct,
  form,
  onFormChange,
  categories,
  newCatMode,
  newCatInput,
  onNewCatMode,
  onNewCatInput,
  onAddCategory,
  onClose,
  onSave,
  saving,
  error,
}) {
  if (!open) return null;

  const isVariant = form.hasVariants;
  const variants  = Array.isArray(form.variants) ? form.variants : [];

  /* ---------- variant row helpers ---------- */
  const addVariantRow = () => {
    onFormChange({
      ...form,
      variants: [...variants, { id: genId(), name: '', unit: 'pc', conversionRate: 1, priceRetail: '', priceWholesale: '', wholesaleQtyThreshold: '', cost: '', lowStockAlert: '' }],
    });
  };

  const updateVariant = (idx, field, value) => {
    const next = variants.map((v, i) => i === idx ? { ...v, [field]: value } : v);
    onFormChange({ ...form, variants: next });
  };

  const removeVariant = (idx) => {
    onFormChange({ ...form, variants: variants.filter((_, i) => i !== idx) });
  };

  /* ---------- save guard ---------- */
  const canSave = () => {
    if (!form.name || !form.category || !form.stock) return false;
    if (isVariant) {
      return variants.length > 0 && variants.every(v => v.name && (v.priceRetail || v.price) && v.cost && v.unit);
    }
    return (form.priceRetail || form.price) && form.cost;
  };

  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${isVariant ? 'modal-lg' : ''}`}>
        <div className="modal-content">

          {/* Header */}
          <div className="modal-header">
            <h5 className="modal-title">
              <i className={`bi ${editProduct ? 'bi-pencil-square' : 'bi-plus-circle'} me-2`}></i>
              {editProduct ? 'Edit Product' : 'Add New Product'}
            </h5>
            <button className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>

          {/* Body */}
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger py-2 small">
                <i className="bi bi-exclamation-circle me-1"></i>{error}
              </div>
            )}

            <div className="row g-3">

              {/* ── Product Name ── */}
              <div className="col-12">
                <label className="form-label fw-semibold">Product Name *</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => onFormChange({ ...form, name: e.target.value })}
                  placeholder="e.g. Itlog (Manok)"
                />
              </div>

              {/* ── Category ── */}
              <div className="col-12">
                <label className="form-label fw-semibold">Category *</label>
                {!newCatMode ? (
                  <div className="d-flex gap-2">
                    <select
                      className="form-select"
                      value={form.category}
                      onChange={e => onFormChange({ ...form, category: e.target.value })}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm flex-shrink-0"
                      onClick={() => onNewCatMode(true)}
                      title="Create a new category"
                    >
                      <i className="bi bi-plus-lg me-1"></i>New
                    </button>
                  </div>
                ) : (
                  <div className="d-flex gap-2">
                    <input
                      autoFocus
                      className="form-control"
                      placeholder="New category name..."
                      value={newCatInput}
                      onChange={e => onNewCatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onAddCategory()}
                    />
                    <button type="button" className="btn btn-success btn-sm flex-shrink-0" onClick={onAddCategory} aria-label="Create category"><i className="bi bi-check2"></i></button>
                    <button type="button" className="btn btn-outline-secondary btn-sm flex-shrink-0" onClick={() => { onNewCatMode(false); onNewCatInput(''); }} aria-label="Cancel new category"><i className="bi bi-x"></i></button>
                  </div>
                )}
                {categories.length === 0 && !newCatMode && (
                  <div className="text-muted small mt-1">No categories yet — click "+ New" to create one.</div>
                )}
              </div>

              {/* ── Variants Toggle ── */}
              <div className="col-12">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="hasVariantsToggle"
                    checked={isVariant}
                    onChange={e => onFormChange({ ...form, hasVariants: e.target.checked, variants: [] })}
                  />
                  <label className="form-check-label fw-semibold" htmlFor="hasVariantsToggle">
                    Has Size / Type Variants
                  </label>
                </div>
                <div className="text-muted small">
                  {isVariant
                    ? 'Stock tracked in base units. Each variant has its own price and selling unit.'
                    : 'Single unit product — no sizes or variants.'}
                </div>
              </div>

              {/* ══════════ NON-VARIANT SECTION ══════════ */}
              {!isVariant && (
                <>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Selling Unit *</label>
                    <select
                      className="form-select"
                      value={form.unit || 'pc'}
                      onChange={e => onFormChange({ ...form, unit: e.target.value })}
                    >
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>

                  {/* Conversion rate only when unit ≠ pc */}
                  {form.unit && form.unit !== 'pc' && (
                    <div className="col-6">
                      <label className="form-label fw-semibold">Pcs per {form.unit}</label>
                      <input
                        type="number"
                        className="form-control"
                        value={form.conversionRate}
                        onChange={e => onFormChange({ ...form, conversionRate: e.target.value })}
                        placeholder="e.g. 30"
                        min="1"
                      />
                      <div className="text-muted small mt-1">
                        Deducts {form.conversionRate || 1} pc(s) per {form.unit} sold.
                      </div>
                    </div>
                  )}

                  <div className="col-6">
                    <label className="form-label fw-semibold">Retail Price (₱) *</label>
                    <input type="number" className="form-control" value={form.priceRetail} onChange={e => onFormChange({ ...form, priceRetail: e.target.value, price: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Wholesale Price (₱)</label>
                    <input type="number" className="form-control" value={form.priceWholesale} onChange={e => onFormChange({ ...form, priceWholesale: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                    <div className="text-muted small mt-1">Leave blank if same as retail.</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cost (₱) *</label>
                    <input type="number" className="form-control" value={form.cost} onChange={e => onFormChange({ ...form, cost: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">W/S Qty Threshold</label>
                    <input type="number" className="form-control" value={form.wholesaleQtyThreshold} onChange={e => onFormChange({ ...form, wholesaleQtyThreshold: e.target.value })} placeholder="e.g. 10" min="0" />
                    <div className="text-muted small mt-1">Auto-apply wholesale ≥ this qty.</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Current Stock *</label>
                    <input type="number" className="form-control" value={form.stock} onChange={e => onFormChange({ ...form, stock: e.target.value })} placeholder="0" min="0" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Low Stock Alert</label>
                    <input type="number" className="form-control" value={form.lowStockAlert} onChange={e => onFormChange({ ...form, lowStockAlert: e.target.value })} placeholder="10" min="0" />
                  </div>
                </>
              )}

              {/* ══════════ VARIANT SECTION ══════════ */}
              {isVariant && (
                <>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Base Unit *</label>
                    <select
                      className="form-select"
                      value={form.baseUnit || 'pc'}
                      onChange={e => onFormChange({ ...form, baseUnit: e.target.value })}
                    >
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <div className="text-muted small mt-1">All stock is tracked in this unit.</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">
                      Stock (in {form.baseUnit || 'pc'}s) *
                    </label>
                    <input type="number" className="form-control" value={form.stock} onChange={e => onFormChange({ ...form, stock: e.target.value })} placeholder="0" min="0" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Low Stock Alert (base units)</label>
                    <input type="number" className="form-control" value={form.lowStockAlert} onChange={e => onFormChange({ ...form, lowStockAlert: e.target.value })} placeholder="10" min="0" />
                  </div>
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label fw-semibold mb-0">
                        Variants *
                        {variants.length > 0 && <span className="badge bg-secondary ms-2">{variants.length}</span>}
                      </label>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={addVariantRow}>
                        <i className="bi bi-plus-lg me-1"></i>Add Variant
                      </button>
                    </div>

                    {variants.length === 0 ? (
                      <div className="alert alert-warning py-2 small mb-0">
                        <i className="bi bi-info-circle me-1"></i>
                        No variants yet. Click "Add Variant" to add size options (e.g., Piece, Tray, Crate).
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Name</th>
                              <th>Selling Unit</th>
                              <th title={`How many ${form.baseUnit || 'pc'}s per selling unit`}>{form.baseUnit || 'pc'}s/unit</th>
                              <th>Retail (₱)</th>
                              <th>Wholesale (₱)</th>
                              <th title="Auto-apply wholesale when qty reaches this">W/S Qty</th>
                              <th>Cost (₱)</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v, idx) => (
                              <tr key={v.id || idx}>
                                <td>
                                  <input className="form-control form-control-sm" placeholder="e.g. Piece" value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)} />
                                </td>
                                <td>
                                  <select className="form-select form-select-sm" value={v.unit} onChange={e => updateVariant(idx, 'unit', e.target.value)}>
                                    {UNITS.map(u => <option key={u}>{u}</option>)}
                                  </select>
                                </td>
                                <td>
                                  <input type="number" className="form-control form-control-sm" placeholder="1" value={v.conversionRate} onChange={e => updateVariant(idx, 'conversionRate', e.target.value)} min="1" />
                                </td>
                                <td>
                                  <input type="number" className="form-control form-control-sm" placeholder="0.00" value={v.priceRetail ?? v.price ?? ''} onChange={e => updateVariant(idx, 'priceRetail', e.target.value)} min="0" step="0.01" />
                                </td>
                                <td>
                                  <input type="number" className="form-control form-control-sm" placeholder="same" value={v.priceWholesale ?? ''} onChange={e => updateVariant(idx, 'priceWholesale', e.target.value)} min="0" step="0.01" />
                                </td>
                                <td>
                                  <input type="number" className="form-control form-control-sm" placeholder="—" title="Auto-apply wholesale ≥ this qty" value={v.wholesaleQtyThreshold ?? ''} onChange={e => updateVariant(idx, 'wholesaleQtyThreshold', e.target.value)} min="0" />
                                </td>
                                <td>
                                  <input type="number" className="form-control form-control-sm" placeholder="0.00" value={v.cost} onChange={e => updateVariant(idx, 'cost', e.target.value)} min="0" step="0.01" />
                                </td>
                                <td className="text-center">
                                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeVariant(idx)} aria-label="Remove variant">
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="text-muted small mt-1">
                      Example: 1 tray = 30 pcs → Name "Tray", unit=tray, pcs/unit=30
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-dark" onClick={onSave} disabled={saving || !canSave()}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                : <><i className="bi bi-check2 me-2"></i>Save Product</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
