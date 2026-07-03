export default function ProductsToolbar({
  search,
  onSearchChange,
  catFilter,
  categories,
  onCategoryChange,
  onAddProduct,
}) {
  return (
    <div className="d-flex flex-wrap gap-2 mb-4 align-items-center justify-content-between">
      <div className="d-flex gap-2 flex-wrap flex-grow-1">
        <div className="input-group" style={{ maxWidth: 280 }}>
          <span className="input-group-text bg-light"><i className="bi bi-search text-muted"></i></span>
          <input
            className="form-control"
            placeholder="Search product..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={catFilter}
          onChange={e => onCategoryChange(e.target.value)}
        >
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <button className="btn btn-dark" onClick={onAddProduct}>
        <i className="bi bi-plus-circle me-2"></i>Add Product
      </button>
    </div>
  );
}
