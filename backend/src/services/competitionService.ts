import { Types } from 'mongoose';
import {
  Competition,
  CompetitionResult,
  CompetitionSubmission,
  Event,
  EventRegistration,
  DynamicForm,
} from '../models';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { createNotification } from './notificationService';

export const listCompetitions = async (params: {
  event?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.event) filter.event = params.event;
  if (params.status) filter.status = params.status;
  if (params.search) {
    const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: regex }, { category: regex }];
  }

  const [items, total] = await Promise.all([
    Competition.find(filter)
      .populate('event', 'title slug startDate')
      .populate('judges', 'name email')
      .populate('coordinators', 'name email')
      .sort({ startDateTime: -1, createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    Competition.countDocuments(filter),
  ]);

  const enriched = await Promise.all(
    items.map(async (competition) => ({
      ...competition,
      stats: {
        registrations: await EventRegistration.countDocuments({ competition: competition._id }),
        submissions: await CompetitionSubmission.countDocuments({ competition: competition._id }),
      },
    })),
  );
  return { items: enriched, total };
};

export const getCompetition = async (id: string) => {
  const competition = await Competition.findById(id)
    .populate('event', 'title slug startDate endDate venue status')
    .populate('judges', 'name email designation')
    .populate('coordinators', 'name email designation')
    .populate('form')
    .lean();
  if (!competition) throw new NotFoundError('Competition');

  const [registrations, submissions, results] = await Promise.all([
    EventRegistration.find({ competition: id })
      .populate('student', 'name email')
      .select('registrationId student teamName isTeam status paymentStatus submittedAt')
      .lean(),
    CompetitionSubmission.find({ competition: id })
      .populate('submittedBy', 'name email')
      .lean(),
    CompetitionResult.find({ competition: id }).populate('participant', 'name').sort({ position: 1 }).lean(),
  ]);

  return { ...competition, registrations, submissions, results };
};

export const createCompetition = async (
  input: {
    title: string;
    description?: string;
    event: string;
    category?: string;
    rules?: string;
    eligibility?: string;
    maxParticipants?: number;
    teamSize?: number;
    allowTeamRegistration?: boolean;
    registrationDeadline?: string;
    fee?: number;
    feeType?: string;
    form?: string;
    judges?: string[];
    coordinators?: string[];
    submissionRequired?: boolean;
    submissionDeadline?: string;
    startDateTime?: string;
    venue?: string;
  },
  actorId: string,
) => {
  const event = await Event.findById(input.event);
  if (!event) throw new NotFoundError('Event');
  if (input.form) {
    const form = await DynamicForm.findById(input.form);
    if (!form) throw new NotFoundError('Form');
  }
  if (input.submissionDeadline && input.registrationDeadline) {
    if (new Date(input.submissionDeadline) < new Date(input.registrationDeadline)) {
      throw new ValidationError('The submission deadline cannot be before the registration deadline');
    }
  }

  return Competition.create({ ...input, status: 'draft', createdBy: actorId });
};

export const updateCompetition = async (id: string, input: Record<string, unknown>) => {
  const competition = await Competition.findById(id);
  if (!competition) throw new NotFoundError('Competition');
  if (input.status === 'published') {
    const results = await CompetitionResult.countDocuments({ competition: id });
    if (!results) throw new ValidationError('Add at least one result before publishing');
    competition.resultsPublished = true;
  }
  Object.assign(competition, input);
  if (input.teamSize) competition.teamSize = Number(input.teamSize);
  await competition.save();
  return competition;
};

export const deleteCompetition = async (id: string) => {
  const registrations = await EventRegistration.countDocuments({ competition: id });
  if (registrations) throw new ConflictError('This competition has registrations and cannot be deleted');
  await Promise.all([
    CompetitionSubmission.deleteMany({ competition: id }),
    CompetitionResult.deleteMany({ competition: id }),
  ]);
  await Competition.findByIdAndDelete(id);
};

export const submitEntry = async (
  competitionId: string,
  studentId: string,
  input: {
    title?: string;
    description?: string;
    fileUrl?: string;
    links?: string[];
    answers?: Array<{ key: string; label: string; value: unknown }>;
  },
) => {
  const competition = await Competition.findById(competitionId).populate('event', 'title');
  if (!competition) throw new NotFoundError('Competition');
  if (!competition.submissionRequired) throw new ValidationError('This competition does not accept submissions');
  if (competition.submissionDeadline && competition.submissionDeadline.getTime() < Date.now()) {
    throw new ValidationError('The submission deadline has passed');
  }

  const registration = await EventRegistration.findOne({ competition: competitionId, student: studentId });
  if (!registration) throw new ValidationError('Register for this competition before submitting');

  const existing = await CompetitionSubmission.findOne({ competition: competitionId, submittedBy: studentId });
  if (existing) throw new ConflictError('You have already submitted an entry for this competition');

  return CompetitionSubmission.create({
    competition: competition._id,
    event: competition.event,
    registration: registration._id,
    submittedBy: studentId,
    title: input.title,
    description: input.description,
    fileUrl: input.fileUrl,
    links: input.links ?? [],
    answers: input.answers ?? [],
  });
};

export const reviewSubmission = async (
  submissionId: string,
  actorId: string,
  input: { status: 'under_review' | 'accepted' | 'rejected'; score?: number; reviewNotes?: string },
) => {
  const submission = await CompetitionSubmission.findById(submissionId);
  if (!submission) throw new NotFoundError('Submission');
  submission.status = input.status;
  if (input.score !== undefined) submission.score = input.score;
  if (input.reviewNotes !== undefined) submission.reviewNotes = input.reviewNotes;
  submission.reviewedBy = new Types.ObjectId(actorId);
  submission.reviewedAt = new Date();
  await submission.save();

  await createNotification([
    {
      user: String(submission.submittedBy),
      type: 'event_update',
      title: `Submission ${input.status.replace('_', ' ')}`,
      message: input.reviewNotes ?? 'Your competition entry has been reviewed.',
      link: '/dashboard/competitions',
    },
  ]);

  return submission;
};

export const declareResult = async (
  competitionId: string,
  actorId: string,
  input: {
    position: 'first' | 'second' | 'third' | 'special_mention';
    displayName: string;
    participant?: string;
    registration?: string;
    notes?: string;
  },
) => {
  const competition = await Competition.findById(competitionId);
  if (!competition) throw new NotFoundError('Competition');

  const existing = await CompetitionResult.findOne({ competition: competitionId, position: input.position });
  if (existing) {
    existing.displayName = input.displayName;
    existing.participant = input.participant ? new Types.ObjectId(input.participant) : undefined;
    existing.registration = input.registration ? new Types.ObjectId(input.registration) : undefined;
    existing.notes = input.notes;
    existing.declaredBy = new Types.ObjectId(actorId);
    await existing.save();
    return existing;
  }

  return CompetitionResult.create({
    competition: competitionId,
    event: competition.event,
    position: input.position,
    displayName: input.displayName,
    participant: input.participant,
    registration: input.registration,
    notes: input.notes,
    declaredBy: actorId,
    published: competition.resultsPublished,
  });
};

export const publishResults = async (competitionId: string) => {
  const competition = await Competition.findById(competitionId);
  if (!competition) throw new NotFoundError('Competition');
  const results = await CompetitionResult.countDocuments({ competition: competitionId });
  if (!results) throw new ValidationError('Declare at least one result before publishing');

  competition.resultsPublished = true;
  competition.status = 'published';
  await competition.save();
  await CompetitionResult.updateMany({ competition: competitionId }, { $set: { published: true } });

  const winners = await CompetitionResult.find({ competition: competitionId }).lean();
  await createNotification(
    winners
      .filter((winner) => winner.participant)
      .map((winner) => ({
        user: String(winner.participant),
        type: 'result_published',
        title: `Results published: ${competition.title}`,
        message: `You placed ${winner.position.replace('_', ' ')} in ${competition.title}.`,
        link: '/dashboard/competitions',
      })),
  );

  return competition;
};

export const listMySubmissions = async (studentId: string) =>
  CompetitionSubmission.find({ submittedBy: studentId })
    .populate({ path: 'competition', select: 'title resultsPublished', populate: { path: 'event', select: 'title' } })
    .sort({ submittedAt: -1 })
    .lean();

export const listMyResults = async (studentId: string) =>
  CompetitionResult.find({ participant: studentId, published: true })
    .populate({ path: 'competition', select: 'title' })
    .lean();
