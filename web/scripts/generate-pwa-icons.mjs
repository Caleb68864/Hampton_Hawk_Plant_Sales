/**
 * PWA icon generation script.
 * Generates pwa-192.png, pwa-512.png, pwa-maskable-512.png from web/public/hawk-logo.png.
 * Uses sharp (devDependency). Skips gracefully if source file is missing or icons already exist.
 *
 * Generation command equivalent:
 *   sharp input=public/hawk-logo.png resize 192 -> public/pwa-192.png
 *   sharp input=public/hawk-logo.png resize 512 -> public/pwa-512.png
 *   sharp input=public/hawk-logo.png resize 512 -> public/pwa-maskable-512.png
 */
import { existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const src = resolve(publicDir, 'hawk-logo.png');

const icons = [
  { out: resolve(publicDir, 'pwa-192.png'), size: 192 },
  { out: resolve(publicDir, 'pwa-512.png'), size: 512 },
  { out: resolve(publicDir, 'pwa-maskable-512.png'), size: 512 },
];

const MIN_SIZE_BYTES = 5 * 1024;

if (!existsSync(src)) {
  console.warn('[pwa-icons] Source file not found:', src, '— skipping icon generation.');
  process.exit(0);
}

const allExistAndLarge = icons.every(
  (icon) => existsSync(icon.out) && statSync(icon.out).size >= MIN_SIZE_BYTES
);

if (allExistAndLarge) {
  console.log('[pwa-icons] Icons already exist and meet size requirements — skipping.');
  process.exit(0);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[pwa-icons] sharp not available — skipping icon generation.');
  process.exit(0);
}

for (const icon of icons) {
  await sharp(src).resize(icon.size, icon.size).png().toFile(icon.out);
  console.log('[pwa-icons] Generated:', icon.out);
}

console.log('[pwa-icons] Done.');
