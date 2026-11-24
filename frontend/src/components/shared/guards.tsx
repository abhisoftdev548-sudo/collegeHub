'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from './empty-state';

/** Full-page loader used while the session is being resolved. */
export const FullPageLoader = ({ label = 'Preparing your workspace…' }: { label?: string }) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
    <p className="text-[13px] text-muted-foreground">{label}</p>
  </div>
);

export const RequireAuth = ({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Array<'admin' | 'teacher' | 'student'>;
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) return <FullPageLoader />;
  if (!user) return <FullPageLoader label="Redirecting to sign in…" />;

  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You don’t have access to this page"
        description="Your account does not have permission to view this section. If you think this is a mistake, contact the administrator."
        action={
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};
