'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Download, FileUp, Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, TableFooterBar, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { PersonCell } from '@/components/shared/person-cell';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, downloadFile } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { StudentFormDialog } from '@/components/students/student-form-dialog';
import { ImportStudentsDialog } from '@/components/students/import-students-dialog';
import type { AcademicSession, Section, Student } from '@/types/api';

export default function StudentsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('student:create', 'student:update') || hasPermission('student:update');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get<Section[]>('/academic/sections'),
  });
  const { data: sessions } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => api.get<AcademicSession[]>('/academic/sessions').catch(() => [] as AcademicSession[]),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['students', search, section, status, page],
    queryFn: () =>
      api.getPaginated<Student>('/students', {
        params: {
          search: search || undefined,
          section: section === 'all' ? undefined : section,
          status: status === 'all' ? undefined : status,
          page,
          limit: 12,
        },
      }),
  });

  const columns: Column<Student>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <Link href={`/dashboard/students/detail?id=${row._id}`} className="block hover:opacity-80">
          <PersonCell name={row.user?.name} email={row.user?.email} />
        </Link>
      ),
    },
    {
      key: 'enrollment',
      header: 'Enrolment',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] text-ink">{row.enrollmentNumber}</p>
          {row.rollNumber ? <p className="text-[11px] text-muted-foreground">Roll {row.rollNumber}</p> : null}
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course · Section',
      render: (row) => (
        <span className="text-[12.5px]">
          {row.course?.code ?? '—'}
          {row.semester?.number ? ` · Sem ${row.semester.number}` : ''}
          {row.section?.name ? ` · ${row.section.name}` : ''}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row) => <span className="text-[12.5px]">{row.department?.code ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Students"
        description="Every enrolled student with their academic placement and status."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadFile('/students/export', 'collegehub-students.csv')}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {canCreate ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <FileUp className="h-4 w-4" /> Import
                </Button>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Add student
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search by name, enrolment number or email…"
        className="mb-4"
        onReset={() => {
          setSearch('');
          setSection('all');
          setStatus('all');
          setPage(1);
        }}
      >
        <Select
          value={section}
          onValueChange={(value) => {
            setSection(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-48">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {(sections ?? []).map((item) => (
              <SelectItem key={item._id} value={item._id}>
                Section {item.name} · {typeof item.course === 'object' ? item.course.code : ''} · Sem{' '}
                {typeof item.semester === 'object' ? item.semester.number : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-36">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {['active', 'graduated', 'detained', 'suspended', 'inactive'].map((value) => (
              <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={Users}
          emptyTitle="No students found"
          emptyDescription="Adjust the filters or add a student to get started."
          footer={
            data ? (
              <TableFooterBar
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                onPageChange={setPage}
                label="students"
              />
            ) : null
          }
        />
      </div>

      <StudentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sections={sections ?? []}
        sessions={sessions ?? []}
        onSaved={() => void refetch()}
      />
      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void refetch()} />
    </div>
  );
}
