import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    customers: 0,
    products: 0,
    lowStock: 0,
    draftChallans: 0,
  });

  useEffect(() => {
    async function load() {
      const [customers, products, lowStock, challans] = await Promise.all([
        apiRequest<{ total: number }>('/customers?pageSize=1'),
        apiRequest<{ total: number }>('/products?pageSize=1'),
        apiRequest<{ total: number }>('/products?lowStock=true'),
        apiRequest<{ total: number }>('/challans?status=DRAFT&pageSize=1'),
      ]);
      setStats({
        customers: customers.total,
        products: products.total,
        lowStock: lowStock.total,
        draftChallans: challans.total,
      });
    }
    load().catch(console.error);
  }, []);

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p className="subtitle">Role: {user?.role}</p>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.customers}</div>
          <div className="stat-label">Total Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.products}</div>
          <div className="stat-label">Total Products</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.lowStock}</div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.draftChallans}</div>
          <div className="stat-label">Draft Challans</div>
        </div>
      </div>
    </div>
  );
}
