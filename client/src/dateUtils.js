import kazakh from './locales/kk.json' with { type: 'json' };

// Local noon represents calendar dates. UTC day numbers avoid DST drift.
export const dateOnly = date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
export const addDays = (date, count) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count, 12);
export const dayDistance = (from, to) => Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
function anniversary(birth, year) {
  const lastDay = new Date(year, birth.getMonth() + 1, 0).getDate();
  return new Date(year, birth.getMonth(), Math.min(birth.getDate(), lastDay), 12);
}
export function nextBirthday(birth, today) {
  const next = anniversary(birth, today.getFullYear());
  return dayDistance(today, next) < 0 ? anniversary(birth, today.getFullYear() + 1) : next;
}
export function calendarAge(birth, today) {
  let years = today.getFullYear() - birth.getFullYear();
  if (anniversary(birth, today.getFullYear()) > dateOnly(today)) years--;
  let cursor = anniversary(birth, birth.getFullYear() + years);
  let months = 0;
  for (let count = 1; count < 12; count++) {
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + count + 1, 0).getDate();
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + count, Math.min(cursor.getDate(), last), 12);
    if (next > dateOnly(today)) break;
    months = count;
  }
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + months + 1, 0).getDate();
  cursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, Math.min(cursor.getDate(), last), 12);
  return { years, months, days: dayDistance(cursor, today) };
}
export function formatAge(birth, today, locale, full = false) {
  const age = calendarAge(birth, today);
  const parts = [['year', age.years], ['month', age.months], ['day', age.days]].filter(([, count]) => count > 0).slice(0, full ? 3 : 2).map(([unit, count]) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(count));
  return parts.length ? new Intl.ListFormat(locale, { style: 'short', type: 'unit' }).format(parts) : new Intl.NumberFormat(locale, { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(0);
}
export function formatDate(date, locale, options = { day: 'numeric', month: 'long' }) {
  // Some Chromium builds report support for kk but return "M10" and "Thu".
  // Keep written Kazakh dates consistent with the interface translations.
  if (locale.startsWith('kk') && ['long', 'short'].includes(options.month)) {
    const calendar = kazakh.calendar;
    const parts = [];
    if (options.year) parts.push(`${date.getFullYear()} ${calendar.yearSuffix}`);
    if (options.day) parts.push(String(date.getDate()).padStart(options.day === '2-digit' ? 2 : 1, '0'));
    parts.push(calendar.months[date.getMonth()]);
    const result = parts.join(' ');
    return options.weekday ? `${result}, ${calendar.weekdays[date.getDay()]}` : result;
  }
  return new Intl.DateTimeFormat(locale, options).format(date);
}
export function formatTime(time, locale) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(2020, 0, 1, hours, minutes));
}
