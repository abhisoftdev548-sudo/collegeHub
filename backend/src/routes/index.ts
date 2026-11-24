import { Router } from 'express';
import authRoutes from './authRoutes';
import academicRoutes from './academicRoutes';
import studentRoutes, { promotionRouter } from './studentRoutes';
import teacherRoutes from './teacherRoutes';
import eventRoutes from './eventRoutes';
import competitionRoutes from './competitionRoutes';
import volunteerRoutes, { taskRouter } from './volunteerRoutes';
import { attendanceRouter, eventAttendanceRouter } from './attendanceRoutes';
import { announcementRouter, dashboardRouter, notificationRouter, reportRouter, searchRouter, settingsRouter } from './miscRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/academic', academicRoutes);
router.use('/students', studentRoutes);
router.use('/promotions', promotionRouter);
router.use('/teachers', teacherRoutes);
router.use('/events', eventRoutes);
router.use('/competitions', competitionRoutes);
router.use('/volunteers', volunteerRoutes);
router.use('/tasks', taskRouter);
router.use('/attendance', attendanceRouter);
router.use('/event-attendance', eventAttendanceRouter);
router.use('/announcements', announcementRouter);
router.use('/notifications', notificationRouter);
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportRouter);
router.use('/settings', settingsRouter);
router.use('/search', searchRouter);

export default router;
