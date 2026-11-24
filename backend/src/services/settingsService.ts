import { Settings } from '../models';
import { COLLEGE } from '../config/constants';

/** Ensures the singleton settings document exists. */
export const ensurePlatformSettings = async (): Promise<void> => {
  const existing = await Settings.findOne({ key: 'platform' });
  if (existing) return;
  await Settings.create({
    key: 'platform',
    collegeName: COLLEGE.name,
    address: `${COLLEGE.city}, ${COLLEGE.state}, ${COLLEGE.country}`,
    allowSelfRegistration: false,
    paymentConfig: { gatewayEnabled: false },
  });
};

export const getPlatformSettings = async () => {
  const settings = await Settings.findOne({ key: 'platform' }).lean();
  return settings;
};

/** Public subset of settings that is safe to expose on the marketing site. */
export const getPublicSettings = async () => {
  const settings = await Settings.findOne({ key: 'platform' }).lean();
  if (!settings) {
    return {
      collegeName: COLLEGE.name,
      address: `${COLLEGE.city}, ${COLLEGE.state}`,
      allowSelfRegistration: false,
      announcementBanner: null,
      socialLinks: {},
    };
  }
  return {
    collegeName: settings.collegeName ?? COLLEGE.name,
    address: settings.address,
    collegeEmail: settings.collegeEmail,
    collegePhone: settings.collegePhone,
    allowSelfRegistration: settings.allowSelfRegistration,
    announcementBanner: settings.announcementBanner,
    socialLinks: settings.socialLinks,
    paymentInstructions: settings.paymentConfig?.paymentInstructions,
  };
};
