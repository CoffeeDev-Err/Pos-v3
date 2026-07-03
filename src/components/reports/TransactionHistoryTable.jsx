export default function TransactionHistoryTable({
  transactions,
  totalSales,
  onSelectTxn,
  formatCurrency,
}) {
  return (
    <div className="card-custom">
      <div className="card-header-custom">
        <i className="bi bi-list-ul me-2"></i>Transaction History
        <span className="ms-2 badge bg-secondary">{transactions.length}</span>
      </div>
      <div className="table-responsive table-scroll-panel table-scroll-panel--reports">
        <table className="table table-hover mb-0 align-middle small">
          <thead className="table-light">
            <tr>
              <th>OR #</th>
              <th>Date / Time</th>
              <th>Cashier</th>
              <th className="text-center">Items</th>
              <th className="text-end">Amount</th>
              <th className="text-center">View</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice().reverse().map(txn => (
              <tr key={txn.id}>
                <td><code className="small">{txn.orNumber || txn.id?.slice(-8)}</code></td>
                <td>{txn.date} <span className="text-muted">{txn.time}</span></td>
                <td>{txn.cashierName}</td>
                <td className="text-center">{txn.items.length}</td>
                <td className="text-end fw-semibold text-success">{formatCurrency(txn.subtotal)}</td>
                <td className="text-center">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => onSelectTxn(txn)}
                    aria-label={`View transaction ${txn.id}`}
                  >
                    <i className="bi bi-eye"></i>
                  </button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan="6" className="text-center text-muted py-4">No transactions for this period</td></tr>
            )}
          </tbody>
          {transactions.length > 0 && (
            <tfoot className="table-light">
              <tr>
                <td colSpan="4" className="fw-bold">Total</td>
                <td className="text-end fw-bold text-success">{formatCurrency(totalSales)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
