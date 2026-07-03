export default function DeleteConfirmModal({ open, onCancel, onConfirm, saving }) {
  if (!open) return null;

  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-body text-center py-4">
            <i className="bi bi-exclamation-triangle-fill text-danger fs-1 d-block mb-3"></i>
            <h5>Delete Product?</h5>
            <p className="text-muted small mb-0">This action cannot be undone.</p>
          </div>
          <div className="modal-footer justify-content-center gap-2">
            <button className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={saving}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Deleting...</>
                : <><i className="bi bi-trash me-2"></i>Delete</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
