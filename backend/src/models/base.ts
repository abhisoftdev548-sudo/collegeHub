import { Schema, type SchemaOptions } from 'mongoose';

/**
 * Shared schema behaviour.
 *
 * Documents serialise with `_id` (never `id`) so that hydrated documents and
 * `.lean()` query results share one identical JSON contract — the frontend can
 * rely on a single identifier field everywhere.
 */
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: { versionKey: false },
  toObject: { versionKey: false },
};

/**
 * Loosely-typed schema factory. Runtime validation lives in the Mongoose
 * definitions + Zod validators; document typing is provided by explicit
 * interfaces per model (see the `*Doc` exports), which keeps query results
 * strongly typed without fighting Mongoose's generic inference.
 */
export const createSchema = (
  definition: Record<string, unknown>,
  options: SchemaOptions = {},
): Schema =>
  new Schema(definition, { ...baseSchemaOptions, ...options });

export const statusEnum = (values: string[], defaultValue: string) => ({
  type: String,
  enum: values,
  default: defaultValue,
  required: true,
});

export const idString = (value: unknown): string => String(value);
export const optIdString = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value);
