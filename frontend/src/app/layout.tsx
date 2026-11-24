import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'CollegeHub · Pundit Dev Prabhakar Shashtri College',
    template: '%s · CollegeHub',
  },
  description:
    'Academic management and event operations platform for Pundit Dev Prabhakar Shashtri College, Chhatarpur, Madhya Pradesh.',
  applicationName: 'CollegeHub',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#3b76e8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
