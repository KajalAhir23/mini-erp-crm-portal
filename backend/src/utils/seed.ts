import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';

async function main() {
  const password = await bcrypt.hash('Password123!', 10);

  const roles = [
    { name: 'Admin User', email: 'admin@erpcrm.test', role: 'ADMIN' as const },
    { name: 'Sales User', email: 'sales@erpcrm.test', role: 'SALES' as const },
    { name: 'Warehouse User', email: 'warehouse@erpcrm.test', role: 'WAREHOUSE' as const },
    { name: 'Accounts User', email: 'accounts@erpcrm.test', role: 'ACCOUNTS' as const },
  ];

  for (const r of roles) {
    await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { name: r.name, email: r.email, role: r.role, passwordHash: password },
    });
  }

  const products = [
    { name: 'Steel Pipe 2 inch', sku: 'SP-2IN', category: 'Pipes', unitPrice: 450, currentStock: 200, minStock: 20, location: 'Warehouse A' },
    { name: 'Steel Pipe 4 inch', sku: 'SP-4IN', category: 'Pipes', unitPrice: 820, currentStock: 120, minStock: 15, location: 'Warehouse A' },
    { name: 'Cement Bag 50kg', sku: 'CEM-50', category: 'Cement', unitPrice: 380, currentStock: 500, minStock: 50, location: 'Warehouse B' },
    { name: 'PVC Fitting Elbow', sku: 'PVC-EL', category: 'Fittings', unitPrice: 25, currentStock: 15, minStock: 20, location: 'Warehouse A' },
  ];

  for (const p of products) {
    await prisma.product.upsert({ where: { sku: p.sku }, update: {}, create: p });
  }

  const customers = [
    { name: 'Ramesh Traders', mobile: '9876543210', businessName: 'Ramesh Traders', customerType: 'WHOLESALE' as const, status: 'ACTIVE' as const, address: 'Pune, MH' },
    { name: 'Vikram Distributors', mobile: '9876500000', businessName: 'Vikram & Co', customerType: 'DISTRIBUTOR' as const, status: 'LEAD' as const, address: 'Mumbai, MH' },
  ];

  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { mobile: c.mobile } });
    if (!existing) await prisma.customer.create({ data: c });
  }

  console.log('Seed complete. Login with any of:');
  roles.forEach((r) => console.log(`  ${r.email} / Password123!  (${r.role})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
