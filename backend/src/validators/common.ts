import { z } from 'zod';
import { Types } from 'mongoose';

export const objectId = () =>
  z
    .string()
    .refine((value) => Types.ObjectId.isValid(value), { message: 'Invalid identifier' });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(60).optional(),
});

export const dateString = () =>
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid date' });

export const optionalDateString = () => dateString().optional();

export const emailField = z.string().trim().toLowerCase().email('Enter a valid email address');

export const phoneField = z
  .string()
  .trim()
  .regex(/^[+]?[0-9\s-]{6,20}$/, 'Enter a valid phone number');

export const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());
