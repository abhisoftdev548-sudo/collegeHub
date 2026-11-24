/**
 * Centralised, non-secret application constants.
 */

export const COLLEGE = {
  name: 'Pundit Dev Prabhakar Shashtri College',
  shortName: 'PDPSC',
  city: 'Chhatarpur',
  state: 'Madhya Pradesh',
  country: 'India',
  tagline: 'College Management & Event Operations Platform',
} as const;

export const ROLES = ['admin', 'teacher', 'student'] as const;
export type Role = (typeof ROLES)[number];

/** Responsibilities are attached to a user and grant scoped capabilities. */
export const RESPONSIBILITIES = ['cr', 'volunteer'] as const;
export type Responsibility = (typeof RESPONSIBILITIES)[number];

export const PERMISSIONS = [
  // Academic structure
  'department:manage',
  'course:manage',
  'session:manage',
  'section:manage',
  'subject:manage',
  // People
  'student:create',
  'student:update',
  'student:read',
  'student:promote',
  'teacher:manage',
  'cr:assign',
  // Events
  'event:create',
  'event:update',
  'event:read',
  'event:manage_volunteers',
  // Competition & forms
  'competition:manage',
  'form:manage',
  'submission:review',
  // Registrations & payments
  'registration:read',
  'payment:manage',
  // Attendance
  'attendance:manage',
  'attendance:read',
  // Tasks
  'task:manage',
  'task:update_own',
  // Announcements
  'announcement:manage',
  'announcement:read',
  // Settings & reporting
  'report:read',
  'settings:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const SESSION_STATUS_VALUES = ['upcoming', 'active', 'completed', 'archived'] as const;
export type SessionStatus = (typeof SESSION_STATUS_VALUES)[number];
export const SESSION_STATUS: string[] = [...SESSION_STATUS_VALUES];
const EVENT_STATUS_VALUES = ['draft', 'published', 'ongoing', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUS_VALUES)[number];
export const EVENT_STATUS: string[] = [...EVENT_STATUS_VALUES];
const ATTENDANCE_STATUS_VALUES = ['present', 'absent', 'late'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS_VALUES)[number];
export const ATTENDANCE_STATUS: string[] = [...ATTENDANCE_STATUS_VALUES];
const PAYMENT_STATUS_VALUES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];
export const PAYMENT_STATUS: string[] = [...PAYMENT_STATUS_VALUES];
const TASK_STATUS_VALUES = ['pending', 'in_progress', 'completed', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];
export const TASK_STATUS: string[] = [...TASK_STATUS_VALUES];
const TASK_PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number];
export const TASK_PRIORITY: string[] = [...TASK_PRIORITY_VALUES];
const REGISTRATION_STATUS_VALUES = ['pending', 'confirmed', 'waitlisted', 'rejected', 'cancelled'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUS_VALUES)[number];
export const REGISTRATION_STATUS: string[] = [...REGISTRATION_STATUS_VALUES];
const RESULT_POSITIONS_VALUES = ['first', 'second', 'third', 'special_mention'] as const;
export type ResultPosition = (typeof RESULT_POSITIONS_VALUES)[number];
export const RESULT_POSITIONS: string[] = [...RESULT_POSITIONS_VALUES];
const FORM_FIELD_TYPES_VALUES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'number',
  'select',
  'radio',
  'checkbox',
  'multi_select',
  'date',
  'file',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES_VALUES)[number];
export const FORM_FIELD_TYPES: string[] = [...FORM_FIELD_TYPES_VALUES];
const ANNOUNCEMENT_AUDIENCES_VALUES = [
  'college',
  'department',
  'course',
  'semester',
  'section',
  'event',
  'volunteer_group',
] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES_VALUES)[number];
export const ANNOUNCEMENT_AUDIENCES: string[] = [...ANNOUNCEMENT_AUDIENCES_VALUES];

export const PAGINATION = { defaultLimit: 20, maxLimit: 100 } as const;
