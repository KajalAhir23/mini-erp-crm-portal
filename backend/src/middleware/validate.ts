import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';

// Validates req.body against a zod schema. On success, replaces req.body with the parsed value.
export function validateBody(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}
