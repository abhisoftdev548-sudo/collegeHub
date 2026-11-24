import { z } from 'zod';
import { objectId, paginationQuery } from './common';

const optionalId = z.union([objectId(), z.literal('')]).optional();
const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date');

export const eventCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    bannerUrl: z.string().trim().max(500).optional(),
    category: objectId(),
    department: optionalId,
    parentEvent: optionalId,
    isMainEvent: z.boolean().optional(),
    coordinator: optionalId,
    teachers: z.array(objectId()).max(30).optional(),
    startDate: isoDate,
    endDate: isoDate,
    registrationStartDate: isoDate.optional(),
    registrationDeadline: isoDate.optional(),
    venue: z.string().trim().max(200).optional(),
    status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']).optional(),
    participationRules: z.string().trim().max(3000).optional(),
    requirements: z.string().trim().max(3000).optional(),
    budget: z
      .object({
        estimated: z.coerce.number().min(0).optional(),
        spent: z.coerce.number().min(0).optional(),
        notes: z.string().trim().max(1000).optional(),
      })
      .optional(),
    registration: z
      .object({
        isEnabled: z.boolean().optional(),
        requiresApproval: z.boolean().optional(),
        maxParticipants: z.coerce.number().int().min(0).optional(),
        fee: z.coerce.number().min(0).max(100000).optional(),
        feeType: z.enum(['individual', 'team']).optional(),
        form: optionalId,
      })
      .optional(),
    isPublic: z.boolean().optional(),
  })
  .strict();

export const eventUpdateSchema = eventCreateSchema.partial().strict();

export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour like #2f6fed')
      .optional(),
  })
  .strict();

export const formFieldSchema = z
  .object({
    key: z.string().trim().min(2).max(40),
    label: z.string().trim().min(1).max(160),
    type: z.enum([
      'short_text', 'long_text', 'email', 'phone', 'number', 'select',
      'radio', 'checkbox', 'multi_select', 'date', 'file',
    ]),
    required: z.boolean().optional(),
    placeholder: z.string().trim().max(160).optional(),
    helpText: z.string().trim().max(300).optional(),
    options: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
    maxLength: z.coerce.number().int().min(1).max(5000).optional(),
    acceptLabel: z.string().trim().max(300).optional(),
  })
  .strict();

export const formCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(1000).optional(),
    event: optionalId,
    competition: optionalId,
    fields: z.array(formFieldSchema).min(1).max(40),
    teamSize: z.coerce.number().int().min(1).max(20).nullable().optional(),
    allowTeamRegistration: z.boolean().optional(),
  })
  .strict();

export const formUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(1000).optional(),
    fields: z.array(formFieldSchema).min(1).max(40).optional(),
    teamSize: z.coerce.number().int().min(1).max(20).nullable().optional(),
    allowTeamRegistration: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const registrationCreateSchema = z
  .object({
    answers: z.union([z.record(z.unknown()), z.array(z.object({ key: z.string(), label: z.string(), value: z.unknown() }))]).optional(),
    teamName: z.string().trim().max(120).optional(),
    teamMembers: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          enrollmentNumber: z.string().trim().max(30).optional(),
          email: z.string().trim().email().optional(),
          phone: z.string().trim().max(20).optional(),
          isLeader: z.boolean().optional(),
        }),
      )
      .max(20)
      .optional(),
    files: z.array(z.object({ url: z.string().trim().min(1), label: z.string().trim().min(1) })).max(10).optional(),
    competitionId: optionalId,
  })
  .strict();

export const registrationStatusSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'waitlisted', 'rejected', 'cancelled']),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const paymentReferenceSchema = z
  .object({ reference: z.string().trim().min(3).max(200), notes: z.string().trim().max(1000).optional() })
  .strict();

export const paymentVerifySchema = z
  .object({
    outcome: z.enum(['paid', 'failed', 'refunded']),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const eventListQuery = paginationQuery.extend({
  status: z.string().trim().max(20).optional(),
  category: objectId().optional(),
  department: objectId().optional(),
  upcoming: z.coerce.boolean().optional(),
  publicOnly: z.coerce.boolean().optional(),
});
