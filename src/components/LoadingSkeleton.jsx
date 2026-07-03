const SkeletonBox = ({ className, style }) => (
  <div className={`skeleton ${className || ''}`.trim()} style={style}></div>
);

export default function LoadingSkeleton({ variant = 'page' }) {
  if (variant === 'banner') {
    return (
      <div className="loading-skeleton loading-skeleton-banner" aria-hidden="true">
        <SkeletonBox className="skeleton-line skeleton-line-lg" />
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="loading-skeleton" aria-hidden="true">
        <SkeletonBox className="skeleton-title" />
        <SkeletonBox className="skeleton-subtitle mb-2" />
        <div className="row g-3 mb-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div className="col-6 col-lg-3" key={idx}>
              <SkeletonBox className="skeleton-card" />
            </div>
          ))}
        </div>
        <div className="row g-3">
          <div className="col-lg-7">
            <SkeletonBox className="skeleton-table" />
          </div>
          <div className="col-lg-5">
            <SkeletonBox className="skeleton-panel mb-3" />
            <SkeletonBox className="skeleton-panel" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'pos') {
    return (
      <div className="loading-skeleton skeleton-pos" aria-hidden="true">
        <div className="skeleton-pos-left">
          <div className="skeleton-row skeleton-row-between">
            <SkeletonBox className="skeleton-title" style={{ width: '180px' }} />
            <SkeletonBox className="skeleton-input" style={{ width: '180px' }} />
          </div>
          <div className="skeleton-row">
            {Array.from({ length: 5 }).map((_, idx) => (
              <SkeletonBox className="skeleton-chip" key={idx} />
            ))}
          </div>
          <SkeletonBox className="skeleton-line" style={{ width: '140px' }} />
          <div className="skeleton-grid">
            {Array.from({ length: 12 }).map((_, idx) => (
              <SkeletonBox className="skeleton-grid-item" key={idx} />
            ))}
          </div>
        </div>
        <div className="skeleton-pos-right">
          <SkeletonBox className="skeleton-panel-sm" />
          <SkeletonBox className="skeleton-panel" />
          <SkeletonBox className="skeleton-panel-sm" />
        </div>
      </div>
    );
  }

  if (variant === 'products') {
    return (
      <div className="loading-skeleton" aria-hidden="true">
        <SkeletonBox className="skeleton-title" style={{ width: '140px' }} />
        <div className="skeleton-row mb-3">
          <SkeletonBox className="skeleton-input" style={{ width: '220px' }} />
          <SkeletonBox className="skeleton-input" style={{ width: '160px' }} />
          <SkeletonBox className="skeleton-btn" />
        </div>
        <div className="row g-2 mb-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div className="col-6 col-md-3" key={idx}>
              <SkeletonBox className="skeleton-card-sm" />
            </div>
          ))}
        </div>
        <SkeletonBox className="skeleton-table" />
      </div>
    );
  }

  if (variant === 'inventory') {
    return (
      <div className="loading-skeleton" aria-hidden="true">
        <SkeletonBox className="skeleton-line skeleton-line-lg" />
        <div className="skeleton-row mb-3">
          <SkeletonBox className="skeleton-input" style={{ width: '220px' }} />
          <SkeletonBox className="skeleton-input" style={{ width: '160px' }} />
          <SkeletonBox className="skeleton-btn" />
        </div>
        <div className="row g-3">
          <div className="col-lg-8">
            <SkeletonBox className="skeleton-table" />
          </div>
          <div className="col-lg-4">
            <SkeletonBox className="skeleton-panel" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'reports') {
    return (
      <div className="loading-skeleton" aria-hidden="true">
        <div className="skeleton-row mb-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonBox className="skeleton-chip" key={idx} />
          ))}
          <SkeletonBox className="skeleton-input" style={{ width: '120px' }} />
          <SkeletonBox className="skeleton-input" style={{ width: '120px' }} />
          <SkeletonBox className="skeleton-btn" />
          <SkeletonBox className="skeleton-btn" />
        </div>
        <div className="row g-3 mb-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div className="col-6 col-lg-4" key={idx}>
              <SkeletonBox className="skeleton-card-sm" />
            </div>
          ))}
        </div>
        <SkeletonBox className="skeleton-panel mb-3" />
        <div className="row g-3 mb-4">
          <div className="col-lg-8">
            <SkeletonBox className="skeleton-table" />
          </div>
          <div className="col-lg-4">
            <SkeletonBox className="skeleton-panel" />
          </div>
        </div>
        <SkeletonBox className="skeleton-table" />
      </div>
    );
  }

  if (variant === 'users') {
    return (
      <div className="loading-skeleton" aria-hidden="true">
        <div className="skeleton-row mb-3">
          <SkeletonBox className="skeleton-btn" style={{ width: '160px' }} />
          <SkeletonBox className="skeleton-btn" style={{ width: '140px' }} />
          <SkeletonBox className="skeleton-btn" style={{ width: '130px' }} />
        </div>
        <div className="row g-3 mb-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div className="col-4" key={idx}>
              <SkeletonBox className="skeleton-card-sm" />
            </div>
          ))}
        </div>
        <SkeletonBox className="skeleton-table" />
      </div>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="loading-skeleton" aria-hidden="true">
        <SkeletonBox className="skeleton-title" style={{ width: '160px' }} />
        <div className="row g-4">
          <div className="col-lg-6">
            <SkeletonBox className="skeleton-panel-lg" />
          </div>
          <div className="col-lg-6">
            <SkeletonBox className="skeleton-panel mb-3" />
            <SkeletonBox className="skeleton-panel" />
          </div>
          <div className="col-12">
            <SkeletonBox className="skeleton-panel" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-skeleton" aria-hidden="true">
      <div className="row g-3 mb-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div className="col-6 col-lg-3" key={idx}>
            <SkeletonBox className="skeleton-card" />
          </div>
        ))}
      </div>
      <SkeletonBox className="skeleton-block" />
      <SkeletonBox className="skeleton-block" />
    </div>
  );
}
