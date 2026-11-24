/**
 * Creates the first administrator account (idempotent).
 * Usage: npm run bootstrap:admin
 */
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { logger } from '../config/logger';
import { hashPassword } from '../utils/password';
import { ensurePlatformSettings } from '../services/settingsService';

const run = async () => {
  await connectDatabase();
  await ensurePlatformSettings();

  const email = env.adminEmail.toLowerCase().trim();
  const existing = await User.findOne({ email });

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.status = 'active';
      await existing.save();
      logger.info({ email }, 'Existing user promoted to administrator');
    } else {
      logger.info({ email }, 'Administrator already exists');
    }
  } else {
    if (!env.adminPassword || env.adminPassword.length < 8) {
      throw new Error(
        'ADMIN_PASSWORD must be set (min 8 characters) to create the first administrator. Add it to .env or the environment.',
      );
    }
    const passwordHash = await hashPassword(env.adminPassword);
    await User.create({
      name: env.adminName,
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
      designation: 'Administrator',
      mustChangePassword: true,
    });
    logger.info({ email }, 'Administrator created. Change the password after first sign-in.');
  }

  await disconnectDatabase();
};

run().catch(async (error) => {
  logger.error({ err: error }, 'Bootstrap failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
