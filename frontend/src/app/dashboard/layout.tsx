'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { RequireAuth } from '@/components/shared/guards';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <RequireAuth>
      <div className="flex min-h-dvh bg-canvas">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
          <footer className="border-t border-line px-4 py-4 sm:px-6 lg:px-8">
            <p className="mx-auto max-w-[1400px] text-[11px] text-subtle-foreground">
              CollegeHub · Pundit Dev Prabhakar Shashtri College, Chhatarpur (MP) · Academic year{' '}
              {new Date().getFullYear()}
            </p>
          </footer>
        </div>
      </div>
    </RequireAuth>
  );
}
