import { dayKey } from '../account/careOverview.js';
const weights = new Map();
export function demoHealth(pet, t) {
  return [
    { id: `${pet.id}-visit`, kind: 'visit', status: 'planned', title: t('events.vet'), date: dayKey(pet.vetDate), nextDate: null, clinic: '', vet: '', notes: t('demoEvents') },
    { id: `${pet.id}-past`, kind: 'visit', status: 'completed', title: t('previousVisit'), date: dayKey(pet.visitDate), nextDate: null, clinic: '', vet: '', notes: t('demoEvents') },
  ];
}
export function demoCareTransport(pet, t) {
  if (!weights.has(pet.id)) {
    const now = new Date(), value = pet.id === 'tommy' ? 3.4 : 4.2;
    weights.set(pet.id, [-28, -14, 0].map((offset, index) => { const date = new Date(now); date.setDate(date.getDate() + offset); return { id: `${pet.id}-weight-${index}`, date: dayKey(date), kg: Number((value + index * .1).toFixed(3)), notes: '', createdAt: date.toISOString(), version: 1 }; }));
  }
  return async (path, { method = 'GET', body } = {}) => {
    if (path.endsWith('/health')) return { records: demoHealth(pet, t) };
    let records = weights.get(pet.id);
    if (method === 'GET') return { records: [...records].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)) };
    if (method === 'DELETE') { weights.set(pet.id, records.filter(record => record.id !== path.split('/').at(-1))); return null; }
    if (!Number.isFinite(body.kg) || body.kg <= 0 || body.kg > 2000) throw { code: 'WEIGHT_VALUE' };
    if (!body.date || body.date > dayKey()) throw { code: 'WEIGHT_DATE' };
    const record = { ...body, version: (body.version || 0) + 1, createdAt: body.createdAt || new Date().toISOString() };
    weights.set(pet.id, [...records.filter(item => item.id !== record.id), record]);
    return { record };
  };
}
