'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Copy,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FormField } from '@/components/shared/form-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/utils';
import type { DynamicForm, EventItem, FormField as FormFieldType } from '@/types/api';

type FieldType = FormFieldType['type'];

const FIELD_TYPES: Array<{ value: FieldType; label: string; needsOptions: boolean }> = [
  { value: 'short_text', label: 'Short text', needsOptions: false },
  { value: 'long_text', label: 'Long text', needsOptions: false },
  { value: 'email', label: 'Email', needsOptions: false },
  { value: 'phone', label: 'Phone', needsOptions: false },
  { value: 'number', label: 'Number', needsOptions: false },
  { value: 'select', label: 'Dropdown', needsOptions: true },
  { value: 'radio', label: 'Single choice', needsOptions: true },
  { value: 'multi_select', label: 'Multiple choice', needsOptions: true },
  { value: 'checkbox', label: 'Agreement checkbox', needsOptions: false },
  { value: 'date', label: 'Date', needsOptions: false },
  { value: 'file', label: 'File upload', needsOptions: false },
];

const needsOptions = (type: FieldType): boolean =>
  FIELD_TYPES.find((entry) => entry.value === type)?.needsOptions ?? false;

/** Turns a human label into the snake_case key the API requires. */
const toKey = (label: string, existing: string[]): string => {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 34) || 'field';
  let key = base.length >= 2 ? base : `${base}_x`;
  let suffix = 2;
  while (existing.includes(key)) {
    key = `${base.slice(0, 30)}_${suffix}`.slice(0, 40);
    suffix += 1;
  }
  return key;
};

interface DraftField extends FormFieldType {
  rowId: string;
}

const emptyField = (rowId: string): DraftField => ({
  rowId,
  key: '',
  label: '',
  type: 'short_text',
  required: false,
  placeholder: '',
  helpText: '',
  options: [],
  acceptLabel: '',
});

export default function FormsPage() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<DynamicForm | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventId, setEventId] = useState('');
  const [allowTeam, setAllowTeam] = useState(false);
  const [teamSize, setTeamSize] = useState<number | ''>('');
  const [fields, setFields] = useState<DraftField[]>([emptyField('f1')]);
  const [saving, setSaving] = useState(false);

  const formsQuery = useQuery({
    queryKey: ['forms'],
    queryFn: () => api.get<DynamicForm[]>('/events/forms'),
  });
  const eventsQuery = useQuery({
    queryKey: ['events', 'for-forms'],
    queryFn: () => api.get<EventItem[]>('/events', { params: { limit: 100, includeSubEvents: true } }),
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/events/forms/${id}`),
    invalidate: [['forms']],
    successMessage: 'Form deleted',
  });

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setEventId('');
    setAllowTeam(false);
    setTeamSize('');
    setFields([emptyField('f1')]);
    setBuilderOpen(true);
  };

  const openEdit = (form: DynamicForm) => {
    setEditing(form);
    setTitle(form.title);
    setDescription(form.description ?? '');
    setEventId(typeof form.event === 'object' && form.event ? form.event._id : (form.event as string | undefined) ?? '');
    setAllowTeam(form.allowTeamRegistration);
    setTeamSize(form.teamSize ?? '');
    setFields(
      form.fields.map((field, index) => ({ ...field, rowId: `existing-${index}`, options: field.options ?? [] })),
    );
    setBuilderOpen(true);
  };

  const updateField = (rowId: string, patch: Partial<DraftField>) =>
    setFields((current) => current.map((field) => (field.rowId === rowId ? { ...field, ...patch } : field)));

  const moveField = (index: number, direction: -1 | 1) =>
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeField = (rowId: string) =>
    setFields((current) => (current.length === 1 ? current : current.filter((field) => field.rowId !== rowId)));

  const duplicateField = (rowId: string) =>
    setFields((current) => {
      const index = current.findIndex((field) => field.rowId === rowId);
      if (index === -1) return current;
      const source = current[index];
      const copy: DraftField = {
        ...source,
        rowId: `copy-${Date.now()}`,
        key: '',
        label: `${source.label} copy`,
        options: [...(source.options ?? [])],
      };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });

  const validationError = useMemo(() => {
    if (title.trim().length < 3) return 'Give the form a title of at least 3 characters';
    for (const [index, field] of fields.entries()) {
      if (!field.label.trim()) return `Field ${index + 1} needs a label`;
      if (needsOptions(field.type) && (field.options ?? []).filter((option) => option.trim()).length < 2) {
        return `"${field.label}" needs at least two options`;
      }
      if (field.type === 'checkbox' && !field.acceptLabel?.trim()) {
        return `"${field.label}" needs an agreement statement`;
      }
    }
    return null;
  }, [title, fields]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // Assign keys after validation so duplicates are impossible.
    const usedKeys: string[] = [];
    const payloadFields = fields.map((field) => {
      const key = /^[a-z][a-z0-9_]{1,38}$/.test(field.key) ? field.key : toKey(field.label, usedKeys);
      usedKeys.push(key);
      return {
        key,
        label: field.label.trim(),
        type: field.type,
        required: Boolean(field.required),
        placeholder: field.placeholder?.trim() || undefined,
        helpText: field.helpText?.trim() || undefined,
        options: needsOptions(field.type) ? (field.options ?? []).map((option) => option.trim()).filter(Boolean) : undefined,
        acceptLabel: field.type === 'checkbox' ? field.acceptLabel?.trim() : undefined,
      };
    });

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      fields: payloadFields,
      allowTeamRegistration: allowTeam,
      teamSize: allowTeam && teamSize ? Number(teamSize) : null,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/events/forms/${editing._id}`, payload);
        toast.success('Form updated');
      } else {
        await api.post('/events/forms', { ...payload, event: eventId || undefined });
        toast.success('Form created');
      }
      await formsQuery.refetch();
      setBuilderOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the form');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<DynamicForm>[] = [
    {
      key: 'title',
      header: 'Form',
      render: (row) => (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-ink">{row.title}</p>
            <p className="text-[11px] text-muted-foreground">{row.description ?? 'No description'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'fields',
      header: 'Fields',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="neutral" size="sm">{row.fields.length} fields</Badge>
          {row.allowTeamRegistration ? <Badge variant="accent" size="sm">Team · {row.teamSize ?? '—'}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'event',
      header: 'Attached to',
      render: (row) =>
        typeof row.event === 'object' && row.event ? (
          <span className="text-[12px]">{row.event.title}</span>
        ) : (
          <span className="text-[12px] text-subtle-foreground">Not attached</span>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={row.isActive ? 'success' : 'danger'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'created',
      header: 'Created',
      render: (row) => (
        <span className="text-[11.5px] text-muted-foreground">
          {row.createdAt ? formatDate(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Edit</Button>
          <ConfirmDialog
            trigger={<Button variant="ghost" size="sm" aria-label={`Delete ${row.title}`}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>}
            title={`Delete “${row.title}”?`}
            description="Registrations that already captured answers keep their stored data. The form can no longer be attached to new events."
            confirmLabel="Delete form"
            onConfirm={() => deleteMutation.mutateAsync(row._id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="Registration forms"
        description="Build the questions participants answer when they register for an event or competition."
        actions={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New form</Button>}
      />

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={formsQuery.data}
          loading={formsQuery.isLoading}
          error={formsQuery.error}
          onRetry={() => void formsQuery.refetch()}
          rowKey={(row) => row._id}
          emptyIcon={ClipboardList}
          emptyTitle="No forms yet"
          emptyDescription="Create a form to collect t-shirt sizes, team details, links and more."
          emptyAction={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New form</Button>}
        />
      </div>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit form' : 'New registration form'}</DialogTitle>
            <DialogDescription>
              Fields are validated on the server. Participants can only submit a form they are registered for.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Form title" htmlFor="form-title" required>
                <Input id="form-title" value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} placeholder="Tech Fest 2026 registration" />
              </FormField>
              <FormField label="Attach to event" htmlFor="form-event" hint={editing ? 'Links cannot be changed after creation' : 'Optional'}>
                <Select value={eventId || 'none'} onValueChange={(value) => setEventId(value === 'none' ? '' : value)} disabled={Boolean(editing)}>
                  <SelectTrigger id="form-event"><SelectValue placeholder="Not attached" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not attached</SelectItem>
                    {(eventsQuery.data ?? []).map((item) => (
                      <SelectItem key={item._id} value={item._id}>{item.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="Description" htmlFor="form-description">
              <Textarea id="form-description" value={description} onChange={(changeEvent) => setDescription(changeEvent.target.value)} rows={2} />
            </FormField>

            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-subtle/50 px-3.5 py-2.5">
              <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                <Switch checked={allowTeam} onCheckedChange={setAllowTeam} />
                Allow team registration
              </label>
              {allowTeam ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor="team-size" className="text-[12px]">Team size</Label>
                  <Input
                    id="team-size"
                    type="number"
                    min={1}
                    max={20}
                    value={teamSize}
                    onChange={(changeEvent) => setTeamSize(changeEvent.target.value ? Number(changeEvent.target.value) : '')}
                    className="h-8 w-20"
                  />
                </div>
              ) : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                  Form fields ({fields.length})
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFields((current) => [...current, emptyField(`f${Date.now()}`)])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add field
                </Button>
              </div>

              <div className="max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
                {fields.map((field, index) => (
                  <div key={field.rowId} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 text-[11px] font-medium tabular-nums text-subtle-foreground">{index + 1}</span>
                      <div className="grid flex-1 gap-2 sm:grid-cols-[1.4fr_1fr]">
                        <Input
                          value={field.label}
                          onChange={(changeEvent) => updateField(field.rowId, { label: changeEvent.target.value })}
                          placeholder="Question label, e.g. T-shirt size"
                          className="h-9 text-[13px]"
                          aria-label={`Label for field ${index + 1}`}
                        />
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(field.rowId, { type: value as FieldType })}
                        >
                          <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button type="button" variant="ghost" size="sm" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Move up">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="Move down">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => duplicateField(field.rowId)} aria-label="Duplicate field">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeField(field.rowId)} disabled={fields.length === 1} aria-label="Remove field">
                          <X className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 pl-5">
                      <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(changeEvent) => updateField(field.rowId, { required: changeEvent.target.checked })}
                          className="h-3.5 w-3.5 accent-[#3b76e8]"
                        />
                        Required
                      </label>
                      <Input
                        value={field.placeholder ?? ''}
                        onChange={(changeEvent) => updateField(field.rowId, { placeholder: changeEvent.target.value })}
                        placeholder="Placeholder (optional)"
                        className="h-8 max-w-[220px] text-[12px]"
                        aria-label="Placeholder"
                      />
                    </div>

                    {needsOptions(field.type) ? (
                      <div className="mt-2 pl-5">
                        <Input
                          value={(field.options ?? []).join(', ')}
                          onChange={(changeEvent) =>
                            updateField(field.rowId, {
                              options: changeEvent.target.value.split(',').map((option) => option.trimStart()),
                            })
                          }
                          placeholder="Comma separated options, e.g. S, M, L, XL"
                          className="h-8 text-[12px]"
                          aria-label="Options"
                        />
                      </div>
                    ) : null}

                    {field.type === 'checkbox' ? (
                      <div className="mt-2 pl-5">
                        <Input
                          value={field.acceptLabel ?? ''}
                          onChange={(changeEvent) => updateField(field.rowId, { acceptLabel: changeEvent.target.value })}
                          placeholder="Agreement text, e.g. I accept the rules"
                          className="h-8 text-[12px]"
                          aria-label="Agreement statement"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {validationError ? (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-[11.5px] text-warning">{validationError}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBuilderOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Save form' : 'Create form'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
