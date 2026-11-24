import { z } from 'zod';
import { objectId } from './common';

export const competitionCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    event: objectId(),
    category: z.string().trim().max(80).optional(),
    rules: z.string().trim().max(5000).optional(),
    eligibility: z.string().trim().max(2000).optional(),
    maxParticipants: z.coerce.number().int().min(0).optional(),
    teamSize: z.coerce.number().int().min(1).max(20).optional(),
    allowTeamRegistration: z.boolean().optional(),
    registrationDeadline: z.string().optional(),
    fee: z.coerce.number().min(0).max(100000).optional(),
    feeType: z.enum(['individual', 'team']).optional(),
    form: z.union([objectId(), z.literal('')]).optional(),
    judges: z.array(objectId()).max(20).optional(),
    coordinators: z.array(objectId()).max(20).optional(),
    submissionRequired: z.boolean().optional(),
    submissionDeadline: z.string().optional(),
    startDateTime: z.string().optional(),
    venue: z.string().trim().max(200).optional(),
  })
  .strict();

export const competitionUpdateSchema = competitionCreateSchema
  .partial()
  .extend({ status: z.enum(['draft', 'open', 'closed', 'judging', 'published']).optional() })
  .strict();

export const submissionCreateSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(3000).optional(),
    fileUrl: z.string().trim().max(500).optional(),
    links: z.array(z.string().trim().max(500)).max(5).optional(),
    answers: z.array(z.object({ key: z.string(), label: z.string(), value: z.unknown() })).max(50).optional(),
  })
  .strict();

export const submissionReviewSchema = z
  .object({
    status: z.enum(['under_review', 'accepted', 'rejected']),
    score: z.coerce.number().min(0).max(100).optional(),
    reviewNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const resultSchema = z
  .object({
    position: z.enum(['first', 'second', 'third', 'special_mention']),
    displayName: z.string().trim().min(1).max(200),
    participant: z.union([objectId(), z.literal('')]).optional(),
    registration: z.union([objectId(), z.literal('')]).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();
