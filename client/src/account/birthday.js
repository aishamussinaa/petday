import { dateOnly, dayDistance, nextBirthday } from '../dateUtils.js';

export function birthdayWindow(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  const birth = new Date(year, month - 1, day, 12);
  if (!Number.isFinite(birth.getTime()) || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null;
  const today = dateOnly(now);
  if (birth > today) return null;
  const birthday = nextBirthday(birth, today);
  const days = dayDistance(today, birthday);
  return days <= 7 ? { days, birthday, key: `${birthday.getFullYear()}-${birthday.getMonth() + 1}-${birthday.getDate()}` } : null;
}
