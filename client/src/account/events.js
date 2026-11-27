import { nextBirthday } from '../dateUtils.js';
import { dayKey, localDay } from './careOverview.js';

export function monthEvents(month, pets, journals) {
  const events = [];
  const first = localDay(month + '-01');
  for (const pet of pets) {
    if (pet.birthDate) {
      const birthday = dayKey(nextBirthday(localDay(pet.birthDate), first));
      if (birthday.startsWith(month) && birthday >= pet.birthDate) {
        events.push({ key: pet.id + '-birthday', date: birthday, kind: 'birthday', pet });
      }
    }
    for (const record of journals[pet.id] || []) {
      for (const field of ['date', 'nextDate']) {
        const date = record[field];
        if (date?.startsWith(month)) events.push({
          key: record.id + '-' + field, date, kind: record.kind, pet, record, followUp: field === 'nextDate',
        });
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.pet.name.localeCompare(b.pet.name) || a.key.localeCompare(b.key));
}
