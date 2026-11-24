/** Re-exports keep accessControl imports tidy and avoid circular imports. */
export { Department } from '../models/Department';
export { Course } from '../models/Course';
export { Event } from '../models/Event';
export { Section } from '../models/Section';
export { StudentProfile } from '../models/StudentProfile';
export { TeachingAssignment } from '../models/TeachingAssignment';
export { Subject as TeacherSubjectScope } from '../models/Subject';
export type { Types } from 'mongoose';
