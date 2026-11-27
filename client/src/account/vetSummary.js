import { formatDate } from '../dateUtils.js';
import { localDay } from './careOverview.js';

export function vetSummary({ records, weights, start, end, language, t }) {
  const date = value => formatDate(localDay(value), language, { year: 'numeric', month: 'long', day: 'numeric' });
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 3 });
  const kg = value => number.format(value) + ' ' + t('care.kg');
  const inRange = row => !row.deletedAt && (!start || row.date >= start) && (!end || row.date <= end);
  const history = records.filter(inRange).sort((a, b) => b.date.localeCompare(a.date));
  const measurements = weights.filter(inRange).sort((a, b) => a.date.localeCompare(b.date)
    || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const sections = ['vaccine', 'visit'].map(kind => ({
    title: t('vet.' + kind),
    entries: history.filter(row => row.kind === kind).map(row => ({
      id: row.id, title: row.title,
      lines: [
        date(row.date) + ' · ' + t('medical.' + row.status),
        ...['clinic', 'vet'].filter(key => row[key]).map(key => t('medical.' + key) + ' · ' + row[key]),
        row.nextDate && t('medical.nextDate') + ' · ' + date(row.nextDate),
        row.notes
      ].filter(Boolean)
    }))
  }));
  let trend = t('vet.needTwo');
  if (measurements.length >= 2) {
    const first = measurements[0], last = measurements.at(-1);
    const change = Math.round((Number(last.kg) - Number(first.kg)) * 1000) / 1000;
    trend = t('vet.change', { first: kg(first.kg), last: kg(last.kg), change: (change > 0 ? '+' : '') + kg(change || 0) });
  }
  sections.push({
    title: t('care.weightTitle'), note: measurements.length ? trend : '',
    entries: measurements.reverse().map(row => ({
      id: row.id, title: date(row.date) + ' · ' + kg(row.kg), lines: row.notes ? [row.notes] : []
    }))
  });
  return { period: start && end ? date(start) + ' — ' + date(end) : t('vet.all'), start, end, sections };
}
