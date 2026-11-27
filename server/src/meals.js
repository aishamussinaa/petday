import { addRestoreRoute } from './restore.js';
import { Router } from 'express';
import { database } from './db.js';
import { session, requireUser, csrf } from './auth.js';
import { ApiError, validDate, todayInZone } from './validation.js';

export const meals = Router({ mergeParams: true });
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const serialize = meal => ({ ...meal, day: meal.day.toISOString().slice(0, 10), amount: meal.amount === null ? null : Number(meal.amount) });
function parseDay(value) {
  if (!validDate(value, '2100-12-31')) throw new ApiError(400, 'MEAL_DATE');
  return new Date(`${value}T00:00:00Z`);
}
function fields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'INVALID_INPUT');
  const day = parseDay(body.day);
  if (body.day > todayInZone(body.timeZone)) throw new ApiError(400, 'MEAL_FUTURE');
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) throw new ApiError(400, 'MEAL_TITLE');
  if (!['dry', 'wet', 'home', 'treat', 'other'].includes(body.kind)) throw new ApiError(400, 'MEAL_KIND');
  if (!['g', 'ml', 'pcs'].includes(body.unit)) throw new ApiError(400, 'MEAL_UNIT');
  if (typeof body.time !== 'string' || (body.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))) throw new ApiError(400, 'MEAL_TIME');
  if (typeof body.notes !== 'string' || body.notes.trim().length > 2000) throw new ApiError(400, 'MEAL_NOTES');
  if (body.amount !== null && (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 100000 || Math.abs(body.amount * 100 - Math.round(body.amount * 100)) > 0.00001)) throw new ApiError(400, 'MEAL_AMOUNT');
  return { title: body.title.trim(), day, kind: body.kind, time: body.time, amount: body.amount === null ? null : Math.round(body.amount * 100) / 100, unit: body.unit, notes: body.notes.trim() };
}
meals.use(session, requireUser, async (req, _res, next) => {
  if (!uuid(req.params.petId) || !await database().pet.findFirst({ where: { id: req.params.petId, userId: req.session.user.id }, select: { id: true } })) throw new ApiError(404, 'PET_NOT_FOUND');
  next();
});
meals.get('/', async (req, res) => {
  const records = await database().meal.findMany({ where: { petId: req.params.petId, day: parseDay(req.query.date), deletedAt: null }, orderBy: [{ time: 'asc' }, { createdAt: 'asc' }] });
  records.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  res.json({ meals: records.map(serialize) });
});
meals.post('/', csrf, async (req, res) => {
  const data = fields(req.body);
  if (!uuid(req.body.id)) throw new ApiError(400, 'INVALID_INPUT');
  try {
    const meal = await database().meal.create({ data: { ...data, id: req.body.id, petId: req.params.petId } });
    res.status(201).json({ meal: serialize(meal) });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const existing = await database().meal.findFirst({ where: { id: req.body.id, petId: req.params.petId, deletedAt: null } });
    const saved = existing && serialize(existing);
    if (!saved || Object.entries(data).some(([key, value]) => key === 'day' ? saved.day !== value.toISOString().slice(0, 10) : saved[key] !== value)) throw new ApiError(409, 'MEAL_CHANGED');
    res.json({ meal: saved });
  }
});
async function mutate(req, res, remove) {
  if (!uuid(req.params.id)) throw new ApiError(404, 'MEAL_NOT_FOUND');
  if (!Number.isInteger(req.body?.version) || req.body.version < 1) throw new ApiError(400, 'INVALID_INPUT');
  const data = remove ? { deletedAt: new Date() } : fields(req.body);
  const meal = await database().$transaction(async tx => {
    const where = { id: req.params.id, petId: req.params.petId, deletedAt: null };
    if (!await tx.meal.findFirst({ where, select: { id: true } })) throw new ApiError(404, 'MEAL_NOT_FOUND');
    const changed = await tx.meal.updateMany({ where: { ...where, version: req.body.version }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ApiError(409, 'MEAL_CHANGED');
    return tx.meal.findUnique({ where: { id: req.params.id } });
  });
  if (remove) return res.status(204).end();
  res.json({ meal: serialize(meal) });
}
meals.put('/:id', csrf, (req, res) => mutate(req, res, false));
meals.delete('/:id', csrf, (req, res) => mutate(req, res, true));
addRestoreRoute(meals, 'meal', 'MEAL');
