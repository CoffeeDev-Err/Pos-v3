export default function ReportsSummaryCards({
  dayCount,
  dailySales,
  totals,
  margin,
  totalExpenses,
  totalProfit,
  formatCurrency,
}) {
  const cards = [
    { label: dayCount > 1 ? 'Daily Sales (Avg)' : 'Daily Sales', value: formatCurrency(dailySales), icon: 'bi-cash-coin', color: '#0f766e', bg: '#ccfbf1' },
    { label: 'Total Sales', value: formatCurrency(totals.totalSales), icon: 'bi-cash-stack', color: '#0d6efd', bg: '#cfe2ff' },
    { label: 'Cost of Products Sold', value: formatCurrency(totals.totalCost), icon: 'bi-box', color: '#6c757d', bg: '#e2e3e5' },
    { label: 'Margin', value: formatCurrency(margin), icon: 'bi-graph-up-arrow', color: '#6610f2', bg: '#e0cffc' },
    { label: 'Expenses', value: formatCurrency(totalExpenses), icon: 'bi-receipt-cutoff', color: '#dc3545', bg: '#f8d7da' },
    { label: 'Total Profit', value: formatCurrency(totalProfit), icon: 'bi-piggy-bank', color: '#fd7e14', bg: '#ffe5d0' },
  ];

  return (
    <div className="row g-3 mb-4">
      {cards.map(card => (
        <div className="col-6 col-lg-4" key={card.label}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
              <i className={`bi ${card.icon}`}></i>
            </div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
