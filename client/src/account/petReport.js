import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { dayKey, localDay } from './careOverview.js';
import { formatDate } from '../dateUtils.js';

export async function makeReport({ pet, records, weights, summary, t, language, fontBytes }) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  if (!fontBytes) { const response = await fetch('/fonts/noto-report.ttf'); if (!response.ok) throw new Error('Font unavailable'); fontBytes = await response.arrayBuffer(); }
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const supported = new Set(font.getCharacterSet());
  const clean = value => [...String(value || '')].map(char => /[\r\t]/.test(char) ? ' ' : char === '\n' || supported.has(char.codePointAt(0)) ? char : '?').join('');
  const ink = rgb(.21, .14, .22), muted = rgb(.39, .34, .39), accent = rgb(.81, .9, .7);
  let page, y;
  function newPage() { page = pdf.addPage([595.28, 841.89]); y = 766; page.drawRectangle({ x: 42, y: 788, width: 511, height: 8, color: accent }); }
  newPage();
  function ensure(height) { if (y - height < 58) newPage(); }
  function text(value, size = 11, color = ink) {
    const lineHeight = size * 1.55;
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= 505) { line = candidate; continue; }
        if (line) { ensure(lineHeight); page.drawText(line, { x: 45, y, font, size, color }); y -= lineHeight; line = ''; }
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > 505) { ensure(lineHeight); page.drawText(line, { x: 45, y, font, size, color }); y -= lineHeight; line = ''; }
          line += char;
        }
      }
      ensure(lineHeight); if (line) page.drawText(line, { x: 45, y, font, size, color }); y -= lineHeight;
    }
  }
  function heading(value) { ensure(65); y -= 14; text(value, 17); y -= 6; }
  const date = value => formatDate(localDay(value), language, { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.setTitle(`PetDay - ${clean(pet.name)}`); pdf.setAuthor('PetDay');
  text('PetDay', 26); text(t(summary ? 'vet.title' : 'care.reportTitle'), 17); text(`${t('care.created')}: ${date(dayKey())}`, 10, muted); y -= 12;
  text(pet.name, 23); text(`${t(`account.speciesOptions.${pet.species}`)}${pet.breed ? ` - ${pet.breed}` : ''}`);
  if (summary) {
    text(summary.period, 12, muted);
    for (const section of summary.sections) {
      heading(section.title);
      if (section.note) text(section.note);
      if (!section.entries.length) text(t('vet.empty'), 11, muted);
      for (const entry of section.entries) {
        ensure(entry.lines.length ? 40 : 22);
        text(entry.title, 12);
        for (const line of entry.lines) text(line, 10, muted);
        y -= 6;
      }
    }
  } else {
    text(`${t('birthDate')}: ${pet.birthDate ? date(pet.birthDate) + (pet.birthApproximate ? ` (${t('account.approximateDate')})` : '') : t('notSpecified')}`);
    for (const key of ['allergies', 'features', 'notes']) { heading(t(`account.${key}`)); text(pet[key] || t('notSpecified')); }
    heading(t('medical.heading', { name: pet.name }));
    if (!records.length) text(t('medical.empty'));
    for (const record of [...records].sort((a, b) => b.date.localeCompare(a.date))) {
      ensure(70); text(`${date(record.date)} - ${t(`medical.${record.kind}`)} - ${t(`medical.${record.status}`)}`, 10, muted); text(record.title, 13);
      for (const key of ['clinic', 'vet']) if (record[key]) text(`${t(`medical.${key}`)}: ${record[key]}`);
      if (record.nextDate) text(`${t('medical.nextDate')}: ${date(record.nextDate)}`);
      if (record.notes) text(record.notes); y -= 12;
    }
    heading(t('care.weightTitle'));
    if (!weights.length) text(t('care.weightEmpty'));
    for (const record of [...weights].sort((a, b) => b.date.localeCompare(a.date))) {
      ensure(45); text(`${date(record.date)} - ${new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(record.kg)} ${t('care.kg')}`);
      if (record.notes) text(record.notes, 10, muted); y -= 6;
    }
  }
  heading(t('care.reportSource')); text(t('care.reportNote'), 10, muted);
  const pages = pdf.getPages(); pages.forEach((p, i) => p.drawText(`PetDay  |  ${i + 1} / ${pages.length}`, { x: 45, y: 30, size: 9, font, color: muted }));
  return pdf.save();
}
