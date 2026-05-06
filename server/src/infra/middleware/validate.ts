import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error as ZodError).issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return next(Object.assign(new Error("Validation failed"), { status: 400, issues }));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issues = (result.error as ZodError).issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return next(Object.assign(new Error("Query validation failed"), { status: 400, issues }));
    }
    req.query = result.data;
    next();
  };
}

export const validate = validateBody;
