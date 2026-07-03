export default function StockInsightsCards({
  inventoryInsights,
  formatCurrency,
}) {
  return (
    <div className="card card-custom mb-4">
      <div className="card-header-custom">
        <i className="bi bi-box-seam me-2"></i>Stock Insights
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-6 col-lg-4">
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{ background: "#e2f0ff", color: "#0d6efd" }}
              >
                <i className="bi bi-basket"></i>
              </div>
              <div className="stat-value">
                {formatCurrency(inventoryInsights.inventoryPrice)}
              </div>
              <div className="stat-label">Inventory Price</div>
            </div>
          </div>
          <div className="col-6 col-lg-4">
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{ background: "#f2f2f2", color: "#6c757d" }}
              >
                <i className="bi bi-wallet2"></i>
              </div>
              <div className="stat-value">
                {formatCurrency(inventoryInsights.inventoryCost)}
              </div>
              <div className="stat-label">Inventory Cost</div>
            </div>
          </div>
          <div className="col-6 col-lg-4">
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{ background: "#e0cffc", color: "#6610f2" }}
              >
                <i className="bi bi-stars"></i>
              </div>
              <div className="stat-value">
                {formatCurrency(inventoryInsights.potentialMargin)}
              </div>
              <div className="stat-label">Potential Sales Margin</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
