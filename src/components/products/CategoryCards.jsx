export default function CategoryCards({ categories, products, catFilter, onSelectCategory, onDeleteCategory }) {
  const allCategories = ['All', ...categories];

  return (
    <div className="row g-2 mb-4">
      {allCategories.map(cat => {
        const count = cat === 'All' ? products.length : products.filter(p => p.category === cat).length;
        return (
          <div className="col-6 col-md-3" key={cat}>
            <div
              className={`card text-center py-2 border-0 shadow-sm ${catFilter === cat ? 'shadow' : ''}`}
              onClick={() => onSelectCategory(cat)}
              style={{ cursor: 'pointer' }}
            >
              <div className="fs-4 text-muted">
                <i className={`bi ${cat === 'All' ? 'bi-box-seam' : 'bi-tag-fill'}`}></i>
              </div>
              <div className="fw-bold">{count}</div>
              <div className="text-muted small d-flex align-items-center justify-content-center gap-1">
                {cat}
                {cat !== 'All' && (
                  <button
                    className="btn btn-link p-0 text-danger"
                    style={{ fontSize: '0.65rem', lineHeight: 1 }}
                    title={`Delete "${cat}" category`}
                    aria-label={`Delete ${cat} category`}
                    onClick={e => { e.stopPropagation(); onDeleteCategory(cat); }}
                  >
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
