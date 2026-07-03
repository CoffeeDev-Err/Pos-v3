export default function ExpenseModal({
  open,
  expenseForm,
  onChange,
  onClose,
  onSave,
  saving,
  error,
}) {
  if (!open) return null;

  return (
    <div className="modal fade show d-block report-modal-backdrop">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title"><i className="bi bi-plus-circle me-2"></i>Add Expense</h5>
            <button className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger py-2 small">
                <i className="bi bi-exclamation-circle me-1"></i>{error}
              </div>
            )}
            <div className="row g-3">
              <div className="col-6">
                <label className="form-label fw-semibold">Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={expenseForm.date}
                  onChange={e => onChange({ ...expenseForm, date: e.target.value })}
                />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Amount (₱) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={expenseForm.amount}
                  onChange={e => onChange({ ...expenseForm, amount: e.target.value })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Category *</label>
                <input
                  className="form-control"
                  value={expenseForm.category}
                  onChange={e => onChange({ ...expenseForm, category: e.target.value })}
                  placeholder="e.g. Rent, Utilities"
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Note</label>
                <input
                  className="form-control"
                  value={expenseForm.note}
                  onChange={e => onChange({ ...expenseForm, note: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-dark"
              onClick={onSave}
              disabled={saving || !expenseForm.date || !expenseForm.amount || !expenseForm.category}
            >
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                : <><i className="bi bi-check2 me-2"></i>Save Expense</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
