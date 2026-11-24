import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const ok = <T>(res: Response, data: T, message?: string, statusCode = 200): Response =>
  res.status(statusCode).json({ success: true, ...(message ? { message } : {}), data });

export const created = <T>(res: Response, data: T, message = 'Created successfully'): Response =>
  ok(res, data, message, 201);

export const paginated = <T>(
  res: Response,
  items: T[],
  meta: Omit<PaginationMeta, 'totalPages' | 'hasNextPage' | 'hasPrevPage'>,
): Response => {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  return res.status(200).json({
    success: true,
    data: items,
    pagination: {
      ...meta,
      totalPages,
      hasNextPage: meta.page < totalPages,
      hasPrevPage: meta.page > 1,
    } satisfies PaginationMeta,
  });
};

export const parsePagination = (
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100,
): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const rawLimit = Number.parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildSearchRegex = (term: unknown): RegExp | undefined => {
  if (typeof term !== 'string' || !term.trim()) return undefined;
  return new RegExp(escapeRegex(term.trim().slice(0, 100)), 'i');
};

/** Express 5 types params as string | string[]; normalise safely. */
export const param = (req: { params: Record<string, string | string[]> }, key: string): string => {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] ?? '' : (value ?? '');
};
