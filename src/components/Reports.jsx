import { useState, useMemo } from 'react';
import { printA4Report } from '../utils/escpos';
import { toLocalDateString } from '../utils/date';
import { useReportsData } from '../hooks/useReportsData';
import { getErrorMessage } from '../utils/errors';
import {
  ReportsFilters,
  ReportsSummaryCards,
  StockInsightsCards,
  TransactionHistoryTable,
  ProductBreakdownCards,
  ExpensesTable,
  TransactionDetailModal,
  ExpenseModal,
} from './reports/index';
import LoadingSkeleton from './LoadingSkeleton';

const peso = (value) => `₱${Number(value || 0).toLocaleString()}`;

export default function Reports({ transactions, products, expenses, currentUser, onCreateExpense, loading }) {
  const today = toLocalDateString();
  const [rangePreset, setRangePreset] = useState('today');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: today, amount: '', category: '', note: '' });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const categories = useMemo(
    () => [...new Set(products.map(p => p.category).filter(Boolean))].sort(),
    [products]
  );
  const handleCategoryChange = (cat) => { setCategoryFilter(cat); setProductFilter(''); };

  const canManage = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  const {
    filteredTransactions,
    filteredExpenses,
    totals,
    totalExpenses,
    margin,
    totalProfit,
    dayCount,
    dailySales,
    inventoryInsights,
    topSellingByAmount,
    topMovingByQty,
    productCostMap,
    productCategoryMap,
  } = useReportsData({ transactions, products, expenses, fromDate, toDate, categoryFilter, productFilter });

  const applyPreset = (preset) => {
    const now = new Date();
    let start = today;
    let end = today;

    if (preset === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      start = toLocalDateString(y);
      end = start;
    } else if (preset === 'week') {
      // Last 7 days = inclusive range of 7 calendar days (today + previous 6 days)
      const w = new Date(now); w.setDate(w.getDate() - 6);
      start = toLocalDateString(w);
    } else if (preset === 'month') {
      const m = new Date(now); m.setDate(1);
      start = toLocalDateString(m);
    }

    setRangePreset(preset);
    setFromDate(start);
    setToDate(end);
  };

  const handlePrintReport = () => {
    const rows = filteredTransactions.slice().reverse().map(t => `
      <tr>
        <td>${t.orNumber || t.id}</td>
        <td>${t.date}</td>
        <td>${t.time}</td>
        <td>${t.cashierName}</td>
        <td>${t.items.length}</td>
        <td class="text-right">${peso(t.subtotal)}</td>
      </tr>
    `).join('');

    const itemRows = topSellingByAmount.map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td class="text-right">${peso(i.amount)}</td>
      </tr>
    `).join('');

    const expenseRows = filteredExpenses.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.category}</td>
        <td>${e.note || ''}</td>
        <td class="text-right">${peso(e.amount)}</td>
      </tr>
    `).join('');

    const filterLabel = productFilter
      ? ` | Product: ${products.find(p => p.id === productFilter)?.name || productFilter}`
      : categoryFilter ? ` | Category: ${categoryFilter}` : '';
    const html = `
      <h1>CARREN'S STORE — Sales Report</h1>
      <p>Period: <strong>${fromDate}</strong> to <strong>${toDate}</strong>${filterLabel} | Generated: ${new Date().toLocaleString()}</p>
      <div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap;">
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(dailySales)}</div><div>Daily Sales</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totals.totalSales)}</div><div>Total Sales</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totals.totalCost)}</div><div>Cost of Goods Sold</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(margin)}</div><div>Margin</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totalExpenses)}</div><div>Expenses</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totalProfit)}</div><div>Total Profit</div></div>
      </div>
      <h2>Transaction History</h2>
      <table>
        <thead><tr><th>OR #</th><th>Date</th><th>Time</th><th>Cashier</th><th>Items</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5"><strong>TOTAL</strong></td><td class="text-right"><strong>${peso(totals.totalSales)}</strong></td></tr></tfoot>
      </table>
      <h2 style="margin-top:20px;">Product Sales Breakdown</h2>
      <table>
        <thead><tr><th>Product</th><th>Qty Sold</th><th>Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <h2 style="margin-top:20px;">Expenses</h2>
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="4">No expenses</td></tr>'}</tbody>
      </table>
    `;
    printA4Report(html, 'Sales Report');
  };

  const handleExportCsv = () => {
    const rows = [
      ['Transaction ID', 'Date', 'Time', 'Cashier', 'Product', 'Qty', 'Price', 'Total', 'Cost', 'Cost Total'],
    ];

    filteredTransactions.forEach(txn => {
      txn.items.forEach(item => {
        if (categoryFilter || productFilter) {
          const cat = productCategoryMap.get(item.productId) || '';
          const matches = productFilter
            ? (item.productId === productFilter || item.name === productFilter)
            : cat === categoryFilter;
          if (!matches) return;
        }
        const currentCost = productCostMap.get(item.productId);
        const cost = Number.isFinite(currentCost) && currentCost > 0
          ? currentCost
          : Number(item.cost || 0);
        const costTotal = cost * Number(item.qty || 0);
        rows.push([
          txn.orNumber || txn.id,
          txn.date,
          txn.time,
          txn.cashierName,
          item.name,
          item.qty,
          item.price,
          item.total,
          cost,
          costTotal,
        ]);
      });
    });

    const csv = rows.map(r => r.map(value => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return '"' + text.replace(/"/g, '""') + '"';
      }
      return text;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-report-${fromDate}-to-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddExpense = async () => {
    if (!expenseForm.date || !expenseForm.category || !expenseForm.amount) return;

    setExpenseSaving(true);
    setExpenseError('');
    try {
      await onCreateExpense({
        date: expenseForm.date,
        amount: expenseForm.amount,
        category: expenseForm.category,
        note: expenseForm.note,
      });
      setExpenseForm({ date: today, amount: '', category: '', note: '' });
      setShowExpenseModal(false);
    } catch (err) {
      setExpenseError(getErrorMessage(err, { fallback: 'Failed to add expense.' }));
    } finally {
      setExpenseSaving(false);
    }
  };

  return (
    <div>
      <ReportsFilters
        rangePreset={rangePreset}
        onPresetChange={applyPreset}
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={(value) => { setFromDate(value); setRangePreset('custom'); }}
        onToChange={(value) => { setToDate(value); setRangePreset('custom'); }}
        onPrint={handlePrintReport}
        onExport={handleExportCsv}
        categories={categories}
        products={products}
        categoryFilter={categoryFilter}
        productFilter={productFilter}
        onCategoryChange={handleCategoryChange}
        onProductChange={setProductFilter}
      />

      {loading ? (
        <LoadingSkeleton variant="reports" />
      ) : (
        <>
          <ReportsSummaryCards
            dayCount={dayCount}
            dailySales={dailySales}
            totals={totals}
            margin={margin}
            totalExpenses={totalExpenses}
            totalProfit={totalProfit}
            formatCurrency={peso}
          />

          <StockInsightsCards inventoryInsights={inventoryInsights} formatCurrency={peso} />

          <div className="row g-3">
            <div className="col-lg-7">
              <TransactionHistoryTable
                transactions={filteredTransactions}
                totalSales={totals.totalSales}
                onSelectTxn={setSelectedTxn}
                formatCurrency={peso}
              />
            </div>
            <ProductBreakdownCards
              topSellingByAmount={topSellingByAmount}
              topMovingByQty={topMovingByQty}
              formatCurrency={peso}
            />
          </div>

          <ExpensesTable
            expenses={filteredExpenses}
            canManage={canManage}
            onAddExpense={() => setShowExpenseModal(true)}
            formatCurrency={peso}
          />
        </>
      )}

      <TransactionDetailModal
        txn={selectedTxn}
        onClose={() => setSelectedTxn(null)}
        formatCurrency={peso}
      />

      <ExpenseModal
        open={showExpenseModal}
        expenseForm={expenseForm}
        onChange={setExpenseForm}
        onClose={() => setShowExpenseModal(false)}
        onSave={handleAddExpense}
        saving={expenseSaving}
        error={expenseError}
      />
    </div>
  );
}
