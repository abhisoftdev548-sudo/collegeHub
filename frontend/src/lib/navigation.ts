import {
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  House,
  Layers,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Users2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Any one of these permissions unlocks the item. Empty = always visible. */
  permissions?: string[];
  roles?: Array<'admin' | 'teacher' | 'student'>;
  responsibility?: 'cr' | 'volunteer';
  badge?: 'notifications';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navigation is derived from permissions returned by the server, never from
 * hardcoded role checks alone — the same rules the API enforces.
 */
export const getNavigation = (): NavSection[] => [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Sparkles, badge: 'notifications' },
    ],
  },
  {
    title: 'Academics',
    items: [
      { label: 'Departments', href: '/dashboard/academics/departments', icon: Building2, permissions: ['department:manage'] },
      { label: 'Courses', href: '/dashboard/academics/courses', icon: GraduationCap, permissions: ['course:manage'] },
      { label: 'Academic Sessions', href: '/dashboard/academics/sessions', icon: CalendarRange, permissions: ['session:manage'] },
      { label: 'Semesters & Sections', href: '/dashboard/academics/sections', icon: Layers, permissions: ['section:manage', 'session:manage'] },
      { label: 'Subjects', href: '/dashboard/academics/subjects', icon: BookOpen, permissions: ['subject:manage', 'teaching:assign'] },
      { label: 'Teaching Assignments', href: '/dashboard/academics/teaching', icon: UserCog, permissions: ['section:manage', 'subject:manage'] },
      { label: 'Class Representatives', href: '/dashboard/academics/representatives', icon: BadgeCheck, permissions: ['cr:assign'] },
      { label: 'My Subjects', href: '/dashboard/my-subjects', icon: BookOpen, roles: ['teacher'] },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Students', href: '/dashboard/students', icon: Users, permissions: ['student:read', 'student:create'] },
      { label: 'Teachers', href: '/dashboard/teachers', icon: UserCog, permissions: ['teacher:manage'] },
      { label: 'Semester Promotion', href: '/dashboard/academics/promotion', icon: ClipboardCheck, permissions: ['student:promote'] },
      { label: 'My Students', href: '/dashboard/my-students', icon: Users2, roles: ['teacher'] },
      { label: 'My Class', href: '/dashboard/my-class', icon: Users2, responsibility: 'cr' },
    ],
  },
  {
    title: 'Events',
    items: [
      { label: 'Event Management', href: '/dashboard/events', icon: CalendarDays, permissions: ['event:create', 'event:update'] },
      { label: 'Competitions', href: '/dashboard/competitions', icon: Award, permissions: ['competition:manage', 'event:read'] },
      { label: 'Forms', href: '/dashboard/forms', icon: ClipboardList, permissions: ['form:manage'] },
      { label: 'Registrations', href: '/dashboard/registrations', icon: FileSpreadsheet, permissions: ['registration:read', 'event:read'] },
      { label: 'Payments', href: '/dashboard/payments', icon: FileSpreadsheet, permissions: ['payment:manage'] },
      { label: 'Explore Events', href: '/dashboard/explore', icon: CalendarDays, roles: ['student'] },
      { label: 'My Registrations', href: '/dashboard/my-registrations', icon: ClipboardCheck, roles: ['student'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Volunteers', href: '/dashboard/volunteers', icon: Users2, permissions: ['event:manage_volunteers', 'event:update'] },
      { label: 'Tasks', href: '/dashboard/tasks', icon: ListChecks, permissions: ['task:manage', 'task:update_own'] },
      { label: 'Volunteer Hub', href: '/dashboard/volunteer', icon: Users2, responsibility: 'volunteer' },
      { label: 'Attendance', href: '/dashboard/attendance', icon: ClipboardCheck, permissions: ['attendance:manage', 'attendance:read'] },
      { label: 'Event Check-in', href: '/dashboard/event-checkin', icon: BadgeCheck, permissions: ['attendance:manage', 'event:update'] },
      { label: 'My Attendance', href: '/dashboard/my-attendance', icon: ClipboardCheck, roles: ['student'] },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Reports', href: '/dashboard/reports', icon: FileSpreadsheet, permissions: ['report:read'] },
      { label: 'Activity Log', href: '/dashboard/audit', icon: ShieldCheck, permissions: ['settings:manage'] },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings, permissions: ['settings:manage'] },
    ],
  },
];

export const publicNavigation = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Events', href: '/events' },
  { label: 'Sign in', href: '/login' },
];

export { House };
