import { useState } from 'react';

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

  // Format with integer for full units, avoid trailing zeros for partial
  const formatQty = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  };

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

export default function ProductsTable({ products, onEdit, onDelete }) {
  const [pageSize, setPageSize] = useState(25);
  
  const displayedProducts = pageSize === 'all' ? products : products.slice(0, pageSize);
  
  return (
    <div className="card-custom">
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <span>
          <i className="bi bi-box-seam me-2"></i>Products ({products.length})
        </span>
        <div className="table-page-size-control">
          <span className="text-muted small me-2">Show</span>
          <select
            className="form-select form-select-sm d-inline-block"
            style={{ maxWidth: '70px' }}
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value="all">All</option>
          </select>
          <span className="text-muted small ms-2">rows</span>
        </div>
      </div>
      <div className="table-responsive table-scroll-panel table-scroll-panel--products">
        <table className="table table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th className="text-end">Price</th>
              <th className="text-end">Cost</th>
              <th className="text-center">Unit</th>
              <th className="text-center">Stock</th>
              <th className="text-center">Alert</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedProducts.map(p => {
              const isVariant = p.hasVariants;
              const stockUnit = isVariant ? (p.baseUnit || 'pc') : p.unit;
              const stockColor = p.stock === 0 ? 'bg-danger' : p.stock <= p.lowStockAlert ? 'bg-warning text-dark' : 'bg-success';
              return (
                <tr key={p.id}>
                  <td>
                    <span className="fw-semibold">{p.name}</span>
                    {isVariant && (
                      <div className="mt-1">
                        {(p.variants || []).map(v => {
                          const retail = Number(v.priceRetail ?? v.price ?? 0);
                          const wholesale = v.priceWholesale ? Number(v.priceWholesale) : null;
                          return (
                            <span key={v.id} className="badge bg-info text-dark me-1 fw-normal" style={{ fontSize: '0.68rem' }}>
                              {v.name} - ₱{retail.toFixed(2)}{wholesale ? ` / W₱${wholesale.toFixed(2)}` : ''}/{v.unit}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td><span className="badge bg-light text-dark border">{p.category}</span></td>
                  <td className="text-end">
                    {isVariant ? (() => {
                      const prices = (p.variants || []).map(v => Number(v.priceRetail ?? v.price ?? 0));
                      const wsP = (p.variants || []).map(v => v.priceWholesale ? Number(v.priceWholesale) : null).filter(Boolean);
                      return (
                        <div>
                          <div className="text-muted small">from ₱{Math.min(...prices).toFixed(2)}</div>
                          {wsP.length > 0 && <div className="text-warning small" style={{ fontSize: '0.7rem' }}>W/S ₱{Math.min(...wsP).toFixed(2)}</div>}
                        </div>
                      );
                    })() : (
                      <div>
                        <div>₱{Number(p.priceRetail ?? p.price ?? 0).toFixed(2)}</div>
                        {p.priceWholesale && <div className="text-warning small" style={{ fontSize: '0.7rem' }}>W/S ₱{Number(p.priceWholesale).toFixed(2)}</div>}
                      </div>
                    )}
                  </td>
                  <td className="text-end text-muted">
                    {isVariant ? '—' : `₱${Number(p.cost || 0).toFixed(2)}`}
                  </td>
                  <td className="text-center text-muted small">
                    {isVariant
                      ? <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle">{p.variants?.length ?? 0} variants</span>
                      : p.unit
                    }
                  </td>
                  <td className="text-center">
                    <span className={`badge ${stockColor}`}>
                      {formatStockDisplay(p)}
                    </span>
                  </td>
                  <td className="text-center text-muted small">{p.lowStockAlert} {stockUnit}</td>
                  <td className="text-center">
                    <div className="d-flex gap-1 justify-content-center">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => onEdit(p)} title="Edit">
                        <i className="bi bi-pencil me-1"></i>Edit
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(p.id)} title="Remove">
                        <i className="bi bi-trash me-1"></i>Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan="8" className="text-center text-muted py-4">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer-meta text-muted small p-3 border-top">
        Showing {displayedProducts.length} of {products.length} {products.length === 1 ? 'product' : 'products'}
      </div>
    </div>
  );
}
