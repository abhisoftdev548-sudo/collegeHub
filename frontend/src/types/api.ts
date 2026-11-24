/**
 * Shared API types mirroring the backend's document shapes.
 * Kept intentionally explicit so pages never fall back to `any`.
 */
export type Role = 'admin' | 'teacher' | 'student';
export type ResponsibilityType = 'cr' | 'volunteer';

export interface Responsibility {
  type: ResponsibilityType;
  section?: string | { _id: string; name: string };
  event?: string | { _id: string; title: string };
  group?: string;
  isPrimary?: boolean;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: string;
  avatarUrl?: string;
  designation?: string;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  responsibilities: Responsibility[];
  permissions: string[];
  studentProfile?: StudentProfileSummary | null;
}

export interface StudentProfileSummary {
  _id: string;
  enrollmentNumber: string;
  rollNumber?: string;
  department?: { _id: string; name: string; code: string };
  course?: { _id: string; name: string; code: string; totalSemesters?: number };
  semester?: { _id: string; number: number; label?: string };
  section?: { _id: string; name: string };
  academicSession?: { _id: string; name: string };
  admissionYear?: number;
  status?: string;
}

export type IdRef = string | { _id: string; name?: string; title?: string; code?: string; email?: string };

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  head?: { _id: string; name: string; email: string } | string;
  teachers?: Array<{ _id: string; name: string; email: string; designation?: string }>;
  isActive: boolean;
  stats?: { courses: number; students: number; subjects: number };
}

export interface Course {
  _id: string;
  name: string;
  code: string;
  department: IdRef;
  durationYears: number;
  totalSemesters: number;
  degreeLevel: string;
  isActive: boolean;
  stats?: { students: number; subjects: number; sections: number };
}

export interface AcademicSession {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed' | 'archived';
  isCurrent: boolean;
  notes?: string;
}

export interface Semester {
  _id: string;
  course: { _id: string; name: string; code: string; totalSemesters?: number };
  number: number;
  academicSession: { _id: string; name: string; isCurrent?: boolean };
  label: string;
  isActive: boolean;
  sections?: number;
}

export interface Section {
  _id: string;
  name: string;
  semester: { _id: string; number: number; label?: string } | string;
  course: { _id: string; name: string; code: string } | string;
  department: { _id: string; name: string; code: string } | string;
  academicSession: { _id: string; name: string } | string;
  crStudents?: Array<{ _id: string; name: string; email: string }>;
  capacity: number;
  isActive: boolean;
  studentCount?: number;
}

export interface Subject {
  _id: string;
  name: string;
  code: string;
  course: IdRef;
  department: IdRef;
  semesterNumber: number;
  credits?: number;
  teachers?: Array<{ _id: string; name: string; email: string; designation?: string }>;
  isActive: boolean;
}

export interface Student {
  _id: string;
  user: { _id: string; name: string; email: string; phone?: string; status: string; responsibilities?: Responsibility[] };
  enrollmentNumber: string;
  rollNumber?: string;
  department?: { _id: string; name: string; code: string };
  course?: { _id: string; name: string; code: string };
  semester?: { _id: string; number: number; label?: string };
  section?: { _id: string; name: string };
  academicSession?: { _id: string; name: string };
  admissionYear: number;
  status: string;
  guardianName?: string;
  guardianPhone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  bloodGroup?: string;
  createdAt: string;
}

export interface Teacher {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  status: string;
  extraPermissions: string[];
  departments: Array<{ _id: string; name: string; code: string }>;
  assignments: number;
  subjects: Array<{ subject: { _id: string; name: string; code: string }; section: { _id: string; name: string } }>;
  createdAt: string;
  lastLoginAt?: string;
}

export interface EventCategory {
  _id: string;
  name: string;
  slug: string;
  color: string;
  description?: string;
  isActive: boolean;
}

export interface EventItem {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  category: { _id: string; name: string; color: string };
  department?: { _id: string; name: string; code: string };
  parentEvent?: { _id: string; title: string } | null;
  isMainEvent: boolean;
  coordinator?: { _id: string; name: string; email: string; designation?: string };
  teachers: Array<{ _id: string; name: string; email: string }>;
  startDate: string;
  endDate: string;
  registrationDeadline?: string;
  venue?: string;
  status: string;
  participationRules?: string;
  requirements?: string;
  registration?: {
    isEnabled: boolean;
    requiresApproval: boolean;
    maxParticipants?: number;
    fee: number;
    feeType: 'individual' | 'team';
    form?: string | { _id: string; title: string };
  };
  isPublic: boolean;
  stats?: { registrations: number; subEvents: number; competitions: number; attendance?: number };
  subEvents?: EventItem[];
  competitions?: Competition[];
  registrationOpen?: boolean;
}

export interface FormField {
  key: string;
  label: string;
  type: 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'select' | 'radio' | 'checkbox' | 'multi_select' | 'date' | 'file';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
  acceptLabel?: string;
}

export interface DynamicForm {
  _id: string;
  title: string;
  description?: string;
  event?: IdRef;
  competition?: IdRef;
  fields: FormField[];
  teamSize?: number | null;
  allowTeamRegistration: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface Registration {
  _id: string;
  registrationId: string;
  event: { _id: string; title: string; startDate?: string; venue?: string; status?: string; bannerUrl?: string } | string;
  competition?: { _id: string; title: string } | string;
  student?: { _id: string; name: string; email: string; phone?: string } | string;
  teamName?: string;
  isTeam: boolean;
  teamMembers: Array<{ name: string; enrollmentNumber?: string; email?: string; phone?: string; isLeader?: boolean }>;
  answers: Array<{ key: string; label: string; value: unknown }>;
  status: string;
  paymentStatus: string;
  feeAmount: number;
  checkInCode: string;
  checkedInAt?: string;
  submittedAt: string;
}

export interface Payment {
  _id: string;
  paymentId: string;
  registration?: { _id: string } | string;
  event?: { _id: string; title: string } | string;
  student?: { _id: string; name: string; email: string } | string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface Competition {
  _id: string;
  title: string;
  description?: string;
  event?: { _id: string; title: string } | string;
  category?: string;
  rules?: string;
  eligibility?: string;
  maxParticipants?: number;
  teamSize: number;
  allowTeamRegistration: boolean;
  registrationDeadline?: string;
  fee: number;
  feeType: string;
  judges: Array<{ _id: string; name: string }>;
  coordinators?: Array<{ _id: string; name: string }>;
  submissionRequired: boolean;
  submissionDeadline?: string;
  resultsPublished: boolean;
  status: string;
  startDateTime?: string;
  venue?: string;
  stats?: { registrations: number; submissions: number };
  registrations?: Array<{
    _id: string;
    registrationId: string;
    student?: { _id: string; name: string; email: string };
    teamName?: string;
    status: string;
    paymentStatus: string;
    submittedAt: string;
  }>;
  submissions?: CompetitionSubmission[];
  results?: CompetitionResult[];
}

export interface CompetitionSubmission {
  _id: string;
  title?: string;
  description?: string;
  fileUrl?: string;
  links?: string[];
  status: string;
  score?: number;
  reviewNotes?: string;
  submittedAt: string;
  submittedBy?: { _id: string; name: string; email: string } | string;
  competition?: { _id: string; title: string };
}

export interface CompetitionResult {
  _id: string;
  position: 'first' | 'second' | 'third' | 'special_mention';
  displayName: string;
  participant?: string;
  notes?: string;
  published: boolean;
}

export interface VolunteerGroup {
  _id: string;
  name: string;
  description?: string;
  event: { _id: string; title: string; startDate?: string; status?: string };
  coordinator: { _id: string; name: string; email: string };
  leader?: { _id: string; name: string; email: string };
  members: Array<{ _id: string; name: string; email: string }>;
  isActive: boolean;
}

export interface TaskItem {
  _id: string;
  title: string;
  description?: string;
  event: { _id: string; title: string };
  group?: { _id: string; name: string };
  assignedTo: Array<{ _id: string; name: string; email: string }>;
  createdBy?: { _id: string; name: string };
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  completedAt?: string;
  updates?: Array<{ by: string; status: string; note?: string; at: string }>;
  createdAt: string;
}

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  audience: string;
  priority: string;
  department?: { _id: string; name: string };
  event?: { _id: string; title: string };
  createdBy?: { _id: string; name: string; role: string };
  publishAt: string;
  expiresAt?: string;
  readBy?: string[];
}

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AttendanceSheet {
  section: Section;
  date: string;
  students: Array<{
    studentId: string;
    enrollmentNumber: string;
    name: string;
    status: 'present' | 'absent' | 'late' | null;
    remarks?: string;
  }>;
  saved: boolean;
  savedAt?: string | null;
}

export interface AttendanceReportRow {
  studentId: string;
  name: string;
  enrollmentNumber: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

export interface AdminDashboard {
  counts: {
    totalStudents: number;
    totalTeachers: number;
    totalDepartments: number;
    totalCourses: number;
    activeEvents: number;
    upcomingEvents: number;
    pendingRegistrations: number;
    totalCRs: number;
    totalVolunteers: number;
    confirmedRegistrations: number;
    eventCheckIns: number;
    pendingPayments: number;
    collectedPayments: number;
  };
  studentsByDepartment: Array<{ name: string; code: string; count: number }>;
  attendanceByDay: Array<{ _id: { date: string; status: string }; count: number }>;
  upcomingEvents: EventItem[];
  recentActivity: Array<{
    _id: string;
    action: string;
    entity: string;
    description?: string;
    createdAt: string;
    actor?: { _id: string; name: string; role: string };
  }>;
  recentStudents: Array<{
    _id: string;
    enrollmentNumber: string;
    user?: { _id: string; name: string; email: string };
    course?: { _id: string; code: string };
    createdAt: string;
  }>;
}

export interface TeacherDashboard {
  assignments: Array<{
    _id: string;
    subject: { _id: string; name: string; code: string };
    section: { _id: string; name: string; semester?: { number: number; label?: string } };
  }>;
  sections: Section[];
  counts: {
    studentCount: number;
    eventCount: number;
    registrationCount: number;
    announcementCount: number;
    pendingTaskCount: number;
    attendancePercentage: number;
    unreadNotifications: number;
  };
  events: EventItem[];
  pendingTasks: TaskItem[];
}

export interface TeachingAssignmentRow {
  _id: string;
  subject: { _id: string; name: string; code: string };
  section: { _id: string; name: string; semester?: { _id?: string; number: number; label?: string } };
  course?: IdRef;
  department?: IdRef;
  semester?: IdRef;
  academicSession?: IdRef;
  teacher?: IdRef;
  isActive?: boolean;
  createdAt?: string;
}

/** `GET /teachers/me/overview` — the teacher's own data scope. */
export interface TeacherOverview {
  assignments: TeachingAssignmentRow[];
  departments: Array<{ _id: string; name: string; code?: string }>;
  scope: { sectionIds: string[]; subjectIds: string[]; eventIds: string[]; departmentIds: string[] };
  studentCount: number;
}

export interface StudentDashboard {
  profile: StudentProfileSummary & { user?: { _id: string; name: string; email: string } };
  subjects: Array<{ subject: { _id: string; name: string; code: string; credits?: number }; teacher: { _id: string; name: string; email: string; designation?: string } }>;
  registrations: Registration[];
  announcements: Announcement[];
  tasks: TaskItem[];
  upcomingEvents: EventItem[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
    bySubject: Array<{ subject: string; present: number; absent: number; late: number; total: number; percentage: number }>;
  };
  counts: { unreadNotifications: number; registrations: number; pendingTasks: number };
  isCR: boolean;
  volunteerGroups: VolunteerGroup[];
}

export interface CRDashboard {
  section: Section | null;
  classmates: Array<{ _id: string; enrollmentNumber: string; rollNumber?: string; user?: { _id: string; name: string; email: string } }>;
  announcements: Announcement[];
  tasks: TaskItem[];
  subjects: Array<{ subject: { _id: string; name: string; code: string }; teacher: { _id: string; name: string; email: string } }>;
  attendance: { sheets: number; percentage: number } | null;
}

export interface VolunteerDashboard {
  groups: VolunteerGroup[];
  tasks: TaskItem[];
  checkIns: Array<{ _id: string; event: { _id: string; title: string }; checkInAt: string; role: string }>;
}

export interface PromotionBatch {
  _id: string;
  name: string;
  fromSession: { _id: string; name: string };
  toSession: { _id: string; name: string };
  status: 'preview' | 'approved' | 'cancelled';
  summary: { total: number; promoted: number; detained: number; graduated: number; skipped: number; excluded: number };
  items: Array<{
    student: { _id: string; name: string; email: string };
    fromSemester?: { _id: string; number: number };
    toSemester?: { _id: string; number: number };
    fromSection?: { _id: string; name: string };
    toSection?: { _id: string; name: string };
    outcome: string;
    reason?: string;
  }>;
  approvedAt?: string;
  createdAt: string;
}

export interface PromotionPreview {
  fromSession: AcademicSession;
  toSession: AcademicSession;
  items: Array<{ student: string; outcome: string; reason?: string }>;
  summary: { total: number; promoted: number; detained: number; graduated: number; skipped: number; excluded: number };
  students: Array<{ id: string; name?: string; email?: string; enrollmentNumber: string }>;
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  entity: string;
  entityId?: string;
  description?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  actor?: { _id: string; name: string; role: string };
}

export interface AcademicReportRow {
  course: string;
  courseCode: string;
  semester: number;
  section: string;
  students: number;
}

export interface WorkloadReportRow {
  id: string;
  name: string;
  email: string;
  designation?: string;
  assignments: number;
  sections: number;
  events: number;
}

export interface EngagementReport {
  newRegistrations: number;
  checkInRate: number;
  activeStudents: number;
  eventCheckIns: number;
  departments: number;
  sections: number;
}

export interface PlatformSettings {
  _id: string;
  key: string;
  collegeName?: string;
  collegeEmail?: string;
  collegePhone?: string;
  address?: string;
  allowSelfRegistration?: boolean;
  maintenanceMode?: boolean;
  announcementBanner?: string;
  socialLinks?: { website?: string; instagram?: string; youtube?: string };
  paymentConfig?: {
    gatewayEnabled?: boolean;
    razorpayKeyId?: string;
    paymentInstructions?: string;
  };
  updatedAt?: string;
}
