export default function GlobalErrorToast({ error, onClose }) {
  if (!error) return null;

  const icon = error.severity === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill';

  return (
    <div className={`global-toast global-toast-${error.severity || 'danger'}`} role="alert" aria-live="assertive">
      <div className="global-toast-icon">
        <i className={`bi ${icon}`}></i>
      </div>
      <div className="global-toast-copy">
        <div className="global-toast-title">{error.title || 'Notice'}</div>
        <div className="global-toast-message">{error.message}</div>
      </div>
      <button type="button" className="global-toast-close" onClick={onClose} aria-label="Dismiss notification">
        <i className="bi bi-x-lg"></i>
      </button>
    </div>
  );
}
