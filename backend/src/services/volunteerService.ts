import { Types } from 'mongoose';
import { Event, Task, User, VolunteerGroup } from '../models';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { createNotification } from './notificationService';
import type { AuthUser } from '../types/express';

export const listGroups = async (params: { event?: string; member?: string }) => {
  const filter: Record<string, unknown> = {};
  if (params.event) filter.event = params.event;
  if (params.member) filter.members = params.member;

  return VolunteerGroup.find(filter)
    .populate('event', 'title startDate status')
    .populate('coordinator', 'name email designation')
    .populate('leader', 'name email')
    .populate('members', 'name email')
    .sort({ createdAt: -1 })
    .lean();
};

export const createGroup = async (
  input: { name: string; event: string; description?: string; coordinator?: string },
  actor: AuthUser,
) => {
  const event = await Event.findById(input.event);
  if (!event) throw new NotFoundError('Event');

  const existing = await VolunteerGroup.findOne({ event: input.event, name: input.name });
  if (existing) throw new ConflictError('A volunteer group with this name already exists for this event');

  const coordinator = input.coordinator ?? (actor.role === 'teacher' ? actor.id : String(event.coordinator));
  const coordinatorUser = await User.findById(coordinator);
  if (!coordinatorUser || !['teacher', 'admin'].includes(coordinatorUser.role)) {
    throw new ValidationError('The group coordinator must be a teacher');
  }

  return VolunteerGroup.create({
    name: input.name,
    event: event._id,
    description: input.description,
    coordinator: coordinatorUser._id,
  });
};

export const updateGroup = async (id: string, input: Record<string, unknown>) => {
  const group = await VolunteerGroup.findById(id);
  if (!group) throw new NotFoundError('Volunteer group');
  Object.assign(group, input);
  await group.save();
  return group;
};

export const deleteGroup = async (id: string) => {
  const tasks = await Task.countDocuments({ group: id });
  if (tasks) throw new ConflictError('Reassign or remove this group’s tasks before deleting it');
  await VolunteerGroup.findByIdAndDelete(id);
};

/**
 * Assigns a student as a volunteer for an event. The student account keeps its
 * role; a scoped `volunteer` responsibility is attached instead.
 */
export const assignVolunteer = async (
  groupId: string,
  studentId: string,
  actorId: string,
  asLeader = false,
) => {
  const [group, student] = await Promise.all([VolunteerGroup.findById(groupId), User.findById(studentId)]);
  if (!group) throw new NotFoundError('Volunteer group');
  if (!student) throw new NotFoundError('Student');
  if (student.role !== 'student') throw new ValidationError('Only students can volunteer');
  if (student.status !== 'active') throw new ValidationError('This student account is not active');

  const already = (student.responsibilities ?? []).some(
    (r) => r.type === 'volunteer' && String(r.event) === String(group.event),
  );

  if (!already) {
    student.responsibilities.push({
      type: 'volunteer',
      event: group.event,
      group: group._id,
      assignedBy: new Types.ObjectId(actorId),
      assignedAt: new Date(),
    } as never);
    student.markModified('responsibilities');
    await student.save();
  }

  await VolunteerGroup.updateOne({ _id: group._id }, { $addToSet: { members: student._id } });
  if (asLeader) {
    await VolunteerGroup.updateOne({ _id: group._id }, { $set: { leader: student._id } });
  }

  await createNotification([
    {
      user: studentId,
      type: 'event_update',
      title: `You are a volunteer for ${(await Event.findById(group.event).select('title').lean())?.title ?? 'an event'}`,
      message: asLeader ? `You lead the ${group.name} team.` : `You joined the ${group.name} team.`,
      link: '/dashboard/volunteer',
    },
  ]);

  return VolunteerGroup.findById(group._id).populate('members', 'name email').lean();
};

export const removeVolunteer = async (groupId: string, studentId: string) => {
  const group = await VolunteerGroup.findById(groupId);
  if (!group) throw new NotFoundError('Volunteer group');
  await VolunteerGroup.updateOne(
    { _id: group._id },
    { $pull: { members: new Types.ObjectId(studentId) }, ...(String(group.leader) === studentId ? { $unset: { leader: '' } } : {}) },
  );

  const student = await User.findById(studentId);
  if (student) {
    const before = (student.responsibilities ?? []).length;
    student.responsibilities = (student.responsibilities ?? []).filter(
      (r) => !(r.type === 'volunteer' && String(r.group) === String(group._id)),
    ) as never;
    if (student.responsibilities.length !== before) {
      student.markModified('responsibilities');
      await student.save();
    }
  }
  return { removed: true };
};

/** Groups visible to a volunteer (their assignments only). */
export const listMyGroups = async (studentId: string) =>
  VolunteerGroup.find({ members: studentId })
    .populate('event', 'title startDate endDate venue status')
    .populate('coordinator', 'name email designation')
    .populate('leader', 'name email')
    .lean();

/* ---------------------------------- Tasks ---------------------------------- */

export const listTasks = async (params: {
  event?: string;
  group?: string;
  status?: string;
  assignedTo?: string;
  page: number;
  limit: number;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.event) filter.event = params.event;
  if (params.group) filter.group = params.group;
  if (params.status) filter.status = params.status;
  if (params.assignedTo) filter.assignedTo = params.assignedTo;

  const [items, total] = await Promise.all([
    Task.find(filter)
      .populate('event', 'title startDate')
      .populate('group', 'name')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    Task.countDocuments(filter),
  ]);
  return { items, total };
};

export const createTask = async (
  input: {
    title: string;
    description?: string;
    event: string;
    group?: string;
    assignedTo?: string[];
    priority?: string;
    dueDate?: string;
  },
  actorId: string,
) => {
  const event = await Event.findById(input.event);
  if (!event) throw new NotFoundError('Event');
  if (input.group) {
    const group = await VolunteerGroup.findById(input.group);
    if (!group || String(group.event) !== String(event._id)) {
      throw new ValidationError('The volunteer group does not belong to this event');
    }
  }
  if (input.assignedTo?.length) {
    const users = await User.find({ _id: { $in: input.assignedTo } }).select('_id').lean();
    if (users.length !== input.assignedTo.length) throw new ValidationError('One or more assignees could not be found');
  }

  const task = await Task.create({
    title: input.title,
    description: input.description,
    event: event._id,
    group: input.group,
    assignedTo: input.assignedTo ?? [],
    createdBy: actorId,
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    updates: [{ by: new Types.ObjectId(actorId), status: 'pending', note: 'Task created' }],
  });

  if (input.assignedTo?.length) {
    await createNotification(
      input.assignedTo.map((userId) => ({
        user: userId,
        type: 'task_assigned',
        title: `New task: ${task.title}`,
        message: `Assigned to you for ${event.title}.`,
        link: '/dashboard/tasks',
      })),
    );
  }

  return task;
};

export const updateTask = async (id: string, input: Record<string, unknown>, actorId: string) => {
  const task = await Task.findById(id);
  if (!task) throw new NotFoundError('Task');

  if (input.status && input.status !== task.status) {
    task.status = input.status as never;
    task.updates.push({
      by: new Types.ObjectId(actorId),
      status: input.status as never,
      note: typeof input.note === 'string' ? input.note : undefined,
      at: new Date(),
    } as never);
    if (input.status === 'completed') {
      task.completedAt = new Date();
      task.completedBy = new Types.ObjectId(actorId);
    } else {
      task.completedAt = undefined;
      task.completedBy = undefined;
    }
  }

  const assignable = ['title', 'description', 'priority', 'dueDate', 'assignedTo', 'group'];
  for (const key of assignable) {
    if (input[key] !== undefined) {
      (task as unknown as Record<string, unknown>)[key] =
        key === 'dueDate' ? new Date(String(input[key])) : input[key];
    }
  }
  await task.save();
  return task;
};

export const deleteTask = async (id: string) => {
  await Task.findByIdAndDelete(id);
};

export const listMyTasks = async (studentId: string) =>
  Task.find({ assignedTo: studentId })
    .populate('event', 'title startDate')
    .populate('group', 'name')
    .populate('createdBy', 'name')
    .sort({ dueDate: 1 })
    .lean();
