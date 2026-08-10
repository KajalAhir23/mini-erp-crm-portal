import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { AuthRequest } from '../middleware/auth';
import { generateChallanNumber } from '../utils/challanNumber';

const challanItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createChallanSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(challanItemSchema).min(1, 'At least one product is required'),
  status: z.enum(['DRAFT', 'CONFIRMED']).optional(),
});

export const updateChallanStatusSchema = z.object({
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']),
});

export async function listChallans(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId as string | undefined;

  const where: any = {
    AND: [status ? { status } : {}, customerId ? { customerId } : {}],
  };

  const [items, total] = await Promise.all([
    prisma.salesChallan.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, mobile: true } }, items: true },
    }),
    prisma.salesChallan.count({ where }),
  ]);

  res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getChallan(req: AuthRequest, res: Response) {
  const challan = await prisma.salesChallan.findUnique({
    where: { id: req.params.id },
    include: { customer: true, items: true, user: { select: { name: true } } },
  });
  if (!challan) throw new ApiError(404, 'Challan not found');
  res.json(challan);
}

// Creates a challan. If status is CONFIRMED, stock is reduced immediately and
// must not go negative. Product data is snapshotted onto each line item.
export async function createChallan(req: AuthRequest, res: Response) {
  const { customerId, items, status } = createChallanSchema.parse(req.body);
  const finalStatus = status || 'DRAFT';

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new ApiError(404, 'Customer not found');

  const result = await prisma.$transaction(async (tx: any) => {
    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });

    if (products.length !== items.length) {
      throw new ApiError(400, 'One or more products were not found');
    }

    if (finalStatus === 'CONFIRMED') {
      for (const item of items) {
        const product = products.find((p: any) => p.id === item.productId)!;
        if (product.currentStock < item.quantity) {
          throw new ApiError(
            400,
            `Insufficient stock for ${product.name}. Available: ${product.currentStock}, requested: ${item.quantity}`
          );
        }
      }
    }

    const challanNumber = await generateChallanNumber();
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    const challan = await tx.salesChallan.create({
      data: {
        challanNumber,
        customerId,
        totalQuantity,
        status: finalStatus,
        createdBy: req.user!.userId,
        items: {
          create: items.map((item) => {
            const product = products.find((p: any) => p.id === item.productId)!;
            return {
              productId: product.id,
              productName: product.name,
              productSku: product.sku,
              unitPrice: product.unitPrice,
              quantity: item.quantity,
            };
          }),
        },
      },
      include: { items: true },
    });

    if (finalStatus === 'CONFIRMED') {
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: 'OUT',
            reason: `Sales challan ${challanNumber}`,
            createdBy: req.user!.userId,
          },
        });
      }
    }

    return challan;
  });

  res.status(201).json(result);
}

// Transitions a challan's status. DRAFT -> CONFIRMED reduces stock (checked for sufficiency).
// CONFIRMED -> CANCELLED restores stock.
export async function updateChallanStatus(req: AuthRequest, res: Response) {
  const { status: newStatus } = updateChallanStatusSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx: any) => {
    const challan = await tx.salesChallan.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!challan) throw new ApiError(404, 'Challan not found');

    if (challan.status === newStatus) {
      return challan;
    }

    if (challan.status === 'DRAFT' && newStatus === 'CONFIRMED') {
      for (const item of challan.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.currentStock < item.quantity) {
          throw new ApiError(
            400,
            `Insufficient stock for ${item.productName}. Available: ${product?.currentStock ?? 0}, requested: ${item.quantity}`
          );
        }
      }
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: 'OUT',
            reason: `Sales challan ${challan.challanNumber} confirmed`,
            createdBy: req.user!.userId,
          },
        });
      }
    } else if (challan.status === 'CONFIRMED' && newStatus === 'CANCELLED') {
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: 'IN',
            reason: `Sales challan ${challan.challanNumber} cancelled`,
            createdBy: req.user!.userId,
          },
        });
      }
    } else if (challan.status === 'DRAFT' && newStatus === 'CANCELLED') {
      // no stock was ever deducted, nothing to restore
    } else {
      throw new ApiError(400, `Cannot transition challan from ${challan.status} to ${newStatus}`);
    }

    return tx.salesChallan.update({
      where: { id: req.params.id },
      data: { status: newStatus },
      include: { items: true },
    });
  });

  res.json(result);
}
