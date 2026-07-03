import { useState } from 'react';
import {
  ProductsToolbar,
  CategoryCards,
  ProductsTable,
  ProductModal,
  DeleteConfirmModal,
} from './products/index';
import { getErrorMessage } from '../utils/errors';

const EMPTY = {
  name: '', category: '',
  hasVariants: false,
  baseUnit: 'pc',
  // non-variant fields
  price: '', cost: '', unit: 'pc', conversionRate: 1,
  priceRetail: '', priceWholesale: '', wholesaleQtyThreshold: '',
  stock: '', lowStockAlert: '',
  // variant fields
  variants: [],
};

export default function Products({
  products,
  categories,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onCreateCategory,
  onDeleteCategory,
}) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ ...EMPTY, category: categories[0] || '' });
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New-category creation inside the form
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  const filtered = products.filter(p => {
    const cat = catFilter === 'All' || p.category === catFilter;
    const s = p.name.toLowerCase().includes(search.toLowerCase());
    return cat && s;
  });

  const openAdd = () => {
    setForm({ ...EMPTY, category: categories[0] || '' });
    setEditProduct(null);
    setNewCatMode(false);
    setNewCatInput('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setForm({
      ...EMPTY,
      ...p,
      price:        String(p.price ?? ''),
      cost:         String(p.cost ?? ''),
      stock:        String(p.stock ?? ''),
      lowStockAlert: String(p.lowStockAlert ?? ''),
      hasVariants:  p.hasVariants || false,
      baseUnit:     p.baseUnit || p.unit || 'pc',
      conversionRate: p.conversionRate || 1,
      variants:     Array.isArray(p.variants) ? p.variants : [],
      priceRetail:  String(p.priceRetail ?? p.price ?? ''),
      priceWholesale: String(p.priceWholesale ?? ''),
      wholesaleQtyThreshold: String(p.wholesaleQtyThreshold ?? ''),
    });
    setEditProduct(p);
    setNewCatMode(false);
    setNewCatInput('');
    setError('');
    setShowModal(true);
  };

  const handleAddCategory = async () => {
    const trimmed = newCatInput.trim();
    if (!trimmed || categories.includes(trimmed)) return;

    setSaving(true);
    setError('');
    try {
      await onCreateCategory(trimmed);
      setForm(f => ({ ...f, category: trimmed }));
      setNewCatMode(false);
      setNewCatInput('');
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while adding the category. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (!form.name || !form.category) return;
    if (form.hasVariants) {
      if (!form.stock || form.variants.length === 0) return;
      if (form.variants.some(v => !v.name || !(v.priceRetail || v.price) || !v.cost || !v.unit)) return;
    } else {
      if (!form.price || !form.cost || !form.stock) return;
    }

    setSaving(true);
    setError('');

    let payload;
    if (form.hasVariants) {
      payload = {
        name:          form.name,
        category:      form.category,
        hasVariants:   true,
        baseUnit:      form.baseUnit || 'pc',
        stock:         parseInt(form.stock),
        lowStockAlert: parseInt(form.lowStockAlert) || 0,
        // store first variant's price at top level for backward-compat display
        price:         parseFloat(form.variants[0]?.priceRetail ?? form.variants[0]?.price) || 0,
        priceRetail:   parseFloat(form.variants[0]?.priceRetail ?? form.variants[0]?.price) || 0,
        cost:          parseFloat(form.variants[0]?.cost)  || 0,
        unit:          form.baseUnit || 'pc',
        conversionRate: 1,
        variants: form.variants.map(v => ({
          id:                   v.id,
          name:                 v.name,
          unit:                 v.unit,
          conversionRate:       Number(v.conversionRate) || 1,
          price:                parseFloat(v.priceRetail ?? v.price) || 0,
          priceRetail:          parseFloat(v.priceRetail ?? v.price) || 0,
          priceWholesale:       v.priceWholesale ? parseFloat(v.priceWholesale) : null,
          wholesaleQtyThreshold: v.wholesaleQtyThreshold ? parseInt(v.wholesaleQtyThreshold) : 0,
          cost:                 parseFloat(v.cost),
          lowStockAlert:        parseInt(v.lowStockAlert) || 0,
        })),
      };
    } else {
      payload = {
        name:          form.name,
        category:      form.category,
        hasVariants:   false,
        baseUnit:      form.unit || 'pc',
        price:         parseFloat(form.priceRetail || form.price) || 0,
        priceRetail:   parseFloat(form.priceRetail || form.price) || 0,
        priceWholesale: form.priceWholesale ? parseFloat(form.priceWholesale) : null,
        wholesaleQtyThreshold: form.wholesaleQtyThreshold ? parseInt(form.wholesaleQtyThreshold) : 0,
        cost:          parseFloat(form.cost),
        unit:          form.unit,
        conversionRate: Number(form.conversionRate) || 1,
        stock:         parseInt(form.stock),
        lowStockAlert: parseInt(form.lowStockAlert) || 0,
        variants:      [],
      };
    }

    try {
      if (editProduct) {
        await onUpdateProduct(editProduct.id, payload);
      } else {
        await onCreateProduct(payload);
      }
      setShowModal(false);
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while saving the product. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError('');
    try {
      const productName = products.find(p => p.id === deleteId)?.name;
      await onDeleteProduct(deleteId, productName);
      setDeleteId(null);
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while deleting the product. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const inUse = products.some(p => p.category === cat);
    const confirmMessage = inUse
      ? `Delete "${cat}" and its products? This will remove ${products.filter(p => p.category === cat).length} product(s) and cannot be undone.`
      : `Delete "${cat}" category? This cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    setSaving(true);
    setError('');
    try {
      await onDeleteCategory(cat, { deleteProducts: inUse });
      if (catFilter === cat) setCatFilter('All');
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while deleting the category. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <ProductsToolbar
        search={search}
        onSearchChange={setSearch}
        catFilter={catFilter}
        categories={categories}
        onCategoryChange={setCatFilter}
        onAddProduct={openAdd}
      />

      <CategoryCards
        categories={categories}
        products={products}
        catFilter={catFilter}
        onSelectCategory={setCatFilter}
        onDeleteCategory={handleDeleteCategory}
      />

      <ProductsTable
        products={filtered}
        onEdit={openEdit}
        onDelete={setDeleteId}
      />

      <ProductModal
        open={showModal}
        editProduct={editProduct}
        form={form}
        onFormChange={setForm}
        categories={categories}
        newCatMode={newCatMode}
        newCatInput={newCatInput}
        onNewCatMode={setNewCatMode}
        onNewCatInput={setNewCatInput}
        onAddCategory={handleAddCategory}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        saving={saving}
        error={error}
      />

      <DeleteConfirmModal
        open={Boolean(deleteId)}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        saving={saving}
      />
    </div>
  );
}
