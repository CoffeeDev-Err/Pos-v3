import '../../styles/receipt.css';

export default function TransactionDetailModal({ txn, onClose, formatCurrency }) {
  if (!txn) return null;

  return (
    <div className="modal fade show d-block report-modal-backdrop">
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title small"><i className="bi bi-receipt me-2"></i>OR# {txn.orNumber || txn.id?.slice(-8)}</h5>
            <button className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="receipt-preview">
              <div className="receipt-info small mb-2">
                <div className="d-flex justify-content-between"><span>Date:</span><span>{txn.date}</span></div>
                <div className="d-flex justify-content-between"><span>Time:</span><span>{txn.time}</span></div>
                <div className="d-flex justify-content-between"><span>Cashier:</span><span>{txn.cashierName}</span></div>
              </div>
              <hr className="receipt-dashed" />
              <table className="w-100 small">
                <tbody>
                  {txn.items.map(item => (
                    <tr key={item.productId || item.name}>
                      <td>{item.name}</td>
                      <td className="text-center">{item.qty}x</td>
                      <td className="text-end">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr className="receipt-dashed" />
              <div className="d-flex justify-content-between fw-bold"><span>TOTAL</span><span>{formatCurrency(txn.subtotal)}</span></div>
              <div className="d-flex justify-content-between small text-muted"><span>CASH</span><span>{formatCurrency(txn.cash)}</span></div>
              <div className="d-flex justify-content-between small text-success"><span>CHANGE</span><span>{formatCurrency(txn.change)}</span></div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
