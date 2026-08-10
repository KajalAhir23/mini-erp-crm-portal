import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

interface Customer { id: string; name: string; }
interface Product { id: string; name: string; sku: string; currentStock: number; unitPrice: string; }
interface ChallanItem { productId: string; productName: string; quantity: number; }
interface Challan {
  id: string;
  challanNumber: string;
  status: string;
  totalQuantity: number;
  customer: { name: string };
  items: ChallanItem[];
  createdAt: string;
}

export default function Challans() {
  const [items, setItems] = useState<Challan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<{ productId: string; quantity: string }[]>([
    { productId: '', quantity: '' },
  ]);

  async function load() {
    const [challansRes, customersRes, productsRes] = await Promise.all([
      apiRequest<{ items: Challan[] }>('/challans'),
      apiRequest<{ items: Customer[] }>('/customers?pageSize=100'),
      apiRequest<{ items: Product[] }>('/products?pageSize=100'),
    ]);
    setItems(challansRes.items);
    setCustomers(customersRes.items);
    setProducts(productsRes.items);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function updateLine(index: number, field: 'productId' | 'quantity', value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: '', quantity: '' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitChallan(status: 'DRAFT' | 'CONFIRMED', e: FormEvent) {
    e.preventDefault();
    setError('');
    const validLines = lines.filter((l) => l.productId && l.quantity);
    if (!customerId || validLines.length === 0) {
      setError('Select a customer and at least one product line');
      return;
    }
    try {
      await apiRequest('/challans', {
        method: 'POST',
        body: {
          customerId,
          status,
          items: validLines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        },
      });
      setShowForm(false);
      setCustomerId('');
      setLines([{ productId: '', quantity: '' }]);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function confirmChallan(id: string) {
    setError('');
    try {
      await apiRequest(`/challans/${id}/status`, { method: 'PATCH', body: { status: 'CONFIRMED' } });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function cancelChallan(id: string) {
    setError('');
    try {
      await apiRequest(`/challans/${id}/status`, { method: 'PATCH', body: { status: 'CANCELLED' } });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Sales Challans</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ New Challan'}</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {showForm && (
        <form className="card-form">
          <label>
            Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <h3>Products</h3>
          {lines.map((line, i) => (
            <div className="form-row" key={i}>
              <select value={line.productId} onChange={(e) => updateLine(i, 'productId', e.target.value)}>
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (stock: {p.currentStock})</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(i, 'quantity', e.target.value)}
              />
              <button type="button" className="btn-small btn-secondary" onClick={() => removeLine(i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={addLine}>+ Add product line</button>

          <div className="form-actions">
            <button type="button" onClick={(e) => submitChallan('DRAFT', e)}>Save as Draft</button>
            <button type="button" onClick={(e) => submitChallan('CONFIRMED', e)}>Confirm & Reduce Stock</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr><th>Challan #</th><th>Customer</th><th>Qty</th><th>Status</th><th>Date</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.challanNumber}</td>
              <td>{c.customer.name}</td>
              <td>{c.totalQuantity}</td>
              <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
              <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              <td>
                {c.status === 'DRAFT' && (
                  <>
                    <button className="btn-small" onClick={() => confirmChallan(c.id)}>Confirm</button>{' '}
                    <button className="btn-small btn-secondary" onClick={() => cancelChallan(c.id)}>Cancel</button>
                  </>
                )}
                {c.status === 'CONFIRMED' && (
                  <button className="btn-small btn-secondary" onClick={() => cancelChallan(c.id)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
