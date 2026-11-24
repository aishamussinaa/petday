export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const localDay = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export function calendarDistance(from, to) {
  const utc = key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((utc(to) - utc(from)) / 86400000);
}
export function healthReminders(records, date) {
  return records.flatMap(record => [
    ...(record.status === 'planned' ? [{ ...record, key: `${record.id}:plan`, due: record.date, followUp: false }] : []),
    ...(record.nextDate ? [{ ...record, key: `${record.id}:next`, due: record.nextDate, followUp: true }] : []),
  ]).map(record => ({ ...record, days: calendarDistance(date, record.due) })).filter(record => record.days <= 7).sort((a, b) => a.due.localeCompare(b.due));
}
