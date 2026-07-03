import { useMemo } from 'react';

/**
 * Compute report aggregates for the selected date range.
 */
export function useReportsData({ transactions, products, expenses, fromDate, toDate, categoryFilter = '', productFilter = '' }) {
  const dateFilteredTransactions = useMemo(() => {
    return transactions.filter(t => t.status !== 'void' && t.date >= fromDate && t.date <= toDate);
  }, [transactions, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => e.date >= fromDate && e.date <= toDate);
  }, [expenses, fromDate, toDate]);

  // Only used for simple (non-variant) products
  const productCostMap = useMemo(
    () => new Map(products.filter(p => !p.hasVariants).map(p => [p.id, Number(p.cost || 0)])),
    [products]
  );

  const variantCostMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => {
      if (p.hasVariants && p.variants) {
        p.variants.forEach(v => map.set(v.id, Number(v.cost || 0)));
      }
    });
    return map;
  }, [products]);

  const productCategoryMap = useMemo(
    () => new Map(products.map(p => [p.id, p.category || ''])),
    [products]
  );

  const filteredTransactions = useMemo(() => {
    if (!categoryFilter && !productFilter) return dateFilteredTransactions;
    return dateFilteredTransactions.filter(t =>
      t.items.some(item => {
        if (productFilter) return item.productId === productFilter || item.name === productFilter;
        const cat = productCategoryMap.get(item.productId) || '';
        return cat === categoryFilter;
      })
    );
  }, [dateFilteredTransactions, categoryFilter, productFilter, productCategoryMap]);

  const totals = useMemo(() => {
    let totalSales = 0;
    let totalCost = 0;
    let totalItems = 0;
    const hasFilter = !!(categoryFilter || productFilter);

    filteredTransactions.forEach(txn => {
      if (!hasFilter) {
        totalSales += Number(txn.subtotal || 0);
        totalItems += txn.items.length;
        txn.items.forEach(item => {
          const unitCost = (() => {
            if (Number(item.cost) > 0) return Number(item.cost);
            if (item.variantId) {
              const vc = variantCostMap.get(item.variantId);
              return (Number.isFinite(vc) && vc > 0) ? vc : 0;
            }
            const pc = productCostMap.get(item.productId);
            return (Number.isFinite(pc) && pc > 0) ? pc : 0;
          })();
          totalCost += unitCost * Number(item.qty || 0);
        });
      } else {
        txn.items.forEach(item => {
          const cat = productCategoryMap.get(item.productId) || '';
          const matches = productFilter
            ? (item.productId === productFilter || item.name === productFilter)
            : cat === categoryFilter;
          if (!matches) return;
          totalSales += Number(item.total || 0);
          totalItems++;
          const unitCost = (() => {
            if (Number(item.cost) > 0) return Number(item.cost);
            if (item.variantId) {
              const vc = variantCostMap.get(item.variantId);
              return (Number.isFinite(vc) && vc > 0) ? vc : 0;
            }
            const pc = productCostMap.get(item.productId);
            return (Number.isFinite(pc) && pc > 0) ? pc : 0;
          })();
          totalCost += unitCost * Number(item.qty || 0);
        });
      }
    });

    return { totalSales, totalCost, totalItems };
  }, [filteredTransactions, productCostMap, variantCostMap, productCategoryMap, categoryFilter, productFilter]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const margin = totals.totalSales - totals.totalCost;
  const totalProfit = margin - totalExpenses;

  const dayCount = Math.max(1, Math.floor((new Date(toDate) - new Date(fromDate)) / 86400000) + 1);
  const dailySales = totals.totalSales / dayCount;

  const inventoryInsights = useMemo(() => {
    let inventoryPrice = 0;
    let inventoryCost = 0;
    products.forEach(p => {
      if (p.hasVariants && p.variants?.length > 0) {
        const valid = p.variants.filter(v => Number(v.conversionRate) > 0);
        if (valid.length > 0) {
          const avgPricePerBase = valid.reduce((s, v) =>
            s + Number(v.priceRetail ?? v.price ?? 0) / Number(v.conversionRate), 0) / valid.length;
          const avgCostPerBase = valid.reduce((s, v) =>
            s + Number(v.cost || 0) / Number(v.conversionRate), 0) / valid.length;
          inventoryPrice += avgPricePerBase * Number(p.stock || 0);
          inventoryCost += avgCostPerBase * Number(p.stock || 0);
        }
      } else {
        inventoryPrice += Number(p.price ?? p.priceRetail ?? 0) * Number(p.stock || 0);
        inventoryCost += Number(p.cost || 0) * Number(p.stock || 0);
      }
    });
    return {
      inventoryPrice,
      inventoryCost,
      potentialMargin: inventoryPrice - inventoryCost,
    };
  }, [products]);

  const topSellingByAmount = useMemo(() => {
    const itemMap = {};
    const hasFilter = !!(categoryFilter || productFilter);
    filteredTransactions.forEach(t => {
      t.items.forEach(item => {
        if (hasFilter) {
          const cat = productCategoryMap.get(item.productId) || '';
          const matches = productFilter
            ? (item.productId === productFilter || item.name === productFilter)
            : cat === categoryFilter;
          if (!matches) return;
        }
        const key = item.productId || item.name;
        if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, amount: 0 };
        itemMap[key].qty += item.qty;
        itemMap[key].amount += item.total;
      });
    });
    return Object.values(itemMap).sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, productCategoryMap, categoryFilter, productFilter]);

  const topMovingByQty = useMemo(() => {
    const itemMap = {};
    const hasFilter = !!(categoryFilter || productFilter);
    filteredTransactions.forEach(t => {
      t.items.forEach(item => {
        if (hasFilter) {
          const cat = productCategoryMap.get(item.productId) || '';
          const matches = productFilter
            ? (item.productId === productFilter || item.name === productFilter)
            : cat === categoryFilter;
          if (!matches) return;
        }
        const key = item.productId || item.name;
        if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, amount: 0 };
        itemMap[key].qty += item.qty;
        itemMap[key].amount += item.total;
      });
    });
    return Object.values(itemMap).sort((a, b) => b.qty - a.qty);
  }, [filteredTransactions, productCategoryMap, categoryFilter, productFilter]);

  return {
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
  };
}
