import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { AuthRequest } from '../middleware/auth';

const customerTypeEnum = z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']);
const customerStatusEnum = z.enum(['LEAD', 'ACTIVE', 'INACTIVE']);

export const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(6),
  email: z.string().email().optional().or(z.literal('')).optional(),
  businessName: z.string().optional(),
  gstNumber: z.string().optional(),
  customerType: customerTypeEnum,
  address: z.string().optional(),
  status: customerStatusEnum.optional(),
  followUpDate: z.string().datetime().optional().or(z.literal('')).optional(),
  notes: z.string().optional(),
});

export const followUpSchema = z.object({
  note: z.string().min(1),
});

export async function listCustomers(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
  const search = (req.query.search as string) || '';
  const status = req.query.status as string | undefined;

  const where: any = {
    AND: [
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { mobile: { contains: search, mode: 'insensitive' } },
              { businessName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      status ? { status } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getCustomer(req: AuthRequest, res: Response) {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      followUps: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
      challans: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json(customer);
}

export async function createCustomer(req: AuthRequest, res: Response) {
  const data = customerSchema.parse(req.body);
  const customer = await prisma.customer.create({
    data: {
      ...data,
      email: data.email || undefined,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    },
  });
  res.status(201).json(customer);
}

export async function updateCustomer(req: AuthRequest, res: Response) {
  const data = customerSchema.partial().parse(req.body);
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Customer not found');

  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: {
      ...data,
      email: data.email || undefined,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    },
  });
  res.json(customer);
}

export async function addFollowUp(req: AuthRequest, res: Response) {
  const { note } = followUpSchema.parse(req.body);
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) throw new ApiError(404, 'Customer not found');

  const followUp = await prisma.followUp.create({
    data: {
      customerId: customer.id,
      note,
      createdBy: req.user!.userId,
    },
  });
  res.status(201).json(followUp);
}
