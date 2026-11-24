'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { AdminDashboardView } from '@/components/dashboard/admin-dashboard';
import { TeacherDashboardView } from '@/components/dashboard/teacher-dashboard';
import { StudentDashboardView } from '@/components/dashboard/student-dashboard';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { FullPageLoader } from '@/components/shared/guards';
import type {
  AdminDashboard,
  CRDashboard,
  StudentDashboard,
  TeacherDashboard,
  VolunteerDashboard,
} from '@/types/api';

export default function DashboardPage() {
  const { user, isCR, isVolunteer } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', user?.role, isCR, isVolunteer],
    queryFn: () => api.get<Record<string, unknown>>('/dashboard'),
    enabled: Boolean(user),
  });

  if (!user) return <FullPageLoader />;
  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return null;

  if (user.role === 'admin') return <AdminDashboardView data={data as unknown as AdminDashboard} />;
  if (user.role === 'teacher') return <TeacherDashboardView data={data as unknown as TeacherDashboard} />;

  return (
    <StudentDashboardView
      data={data as unknown as StudentDashboard}
      cr={isCR ? (data.cr as CRDashboard | undefined) : undefined}
      volunteer={isVolunteer ? (data.volunteer as VolunteerDashboard | undefined) : undefined}
    />
  );
}
