import { Router } from 'express';
import { database } from './db.js';
import { session, requireUser, csrf } from './auth.js';
import { ApiError, validatePet } from './validation.js';
import { multipart, preparePhoto, discard, photoPath } from './photos.js';

export const pets = Router();
pets.use(session, requireUser);
const publicPet = ({ userId, photoKey, ...pet }) => ({ ...pet, birthDate: pet.birthDate?.toISOString().slice(0, 10) || null, photoUrl: photoKey ? `/api/pets/${pet.id}/photo?v=${pet.version}` : null });
async function owned(req) {
  if (!/^[a-f0-9-]{36}$/i.test(req.params.id || '')) throw new ApiError(404, 'PET_NOT_FOUND');
  const pet = await database().pet.findFirst({ where: { id: req.params.id, userId: req.session.user.id } });
  if (!pet) throw new ApiError(404, 'PET_NOT_FOUND');
  return pet;
}
pets.get('/', async (req, res) => res.json({ pets: (await database().pet.findMany({ where: { userId: req.session.user.id }, orderBy: { createdAt: 'asc' } })).map(publicPet) }));
pets.get('/:id', async (req, res) => res.json({ pet: publicPet(await owned(req)) }));
pets.get('/:id/photo', async (req, res, next) => {
  const pet = await owned(req);
  if (!pet.photoKey) throw new ApiError(404, 'PHOTO_NOT_FOUND');
  res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' });
  res.sendFile(photoPath(pet.photoKey), error => { if (error) next(new ApiError(404, 'PHOTO_NOT_FOUND')); });
});
async function save(req, res) {
  const previous = req.params.id ? await owned(req) : null;
  let input;
  try { input = JSON.parse(req.body.data); } catch { throw new ApiError(400, 'INVALID_INPUT'); }
  const data = validatePet(input);
  if (previous && (!Number.isInteger(input.version) || input.version !== previous.version)) throw new ApiError(409, 'PET_CHANGED');
  if ((input.photoAction === 'replace') !== Boolean(req.file)) throw new ApiError(400, 'INVALID_PHOTO', { photo: 'INVALID_PHOTO' });
  let newPhoto;
  try {
    if (req.file) newPhoto = await preparePhoto(req.file, input.crop);
    const photoKey = newPhoto || (input.photoAction === 'remove' ? null : previous?.photoKey || null);
    const pet = await database().$transaction(async tx => {
      if (!previous) return tx.pet.create({ data: { ...data, photoKey, userId: req.session.user.id } });
      const result = await tx.pet.updateMany({ where: { id: previous.id, userId: req.session.user.id, version: input.version }, data: { ...data, photoKey, version: { increment: 1 } } });
      if (result.count !== 1) throw new ApiError(409, 'PET_CHANGED');
      return tx.pet.findUnique({ where: { id: previous.id } });
    });
    if (previous?.photoKey && previous.photoKey !== pet.photoKey) await discard(previous.photoKey);
    res.status(previous ? 200 : 201).json({ pet: publicPet(pet) });
  } catch (error) { await discard(newPhoto); throw error; }
}
pets.post('/', csrf, multipart, save);
pets.put('/:id', csrf, async (req, _res, next) => { await owned(req); next(); }, multipart, save);
pets.delete('/:id', csrf, async (req, res) => {
  const pet = await owned(req);
  if (req.body?.version !== pet.version) throw new ApiError(409, 'PET_CHANGED');
  const result = await database().pet.deleteMany({ where: { id: pet.id, userId: req.session.user.id, version: pet.version } });
  if (result.count !== 1) throw new ApiError(409, 'PET_CHANGED');
  await discard(pet.photoKey);
  res.status(204).end();
});
