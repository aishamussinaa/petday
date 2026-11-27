import { addRestoreRoute } from './restore.js';
import { Router } from 'express';
import { database } from './db.js';
import { session, requireUser, csrf } from './auth.js';
import { ApiError, validDate, todayInZone } from './validation.js';

export const weights = Router({ mergeParams: true });
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const serialize = record => ({ ...record, kg: Number(record.kg), date: record.date.toISOString().slice(0, 10) });
function fields(body) {
  if (!body || !validDate(body.date, todayInZone(body.timeZone))) throw new ApiError(400, 'WEIGHT_DATE');
  if (typeof body.kg !== 'number' || !Number.isFinite(body.kg) || body.kg < .001 || body.kg > 2000 || Math.abs(body.kg * 1000 - Math.round(body.kg * 1000)) > .000001) throw new ApiError(400, 'WEIGHT_VALUE');
  if (typeof body.notes !== 'string' || body.notes.trim().length > 1000) throw new ApiError(400, 'WEIGHT_NOTES');
  return { date: new Date(`${body.date}T00:00:00Z`), kg: body.kg, notes: body.notes.trim() };
}
weights.use(session, requireUser, async (req, _res, next) => {
  if (!uuid(req.params.petId) || !await database().pet.findFirst({ where: { id: req.params.petId, userId: req.session.user.id }, select: { id: true } })) throw new ApiError(404, 'PET_NOT_FOUND');
  next();
});
weights.get('/', async (req, res) => {
  const records = await database().weightRecord.findMany({ where: { petId: req.params.petId, deletedAt: null }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
  res.json({ records: records.map(serialize) });
});
weights.post('/', csrf, async (req, res) => {
  const data = fields(req.body);
  if (!uuid(req.body.id)) throw new ApiError(400, 'INVALID_INPUT');
  try {
    const record = await database().weightRecord.create({ data: { ...data, id: req.body.id, petId: req.params.petId } });
    res.status(201).json({ record: serialize(record) });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const record = await database().weightRecord.findFirst({ where: { id: req.body.id, petId: req.params.petId, deletedAt: null } });
    if (!record || record.date.getTime() !== data.date.getTime() || Number(record.kg) !== data.kg || record.notes !== data.notes) throw new ApiError(409, 'WEIGHT_CHANGED');
    res.json({ record: serialize(record) });
  }
});
async function mutate(req, res, remove) {
  if (!uuid(req.params.id)) throw new ApiError(404, 'WEIGHT_NOT_FOUND');
  if (!Number.isInteger(req.body?.version) || req.body.version < 1) throw new ApiError(400, 'INVALID_INPUT');
  const data = remove ? { deletedAt: new Date() } : fields(req.body);
  const record = await database().$transaction(async tx => {
    const where = { id: req.params.id, petId: req.params.petId, deletedAt: null };
    if (!await tx.weightRecord.findFirst({ where })) throw new ApiError(404, 'WEIGHT_NOT_FOUND');
    const changed = await tx.weightRecord.updateMany({ where: { ...where, version: req.body.version }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ApiError(409, 'WEIGHT_CHANGED');
    return tx.weightRecord.findUnique({ where: { id: req.params.id } });
  });
  if (remove) return res.status(204).end();
  res.json({ record: serialize(record) });
}
weights.put('/:id', csrf, (req, res) => mutate(req, res, false));
weights.delete('/:id', csrf, (req, res) => mutate(req, res, true));
addRestoreRoute(weights, 'weightRecord', 'WEIGHT');
