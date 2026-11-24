import { Types } from 'mongoose';
import { Notification } from '../models';
import { logger } from '../config/logger';

export interface NotificationInput {
  user: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  meta?: Record<string, unknown>;
}

/**
 * Bulk notification creation. Notification delivery must never break the
 * business action, so failures are logged rather than thrown.
 */
export const createNotification = async (items: NotificationInput[]): Promise<void> => {
  if (!items.length) return;
  try {
    await Notification.insertMany(
      items.map((item) => ({
        user: new Types.ObjectId(item.user),
        type: item.type,
        title: item.title,
        message: item.message,
        link: item.link,
        meta: item.meta,
      })),
      { ordered: false },
    );
  } catch (error) {
    logger.warn({ err: error }, 'Failed to create notifications');
  }
};

export const listMyNotifications = async (userId: string, params: { unreadOnly?: boolean; limit: number }) => {
  const filter: Record<string, unknown> = { user: userId };
  if (params.unreadOnly) filter.read = false;
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(params.limit).lean(),
    Notification.countDocuments({ user: userId, read: false }),
  ]);
  return { items, unreadCount };
};

export const markNotificationsRead = async (userId: string, ids?: string[]) => {
  const filter: Record<string, unknown> = { user: userId, read: false };
  if (ids?.length) filter._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
  await Notification.updateMany(filter, { $set: { read: true, readAt: new Date() } });
};

export const getUnreadCount = async (userId: string): Promise<number> =>
  Notification.countDocuments({ user: userId, read: false });
