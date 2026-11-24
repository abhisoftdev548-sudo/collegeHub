import { Types } from 'mongoose';
import {
  AcademicSession,
  Course,
  PromotionBatch,
  Section,
  Semester,
  StudentEnrollment,
  StudentProfile,
  User,
} from '../models';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

export interface PromotionScope {
  department?: string;
  course?: string;
  semesterNumber?: number;
  fromSession: string;
  toSession: string;
  /** Student ids excluded from promotion (detained / failed / holds) */
  detainStudentIds?: string[];
  /** Administrative overrides: studentId -> target semester number */
  overrides?: Array<{ studentId: string; toSemesterNumber: number; reason?: string }>;
}

interface PlannedItem {
  student: Types.ObjectId;
  fromSemester: Types.ObjectId;
  toSemester?: Types.ObjectId;
  fromSection?: Types.ObjectId;
  toSection?: Types.ObjectId;
  outcome: 'promoted' | 'detained' | 'graduated' | 'skipped' | 'excluded';
  reason?: string;
}

const findOrCreateSemester = async (
  course: Types.ObjectId,
  number: number,
  session: Types.ObjectId,
): Promise<{ semester: Types.ObjectId | null; graduated: boolean }> => {
  const courseDoc = await Course.findById(course);
  if (!courseDoc) throw new NotFoundError('Course');
  if (number > courseDoc.totalSemesters) return { semester: null, graduated: true };

  const existing = await Semester.findOne({ course, number, academicSession: session });
  if (existing) return { semester: existing._id as Types.ObjectId, graduated: false };

  const created = await Semester.create({
    course,
    number,
    academicSession: session,
    label: `${courseDoc.code} Semester ${number} (${(await AcademicSession.findById(session))?.name ?? ''})`.trim(),
  });
  return { semester: created._id as Types.ObjectId, graduated: false };
};

/** Picks the target section within the next semester (by same name first). */
const resolveTargetSection = async (
  currentSection: Types.ObjectId,
  targetSemester: Types.ObjectId,
): Promise<Types.ObjectId | undefined> => {
  const current = await Section.findById(currentSection).lean();
  if (!current) return undefined;
  const sameName = await Section.findOne({ semester: targetSemester, name: current.name, isActive: true }).lean();
  if (sameName) return sameName._id as Types.ObjectId;
  const anySection = await Section.findOne({ semester: targetSemester, isActive: true }).sort({ name: 1 }).lean();
  return (anySection?._id as Types.ObjectId) ?? undefined;
};

/**
 * Builds a promotion plan WITHOUT mutating student records.
 * Promotion is always an explicit, authorised workflow:
 *   preview -> admin review (exceptions) -> approve -> history appended.
 */
export const previewPromotion = async (scope: PromotionScope) => {
  const [fromSession, toSession] = await Promise.all([
    AcademicSession.findById(scope.fromSession),
    AcademicSession.findById(scope.toSession),
  ]);
  if (!fromSession) throw new NotFoundError('Source academic session');
  if (!toSession) throw new NotFoundError('Target academic session');
  if (String(fromSession._id) === String(toSession._id)) {
    throw new ValidationError('Source and target sessions must differ');
  }

  const semesterFilter: Record<string, unknown> = { academicSession: fromSession._id };
  if (scope.course) semesterFilter.course = scope.course;
  if (scope.semesterNumber) semesterFilter.number = scope.semesterNumber;
  const semesters = await Semester.find(semesterFilter).lean();
  if (!semesters.length) throw new ValidationError('No semester offerings found in the source session for this scope');

  const profileFilter: Record<string, unknown> = {
    academicSession: fromSession._id,
    semester: { $in: semesters.map((s) => s._id) },
    status: 'active',
  };
  if (scope.department) profileFilter.department = scope.department;
  if (scope.course) profileFilter.course = scope.course;

  const profiles = await StudentProfile.find(profileFilter).populate('user', 'name email').lean();
  const detain = new Set((scope.detainStudentIds ?? []).map(String));
  const overrideMap = new Map((scope.overrides ?? []).map((o) => [o.studentId, o]));

  const items: PlannedItem[] = [];

  for (const profile of profiles) {
    const currentSemester = semesters.find((s) => String(s._id) === String(profile.semester));
    const currentNumber = currentSemester?.number ?? 1;

    if (detain.has(String(profile.user)) || profile.promotionHold) {
      items.push({
        student: profile.user as Types.ObjectId,
        fromSemester: profile.semester as Types.ObjectId,
        fromSection: profile.section as Types.ObjectId,
        outcome: 'detained',
        reason: profile.promotionHold ? 'Promotion hold set' : 'Marked as detained/failed',
      });
      continue;
    }

    const override = overrideMap.get(String(profile.user));
    const targetNumber = override ? override.toSemesterNumber : currentNumber + 1;

    const { semester: targetSemester, graduated } = await findOrCreateSemester(
      profile.course as Types.ObjectId,
      targetNumber,
      toSession._id as Types.ObjectId,
    );

    if (graduated) {
      items.push({
        student: profile.user as Types.ObjectId,
        fromSemester: profile.semester as Types.ObjectId,
        fromSection: profile.section as Types.ObjectId,
        outcome: 'graduated',
        reason: 'Completed the final semester of the course',
      });
      continue;
    }
    if (!targetSemester) {
      items.push({
        student: profile.user as Types.ObjectId,
        fromSemester: profile.semester as Types.ObjectId,
        fromSection: profile.section as Types.ObjectId,
        outcome: 'skipped',
        reason: 'No target semester available',
      });
      continue;
    }

    const targetSection = await resolveTargetSection(
      profile.section as Types.ObjectId,
      targetSemester,
    );

    items.push({
      student: profile.user as Types.ObjectId,
      fromSemester: profile.semester as Types.ObjectId,
      toSemester: targetSemester,
      fromSection: profile.section as Types.ObjectId,
      toSection: targetSection,
      outcome: 'promoted',
      reason: override?.reason,
    });
  }

  const summary = {
    total: items.length,
    promoted: items.filter((i) => i.outcome === 'promoted').length,
    detained: items.filter((i) => i.outcome === 'detained').length,
    graduated: items.filter((i) => i.outcome === 'graduated').length,
    skipped: items.filter((i) => i.outcome === 'skipped').length,
    excluded: 0,
  };

  return {
    fromSession,
    toSession,
    items,
    summary,
    students: profiles.map((p) => ({
      id: String(p.user),
      name: (p.user as unknown as { name?: string })?.name,
      email: (p.user as unknown as { email?: string })?.email,
      enrollmentNumber: p.enrollmentNumber,
    })),
  };
};

export const createPromotionBatch = async (
  scope: PromotionScope,
  actorId: string,
  name?: string,
) => {
  const preview = await previewPromotion(scope);

  const batch = await PromotionBatch.create({
    name: name ?? `Promotion ${preview.fromSession.name} → ${preview.toSession.name}`,
    fromSession: preview.fromSession._id,
    toSession: preview.toSession._id,
    status: 'preview',
    scope: {
      department: scope.department,
      course: scope.course,
      semesterNumber: scope.semesterNumber,
    },
    items: preview.items,
    summary: preview.summary,
    createdBy: new Types.ObjectId(actorId),
  });

  return { batch, preview };
};

/** Applies an approved promotion batch exactly once. */
export const approvePromotionBatch = async (batchId: string, actorId: string) => {
  const batch = await PromotionBatch.findById(batchId);
  if (!batch) throw new NotFoundError('Promotion batch');
  if (batch.status === 'approved') throw new ConflictError('This promotion batch has already been approved');
  if (batch.status === 'cancelled') throw new ValidationError('This promotion batch was cancelled');

  for (const item of batch.items) {
    if (item.outcome === 'promoted' && item.toSemester) {
      const profile = await StudentProfile.findOne({ user: item.student });
      if (!profile) continue;
      if (String(profile.semester) !== String(item.fromSemester)) {
        // Student already moved (e.g. manual correction) — record as skipped.
        item.outcome = 'skipped';
        item.reason = 'Student semester changed after the batch was previewed';
        continue;
      }

      const targetSemester = await Semester.findById(item.toSemester).lean();
      if (!targetSemester) {
        item.outcome = 'skipped';
        item.reason = 'Target semester no longer exists';
        continue;
      }

      const previous = await StudentEnrollment.findOne({ student: item.student, effectiveTo: { $exists: false } })
        .sort({ effectiveFrom: -1 });
      if (previous) {
        previous.effectiveTo = new Date();
        await previous.save();
      }

      profile.semester = targetSemester._id;
      profile.academicSession = targetSemester.academicSession;
      if (item.toSection) profile.section = item.toSection;
      await profile.save();

      await StudentEnrollment.create({
        student: item.student,
        academicSession: targetSemester.academicSession,
        department: profile.department,
        course: profile.course,
        semester: targetSemester._id,
        semesterNumber: targetSemester.number,
        section: profile.section,
        event: 'promotion',
        status: 'active',
        remarks: item.reason,
        recordedBy: new Types.ObjectId(actorId),
        promotionBatch: batch._id,
      });

      // CR responsibilities from the previous session do not carry over.
      await User.updateOne(
        { _id: item.student },
        { $pull: { responsibilities: { type: 'cr', section: item.fromSection } } },
      );
      if (item.fromSection) {
        await Section.updateOne({ _id: item.fromSection }, { $pull: { crStudents: item.student } });
      }
    } else if (item.outcome === 'graduated') {
      const profile = await StudentProfile.findOne({ user: item.student });
      if (!profile) continue;
      const previous = await StudentEnrollment.findOne({ student: item.student, effectiveTo: { $exists: false } })
        .sort({ effectiveFrom: -1 });
      if (previous) {
        previous.status = 'completed';
        previous.effectiveTo = new Date();
        await previous.save();
      }
      profile.status = 'graduated';
      await profile.save();
      await StudentEnrollment.create({
        student: item.student,
        academicSession: batch.toSession,
        department: profile.department,
        course: profile.course,
        semester: profile.semester,
        semesterNumber: (await Semester.findById(profile.semester).select('number').lean())?.number ?? 1,
        section: profile.section,
        event: 'graduation',
        status: 'completed',
        remarks: 'Completed course requirements',
        recordedBy: new Types.ObjectId(actorId),
        promotionBatch: batch._id,
      });
    } else if (item.outcome === 'detained') {
      const profile = await StudentProfile.findOne({ user: item.student });
      if (!profile) continue;
      profile.status = 'detained';
      await profile.save();
      await StudentEnrollment.create({
        student: item.student,
        academicSession: batch.toSession,
        department: profile.department,
        course: profile.course,
        semester: profile.semester,
        semesterNumber: (await Semester.findById(profile.semester).select('number').lean())?.number ?? 1,
        section: profile.section,
        event: 're_enrollment',
        status: 'detained',
        remarks: item.reason ?? 'Detained',
        recordedBy: new Types.ObjectId(actorId),
        promotionBatch: batch._id,
      });
    }
  }

  batch.summary = {
    total: batch.items.length,
    promoted: batch.items.filter((i) => i.outcome === 'promoted').length,
    detained: batch.items.filter((i) => i.outcome === 'detained').length,
    graduated: batch.items.filter((i) => i.outcome === 'graduated').length,
    skipped: batch.items.filter((i) => i.outcome === 'skipped').length,
    excluded: batch.items.filter((i) => i.outcome === 'excluded').length,
  };
  batch.status = 'approved';
  batch.approvedAt = new Date();
  batch.approvedBy = new Types.ObjectId(actorId);
  batch.markModified('items');
  await batch.save();

  return batch;
};

export const cancelPromotionBatch = async (batchId: string) => {
  const batch = await PromotionBatch.findById(batchId);
  if (!batch) throw new NotFoundError('Promotion batch');
  if (batch.status === 'approved') throw new ConflictError('Approved batches cannot be cancelled; use corrections instead');
  batch.status = 'cancelled';
  await batch.save();
  return batch;
};

export const listPromotionBatches = async () =>
  PromotionBatch.find()
    .populate('fromSession', 'name')
    .populate('toSession', 'name')
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

export const getPromotionBatch = async (batchId: string) => {
  const batch = await PromotionBatch.findById(batchId)
    .populate('fromSession', 'name')
    .populate('toSession', 'name')
    .populate('items.student', 'name email')
    .populate('items.fromSemester', 'number label')
    .populate('items.toSemester', 'number label')
    .populate('items.fromSection', 'name')
    .populate('items.toSection', 'name')
    .lean();
  if (!batch) throw new NotFoundError('Promotion batch');
  return batch;
};

/** Authorised manual correction of a student's placement (history preserved). */
export const correctStudentPlacement = async (
  studentUserId: string,
  target: { semester: string; section: string },
  actorId: string,
  remarks: string,
) => {
  const profile = await StudentProfile.findOne({ user: studentUserId });
  if (!profile) throw new NotFoundError('Student');
  const [semester, section] = await Promise.all([
    Semester.findById(target.semester),
    Section.findById(target.section),
  ]);
  if (!semester) throw new NotFoundError('Semester');
  if (!section) throw new NotFoundError('Section');
  if (String(section.semester) !== String(semester._id)) {
    throw new ValidationError('Section does not belong to the selected semester');
  }

  const previous = await StudentEnrollment.findOne({ student: studentUserId, effectiveTo: { $exists: false } })
    .sort({ effectiveFrom: -1 });
  if (previous) {
    previous.effectiveTo = new Date();
    await previous.save();
  }

  profile.semester = semester._id;
  profile.section = section._id;
  profile.academicSession = semester.academicSession;
  if (profile.status === 'detained') profile.status = 'active';
  await profile.save();

  await StudentEnrollment.create({
    student: studentUserId,
    academicSession: semester.academicSession,
    department: profile.department,
    course: profile.course,
    semester: semester._id,
    semesterNumber: semester.number,
    section: section._id,
    event: 'correction',
    status: 'active',
    remarks,
    recordedBy: new Types.ObjectId(actorId),
  });

  return profile;
};
