import { Types } from 'mongoose';
import { Announcement, Department, Event, StudentProfile, User, VolunteerGroup } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import type { AuthUser } from '../types/express';
import { getTeacherScope } from './accessControl';
import { createNotification } from './notificationService';
import { refId } from '../utils/ids';

export const listAnnouncements = async (params: {
  page: number;
  limit: number;
  audience?: string;
  search?: string;
  includeExpired?: boolean;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.audience) filter.audience = params.audience;
  if (params.search) filter.title = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (!params.includeExpired) {
    filter.$or = [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }];
  }

  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .populate('section', 'name')
      .populate('event', 'title')
      .populate('createdBy', 'name role')
      .sort({ publishAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    Announcement.countDocuments(filter),
  ]);
  return { items, total };
};

/** Audiences an announcement reaches for the signed-in user. */
export const listAnnouncementsForUser = async (user: AuthUser, limit = 20) => {
  const now = new Date();
  const or: Record<string, unknown>[] = [{ audience: 'college' }];

  if (user.role === 'student') {
    const profile = await StudentProfile.findOne({ user: user.id }).lean();
    if (profile) {
      or.push({ audience: 'department', department: profile.department });
      or.push({ audience: 'course', course: profile.course });
      or.push({ audience: 'semester', semester: profile.semester });
      or.push({ audience: 'section', section: profile.section });
    }
    const volunteerEventIds = user.responsibilities
      .filter((responsibility) => responsibility.type === 'volunteer' && responsibility.event)
      .map((responsibility) => responsibility.event);
    if (volunteerEventIds.length) or.push({ audience: 'event', event: { $in: volunteerEventIds } });
    const groups = await VolunteerGroup.find({ members: user.id }).select('_id').lean();
    if (groups.length) or.push({ audience: 'volunteer_group', volunteerGroup: { $in: groups.map((g) => g._id) } });
  }

  if (user.role === 'teacher') {
    const scope = await getTeacherScope(user);
    if (scope.departmentIds.length) or.push({ audience: 'department', department: { $in: scope.departmentIds } });
    if (scope.eventIds.length) or.push({ audience: 'event', event: { $in: scope.eventIds } });
  }

  if (user.role === 'admin') return listAnnouncements({ page: 1, limit });

  const items = await Announcement.find({
    published: true,
    publishAt: { $lte: now },
    $and: [
      { $or: or },
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
    ],
  })
    .populate('createdBy', 'name role')
    .populate('event', 'title')
    .sort({ priority: -1, publishAt: -1 })
    .limit(limit)
    .lean();

  return { items, total: items.length };
};

const assertAnnouncementScope = async (actor: AuthUser, input: Record<string, unknown>): Promise<void> => {
  if (actor.role === 'admin') return;
  if (actor.role !== 'teacher') throw new Error('Forbidden');
  const scope = await getTeacherScope(actor);

  if (input.audience === 'college') return; // teachers may post college-wide notices (authorised capability)
  if (input.audience === 'event') {
    if (!scope.eventIds.includes(String(input.event))) throw new Error('Forbidden');
    return;
  }
  if (input.audience === 'department') {
    if (!scope.departmentIds.includes(String(input.department))) throw new Error('Forbidden');
    return;
  }
  if (input.audience === 'section') {
    if (!scope.sectionIds.includes(String(input.section))) throw new Error('Forbidden');
  }
};

const isFutureDate = (value?: Date | string | null): boolean =>
  Boolean(value && new Date(value as never).getTime() > Date.now() + 60_000);

/**
 * Sends the announcement notification to its audience. Exported so the
 * scheduled-announcements maintenance script can deliver announcements whose
 * `publishAt` time has arrived (see `src/scripts/publishScheduledAnnouncements.ts`).
 */
export const fanOutAnnouncement = async (announcement: {
  _id: unknown;
  title: string;
  body: string;
  audience: string;
  department?: unknown;
  course?: unknown;
  semester?: unknown;
  section?: unknown;
  event?: unknown;
  volunteerGroup?: unknown;
}): Promise<number> => {
  const recipients = new Set<string>();
  if (announcement.audience === 'college') {
    const users = await User.find({ status: 'active' }).select('_id').limit(5000).lean();
    users.forEach((user) => recipients.add(String(user._id)));
  } else if (announcement.audience === 'department') {
    // Students in the department *and* its teaching staff (teachers + head).
    const [profiles, department] = await Promise.all([
      StudentProfile.find({ department: announcement.department as never }).select('user').limit(5000).lean(),
      Department.findById(announcement.department as never).select('teachers head').lean(),
    ]);
    profiles.forEach((profile) => recipients.add(String(profile.user)));
    department?.teachers?.forEach((teacher) => recipients.add(String(teacher)));
    if (department?.head) recipients.add(String(department.head));
  } else if (announcement.audience === 'course') {
    const profiles = await StudentProfile.find({ course: announcement.course as never }).select('user').limit(5000).lean();
    profiles.forEach((profile) => recipients.add(String(profile.user)));
  } else if (announcement.audience === 'semester') {
    const profiles = await StudentProfile.find({ semester: announcement.semester as never }).select('user').limit(5000).lean();
    profiles.forEach((profile) => recipients.add(String(profile.user)));
  } else if (announcement.audience === 'section') {
    const profiles = await StudentProfile.find({ section: announcement.section as never }).select('user').limit(5000).lean();
    profiles.forEach((profile) => recipients.add(String(profile.user)));
  } else if (announcement.audience === 'event') {
    const event = await Event.findById(announcement.event).select('teachers coordinator').lean();
    const { EventRegistration } = await import('../models');
    const registrations = await EventRegistration.find({ event: announcement.event as never }).select('student').limit(5000).lean();
    registrations.forEach((registration) => recipients.add(refId(registration.student)));
    event?.teachers?.forEach((teacher) => recipients.add(String(teacher)));
    if (event?.coordinator) recipients.add(String(event.coordinator));
  } else if (announcement.audience === 'volunteer_group') {
    const group = await VolunteerGroup.findById(announcement.volunteerGroup).select('members coordinator').lean();
    group?.members?.forEach((member) => recipients.add(String(member)));
    if (group?.coordinator) recipients.add(String(group.coordinator));
  }

  await createNotification(
    [...recipients].map((userId) => ({
      user: userId,
      type: 'announcement',
      title: String(announcement.title),
      message: String(announcement.body).slice(0, 180),
      link: '/dashboard/announcements',
    })),
  );

  return recipients.size;
};

export const createAnnouncement = async (input: Record<string, unknown>, actor: AuthUser) => {
  try {
    await assertAnnouncementScope(actor, input);
  } catch {
    throw new ValidationError('You can only post announcements for your assigned areas');
  }

  if (input.audience === 'department' && !input.department) throw new ValidationError('Select a department');
  if (input.audience === 'course' && !input.course) throw new ValidationError('Select a course');
  if (input.audience === 'semester' && !input.semester) throw new ValidationError('Select a semester');
  if (input.audience === 'section' && !input.section) throw new ValidationError('Select a section');
  if (input.audience === 'event' && !input.event) throw new ValidationError('Select an event');
  if (input.audience === 'volunteer_group' && !input.volunteerGroup) throw new ValidationError('Select a volunteer group');

  const announcement = await Announcement.create({ ...input, createdBy: actor.id, publishAt: input.publishAt ?? new Date() });

  // Fan out immediately unless the author scheduled it for later or kept it as a draft.
  // `notifiedAt` marks delivery so the scheduled-delivery script never repeats it.
  if (input.published !== false && !isFutureDate(announcement.publishAt)) {
    await fanOutAnnouncement(announcement);
    await Announcement.updateOne({ _id: announcement._id }, { $set: { notifiedAt: new Date() } });
  }

  return announcement;
};

export const updateAnnouncement = async (id: string, input: Record<string, unknown>) => {
  const announcement = await Announcement.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
  if (!announcement) throw new NotFoundError('Announcement');

  // Publishing a previously scheduled draft delivers it now if it is already due.
  if (announcement.published && !announcement.notifiedAt && !isFutureDate(announcement.publishAt)) {
    await fanOutAnnouncement(announcement);
    await Announcement.updateOne({ _id: announcement._id }, { $set: { notifiedAt: new Date() } });
  }

  return announcement;
};

export const deleteAnnouncement = async (id: string) => {
  await Announcement.findByIdAndDelete(id);
};

export const markAnnouncementRead = async (announcementId: string, userId: string) => {
  await Announcement.updateOne({ _id: announcementId }, { $addToSet: { readBy: new Types.ObjectId(userId) } });
};

export { Types };
