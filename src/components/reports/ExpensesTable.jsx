export default function ExpensesTable({ expenses, canManage, onAddExpense, formatCurrency }) {
  return (
    <div className="card card-custom mt-4">
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <div><i className="bi bi-receipt-cutoff me-2"></i>Expenses</div>
        {canManage && (
          <button className="btn btn-sm btn-outline-dark" onClick={onAddExpense}>
            <i className="bi bi-plus-circle me-1"></i>Add Expense
          </button>
        )}
      </div>
      <div className="table-responsive table-scroll-panel table-scroll-panel--reports">
        <table className="table table-hover mb-0 align-middle small">
          <thead className="table-light">
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Note</th>
              <th className="text-end">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => (
              <tr key={exp.id}>
                <td>{exp.date}</td>
                <td>{exp.category}</td>
                <td className="text-muted">{exp.note || '-'}</td>
                <td className="text-end">{formatCurrency(exp.amount)}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan="4" className="text-center text-muted py-4">No expenses for this period</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
