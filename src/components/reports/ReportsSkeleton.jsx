export default function ReportsSkeleton() {
  return (
    <div>
      <div className="row g-3 mb-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div className="col-6 col-lg-4" key={idx}>
            <div className="stat-card report-skeleton"></div>
          </div>
        ))}
      </div>
      <div className="card card-custom mb-4">
        <div className="card-body">
          <div className="report-skeleton report-skeleton-row"></div>
          <div className="report-skeleton report-skeleton-row"></div>
          <div className="report-skeleton report-skeleton-row"></div>
        </div>
      </div>
      <div className="card card-custom">
        <div className="card-body">
          <div className="report-skeleton report-skeleton-row"></div>
          <div className="report-skeleton report-skeleton-row"></div>
          <div className="report-skeleton report-skeleton-row"></div>
        </div>
      </div>
    </div>
  );
}
