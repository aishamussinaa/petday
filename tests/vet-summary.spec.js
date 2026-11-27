import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { shiftDay } from '../shared/weekly.js';

test.use({ timezoneId: 'UTC' });

test('vet summary previews inclusive dates and exports the selected period', async ({ page }, info) => {
  const today = '2026-11-27';
  await page.clock.setFixedTime(new Date(today + 'T12:00:00Z'));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/demo');
  await page.locator('.account-nav').getByRole('button', { name: 'Здоровье' }).click();
  const dialog = page.getByRole('dialog');
  for (const [date, title] of [
    ['2026-10-27', 'Осмотр перед поездкой'],
    ['2026-11-21', 'Контрольный осмотр Томми'],
    ['2026-11-22', 'Повторный осмотр лапы'],
  ]) {
    await page.getByRole('button', { name: 'Добавить визит', exact: true }).click();
    await dialog.locator('#health-status').selectOption('completed');
    await dialog.locator('#health-title').fill(title);
    await dialog.locator('#health-date').fill(date);
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Сводка для ветеринара' }).click();
  const sections = dialog.locator('.vet-section');
  const pdf = dialog.getByRole('button', { name: 'Скачать сводку в PDF' });
  await expect(dialog.locator('.vet-pet')).toHaveText('Томми');
  await expect(sections.locator('h3 span')).toHaveText(['1','4','3']);
  await expect(dialog.locator('.vet-trend')).toContainText('+0,2 кг');
  async function download(name) {
    const waiting = page.waitForEvent('download');
    await pdf.click();
    const file = await waiting;
    const output = info.outputPath(name);
    await file.saveAs(output);
    const reader = fileURLToPath(new URL('./pdf-text.py', import.meta.url));
    const text = execFileSync('python', ['-X', 'utf8', reader, output], { encoding: 'utf8' });
    return { filename: file.suggestedFilename(), text: text.replace(/\s+/gu, ' ').trim() };
  }
  const all = await download('all.pdf');
  const outside = ['Осмотр перед поездкой', 'Повторный осмотр лапы', 'Визит к ветеринару', '3,6 кг'];
  for (const entry of outside) expect(all.text).toContain(entry);
  const period = dialog.getByLabel('Период');
  await period.selectOption('30');
  await expect(sections.locator('h3 span')).toHaveText(['0','2','3']);
  const from = dialog.locator('#vet-from'), to = dialog.locator('#vet-to');
  await from.fill(shiftDay(today, -30));
  await to.fill(shiftDay(today, -6));
  await expect(sections.locator('h3 span')).toHaveText(['1','1','2']);
  await expect(dialog.locator('.vet-trend')).toContainText('+0,1 кг');
  const filtered = await download('filtered.pdf');
  expect(filtered.filename).toContain('2026-10-28_2026-11-21');
  for (const entry of [
    '28 октября 2026 г. — 21 ноября 2026 г.',
    'Пример вакцинации 28 октября 2026 г.',
    'Контрольный осмотр Томми 21 ноября 2026 г.',
    '30 октября 2026 г. · 3,4 кг',
    '21 ноября 2026 г. · 3,5 кг',
    'изменение +0,1 кг',
  ]) expect(filtered.text).toContain(entry);
  for (const entry of outside) expect(filtered.text).not.toContain(entry);
  await from.fill(today);
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(pdf).toHaveCount(0);
  await to.fill(today);
  await expect(sections.locator('h3 span')).toHaveText(['0','0','1']);
  await expect(dialog.locator('.vet-trend')).toContainText('два взвешивания');
  await from.fill('2000-01-01');
  await to.fill('2000-01-01');
  await expect(sections.locator('h3 span')).toHaveText(['0','0','0']);
  for (const [language, name] of [['KZ','Ветеринарға арналған қорытынды'],['EN','Vet summary']]) {
    await dialog.getByRole('button', { name: language, exact: true }).click();
    await expect(dialog).toHaveAccessibleName(name);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await page.locator('.real-pet-selector').getByRole('button', { name: 'Ума' }).click();
  await page.getByRole('button', { name: 'Vet summary' }).click();
  await expect(dialog.locator('.vet-trend')).toContainText('4.2 kg');
  await expect(dialog.locator('.vet-pet')).toHaveText('Ума');
});
