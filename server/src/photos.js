import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import sharp from 'sharp';
import multer from 'multer';
import { ApiError } from './validation.js';
import { database } from './db.js';

export const uploads = path.resolve(process.env.UPLOAD_DIR || fileURLToPath(new URL('../../uploads/pets/', import.meta.url)));
export const multipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, fieldSize: 32768, parts: 2 } }).single('photo');
export const photoPath = key => path.join(uploads, key);
export async function discard(key) { if (key) await unlink(photoPath(key)).catch(() => {}); }
export async function preparePhoto(file, crop) {
  if (!file) throw new ApiError(400, 'INVALID_PHOTO', { photo: 'INVALID_PHOTO' });
  if (!crop || !['x', 'y', 'zoom'].every(key => typeof crop[key] === 'number' && Number.isFinite(crop[key])) || crop.x < 0 || crop.x > 1 || crop.y < 0 || crop.y > 1 || crop.zoom < 1 || crop.zoom > 3) throw new ApiError(400, 'INVALID_CROP', { photo: 'INVALID_CROP' });
  let bytes;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 25000000, failOn: 'warning', animated: true });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new ApiError(415, 'PHOTO_FORMAT', { photo: 'PHOTO_FORMAT' });
    if ((metadata.pages || 1) !== 1 || metadata.width > 8192 || metadata.height > 8192) throw new ApiError(400, 'PHOTO_DIMENSIONS', { photo: 'PHOTO_DIMENSIONS' });
    const { data, info } = await image.rotate().toBuffer({ resolveWithObject: true });
    const size = Math.max(1, Math.floor(Math.min(info.width, info.height) / crop.zoom));
    bytes = await sharp(data).extract({ left: Math.round((info.width - size) * crop.x), top: Math.round((info.height - size) * crop.y), width: size, height: size }).resize({ width: 768, height: 768, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'PHOTO_DAMAGED', { photo: 'PHOTO_DAMAGED' });
  }
  await mkdir(uploads, { recursive: true });
  const key = `${randomUUID()}.webp`;
  await writeFile(photoPath(key), bytes, { flag: 'wx' });
  return key;
}
// Grace period protects files prepared by an in-flight transaction or another worker.
export async function cleanup() {
  const db = database();
  const cutoff = new Date(Date.now() - 3600000);
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const files = await readdir(uploads).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  for (const file of files) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(file)) continue;
    const info = await stat(photoPath(file)).catch(() => null);
    if (info && info.mtime < cutoff && !await db.pet.findUnique({ where: { photoKey: file }, select: { id: true } })) await discard(file);
  }
}
