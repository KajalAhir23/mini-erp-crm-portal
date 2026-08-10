import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { AuthRequest } from '../middleware/auth';

export const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  currentStock: z.number().int().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  location: z.string().optional(),
});

export const stockMovementSchema = z.object({
  quantity: z.number().int().positive(),
  movementType: z.enum(['IN', 'OUT']),
  reason: z.string().min(1),
});

export async function listProducts(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
  const search = (req.query.search as string) || '';
  const lowStock = req.query.lowStock === 'true';

  const where: any = {
    AND: [
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  };

  const [allMatching, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: lowStock ? undefined : (page - 1) * pageSize,
      take: lowStock ? undefined : pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  const items = lowStock
    ? allMatching.filter((p: any) => p.currentStock <= p.minStock)
    : allMatching;

  res.json({
    items,
    total: lowStock ? items.length : total,
    page,
    pageSize,
    totalPages: lowStock ? 1 : Math.ceil(total / pageSize),
  });
}

export async function getProduct(req: AuthRequest, res: Response) {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
  });
  if (!product) throw new ApiError(404, 'Product not found');
  res.json(product);
}

export async function createProduct(req: AuthRequest, res: Response) {
  const data = productSchema.parse(req.body);
  const product = await prisma.product.create({ data });
  res.status(201).json(product);
}

export async function updateProduct(req: AuthRequest, res: Response) {
  const data = productSchema.partial().parse(req.body);
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Product not found');

  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json(product);
}

// Records a stock movement and adjusts currentStock atomically. Stock must never go negative.
export async function addStockMovement(req: AuthRequest, res: Response) {
  const { quantity, movementType, reason } = stockMovementSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx: any) => {
    const product = await tx.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new ApiError(404, 'Product not found');

    const newStock =
      movementType === 'IN' ? product.currentStock + quantity : product.currentStock - quantity;

    if (newStock < 0) {
      throw new ApiError(400, `Insufficient stock. Available: ${product.currentStock}, requested: ${quantity}`);
    }

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { currentStock: newStock },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        quantity,
        movementType,
        reason,
        createdBy: req.user!.userId,
      },
    });

    return { product: updated, movement };
  });

  res.status(201).json(result);
}
