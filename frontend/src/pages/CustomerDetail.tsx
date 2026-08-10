import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';

interface FollowUp {
  id: string;
  note: string;
  createdAt: string;
  user: { name: string };
}

interface CustomerDetailData {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  businessName?: string;
  gstNumber?: string;
  customerType: string;
  status: string;
  address?: string;
  followUps: FollowUp[];
}

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<CustomerDetailData | null>(null);
  const [note, setNote] = useState('');

  async function load() {
    const data = await apiRequest<CustomerDetailData>(`/customers/${id}`);
    setCustomer(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [id]);

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await apiRequest(`/customers/${id}/follow-ups`, { method: 'POST', body: { note } });
    setNote('');
    load();
  }

  if (!customer) return <p>Loading...</p>;

  return (
    <div>
      <h1>{customer.name}</h1>
      <div className="detail-grid">
        <div><strong>Mobile:</strong> {customer.mobile}</div>
        <div><strong>Email:</strong> {customer.email || '-'}</div>
        <div><strong>Business:</strong> {customer.businessName || '-'}</div>
        <div><strong>GST:</strong> {customer.gstNumber || '-'}</div>
        <div><strong>Type:</strong> {customer.customerType}</div>
        <div><strong>Status:</strong> {customer.status}</div>
        <div><strong>Address:</strong> {customer.address || '-'}</div>
      </div>

      <h2>Follow-up Notes</h2>
      <form className="inline-form" onSubmit={handleAddNote}>
        <input
          placeholder="Add a follow-up note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      <ul className="followup-list">
        {customer.followUps.map((f) => (
          <li key={f.id}>
            <div className="followup-note">{f.note}</div>
            <div className="followup-meta">{f.user.name} · {new Date(f.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
