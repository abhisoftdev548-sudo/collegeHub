'use client';

import { Controller, useForm } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { FormField } from '@/components/shared/form-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { FormField as FormFieldType } from '@/types/api';

export type FormAnswers = Record<string, string | string[] | boolean | number>;

interface DynamicFormRendererProps {
  fields: FormFieldType[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  disabled?: boolean;
}

/**
 * Renders server-defined form fields. Types, required flags, options and
 * constraints all come from the backend definition — the UI never invents
 * questions or validation rules beyond what the API enforces.
 */
export const DynamicFormRenderer = ({ fields, control, errors, disabled }: DynamicFormRendererProps) => {
  if (fields.length === 0) {
    return (
      <p className="rounded-xl bg-surface-subtle/70 px-3 py-2.5 text-[12px] text-muted-foreground">
        This event does not need any extra information.
      </p>
    );
  }

  return (
    <div className="space-y-3.5">
      {fields.map((field) => {
        const error = (errors[field.key] as { message?: string } | undefined)?.message;

        if (field.type === 'checkbox') {
          return (
            <Controller
              key={field.key}
              control={control}
              name={field.key}
              rules={{ required: field.required ? 'This must be accepted' : false }}
              render={({ field: controllerField }) => (
                <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-subtle/40 px-3 py-2.5">
                  <Checkbox
                    id={field.key}
                    checked={Boolean(controllerField.value)}
                    onCheckedChange={(checked) => controllerField.onChange(Boolean(checked))}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor={field.key} className="cursor-pointer text-[12.5px] leading-snug text-ink">
                      {field.acceptLabel ?? field.label}
                      {field.required ? <span className="ml-0.5 text-danger">*</span> : null}
                    </Label>
                    {error ? <p className="mt-0.5 text-[11px] text-danger">{error}</p> : null}
                  </div>
                </div>
              )}
            />
          );
        }

        if (field.type === 'select') {
          return (
            <FormField key={field.key} label={field.label} htmlFor={field.key} required={field.required} error={error} hint={field.helpText}>
              <Controller
                control={control}
                name={field.key}
                rules={{ required: field.required ? 'Select an option' : false }}
                render={({ field: controllerField }) => (
                  <Select
                    value={(controllerField.value as string) ?? ''}
                    onValueChange={controllerField.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger id={field.key} invalid={Boolean(error)}>
                      <SelectValue placeholder={field.placeholder ?? 'Select an option'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          );
        }

        if (field.type === 'radio') {
          return (
            <FormField key={field.key} label={field.label} required={field.required} error={error} hint={field.helpText}>
              <Controller
                control={control}
                name={field.key}
                rules={{ required: field.required ? 'Choose an option' : false }}
                render={({ field: controllerField }) => (
                  <RadioGroup
                    value={(controllerField.value as string) ?? ''}
                    onValueChange={controllerField.onChange}
                    disabled={disabled}
                    className="gap-1.5"
                  >
                    {(field.options ?? []).map((option) => (
                      <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-[12.5px] text-ink-soft hover:bg-surface-subtle">
                        <RadioGroupItem value={option} id={`${field.key}-${option}`} />
                        {option}
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>
          );
        }

        if (field.type === 'multi_select') {
          return (
            <FormField key={field.key} label={field.label} required={field.required} error={error} hint={field.helpText}>
              <Controller
                control={control}
                name={field.key}
                rules={{
                  validate: (value) =>
                    !field.required || (Array.isArray(value) && value.length > 0) || 'Select at least one option',
                }}
                render={({ field: controllerField }) => {
                  const selected = Array.isArray(controllerField.value) ? (controllerField.value as string[]) : [];
                  return (
                    <div className="grid gap-1.5 rounded-xl border border-line p-2.5 sm:grid-cols-2">
                      {(field.options ?? []).map((option) => {
                        const checked = selected.includes(option);
                        return (
                          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[12.5px] text-ink-soft hover:bg-surface-subtle">
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() =>
                                controllerField.onChange(
                                  checked ? selected.filter((value) => value !== option) : [...selected, option],
                                )
                              }
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  );
                }}
              />
            </FormField>
          );
        }

        if (field.type === 'long_text') {
          return (
            <FormField key={field.key} label={field.label} htmlFor={field.key} required={field.required} error={error} hint={field.helpText}>
              <Controller
                control={control}
                name={field.key}
                rules={{ required: field.required ? 'This field is required' : false }}
                render={({ field: controllerField }) => (
                  <Textarea
                    id={field.key}
                    rows={4}
                    placeholder={field.placeholder}
                    value={(controllerField.value as string) ?? ''}
                    onChange={controllerField.onChange}
                    disabled={disabled}
                    invalid={Boolean(error)}
                    maxLength={field.maxLength}
                  />
                )}
              />
            </FormField>
          );
        }

        const inputType =
          field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'phone' ? 'tel' : 'text';

        return (
          <FormField key={field.key} label={field.label} htmlFor={field.key} required={field.required} error={error} hint={field.helpText}>
            <Controller
              control={control}
              name={field.key}
              rules={{
                required: field.required ? 'This field is required' : false,
                validate: (value) => {
                  if (value === '' || value === undefined) return true;
                  if (field.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value))) {
                    return 'Enter a valid email address';
                  }
                  if (field.type === 'phone' && String(value).replace(/\D/g, '').length < 10) {
                    return 'Enter a valid phone number';
                  }
                  if (field.type === 'number') {
                    const numeric = Number(value);
                    if (Number.isNaN(numeric)) return 'Enter a valid number';
                    if (field.min !== undefined && numeric < field.min) return `Minimum is ${field.min}`;
                    if (field.max !== undefined && numeric > field.max) return `Maximum is ${field.max}`;
                  }
                  return true;
                },
              }}
              render={({ field: controllerField }) => (
                <Input
                  id={field.key}
                  type={inputType}
                  placeholder={field.placeholder}
                  value={(controllerField.value as string) ?? ''}
                  onChange={controllerField.onChange}
                  disabled={disabled}
                  invalid={Boolean(error)}
                  min={field.min}
                  max={field.max}
                  maxLength={field.maxLength}
                />
              )}
            />
          </FormField>
        );
      })}
    </div>
  );
};

export { useForm };
