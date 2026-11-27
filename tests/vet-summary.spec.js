import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dayKey } from '../client/src/account/careOverview.js';
import { shiftDay } from '../shared/weekly.js';

test('vet summary previews inclusive dates and exports the selected period', async ({ page }, info) => {
  const today = dayKey();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/demo');
  await page.locator('.account-nav').getByRole('button', { name: 'Здоровье' }).click();
  await page.getByRole('button', { name: 'Сводка для ветеринара' }).click();
  const dialog = page.getByRole('dialog');
  const sections = dialog.locator('.vet-section');
  const pdf = dialog.getByRole('button', { name: 'Скачать сводку в PDF' });
  await expect(dialog.locator('.vet-pet')).toHaveText('Томми');
  await expect(sections.locator('h3 span')).toHaveText(['1','1','3']);
  await expect(dialog.locator('.vet-trend')).toContainText('+0,2 кг');
  async function download(name) {
    const waiting = page.waitForEvent('download');
    await pdf.click();
    const file = await waiting;
    const output = info.outputPath(name);
    await file.saveAs(output);
    expect((await readFile(output)).subarray(0,5).toString()).toBe('%PDF-');
    return file.suggestedFilename();
  }
  await download('all.pdf');
  const period = dialog.getByLabel('Период');
  await period.selectOption('30');
  await expect(sections.locator('h3 span')).toHaveText(['0','0','3']);
  const from = dialog.locator('#vet-from'), to = dialog.locator('#vet-to');
  await from.fill(shiftDay(today, -30));
  await to.fill(shiftDay(today, -6));
  await expect(sections.locator('h3 span')).toHaveText(['1','0','2']);
  await expect(dialog.locator('.vet-trend')).toContainText('+0,1 кг');
  expect(await download('filtered.pdf')).toContain(shiftDay(today,-30) + '_' + shiftDay(today,-6));
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
