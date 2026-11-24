import Link from 'next/link';
import { GraduationCap, Mail, MapPin, Phone } from 'lucide-react';

export const SiteFooter = () => (
  <footer className="border-t border-line bg-surface">
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-[15px] font-semibold text-ink">CollegeHub</span>
        </div>
        <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          The academic operations and campus events platform for Pundit Dev Prabhakar Shashtri College,
          Chhatarpur, Madhya Pradesh.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">Explore</h3>
        <ul className="space-y-2 text-[13px] text-ink-soft">
          <li><Link href="/" className="hover:text-primary">Home</Link></li>
          <li><Link href="/about" className="hover:text-primary">About the college</Link></li>
          <li><Link href="/events" className="hover:text-primary">Events</Link></li>
          <li><Link href="/login" className="hover:text-primary">Sign in</Link></li>
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">Campus</h3>
        <ul className="space-y-2.5 text-[13px] text-ink-soft">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Chhatarpur, Madhya Pradesh, India</span>
          </li>
          <li className="flex items-start gap-2">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>office@pdpscollege.edu.in</span>
          </li>
          <li className="flex items-start gap-2">
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>+91 7682 000 000</span>
          </li>
        </ul>
      </div>
    </div>
    <div className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row sm:px-6">
        <p className="text-[11.5px] text-subtle-foreground">
          © {new Date().getFullYear()} Pundit Dev Prabhakar Shashtri College. All rights reserved.
        </p>
        <p className="text-[11.5px] text-subtle-foreground">Built with CollegeHub</p>
      </div>
    </div>
  </footer>
);
