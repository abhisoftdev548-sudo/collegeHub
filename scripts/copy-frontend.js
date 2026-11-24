/**
 * Copies the statically exported Next.js frontend (frontend/out) into
 * backend/public so that the Express server can serve the whole application
 * from a single process/container.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'frontend', 'out');
const dest = path.join(root, 'backend', 'public');

if (!fs.existsSync(src)) {
  console.error('[copy-frontend] frontend/out not found. Run the frontend build first.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`[copy-frontend] Copied ${src} -> ${dest}`);
