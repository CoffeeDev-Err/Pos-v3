export default function ReportsFilters({
  rangePreset,
  onPresetChange,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onPrint,
  onExport,
  categories = [],
  products = [],
  categoryFilter = '',
  productFilter = '',
  onCategoryChange,
  onProductChange,
}) {
  const filteredProducts = categoryFilter
    ? products.filter(p => p.category === categoryFilter)
    : products;

  return (
    <div className="mb-4">
      <div className="d-flex flex-wrap gap-2 mb-2 align-items-center justify-content-between">
        <div className="d-flex gap-2 flex-wrap">
          {[
            { v: 'today', l: 'Today' },
            { v: 'yesterday', l: 'Yesterday' },
            { v: 'week', l: 'Last 7 Days' },
            { v: 'month', l: 'This Month' },
          ].map(({ v, l }) => (
            <button
              key={v}
              className={`breakdown-tab ${rangePreset === v ? 'active' : ''}`}
              onClick={() => onPresetChange(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <div className="d-flex align-items-center gap-2">
            <label className="small text-muted">From</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={fromDate}
              onChange={e => onFromChange(e.target.value)}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="small text-muted">To</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={toDate}
              onChange={e => onToChange(e.target.value)}
            />
          </div>
          <button className="btn btn-outline-dark" onClick={onPrint}>
            <i className="bi bi-printer me-2"></i>Print A4 Report
          </button>
          <button className="btn btn-outline-secondary" onClick={onExport}>
            <i className="bi bi-download me-2"></i>Export CSV
          </button>
        </div>
      </div>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <i className="bi bi-funnel text-muted small"></i>
        <select
          className="form-select form-select-sm"
          style={{ minWidth: 180 }}
          value={categoryFilter}
          onChange={e => onCategoryChange(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ minWidth: 200 }}
          value={productFilter}
          onChange={e => onProductChange(e.target.value)}
        >
          <option value="">All Products</option>
          {filteredProducts.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {(categoryFilter || productFilter) && (
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => { onCategoryChange(''); onProductChange(''); }}
          >
            <i className="bi bi-x-circle me-1"></i>Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
