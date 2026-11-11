import { Router } from 'express';
import { database } from './db.js';
import { session, requireUser, csrf } from './auth.js';
import { ApiError, validDate, todayInZone } from './validation.js';

export const health = Router({ mergeParams: true });
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const calendarDate = value => value ? new Date(`${value}T00:00:00Z`) : null;
const serialize = record => ({ ...record, date: record.date.toISOString().slice(0, 10), nextDate: record.nextDate?.toISOString().slice(0, 10) || null });

function fields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'INVALID_INPUT');
  if (!['vaccine', 'visit'].includes(body.kind) || !['planned', 'completed'].includes(body.status)) throw new ApiError(400, 'HEALTH_TYPE');
  if (!validDate(body.date, '2100-12-31')) throw new ApiError(400, 'HEALTH_DATE');
  if (body.status === 'completed' && body.date > todayInZone(body.timeZone)) throw new ApiError(400, 'HEALTH_FUTURE');
  if (body.nextDate !== null && body.nextDate !== '' && (!validDate(body.nextDate, '2100-12-31') || body.nextDate <= body.date)) throw new ApiError(400, 'HEALTH_NEXT_DATE');
  const data = { kind: body.kind, status: body.status, date: calendarDate(body.date), nextDate: calendarDate(body.nextDate) };
  for (const [key, max] of Object.entries({ title: 120, clinic: 160, vet: 120, notes: 4000 })) {
    if (typeof body[key] !== 'string' || body[key].trim().length > max || (key === 'title' && !body[key].trim())) throw new ApiError(400, key === 'title' ? 'HEALTH_TITLE' : 'HEALTH_TEXT');
    data[key] = body[key].trim();
  }
  return data;
}

health.use(session, requireUser, async (req, _res, next) => {
  if (!uuid(req.params.petId) || !await database().pet.findFirst({ where: { id: req.params.petId, userId: req.session.user.id }, select: { id: true } })) throw new ApiError(404, 'PET_NOT_FOUND');
  next();
});
health.get('/', async (req, res) => {
  const records = await database().healthRecord.findMany({ where: { petId: req.params.petId, deletedAt: null }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
  res.json({ records: records.map(serialize) });
});
health.post('/', csrf, async (req, res) => {
  const data = fields(req.body);
  if (!uuid(req.body.id)) throw new ApiError(400, 'INVALID_INPUT');
  try {
    const record = await database().healthRecord.create({ data: { ...data, id: req.body.id, petId: req.params.petId } });
    res.status(201).json({ record: serialize(record) });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    // A stable client ID makes retrying a lost create response safe.
    const existing = await database().healthRecord.findFirst({ where: { id: req.body.id, petId: req.params.petId, deletedAt: null } });
    if (!existing || Object.entries(data).some(([key, value]) => value instanceof Date ? existing[key]?.getTime() !== value.getTime() : existing[key] !== value)) throw new ApiError(409, 'HEALTH_CHANGED');
    res.json({ record: serialize(existing) });
  }
});
async function mutate(req, res, remove) {
  if (!uuid(req.params.id)) throw new ApiError(404, 'HEALTH_NOT_FOUND');
  if (!Number.isInteger(req.body?.version) || req.body.version < 1) throw new ApiError(400, 'INVALID_INPUT');
  const data = remove ? { deletedAt: new Date() } : fields(req.body);
  const record = await database().$transaction(async tx => {
    const where = { id: req.params.id, petId: req.params.petId, deletedAt: null };
    if (!await tx.healthRecord.findFirst({ where, select: { id: true } })) throw new ApiError(404, 'HEALTH_NOT_FOUND');
    const result = await tx.healthRecord.updateMany({ where: { ...where, version: req.body.version }, data: { ...data, version: { increment: 1 } } });
    if (result.count !== 1) throw new ApiError(409, 'HEALTH_CHANGED');
    return tx.healthRecord.findUnique({ where: { id: req.params.id } });
  });
  if (remove) return res.status(204).end();
  res.json({ record: serialize(record) });
}
health.put('/:id', csrf, (req, res) => mutate(req, res, false));
health.delete('/:id', csrf, (req, res) => mutate(req, res, true));
