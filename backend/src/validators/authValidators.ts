import { z } from 'zod';
import { objectId } from './common';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(120)
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().min(6).max(20).optional(),
    avatarUrl: z.string().trim().max(500).optional(),
  })
  .strict();

export const registerSelfSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    password: z.string().min(8).max(120),
    enrollmentNumber: z.string().trim().min(3).max(30),
    phone: z.string().trim().min(6).max(20).optional(),
  })
  .strict();

export const sessionQuerySchema = z.object({ id: objectId().optional() });
