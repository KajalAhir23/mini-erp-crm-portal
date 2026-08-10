import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details ?? undefined,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.flatten(),
    });
  }

  // Prisma unique constraint violation
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  ) {
    return res.status(409).json({
      error: 'A record with this value already exists',
      details: (err as { meta?: unknown }).meta,
    });
  }

  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
