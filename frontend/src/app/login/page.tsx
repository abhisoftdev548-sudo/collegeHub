import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { FullPageLoader } from '@/components/shared/guards';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to CollegeHub with your institutional account.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoader label="Loading sign in…" />}>
      <LoginForm />
    </Suspense>
  );
}
