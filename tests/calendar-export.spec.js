import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { healthCalendarFile } from '../client/src/account/healthCalendar.js';

const unfold = text => text.replace(/\r\n /g, '');
const uid = text => unfold(text).split('\r\n').find(line => line.startsWith('UID:'));

test('iCalendar preserves UTF-8, escaped text, distinct follow-ups and edited dates', () => {
  const record = {
    id: 'sample', kind: 'vaccine', title: 'Екпе 💉 '.repeat(18), clinic: 'Clinic, A;B\\C',
    notes: 'Первая строка\r\nLOCATION:other', vet: 'Дәрігер', date: '2024-02-29', nextDate: '2024-12-31', version: 2
  };
  const input = { pet: { id: 'tommy', name: 'Томми' }, record, t: key => key, now: new Date('2024-02-01T10:11:12.345Z') };
  const { content } = healthCalendarFile(input);
  expect(content.endsWith('END:VCALENDAR\r\n')).toBe(true);
  for (const line of content.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  const plain = unfold(content);
  expect(plain).toContain('DTSTAMP:20240201T101112Z\r\nSEQUENCE:1');
  expect(plain).toContain('DTSTART;VALUE=DATE:20240229\r\nDTEND;VALUE=DATE:20240301');
  expect(plain).toContain('SUMMARY:Томми · ' + record.title);
  expect(plain).toContain('LOCATION:Clinic\\, A\\;B\\\\C');
  expect(plain).toContain('Первая строка\\nLOCATION:other');
  expect(plain.match(/^LOCATION:/gm)).toHaveLength(1);
  const followUp = healthCalendarFile({ ...input, followUp: true }).content;
  expect(followUp).toContain('DTSTART;VALUE=DATE:20241231\r\nDTEND;VALUE=DATE:20250101');
  expect(uid(followUp)).not.toBe(uid(content));
  expect(uid(healthCalendarFile({ ...input, record:{ ...record, date:'2024-03-01', version:3 } }).content)).toBe(uid(content));
});

for (const timezoneId of ['America/Los_Angeles', 'Asia/Almaty']) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });
    test('downloads the selected pet and date from Health and Calendar', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-05-15T12:00:00Z'));
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto('/demo');
      const nav = page.locator('.account-nav');
      await nav.getByRole('button', { name: 'Здоровье' }).click();
      async function download(container, name = 'Добавить в мой календарь') {
        const ready = page.waitForEvent('download');
        await container.getByRole('button', { name, exact: true }).click();
        const file = await ready;
        expect(file.suggestedFilename()).toMatch(/\.ics$/);
        return unfold(await readFile(await file.path(), 'utf8'));
      }
      const vaccine = page.locator('.medical-record').filter({ hasText:'Пример вакцинации' });
      expect(await download(vaccine)).toContain('DTSTART;VALUE=DATE:20260415');
      const visit = page.locator('.medical-record').filter({ hasText:'Визит к ветеринару' });
      await visit.getByRole('button', { name:'Редактировать' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('#health-nextDate').fill('2026-05-31');
      await dialog.getByRole('button', { name:'Сохранить' }).click();
      await expect(dialog).toHaveCount(0);
      const primary = await download(visit);
      expect(primary).toContain('SUMMARY:Томми · Визит к ветеринару');
      expect(primary).toContain('DTSTART;VALUE=DATE:20260516');
      const next = await download(visit, 'Добавить повторную дату в календарь');
      expect(next).toContain('DTSTART;VALUE=DATE:20260531');
      await nav.getByRole('button', { name:'Календарь' }).click();
      const agenda = page.locator('.events-agenda');
      const later = agenda.locator('li').filter({ has:page.locator('time[datetime="2026-05-31"]') });
      expect(uid(await download(later))).toBe(uid(next));
      await page.locator('.event-calendar select').selectOption('uma');
      const other = await download(agenda);
      expect(other).toContain('SUMMARY:Ума · Визит к ветеринару');
      expect(uid(other)).not.toBe(uid(primary));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
}
