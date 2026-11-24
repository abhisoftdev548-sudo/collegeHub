import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-friendly public identifier, e.g. REG-2026-4F7K9Q. */
export const generatePublicCode = (prefix: string): string => {
  const bytes = randomBytes(6);
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return `${prefix}-${new Date().getFullYear()}-${code}`;
};

export const generateToken = (bytes = 32): string => randomBytes(bytes).toString('hex');
