import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  businessName?: string;
  customerType: string;
  status: string;
}

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    businessName: '',
    customerType: 'RETAIL',
    address: '',
  });
  const [error, setError] = useState('');

  async function load() {
    const data = await apiRequest<{ items: Customer[] }>(
      `/customers?search=${encodeURIComponent(search)}`
    );
    setItems(data.items);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/customers', { method: 'POST', body: form });
      setShowForm(false);
      setForm({ name: '', mobile: '', email: '', businessName: '', customerType: 'RETAIL', address: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add Customer'}
        </button>
      </div>

      {showForm && (
        <form className="card-form" onSubmit={handleCreate}>
          {error && <div className="alert-error">{error}</div>}
          <div className="form-row">
            <label>
              Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Mobile
              <input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Email
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              Business Name
              <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Customer Type
              <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </label>
            <label>
              Address
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
          </div>
          <button type="submit">Save Customer</button>
        </form>
      )}

      <input
        className="search-box"
        placeholder="Search by name, mobile, or business..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Mobile</th>
            <th>Business</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
              <td>{c.mobile}</td>
              <td>{c.businessName || '-'}</td>
              <td>{c.customerType}</td>
              <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
