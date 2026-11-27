import { weeklySummary } from '../../../shared/weekly.js';
import { dayKey, localDay } from '../account/careOverview.js';

const fail = (code, fields) => { throw { code, ...(fields ? { fields } : {}) }; };
const dateValid = (value, max = '2100-12-31') => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= max && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const shift = (day, count) => { const date = localDay(day); date.setDate(date.getDate() + count); return dayKey(date); };
const text = (value, max, code, required = false) => { if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(code); return value.trim(); };
const within = (value, min, max, places) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < .000001;
const timeValid = value => typeof value === 'string' && (value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
const ordered = records => [...records].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.createdAt.localeCompare(b.createdAt));

async function cropPhoto(file, crop) {
  if (!(file instanceof Blob)) fail('INVALID_PHOTO', { photo: 'INVALID_PHOTO' });
  if (file.size > 5 * 1024 * 1024) fail('PHOTO_TOO_LARGE', { photo: 'PHOTO_TOO_LARGE' });
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) fail('PHOTO_FORMAT', { photo: 'PHOTO_FORMAT' });
  if (!crop || !['x', 'y', 'zoom'].every(key => Number.isFinite(crop[key])) || crop.x < 0 || crop.x > 1 || crop.y < 0 || crop.y > 1 || crop.zoom < 1 || crop.zoom > 3) fail('INVALID_CROP', { photo: 'INVALID_CROP' });
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const w = image.naturalWidth, h = image.naturalHeight;
    if (w > 8192 || h > 8192 || w * h > 25000000) fail('PHOTO_DIMENSIONS', { photo: 'PHOTO_DIMENSIONS' });
    const side = Math.max(1, Math.floor(Math.min(w, h) / crop.zoom));
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = Math.min(768, side);
    canvas.getContext('2d').drawImage(image, Math.round((w - side) * crop.x), Math.round((h - side) * crop.y), side, side, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .85));
    if (!blob) fail('PHOTO_DAMAGED');
    return URL.createObjectURL(blob);
  } catch (error) { if (error.code) throw error; fail('PHOTO_DAMAGED', { photo: 'PHOTO_DAMAGED' }); }
  finally { URL.revokeObjectURL(url); }
}

export function createDemoStore({ t, now = () => new Date() }) {
  let pets, tasks, routines, health, meals, weights, events, epoch = 0;
  const urls = new Set();
  function publicCopy(value) {
    if (Array.isArray(value)) return value.map(publicCopy);
    if (!value || typeof value !== 'object') return value;
    const result = Object.fromEntries(Object.entries(value).filter(([key]) => key !== '_labels').map(([key, item]) => [key, publicCopy(item)]));
    // Only untouched example text is translated. Form drafts snapshot the displayed
    // strings; saving a record makes its text visitor-owned, so it stays unchanged.
    for (const [key, label] of Object.entries(value._labels || {})) Object.defineProperty(result, key, { enumerable: true, configurable: true, get: () => t(label) });
    return result;
  }
  const timestamp = () => now().toISOString();
  const today = () => dayKey(now());
  const record = data => ({ id: crypto.randomUUID(), version: 1, createdAt: timestamp(), ...data });
  const revoke = url => { if (urls.delete(url)) URL.revokeObjectURL(url); };
  function seed() {
    const date = today();
    pets = new Map(['tommy', 'uma'].map((id, index) => [id, record({ id, _labels: { notes: 'sandbox.examplePet', ...(index ? {} : { breed: 'breeds.toyPoodle' }) }, name: index ? 'Ума' : 'Томми', species: index ? 'cat' : 'dog', breed: index ? '' : t('breeds.toyPoodle'), sex: 'unknown', birthDate: null, birthApproximate: false, features: '', allergies: '', notes: t('sandbox.examplePet'), photoUrl: `/images/${index ? 'uma' : 'poodle'}.jpg` })]));
    tasks = new Map(); routines = new Map(); health = new Map(); meals = new Map(); weights = new Map(); events = [];
    for (const [id, pet] of pets) {
      const routine = record({ _labels: { title: id === 'tommy' ? 'sandbox.walks' : 'tasks.freshWater' }, petId: id, title: t(id === 'tommy' ? 'sandbox.walks' : 'tasks.freshWater'), category: id === 'tommy' ? 'walk' : 'water', time: '', notes: '', targetCount: id === 'tommy' ? 3 : 1, weekdays: [0, 1, 2, 3, 4, 5, 6], startDay: shift(date, -6), stopDay: null }); routines.set(routine.id, routine);
      const routineTask = record({ _labels: routine._labels, petId: id, day: date, routineId: routine.id, title: routine.title, category: routine.category, time: '', notes: '', targetCount: routine.targetCount, completedCount: id === 'tommy' ? 1 : 0, completedAt: null, deletedAt: null }); tasks.set(routineTask.id, routineTask);
      for (const [key, category, time, complete] of [['breakfast', 'food', '08:00', true], ['brushing', 'care', '14:00', false], ['dinner', 'food', '19:00', false]]) {
        const task = record({ _labels: { title: `tasks.${key}` }, petId: id, day: date, routineId: null, title: t(`tasks.${key}`), category, time, notes: '', targetCount: 1, completedCount: complete ? 1 : 0, completedAt: complete ? timestamp() : null, deletedAt: null }); tasks.set(task.id, task);
      }
      const meal = record({ _labels: { title: 'tasks.breakfast' }, petId: id, day: date, title: t('tasks.breakfast'), kind: 'dry', time: '08:00', amount: id === 'tommy' ? 50 : 40, unit: 'g', notes: '', deletedAt: null }); meals.set(meal.id, meal);
      for (const [kind, status, offset, key] of [['visit', 'planned', 1, 'events.vet'], ['vaccine', 'completed', -30, 'sandbox.vaccine']]) {
        const item = record({ _labels: { title: key, notes: 'sandbox.exampleRecord' }, petId: id, kind, status, title: t(key), date: shift(date, offset), nextDate: null, clinic: '', vet: '', notes: t('sandbox.exampleRecord'), deletedAt: null }); health.set(item.id, item);
      }
      for (let offset = -6; offset < 0; offset++) {
        const day = shift(date, offset), count = (id === 'tommy' ? [3, 2, 3, 1, 3, 3] : [1, 1, 0, 1, 1, 1])[offset + 6];
        const task = record({ _labels: routine._labels, petId: id, day, routineId: routine.id, title: routine.title, category: routine.category, time: '', notes: '', targetCount: routine.targetCount, completedCount: count, completedAt: count === routine.targetCount ? day + 'T12:00:00Z' : null, deletedAt: null }); tasks.set(task.id, task);
        const meal = record({ _labels: { title: 'tasks.breakfast' }, petId: id, day, title: t('tasks.breakfast'), kind: 'dry', time: '08:00', amount: id === 'tommy' ? 50 : 40, unit: 'g', notes: '', deletedAt: null }); meals.set(meal.id, meal);
      }
      [-28, -6, 0].forEach((offset, index) => { const item = record({ petId: id, date: shift(date, offset), kg: Number(((pet.species === 'dog' ? 3.4 : 4.2) + index * .1).toFixed(3)), notes: '', deletedAt: null }); weights.set(item.id, item); });
    }
  }
  function reset() { epoch++; for (const url of [...urls]) revoke(url); seed(); }
  function live(map, petId) { return [...map.values()].filter(item => item.petId === petId && !item.deletedAt); }
  function owned(map, id, petId, code) { const item = map.get(id); if (!item || item.petId !== petId || item.deletedAt) fail(code); return item; }
  function version(item, body, code) { if (!Number.isInteger(body?.version) || body.version < 1) fail('INVALID_INPUT'); if (body.version !== item.version) fail(code); }
  function create(map, data, petId, code) {
    if (typeof data.id !== 'string' || !data.id) fail('INVALID_INPUT');
    const existing = map.get(data.id);
    if (existing) { if (existing.petId !== petId || existing.deletedAt || Object.entries(data).some(([key, value]) => JSON.stringify(existing[key]) !== JSON.stringify(value))) fail(code); return existing; }
    const item = record({ ...data, petId, deletedAt: null }); map.set(item.id, item); return item;
  }
  function event(task, action) { events.unshift({ _labels: task._labels?.title ? { title: task._labels.title } : undefined, id: crypto.randomUUID(), taskId: task.id, day: task.day, petId: task.petId, action, title: task.title, version: task.version, completedCount: task.completedCount, targetCount: task.targetCount, createdAt: timestamp() }); }
  function taskFields(body) {
    const title = text(body.title, 120, 'TASK_TITLE', true), notes = text(body.notes, 1000, 'TASK_NOTES');
    if (!['food', 'water', 'walk', 'care', 'other'].includes(body.category)) fail('TASK_CATEGORY');
    if (!timeValid(body.time)) fail('TASK_TIME');
    if (!Number.isInteger(body.targetCount) || body.targetCount < 1 || body.targetCount > 20) fail('TASK_TARGET');
    return { title, notes, category: body.category, time: body.time, targetCount: body.targetCount };
  }
  function journalFields(kind, body) {
    if (kind === 'weights') {
      if (!dateValid(body.date, today())) fail('WEIGHT_DATE');
      if (!within(body.kg, .001, 2000, 3)) fail('WEIGHT_VALUE');
      return { date: body.date, kg: body.kg, notes: text(body.notes, 1000, 'WEIGHT_NOTES') };
    }
    if (kind === 'health') {
      if (!['vaccine', 'visit'].includes(body.kind) || !['planned', 'completed'].includes(body.status)) fail('HEALTH_TYPE');
      if (!dateValid(body.date)) fail('HEALTH_DATE');
      if (body.status === 'completed' && body.date > today()) fail('HEALTH_FUTURE');
      if (body.nextDate && (!dateValid(body.nextDate) || body.nextDate <= body.date)) fail('HEALTH_NEXT_DATE');
      return { kind: body.kind, status: body.status, title: text(body.title, 120, 'HEALTH_TITLE', true), date: body.date, nextDate: body.nextDate || null, clinic: text(body.clinic, 160, 'HEALTH_TEXT'), vet: text(body.vet, 120, 'HEALTH_TEXT'), notes: text(body.notes, 4000, 'HEALTH_TEXT') };
    }
    if (!dateValid(body.day)) fail('MEAL_DATE'); if (body.day > today()) fail('MEAL_FUTURE');
    if (!['dry', 'wet', 'home', 'treat', 'other'].includes(body.kind)) fail('MEAL_KIND');
    if (!['g', 'ml', 'pcs'].includes(body.unit)) fail('MEAL_UNIT'); if (!timeValid(body.time)) fail('MEAL_TIME');
    if (body.amount !== null && !within(body.amount, .01, 100000, 2)) fail('MEAL_AMOUNT');
    return { day: body.day, title: text(body.title, 120, 'MEAL_TITLE', true), kind: body.kind, amount: body.amount, unit: body.unit, time: body.time, notes: text(body.notes, 2000, 'MEAL_NOTES') };
  }
  async function petSave(id, body) {
    let data; try { data = JSON.parse(body.get('data')); } catch { fail('INVALID_INPUT'); }
    const existing = id ? pets.get(id) : null; if (id && !existing) fail('PET_NOT_FOUND'); if (existing) version(existing, data, 'PET_CHANGED');
    const fields = {}, value = {};
    for (const [key, max] of Object.entries({ name: 80, breed: 120, features: 2000, allergies: 2000, notes: 4000 })) {
      if (typeof data[key] !== 'string' || data[key].trim().length > max || (key === 'name' && !data[key].trim())) fields[key] = key === 'name' ? 'NAME_REQUIRED' : 'TEXT_TOO_LONG'; else value[key] = data[key].trim();
    }
    if (!['cat', 'dog', 'bird', 'rabbit', 'rodent', 'fish', 'reptile', 'other'].includes(data.species)) fields.species = 'SPECIES_REQUIRED';
    if (!['unknown', 'female', 'male'].includes(data.sex)) fields.sex = 'INVALID_INPUT';
    if (data.birthDate && !dateValid(data.birthDate, today())) fields.birthDate = 'INVALID_BIRTH_DATE';
    if (!['keep', 'remove', 'replace'].includes(data.photoAction)) fields.photo = 'INVALID_PHOTO';
    if (Object.keys(fields).length) fail('VALIDATION_ERROR', fields);
    const currentEpoch = epoch;
    let photoUrl = existing?.photoUrl || null;
    if (data.photoAction === 'remove') photoUrl = null;
    if (data.photoAction === 'replace') photoUrl = await cropPhoto(body.get('photo'), data.crop);
    if (epoch !== currentEpoch || (existing && pets.get(id) !== existing)) { if (photoUrl !== existing?.photoUrl && photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl); fail('PET_CHANGED'); }
    if (photoUrl?.startsWith('blob:')) urls.add(photoUrl);
    const pet = record({ ...value, id: id || crypto.randomUUID(), species: data.species, sex: data.sex, birthDate: data.birthDate || null, birthApproximate: Boolean(data.birthDate && data.birthApproximate), photoUrl, version: (existing?.version || 0) + 1 });
    pets.set(pet.id, pet); if (existing?.photoUrl !== photoUrl) revoke(existing?.photoUrl);
    return { pet };
  }
  async function dispatch(path, { method = 'GET', body } = {}) {
    const url = new URL(path, 'https://demo.invalid'), parts = url.pathname.split('/').filter(Boolean);
    if (url.origin !== 'https://demo.invalid') fail('API_NOT_FOUND');
    if (url.pathname === '/auth/session' && method === 'GET') return { user: { id: 'demo-visitor', email: '' } };
    if (parts[0] !== 'pets') fail('API_NOT_FOUND');
    if (parts.length === 1) { if (method === 'GET') return { pets: [...pets.values()] }; if (method === 'POST') return petSave(null, body); fail('API_NOT_FOUND'); }
    const petId = parts[1]; if (!pets.has(petId)) fail('PET_NOT_FOUND');
    if (parts.length === 2) {
      if (method === 'PUT') return petSave(petId, body);
      if (method === 'DELETE') { version(pets.get(petId), body, 'PET_CHANGED'); revoke(pets.get(petId).photoUrl); pets.delete(petId); for (const map of [tasks, routines, health, meals, weights]) for (const [key, item] of map) if (item.petId === petId) map.delete(key); events = events.filter(e => e.petId !== petId); return null; }
      fail('API_NOT_FOUND');
    }
    const kind = parts[2], id = parts[3];
    if (parts.length === 5 && parts[4] === 'restore' && method === 'POST') {
      const collection = { tasks, meals, health, weights }[kind];
      const prefix = { tasks: 'TASK', meals: 'MEAL', health: 'HEALTH', weights: 'WEIGHT' }[kind];
      if (!prefix) fail('API_NOT_FOUND');
      const expected = body?.version;
      if (!Number.isSafeInteger(expected) || expected < 2 || expected >= 2147483647) fail('INVALID_INPUT');
      const item = collection.get(id);
      if (!item || item.petId !== petId) fail(prefix + '_NOT_FOUND');
      if (!item.deletedAt && item.version === expected + 1) return null;
      if (!item.deletedAt || item.version !== expected) fail(prefix + '_CHANGED');
      const stop = kind === 'tasks' && routines.get(item.routineId)?.stopDay;
      if (stop && item.day >= stop) fail('TASK_CHANGED');
      item.deletedAt = null;
      item.version++;
      if (kind === 'tasks') event(item, 'restored');
      return null;
    }
    if (kind === 'tasks' && id === 'weekly' && method === 'GET') {
      const end = url.searchParams.get('end');
      if (!dateValid(end, today()) || end < '1900-01-07') fail('TASK_DATE');
      const forPet = map => [...map.values()].filter(item => item.petId === petId);
      return weeklySummary({ end, tasks: forPet(tasks), routines: forPet(routines), meals: forPet(meals), weights: forPet(weights) });
    }
    if (kind === 'tasks') {
      if (!id && method === 'GET') {
        const day = url.searchParams.get('date'); if (!dateValid(day)) fail('TASK_DATE');
        for (const routine of routines.values()) {
          if (routine.petId !== petId || day < routine.startDay || (routine.stopDay && day >= routine.stopDay) || !routine.weekdays.includes(localDay(day).getDay())) continue;
          if ([...tasks.values()].some(task => task.routineId === routine.id && task.day === day)) continue;
          const task = record({ ...taskFields(routine), _labels: routine._labels, petId, day, routineId: routine.id, completedCount: 0, completedAt: null, deletedAt: null }); tasks.set(task.id, task);
        }
        return { tasks: ordered(live(tasks, petId).filter(task => task.day === day)), events: events.filter(e => e.petId === petId && e.day === day).slice(0, 100), routines: [...routines.values()].filter(r => r.petId === petId && !r.stopDay) };
      }
      if (id === 'routines') {
        if (parts.length === 4 && method === 'POST') {
          const value = taskFields(body); if (!dateValid(body.day)) fail('TASK_DATE');
          if (!Array.isArray(body.weekdays) || !body.weekdays.length || body.weekdays.some(n => !Number.isInteger(n) || n < 0 || n > 6) || new Set(body.weekdays).size !== body.weekdays.length) fail('TASK_WEEKDAYS');
          return { id: create(routines, { ...value, id: body.id, weekdays: [...body.weekdays].sort(), startDay: body.day, stopDay: null }, petId, 'TASK_CHANGED').id };
        }
        if (parts[5] === 'stop' && method === 'POST') {
          const routine = owned(routines, parts[4], petId, 'TASK_NOT_FOUND'); if (routine.stopDay) return { stopped: true }; routine.stopDay = shift(today(), 1);
          for (const task of tasks.values()) if (task.routineId === routine.id && task.day >= routine.stopDay && !task.completedCount && !task.deletedAt) { task.deletedAt = timestamp(); task.version++; event(task, 'deleted'); }
          return { stopped: true };
        }
        fail('API_NOT_FOUND');
      }
      if (!id && method === 'POST') {
        const value = taskFields(body); if (!dateValid(body.day)) fail('TASK_DATE'); const existed = tasks.has(body.id);
        const loggedWalk = body.logCompletedWalk === true;
        if (loggedWalk && (value.category !== 'walk' || value.targetCount !== 1)) fail('INVALID_INPUT');
        if (loggedWalk && body.day > today()) fail('TASK_FUTURE');
        const task = create(tasks, { ...value, id: body.id, day: body.day, routineId: null, completedCount: loggedWalk ? 1 : 0, completedAt: loggedWalk ? tasks.get(body.id)?.completedAt || timestamp() : null }, petId, 'TASK_CHANGED');
        if (!existed) event(task, loggedWalk ? 'completed' : 'created');
        return { task };
      }
      const task = owned(tasks, id, petId, 'TASK_NOT_FOUND'); version(task, body, 'TASK_CHANGED'); let action;
      if (method === 'PATCH' && ['count', 'state'].includes(parts[4])) {
        if (parts[4] === 'state' && (task.targetCount !== 1 || typeof body.completed !== 'boolean')) fail('INVALID_INPUT');
        if (parts[4] === 'count' && ![1, -1].includes(body.delta)) fail('INVALID_INPUT');
        const count = parts[4] === 'state' ? Number(body.completed) : task.completedCount + body.delta;
        if (count < 0 || count > task.targetCount) fail('TASK_COUNT'); if (count > task.completedCount && task.day > today()) fail('TASK_FUTURE');
        if (count === task.completedCount) return { task };
        action = parts[4] === 'state' ? (count ? 'completed' : 'reopened') : count > task.completedCount ? 'progressed' : 'reduced'; task.completedCount = count; task.completedAt = count === task.targetCount ? timestamp() : null;
      } else if (method === 'DELETE') { task.deletedAt = timestamp(); action = 'deleted'; }
      else if (method === 'PUT') { const value = taskFields(body); if (value.targetCount < task.completedCount) fail('TASK_TARGET_BELOW_COUNT'); Object.assign(task, value); delete task._labels; task.completedAt = task.targetCount === task.completedCount ? task.completedAt || timestamp() : null; action = 'edited'; }
      else fail('API_NOT_FOUND');
      task.version++; event(task, action); return { task };
    }
    const map = { health, meals, weights }[kind], prefix = { health: 'HEALTH', meals: 'MEAL', weights: 'WEIGHT' }[kind];
    if (!map) fail('API_NOT_FOUND');
    if (method === 'GET' && !id) {
      let records = live(map, petId);
      if (kind === 'meals') { const day = url.searchParams.get('date'); if (!dateValid(day)) fail('MEAL_DATE'); return { meals: ordered(records.filter(r => r.day === day)) }; }
      records.sort((a, b) => (kind === 'weights' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); return { records };
    }
    let item;
    if (method === 'POST' && !id) item = create(map, { ...journalFields(kind, body), id: body.id }, petId, `${prefix}_CHANGED`);
    else {
      item = owned(map, id, petId, `${prefix}_NOT_FOUND`); version(item, body, `${prefix}_CHANGED`);
      if (method === 'DELETE') { item.deletedAt = timestamp(); item.version++; return null; }
      if (method !== 'PUT') fail('API_NOT_FOUND');
      item = { ...item, ...journalFields(kind, body), version: item.version + 1 }; delete item._labels; map.set(item.id, item);
    }
    return { [kind === 'meals' ? 'meal' : 'record']: item };
  }
  seed();
  return { request: async (...args) => publicCopy(await dispatch(...args)), reset, dispose: () => { epoch++; for (const url of [...urls]) revoke(url); } };
}
