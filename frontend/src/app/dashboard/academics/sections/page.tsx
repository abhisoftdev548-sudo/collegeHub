'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layers, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { AcademicSession, Course, Semester, Section } from '@/types/api';

const sectionSchema = z.object({
  name: z.string().trim().min(1, 'Enter a section name').max(40),
  semester: z.string().min(1, 'Select a semester'),
  capacity: z.coerce.number().int().min(1).max(500),
});
type SectionInput = z.input<typeof sectionSchema>;
type SectionValues = z.output<typeof sectionSchema>;

const generateSchema = z.object({
  course: z.string().min(1, 'Select a course'),
  academicSession: z.string().min(1, 'Select a session'),
});
type GenerateInput = z.input<typeof generateSchema>;
type GenerateValues = z.output<typeof generateSchema>;

export default function SectionsPage() {
  const { hasPermission } = useAuth();
  const canManageSections = hasPermission('section:manage');
  const canGenerate = hasPermission('session:manage');

  const [tab, setTab] = useState('sections');
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: () => api.get<Semester[]>('/academic/semesters'),
  });
  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get<Course[]>('/academic/courses'),
  });
  const { data: sessions } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => api.get<AcademicSession[]>('/academic/sessions'),
    enabled: canGenerate,
  });

  const { data: sections, isLoading, error, refetch } = useQuery({
    queryKey: ['sections', semesterFilter],
    queryFn: () =>
      api.get<Section[]>('/academic/sections', {
        params: { semester: semesterFilter === 'all' ? undefined : semesterFilter },
      }),
  });

  const filteredSections = useMemo(() => {
    if (!sections) return sections;
    if (!search.trim()) return sections;
    const needle = search.toLowerCase();
    return sections.filter((section) => {
      const courseName = typeof section.course === 'object' ? section.course.name : '';
      const courseCode = typeof section.course === 'object' ? section.course.code : '';
      return `${section.name} ${courseName} ${courseCode}`.toLowerCase().includes(needle);
    });
  }, [sections, search]);

  const groupedSemesters = useMemo(() => {
    const map = new Map<string, { course: string; session: string; semesters: Semester[] }>();
    for (const semester of semesters ?? []) {
      const courseName = typeof semester.course === 'object' ? semester.course.name : 'Course';
      const sessionName = semester.academicSession?.name ?? '';
      const key = `${courseName}|${sessionName}`;
      if (!map.has(key)) map.set(key, { course: courseName, session: sessionName, semesters: [] });
      map.get(key)!.semesters.push(semester);
    }
    return [...map.values()].map((group) => ({
      ...group,
      semesters: group.semesters.sort((a, b) => a.number - b.number),
    }));
  }, [semesters]);

  const sectionForm = useForm<SectionInput, unknown, SectionValues>({
    resolver: zodResolver(sectionSchema),
    defaultValues: { name: 'A', semester: '', capacity: 60 },
  });
  const generateForm = useForm<GenerateInput, unknown, GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { course: '', academicSession: '' },
  });

  const createMutation = useApiMutation({
    mutationFn: (values: SectionValues) => api.post<Section>('/academic/sections', values),
    invalidate: [['sections'], ['semesters'], ['dashboard']],
    successMessage: 'Section created',
    onSuccess: () => {
      setOpen(false);
      sectionForm.reset({ name: 'A', semester: '', capacity: 60 });
    },
  });

  const generateMutation = useApiMutation({
    mutationFn: (values: GenerateValues) =>
      api.post<{ created: number; semesters: Semester[] }>('/academic/semesters/generate', values),
    invalidate: [['semesters'], ['sections']],
    onSuccess: (data) => {
      setGenerateOpen(false);
      setGenerateResult(`${data.created} semester${data.created === 1 ? '' : 's'} generated`);
      generateForm.reset({ course: '', academicSession: '' });
    },
  });

  const deleteSectionMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/academic/sections/${id}`),
    invalidate: [['sections'], ['semesters']],
    successMessage: 'Section deactivated',
  });

  const deleteSemesterMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/academic/semesters/${id}`),
    invalidate: [['semesters'], ['sections']],
    successMessage: 'Semester removed',
  });

  const columns: Column<Section>[] = [
    {
      key: 'section',
      header: 'Section',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-primary-hover">
            {row.name}
          </span>
          <div>
            <p className="font-medium text-ink">
              {typeof row.course === 'object' ? row.course.name : 'Course'}
              {typeof row.semester === 'object' ? ` · Semester ${row.semester.number}` : ''}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {typeof row.department === 'object' ? row.department.code : ''} ·{' '}
              {typeof row.academicSession === 'object' ? row.academicSession.name : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'students',
      header: 'Students',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums text-[12.5px]">
          <Users className="h-3.5 w-3.5 text-subtle-foreground" />
          {row.studentCount ?? 0} / {row.capacity}
        </span>
      ),
    },
    {
      key: 'cr',
      header: 'Class representatives',
      render: (row) =>
        row.crStudents?.length ? (
          <div className="flex flex-wrap gap-1">
            {row.crStudents.map((student) => (
              <Badge key={student._id} variant="primary" size="sm">{student.name}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-[12px] text-subtle-foreground">None</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={row.isActive ? 'success' : 'danger'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    ...(canManageSections
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row: Section) => (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" aria-label={`Deactivate section ${row.name}`} disabled={!row.isActive}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                }
                title={`Deactivate section ${row.name}?`}
                description="No new students can be placed here. Existing students and attendance records are preserved."
                confirmLabel="Deactivate"
                onConfirm={() => deleteSectionMutation.mutateAsync(row._id)}
              />
            ),
          } satisfies Column<Section>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Semesters & sections"
        description="Semesters belong to a course and session; sections split a semester into classes."
        actions={
          <div className="flex gap-2">
            {canGenerate ? (
              <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
                <Sparkles className="h-4 w-4" /> Generate semesters
              </Button>
            ) : null}
            {canManageSections ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New section
              </Button>
            ) : null}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="semesters">Semesters</TabsTrigger>
        </TabsList>

        <TabsContent value="sections">
          <FilterBar search={search} onSearchChange={setSearch} placeholder="Search sections…" className="mb-4">
            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
              <SelectTrigger className="h-9 w-full text-[13px] sm:w-64">
                <SelectValue placeholder="All semesters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All semesters</SelectItem>
                {(semesters ?? []).map((semester) => (
                  <SelectItem key={semester._id} value={semester._id}>
                    {typeof semester.course === 'object' ? semester.course.code : 'Course'} · Sem {semester.number} ·{' '}
                    {semester.academicSession?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBar>

          <div className="rounded-card border border-line bg-surface shadow-soft">
            <DataTable
              columns={columns}
              rows={filteredSections}
              loading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              rowKey={(row) => row._id}
              emptyIcon={Layers}
              emptyTitle="No sections yet"
              emptyDescription="Generate semesters for a course first, then create sections."
            />
          </div>
        </TabsContent>

        <TabsContent value="semesters">
          {groupedSemesters.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No semesters generated"
              description="Generate the full semester ladder for a course and academic session."
              action={canGenerate ? <Button size="sm" onClick={() => setGenerateOpen(true)}><Sparkles className="h-4 w-4" /> Generate semesters</Button> : null}
            />
          ) : (
            <div className="space-y-4">
              {groupedSemesters.map((group) => (
                <div key={`${group.course}-${group.session}`} className="rounded-card border border-line bg-surface p-4 shadow-soft">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-[14px] font-semibold text-ink">{group.course}</h3>
                      <p className="text-[11.5px] text-muted-foreground">Session {group.session || '—'}</p>
                    </div>
                    <Badge variant="neutral">{group.semesters.length} semesters</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.semesters.map((semester) => (
                      <div
                        key={semester._id}
                        className="group flex items-center gap-2 rounded-lg border border-line bg-surface-subtle/60 px-2.5 py-1.5"
                      >
                        <span className="text-[12px] font-medium text-ink">Sem {semester.number}</span>
                        <Badge variant={statusVariant(semester.isActive ? 'active' : 'blocked')} size="sm">
                          {semester.isActive ? 'Active' : 'Off'}
                        </Badge>
                        {canGenerate ? (
                          <ConfirmDialog
                            trigger={
                              <button type="button" className="text-subtle-foreground hover:text-danger" aria-label={`Delete semester ${semester.number}`}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            }
                            title={`Delete semester ${semester.number}?`}
                            description="Sections attached to this semester block deletion. This cannot be undone."
                            confirmLabel="Delete"
                            onConfirm={() => deleteSemesterMutation.mutateAsync(semester._id)}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New section"
        description="Sections are the class groups students are placed in."
        submitLabel="Create section"
        submitting={createMutation.isPending}
        size="sm"
        onSubmit={sectionForm.handleSubmit((values) => createMutation.mutate(values))}
      >
        <FormField label="Section name" htmlFor="section-name" required error={sectionForm.formState.errors.name?.message}>
          <Input id="section-name" placeholder="A" invalid={Boolean(sectionForm.formState.errors.name)} {...sectionForm.register('name')} />
        </FormField>
        <FormField label="Semester" htmlFor="section-semester" required error={sectionForm.formState.errors.semester?.message}>
          <Controller
            control={sectionForm.control}
            name="semester"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="section-semester" invalid={Boolean(sectionForm.formState.errors.semester)}>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {(semesters ?? []).map((semester) => (
                    <SelectItem key={semester._id} value={semester._id}>
                      {typeof semester.course === 'object' ? semester.course.code : 'Course'} · Sem {semester.number} ·{' '}
                      {semester.academicSession?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Capacity" htmlFor="section-capacity" required error={sectionForm.formState.errors.capacity?.message}>
          <Input id="section-capacity" type="number" min={1} max={500} {...sectionForm.register('capacity')} />
        </FormField>
      </FormDialog>

      <FormDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="Generate semesters"
        description="Creates the complete semester ladder (per the course structure) for a session."
        submitLabel="Generate"
        submitting={generateMutation.isPending}
        size="sm"
        onSubmit={generateForm.handleSubmit((values) => generateMutation.mutate(values))}
      >
        {generateResult ? (
          <p className="rounded-lg bg-success-soft px-3 py-2 text-[12.5px] text-success">{generateResult}</p>
        ) : null}
        <FormField label="Course" htmlFor="generate-course" required error={generateForm.formState.errors.course?.message}>
          <Controller
            control={generateForm.control}
            name="course"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="generate-course" invalid={Boolean(generateForm.formState.errors.course)}>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {(courses ?? []).map((course) => (
                    <SelectItem key={course._id} value={course._id}>
                      {course.name} ({course.totalSemesters} semesters)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Academic session" htmlFor="generate-session" required error={generateForm.formState.errors.academicSession?.message}>
          <Controller
            control={generateForm.control}
            name="academicSession"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="generate-session" invalid={Boolean(generateForm.formState.errors.academicSession)}>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {(sessions ?? []).map((session) => (
                    <SelectItem key={session._id} value={session._id}>
                      {session.name}{session.isCurrent ? ' (current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </FormDialog>
    </div>
  );
}
