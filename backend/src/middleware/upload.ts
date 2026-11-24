import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import multer from 'multer';
import { env } from '../config/env';
import { ValidationError } from '../utils/errors';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const stamp = new Date().toISOString().slice(0, 7).replace('-', '');
    const target = path.join(uploadRoot, stamp);
    fs.mkdirSync(target, { recursive: true });
    callback(null, target);
  },
  filename: (_req, file, callback) => {
    // Filenames are generated server-side; the client name is never trusted.
    const extension = EXTENSION_BY_MIME[file.mimetype] ?? '.bin';
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  },
});

export const uploadSingle = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return callback(new ValidationError('Unsupported file type. Upload images, PDFs, documents or ZIP files.'));
    }
    return callback(null, true);
  },
}).single('file');

export const toPublicUrl = (file: Express.Multer.File): string =>
  `/uploads/${path.relative(uploadRoot, file.path).split(path.sep).join('/')}`;
