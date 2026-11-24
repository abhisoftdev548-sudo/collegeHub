'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Download, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, TableFooterBar, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { PersonCell } from '@/components/shared/person-cell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, downloadFile, getErrorMessage } from '@/lib/api';
import type { TeacherOverview } from '@/types/api';

interface MyStudentRow {
  _id: string;
  enrollmentNumber: string;
  rollNumber?: string;
  user?: { _id: string; name?: string; email?: string; status?: string };
  section?: { _id: string; name: string };
  course?: { _id: string; name?: string; code?: string };
  semester?: { _id: string; number: number; label?: string };
}

export default function MyStudentsPage() {
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const limit = 20;

  const overviewQuery = useQuery({
    queryKey: ['teacher-overview'],
    queryFn: () => api.get<TeacherOverview>('/teachers/me/overview'),
  });

  const studentsQuery = useQuery({
    queryKey: ['my-students', search, sectionFilter, page],
    queryFn: () =>
      api.getPaginated<MyStudentRow>('/teachers/me/students', {
        params: {
          search: search || undefined,
          section: sectionFilter === 'all' ? undefined : sectionFilter,
          page,
          limit,
        },
      }),
  });

  const mySections = (overviewQuery.data?.assignments ?? [])
    .map((assignment) => assignment.section)
    .filter((section, index, list) => Boolean(section) && list.findIndex((item) => item?._id === section._id) === index);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(
        '/students/export',
        `students-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success('Roster exported — filter by section inside the spreadsheet');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const columns: Array<Column<MyStudentRow>> = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <Link href={`/dashboard/students/detail?id=${row._id}`} className="block hover:opacity-80">
          <PersonCell name={row.user?.name} email={row.user?.email} meta={row.enrollmentNumber} />
        </Link>
      ),
    },
    {
      key: 'section',
      header: 'Section',
      render: (row) => (
        <span className="text-[12.5px] text-ink-soft">
          {row.section?.name ?? '—'}
          {row.semester ? ` · Sem ${row.semester.number}` : ''}
        </span>
      ),
    },
    {
      key: 'course',
      header: 'Course',
      render: (row) => <span className="text-[12.5px] text-ink-soft">{row.course?.code ?? row.course?.name ?? '—'}</span>,
    },
    {
      key: 'roll',
      header: 'Roll no.',
      render: (row) => <span className="font-mono text-[11.5px] text-muted-foreground">{row.rollNumber ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant="success" size="sm">{row.user?.status ?? 'active'}</Badge>,
      className: 'text-right',
      headerClassName: 'text-right',
    },
  ];

  const pagination = studentsQuery.data?.pagination;
  const hasFilters = Boolean(search) || sectionFilter !== 'all';

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="My students"
        description="Students in the sections you are assigned to."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} loading={exporting}>
            <Download className="h-3.5 w-3.5" /> Export roster
          </Button>
        }
      />

      <div className="mb-4">
        <FilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name, email or enrollment…"
          onReset={() => {
            setSearch('');
            setSectionFilter('all');
            setPage(1);
          }}
        >
          <div className="sm:w-52">
            <Select
              value={sectionFilter}
              onValueChange={(value) => {
                setSectionFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by section" className="h-9 text-[13px]">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All my sections</SelectItem>
                {mySections.map((section) => (
                  <SelectItem key={section._id} value={section._id}>
                    Section {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>
      </div>

      <DataTable
        columns={columns}
        rows={studentsQuery.data?.data}
        loading={studentsQuery.isLoading}
        error={studentsQuery.error}
        onRetry={() => void studentsQuery.refetch()}
        rowKey={(row) => row._id}
        emptyIcon={Users2}
        emptyTitle={hasFilters ? 'No students match this filter' : 'No students yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different search term or section.'
            : 'Students appear once they are assigned to your sections.'
        }
      />

      {pagination ? (
        <TableFooterBar
          page={pagination.page}
          totalPages={Math.max(1, Math.ceil(pagination.total / pagination.limit))}
          total={pagination.total}
          onPageChange={setPage}
          label="students"
        />
      ) : null}
    </div>
  );
}
