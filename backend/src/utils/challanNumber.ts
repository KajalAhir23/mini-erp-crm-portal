import { prisma } from '../config/db';

// Generates a sequential, human friendly challan number like CH-2026-000123
export async function generateChallanNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.salesChallan.count();
  const next = (count + 1).toString().padStart(6, '0');
  return `CH-${year}-${next}`;
}
