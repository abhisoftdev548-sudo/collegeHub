import { Types } from 'mongoose';
import {
  Competition,
  DynamicForm,
  Event,
  EventAttendance,
  EventCategory,
  EventRegistration,
  Payment,
} from '../models';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { getTeacherScope } from './accessControl';
import type { AuthUser } from '../types/express';
import { createNotification } from './notificationService';
import { refId } from '../utils/ids';

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `event-${Date.now()}`;

export const ensureUniqueSlug = async (base: string, ignoreId?: string): Promise<string> => {
  let slug = base;
  let attempt = 1;
  for (;;) {
    const existing = await Event.findOne({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }).select('_id').lean();
    if (!existing) return slug;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
};

/* -------------------------------- Categories -------------------------------- */

export const listCategories = async (includeInactive = false) =>
  EventCategory.find(includeInactive ? {} : { isActive: true }).sort({ name: 1 }).lean();

export const createCategory = async (input: { name: string; description?: string; color?: string }) => {
  const exists = await EventCategory.findOne({ name: new RegExp(`^${input.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (exists) throw new ConflictError('An event category with this name already exists');
  const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = base;
  let n = 1;
  while (await EventCategory.findOne({ slug })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return EventCategory.create({ ...input, slug });
};

export const updateCategory = async (id: string, input: Record<string, unknown>) => {
  const category = await EventCategory.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
  if (!category) throw new NotFoundError('Event category');
  return category;
};

/* ---------------------------------- Events ---------------------------------- */

export interface EventListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  department?: string;
  upcoming?: boolean;
  includeSubEvents?: boolean;
  publicOnly?: boolean;
}

export const listEvents = async (params: EventListParams, user?: AuthUser) => {
  const filter: Record<string, unknown> = {};
  if (params.search) {
    const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { venue: regex }];
  }
  if (params.status) filter.status = params.status;
  if (params.category) filter.category = params.category;
  if (params.department) filter.department = params.department;
  if (params.upcoming) filter.startDate = { $gte: new Date() };
  if (params.includeSubEvents === false) filter.parentEvent = null;

  // Teacher visibility: events they manage, events of their departments, and published events.
  if (user?.role === 'teacher') {
    const scope = await getTeacherScope(user);
    filter.$and = [
      {
        $or: [
          { _id: { $in: scope.eventIds.map((id) => new Types.ObjectId(id)) } },
          { department: { $in: scope.departmentIds.map((id) => new Types.ObjectId(id)) } },
          { status: { $in: ['published', 'ongoing', 'completed'] }, isPublic: true },
        ],
      },
    ];
  }
  if (user?.role === 'student' || !user || params.publicOnly) {
    if (!user || params.publicOnly) {
      filter.status = params.status ?? { $in: ['published', 'ongoing', 'completed'] };
      filter.isPublic = true;
    }
  }

  const [items, total] = await Promise.all([
    Event.find(filter)
      .populate('category', 'name slug color')
      .populate('department', 'name code')
      .populate('coordinator', 'name email designation')
      .populate('teachers', 'name email')
      .sort({ startDate: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    Event.countDocuments(filter),
  ]);

  const enriched = await Promise.all(
    items.map(async (event) => {
      const [registrations, subEvents, competitions] = await Promise.all([
        EventRegistration.countDocuments({ event: event._id }),
        Event.countDocuments({ parentEvent: event._id }),
        Competition.countDocuments({ event: event._id }),
      ]);
      return { ...event, stats: { registrations, subEvents, competitions } };
    }),
  );

  return { items: enriched, total };
};

export const getEventById = async (id: string, user?: AuthUser) => {
  const event = await Event.findOne({ $or: [{ _id: id }, { slug: id }] })
    .populate('category', 'name slug color')
    .populate('department', 'name code')
    .populate('coordinator', 'name email designation')
    .populate('teachers', 'name email designation')
    .populate('parentEvent', 'title slug startDate')
    .lean();
  if (!event) throw new NotFoundError('Event');

  const isPublic = event.isPublic && ['published', 'ongoing', 'completed'].includes(event.status);
  if (!isPublic) {
    if (!user) throw new ForbiddenError('This event is not published yet');
    if (user.role === 'teacher') {
      const scope = await getTeacherScope(user);
      const canManage =
        scope.eventIds.includes(String(event._id)) ||
        (event.department && scope.departmentIds.includes(String(event.department)));
      if (!canManage) throw new ForbiddenError('You do not have access to this event');
    }
  }

  const [subEvents, competitions, registrations, attendanceCount] = await Promise.all([
    Event.find({ parentEvent: event._id }).populate('category', 'name color').sort({ startDate: 1 }).lean(),
    Competition.find({ event: event._id }).select('title status registrationDeadline fee teamSize allowTeamRegistration maxParticipants').lean(),
    EventRegistration.countDocuments({ event: event._id }),
    EventAttendance.countDocuments({ event: event._id }),
  ]);

  const registrationOpen = Boolean(
    event.registration?.isEnabled &&
      (!event.registrationDeadline || new Date(event.registrationDeadline).getTime() > Date.now()) &&
      event.status === 'published',
  );

  return { ...event, subEvents, competitions, stats: { registrations, attendance: attendanceCount }, registrationOpen };
};

export interface EventInput {
  title: string;
  description?: string;
  bannerUrl?: string;
  category: string;
  department?: string;
  parentEvent?: string;
  isMainEvent?: boolean;
  coordinator?: string;
  teachers?: string[];
  startDate: string;
  endDate: string;
  registrationStartDate?: string;
  registrationDeadline?: string;
  venue?: string;
  status?: string;
  participationRules?: string;
  requirements?: string;
  budget?: { estimated?: number; spent?: number; notes?: string };
  registration?: {
    isEnabled?: boolean;
    requiresApproval?: boolean;
    maxParticipants?: number;
    fee?: number;
    feeType?: string;
    form?: string;
  };
  isPublic?: boolean;
}

const validateEventDates = (input: EventInput): void => {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ValidationError('Invalid event dates');
  if (end < start) throw new ValidationError('The event end date must be on or after the start date');
  if (input.registrationDeadline && new Date(input.registrationDeadline) > end) {
    throw new ValidationError('The registration deadline cannot be after the event ends');
  }
};

export const createEvent = async (input: EventInput, actor: AuthUser) => {
  validateEventDates(input);

  const category = await EventCategory.findById(input.category);
  if (!category) throw new NotFoundError('Event category');

  if (input.parentEvent) {
    const parent = await Event.findById(input.parentEvent);
    if (!parent) throw new NotFoundError('Parent event');
    if (parent.parentEvent) throw new ValidationError('Sub-events cannot contain further sub-events');
  }

  if (actor.role === 'teacher') {
    const scope = await getTeacherScope(actor);
    if (input.department && !scope.departmentIds.includes(input.department)) {
      throw new ForbiddenError('You can only create events for departments you belong to');
    }
    if (!input.department && !input.parentEvent) {
      throw new ForbiddenError('Select a department for this event');
    }
  }

  const slug = await ensureUniqueSlug(slugify(input.title));
  const isSubEvent = Boolean(input.parentEvent);

  const event = await Event.create({
    ...input,
    slug,
    parentEvent: input.parentEvent ?? null,
    isMainEvent: input.isMainEvent ?? !isSubEvent,
    category: category._id,
    department: input.department || undefined,
    coordinator: input.coordinator || actor.id,
    teachers: input.teachers ?? [],
    status: input.status ?? 'draft',
    isPublic: input.isPublic ?? true,
    createdBy: actor.id,
    registration: {
      isEnabled: input.registration?.isEnabled ?? false,
      requiresApproval: input.registration?.requiresApproval ?? false,
      maxParticipants: input.registration?.maxParticipants,
      fee: input.registration?.fee ?? 0,
      feeType: input.registration?.feeType ?? 'individual',
      form: input.registration?.form || undefined,
    },
    publishedAt: (input.status ?? 'draft') === 'published' ? new Date() : undefined,
  });

  if (event.teachers.length) {
    const { invalidateScopeCache } = await import('./accessControl');
    event.teachers.forEach((teacher) => invalidateScopeCache(String(teacher)));
    invalidateScopeCache(String(event.coordinator));
  }

  return event;
};

export const updateEvent = async (id: string, input: Partial<EventInput>) => {
  const event = await Event.findById(id);
  if (!event) throw new NotFoundError('Event');

  const mergedDates = {
    title: input.title ?? event.title,
    startDate: input.startDate ?? event.startDate.toISOString(),
    endDate: input.endDate ?? event.endDate.toISOString(),
    registrationDeadline: input.registrationDeadline ?? event.registrationDeadline?.toISOString(),
  } as EventInput;
  validateEventDates({ ...mergedDates, category: String(event.category) });

  if (input.category) {
    const category = await EventCategory.findById(input.category);
    if (!category) throw new NotFoundError('Event category');
  }

  if (input.title && input.title !== event.title) {
    event.slug = await ensureUniqueSlug(slugify(input.title), id);
  }

  const previousStatus = event.status;
  const assignable: Array<keyof EventInput> = [
    'title', 'description', 'bannerUrl', 'category', 'department', 'parentEvent', 'isMainEvent',
    'coordinator', 'teachers', 'startDate', 'endDate', 'registrationStartDate', 'registrationDeadline',
    'venue', 'status', 'participationRules', 'requirements', 'budget', 'isPublic',
  ];
  for (const key of assignable) {
    if (input[key] !== undefined) {
      (event as unknown as Record<string, unknown>)[key] =
        key === 'parentEvent' && !input[key] ? null : input[key];
    }
  }
  if (input.registration) {
    event.registration = {
      ...event.registration,
      ...input.registration,
      form: input.registration.form ? new Types.ObjectId(input.registration.form) : (event.registration.form as Types.ObjectId | undefined),
    } as typeof event.registration;
  }

  if (input.status === 'published' && previousStatus !== 'published') {
    event.publishedAt = new Date();
  }

  await event.save();

  if (input.status === 'published' && previousStatus !== 'published') {
    // Notify the student body about newly published events.
    const { User } = await import('../models');
    const students = await User.find({ role: 'student', status: 'active' }).select('_id').limit(5000).lean();
    await createNotification(
      students.map((student) => ({
        user: String(student._id),
        type: 'event_new',
        title: `New event: ${event.title}`,
        message: `Registrations are opening for ${event.title}.`,
        link: `/events/detail?id=${String(event._id)}`,
      })),
    );
  }

  return event;
};

export const deleteEvent = async (id: string) => {
  const [registrations, subEvents] = await Promise.all([
    EventRegistration.countDocuments({ event: id }),
    Event.countDocuments({ parentEvent: id }),
  ]);
  if (registrations || subEvents) {
    throw new ConflictError('This event has registrations or sub-events. Cancel it instead of deleting.');
  }
  await Promise.all([
    Competition.deleteMany({ event: id }),
    EventAttendance.deleteMany({ event: id }),
    Payment.deleteMany({ event: id, status: 'pending' }),
  ]);
  await Event.findByIdAndDelete(id);
};

export const getEventRegistrations = async (
  eventId: string,
  params: { page: number; limit: number; status?: string; search?: string; competition?: string },
) => {
  const filter: Record<string, unknown> = { event: eventId };
  if (params.status) filter.status = params.status;
  if (params.competition) filter.competition = params.competition;

  const [items, total] = await Promise.all([
    EventRegistration.find(filter)
      .populate('student', 'name email phone')
      .populate('competition', 'title')
      .sort({ submittedAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    EventRegistration.countDocuments(filter),
  ]);

  if (!params.search) return { items, total };
  const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const filtered = items.filter((item) => {
    const student = item.student as unknown as { name?: string; email?: string } | null;
    return (
      regex.test(item.registrationId) ||
      regex.test(student?.name ?? '') ||
      regex.test(student?.email ?? '') ||
      regex.test(item.teamName ?? '')
    );
  });
  return { items: filtered, total: filtered.length };
};

export const updateRegistrationStatus = async (
  registrationId: string,
  status: string,
  notes?: string,
) => {
  const registration = await EventRegistration.findById(registrationId).populate('event', 'title');
  if (!registration) throw new NotFoundError('Registration');
  registration.status = status as never;
  if (notes) registration.notes = notes;
  await registration.save();

  await createNotification([
    {
      user: refId(registration.student),
      type: 'event_update',
      title: `Registration ${status}`,
      message: `Your registration ${registration.registrationId} for ${(registration.event as unknown as { title?: string })?.title ?? 'the event'} is now ${status}.`,
      link: '/dashboard/registrations',
    },
  ]);

  return registration;
};

/** Registers the signed-in student for an event (server-side pricing & limits). */
export const registerForEvent = async (
  eventId: string,
  studentId: string,
  submission: {
    answers: Array<{ key: string; label: string; value: unknown }>;
    teamName?: string;
    teamMembers?: Array<{ name: string; enrollmentNumber?: string; email?: string; phone?: string; isLeader?: boolean }>;
    files?: Array<{ url: string; label: string }>;
    competitionId?: string;
  },
) => {
  const event = await Event.findById(eventId);
  if (!event) throw new NotFoundError('Event');
  if (!event.registration?.isEnabled) throw new ValidationError('Registration is not open for this event');
  if (event.status !== 'published' && event.status !== 'ongoing') {
    throw new ValidationError('This event is not open for registration');
  }
  if (event.registrationDeadline && event.registrationDeadline.getTime() < Date.now()) {
    throw new ValidationError('The registration deadline has passed');
  }
  if (event.registrationStartDate && event.registrationStartDate.getTime() > Date.now()) {
    throw new ValidationError('Registration has not opened yet');
  }

  const existing = await EventRegistration.findOne({
    event: event._id,
    student: studentId,
    ...(submission.competitionId ? { competition: submission.competitionId } : {}),
  });
  if (existing) throw new ConflictError('You are already registered for this event');

  const count = await EventRegistration.countDocuments({
    event: event._id,
    status: { $in: ['pending', 'confirmed'] },
  });
  if (event.registration.maxParticipants && count >= event.registration.maxParticipants) {
    throw new ConflictError('This event has reached its registration limit');
  }

  // Pricing is always derived from the server-side event/competition config.
  let fee = event.registration.fee ?? 0;
  let competitionDoc = null;
  if (submission.competitionId) {
    competitionDoc = await Competition.findOne({ _id: submission.competitionId, event: event._id });
    if (!competitionDoc) throw new NotFoundError('Competition');
    if (competitionDoc.status === 'closed' || competitionDoc.status === 'published') {
      throw new ValidationError('This competition is no longer accepting registrations');
    }
    if (competitionDoc.registrationDeadline && competitionDoc.registrationDeadline.getTime() < Date.now()) {
      throw new ValidationError('The competition registration deadline has passed');
    }
    fee = competitionDoc.fee ?? fee;
  }

  const isTeam = Boolean(submission.teamMembers?.length) || Boolean(event.registration.feeType === 'team' && submission.teamName);
  // Fees are taken from the server-side configuration only — never from the client.
  const finalFee = fee;

  const registration = await EventRegistration.create({
    registrationId: `REG-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    event: event._id,
    competition: competitionDoc?._id,
    student: studentId,
    teamName: submission.teamName,
    isTeam,
    teamMembers: submission.teamMembers ?? [],
    answers: submission.answers ?? [],
    files: submission.files ?? [],
    status: event.registration.requiresApproval ? 'pending' : finalFee > 0 ? 'pending' : 'confirmed',
    paymentStatus: finalFee > 0 ? 'pending' : 'paid',
    feeAmount: finalFee,
    checkInCode: `CHK-${Math.random().toString(36).slice(2, 10).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`,
  });

  if (finalFee > 0) {
    await Payment.create({
      paymentId: `PAY-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      student: studentId,
      event: event._id,
      competition: competitionDoc?._id,
      registration: registration._id,
      amount: finalFee,
      status: 'pending',
      gateway: 'manual',
      method: 'manual',
    });
  }

  await createNotification([
    {
      user: studentId,
      type: 'event_update',
      title: 'Registration received',
      message: `Your registration ${registration.registrationId} for ${event.title} has been received.`,
      link: '/dashboard/registrations',
    },
  ]);

  return registration;
};

export const listMyRegistrations = async (studentId: string) =>
  EventRegistration.find({ student: studentId })
    .populate('event', 'title slug startDate endDate venue status bannerUrl')
    .populate('competition', 'title status')
    .sort({ submittedAt: -1 })
    .lean();
