import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: string;
  currentStock: number;
  minStock: number;
  location?: string;
}

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', sku: '', category: '', unitPrice: '', currentStock: '', minStock: '', location: '',
  });
  const [movementFor, setMovementFor] = useState<Product | null>(null);
  const [movement, setMovement] = useState({ quantity: '', movementType: 'IN', reason: '' });

  async function load() {
    const params = new URLSearchParams({ search, ...(lowStockOnly ? { lowStock: 'true' } : {}) });
    const data = await apiRequest<{ items: Product[] }>(`/products?${params.toString()}`);
    setItems(data.items);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [search, lowStockOnly]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/products', {
        method: 'POST',
        body: {
          ...form,
          unitPrice: Number(form.unitPrice),
          currentStock: Number(form.currentStock || 0),
          minStock: Number(form.minStock || 0),
        },
      });
      setShowForm(false);
      setForm({ name: '', sku: '', category: '', unitPrice: '', currentStock: '', minStock: '', location: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleMovement(e: FormEvent) {
    e.preventDefault();
    if (!movementFor) return;
    setError('');
    try {
      await apiRequest(`/products/${movementFor.id}/movements`, {
        method: 'POST',
        body: { ...movement, quantity: Number(movement.quantity) },
      });
      setMovementFor(null);
      setMovement({ quantity: '', movementType: 'IN', reason: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Products & Inventory</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add Product'}</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {showForm && (
        <form className="card-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>SKU<input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
            <label>Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>Unit Price<input required type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></label>
            <label>Opening Stock<input type="number" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} /></label>
            <label>Min Stock Alert<input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></label>
          </div>
          <button type="submit">Save Product</button>
        </form>
      )}

      {movementFor && (
        <form className="card-form" onSubmit={handleMovement}>
          <h3>Stock Movement — {movementFor.name}</h3>
          <div className="form-row">
            <label>
              Type
              <select value={movement.movementType} onChange={(e) => setMovement({ ...movement, movementType: e.target.value })}>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </label>
            <label>Quantity<input required type="number" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} /></label>
          </div>
          <label>Reason<input required value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} /></label>
          <div className="form-actions">
            <button type="submit">Record Movement</button>
            <button type="button" className="btn-secondary" onClick={() => setMovementFor(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <input className="search-box" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="checkbox-label">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Location</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className={p.currentStock <= p.minStock ? 'row-warning' : ''}>
              <td>{p.name}</td>
              <td>{p.sku}</td>
              <td>{p.category || '-'}</td>
              <td>₹{p.unitPrice}</td>
              <td>{p.currentStock} {p.currentStock <= p.minStock && <span className="badge badge-low">LOW</span>}</td>
              <td>{p.location || '-'}</td>
              <td><button className="btn-small" onClick={() => setMovementFor(p)}>Adjust Stock</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
