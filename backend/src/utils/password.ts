import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = async (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/** Generates a readable temporary password for admin-created accounts. */
export const generateTemporaryPassword = (): string => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%&*';
  const pick = (source: string, count: number) =>
    Array.from({ length: count }, () =>
      source.charAt(Math.floor(Math.random() * source.length)),
    ).join('');
  return `${pick(uppercase, 2)}${pick(lowercase, 4)}${pick(digits, 2)}${pick(special, 1)}`;
};
