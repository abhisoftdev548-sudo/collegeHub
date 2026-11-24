import { z } from 'zod';
import { DynamicForm, Event, FormSubmission } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { FORM_FIELD_TYPES } from '../config/constants';

export interface FormFieldInput {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
  acceptLabel?: string;
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,38}$/;

export const validateFormDefinition = (fields: FormFieldInput[]): void => {
  const keys = new Set<string>();
  for (const field of fields) {
    if (!KEY_PATTERN.test(field.key)) {
      throw new ValidationError(
        `Field key "${field.key}" is invalid. Use lowercase letters, numbers and underscores (a-z0-9_), starting with a letter.`,
      );
    }
    if (keys.has(field.key)) throw new ValidationError(`Duplicate field key "${field.key}"`);
    keys.add(field.key);
    if (!FORM_FIELD_TYPES.includes(field.type)) throw new ValidationError(`Unsupported field type "${field.type}"`);
    if (['select', 'radio', 'multi_select'].includes(field.type) && (!field.options || field.options.length === 0)) {
      throw new ValidationError(`Field "${field.label}" needs at least one option`);
    }
    if (field.type === 'checkbox' && field.required && !field.acceptLabel) {
      throw new ValidationError(`Consent checkbox "${field.label}" must define an accept label`);
    }
  }
};

export const listForms = async (params: { event?: string; competition?: string }) => {
  const filter: Record<string, unknown> = {};
  if (params.event) filter.event = params.event;
  if (params.competition) filter.competition = params.competition;
  return DynamicForm.find(filter).sort({ createdAt: -1 }).lean();
};

export const getFormById = async (id: string) => {
  const form = await DynamicForm.findById(id).populate('event', 'title').lean();
  if (!form) throw new NotFoundError('Form');
  return form;
};

export const createForm = async (
  input: {
    title: string;
    description?: string;
    event?: string;
    competition?: string;
    fields: FormFieldInput[];
    teamSize?: number | null;
    allowTeamRegistration?: boolean;
  },
  actorId: string,
) => {
  validateFormDefinition(input.fields);
  if (input.event) {
    const event = await Event.findById(input.event);
    if (!event) throw new NotFoundError('Event');
  }
  return DynamicForm.create({ ...input, createdBy: actorId });
};

export const updateForm = async (id: string, input: Record<string, unknown>) => {
  const form = await DynamicForm.findById(id);
  if (!form) throw new NotFoundError('Form');
  if (Array.isArray(input.fields)) {
    validateFormDefinition(input.fields as FormFieldInput[]);
    form.fields = input.fields as never;
  }
  if (typeof input.title === 'string') form.title = input.title;
  if (typeof input.description === 'string') form.description = input.description;
  if (input.teamSize !== undefined) form.teamSize = input.teamSize === null ? null : Number(input.teamSize);
  if (typeof input.allowTeamRegistration === 'boolean') form.allowTeamRegistration = input.allowTeamRegistration;
  if (typeof input.isActive === 'boolean') form.isActive = input.isActive;
  await form.save();
  return form;
};

export const deleteForm = async (id: string) => {
  const submissions = await FormSubmission.countDocuments({ form: id });
  if (submissions) throw new ValidationError('This form already has submissions and cannot be deleted');
  await DynamicForm.findByIdAndDelete(id);
};

/**
 * Builds a Zod schema from a stored form definition so that submissions are
 * validated server-side against the exact same rules the client renders.
 */
export const buildAnswerSchema = (fields: FormFieldInput[]) => {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let schema: z.ZodTypeAny;
    switch (field.type) {
      case 'long_text':
      case 'short_text':
        schema = z.string().trim().max(field.maxLength ?? (field.type === 'long_text' ? 2000 : 200));
        if (field.type === 'short_text') schema = z.string().trim().min(1).max(field.maxLength ?? 200);
        break;
      case 'email':
        schema = z.string().trim().email();
        break;
      case 'phone':
        schema = z.string().trim().regex(/^[+]?[0-9\s-]{6,20}$/, 'Enter a valid phone number');
        break;
      case 'number':
        schema = z.coerce.number().min(field.min ?? 0).max(field.max ?? 1_000_000);
        break;
      case 'date': {
        schema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date');
        break;
      }
      case 'select':
      case 'radio':
        schema = z.enum((field.options ?? []).map((option) => option) as [string, ...string[]]);
        break;
      case 'multi_select':
        schema = z.array(z.enum((field.options ?? []) as [string, ...string[]])).min(1, 'Select at least one option');
        break;
      case 'checkbox':
        schema = z.literal(true);
        break;
      case 'file':
        schema = z.object({ url: z.string().trim().min(1), label: z.string().trim().min(1) });
        break;
      default:
        schema = z.unknown();
    }
    shape[field.key] = field.required ? schema : schema.optional();
  }

  return z.object(shape).strict();
};

/** Validates raw registration answers and returns normalised key/label/value pairs. */
export const validateAnswers = async (formId: string, answers: Record<string, unknown>) => {
  const form = await DynamicForm.findById(formId).lean();
  if (!form) throw new NotFoundError('Form');

  const schema = buildAnswerSchema(form.fields as never);
  const parsed = schema.safeParse(answers);
  if (!parsed.success) {
    throw new ValidationError(
      'Please correct the highlighted fields',
      parsed.error.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  const normalised = form.fields.map((field) => ({
    key: field.key,
    label: field.label,
    value: (parsed.data as Record<string, unknown>)[field.key] ?? null,
  }));

  return { form, answers: normalised };
};

export const createSubmission = async (
  formId: string,
  submittedBy: string,
  payload: { answers: Record<string, unknown>; files?: Array<{ url: string; label: string }> },
) => {
  const { form, answers } = await validateAnswers(formId, payload.answers);
  return FormSubmission.create({
    form: form._id,
    event: form.event,
    competition: form.competition,
    submittedBy,
    answers,
    files: payload.files ?? [],
  });
};
