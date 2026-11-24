/**
 * Publishes announcements that were scheduled for a future time and are now due.
 *
 * Announcements created with a future `publishAt` are stored published but are
 * not fanned out to notification inboxes at creation time (the audience should
 * not see them early). Run this script periodically — e.g. every 5 minutes via
 * cron / a platform scheduler — to deliver those notifications.
 *
 *   npm run publish:scheduled              # once
 *   node dist/scripts/publishScheduledAnnouncements.js   # compiled build
 *
 * The script is idempotent: it records delivery on the announcement
 * (`notifiedAt`) so a re-run never sends duplicates.
 */
import { connectDatabase, disconnectDatabase } from '../config/db';
import { Announcement } from '../models/Announcement';
import { fanOutAnnouncement } from '../services/announcementService';
import { logger } from '../config/logger';

const BATCH_SIZE = 100;

const run = async (): Promise<void> => {
  await connectDatabase();

  const now = new Date();
  let delivered = 0;
  let scanned = 0;

  // Loop in batches until nothing remains due.
  for (;;) {
    const due = await Announcement.find({
      published: true,
      publishAt: { $lte: now },
      notifiedAt: { $exists: false },
    })
      .limit(BATCH_SIZE)
      .lean();

    if (due.length === 0) break;
    scanned += due.length;

    for (const announcement of due) {
      try {
        const recipients = await fanOutAnnouncement(announcement as never);
        await Announcement.updateOne({ _id: announcement._id }, { $set: { notifiedAt: new Date() } });
        delivered += 1;
        logger.info(
          { announcementId: String(announcement._id), audience: announcement.audience, recipients },
          'Scheduled announcement delivered',
        );
      } catch (error) {
        // Leave notifiedAt unset so the next run retries this announcement.
        logger.error({ err: error, announcementId: String(announcement._id) }, 'Failed to deliver scheduled announcement');
      }
    }

    if (due.length < BATCH_SIZE) break;
  }

  logger.info({ scanned, delivered }, 'Scheduled announcement run complete');
};

run()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ err: error }, 'Scheduled announcement run failed');
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  });
