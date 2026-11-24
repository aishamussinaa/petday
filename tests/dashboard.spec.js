import { test, expect } from '@playwright/test';
import { calendarAge, dayDistance, nextBirthday } from '../client/src/dateUtils.js';

test('календарный возраст и ближайший день рождения', () => {
  expect(calendarAge(new Date(2020, 0, 31), new Date(2023, 1, 28))).toEqual({ years: 3, months: 1, days: 0 });
  expect(dayDistance(new Date(2026, 11, 25), nextBirthday(new Date(2020, 0, 4), new Date(2026, 11, 25)))).toBe(10);
  expect(dayDistance(new Date(2025, 1, 27), nextBirthday(new Date(2020, 1, 29), new Date(2025, 1, 27)))).toBe(1);
});

test('демо: независимый прогресс, отметка и отмена, языки без потери черновика', async ({ page }) => {
  await page.goto('/demo');
  const grooming = page.getByRole('checkbox', { name: 'Выполнение: Расчесать шерсть', exact: true }); await grooming.check();
  await page.locator('.real-pet-selector').getByRole('button', { name: 'Ума', exact: true }).click(); await expect(grooming).not.toBeChecked();
  await page.locator('.real-pet-selector').getByRole('button', { name: 'Томми', exact: true }).click(); await expect(grooming).toBeChecked(); await grooming.uncheck();
  await page.getByRole('button', { name: 'Добавить дело', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('Укажи название');
  await dialog.getByRole('button', { name: 'EN', exact: true }).click(); await expect(dialog.getByRole('alert')).not.toContainText('Укажи');
  await dialog.locator('#task-title').fill('Мой черновик'); await dialog.locator('#task-time').fill('15:45');
  await dialog.getByRole('button', { name: 'KZ', exact: true }).click(); await expect(dialog.locator('#task-title')).toHaveValue('Мой черновик'); await expect(dialog.locator('#task-time')).toHaveValue('15:45');
  await dialog.getByRole('button', { name: 'Сақтау', exact: true }).click(); await expect(dialog).not.toBeVisible(); await expect(page.locator('.today-task').filter({ hasText: 'Мой черновик' })).toHaveCount(1);
  await page.locator('.account-header').getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('.today-task').getByRole('heading', { name: 'Breakfast', exact: true })).toBeVisible();
  await expect(page.locator('.today-task').filter({ hasText: 'Мой черновик' })).toHaveCount(1);
  await page.locator('.account-header').getByRole('button', { name: 'KZ', exact: true }).click();
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'kk'); await expect(page.locator('.today-task').filter({ hasText: 'Мой черновик' })).toHaveCount(0);
});

test('демо: профиль, дата без вымысла и возврат фокуса', async ({ page }) => {
  await page.goto('/demo'); const nav = page.locator('.account-nav'); await nav.getByRole('button', { name: 'Питомцы', exact: true }).click();
  await expect(page.locator('.real-pet-card')).toHaveCount(2); const profile = page.locator('.real-pet-card').first().getByRole('button', { name: 'Посмотреть профиль' });
  await profile.click(); await expect(page.getByRole('dialog')).toHaveAccessibleName('Томми'); await expect(page.getByRole('dialog')).toContainText('Дата рождения не указана');
  await page.keyboard.press('Escape'); await expect(profile).toBeFocused();
  await nav.getByRole('button', { name: 'Питание', exact: true }).click(); await expect(page.locator('.feeding-entry')).toHaveCount(1);
  await nav.getByRole('button', { name: 'Здоровье', exact: true }).click(); await expect(page.locator('.medical-record')).toHaveCount(2);
  await nav.getByRole('button', { name: 'Сегодня', exact: true }).click(); await page.getByRole('button', { name: 'Добавить дело', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Сохранить', exact: true }).focus(); await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Добавить дело', exact: true })).toBeFocused();
});

for (const width of [390, 768, 1440]) test(`полное демо: три языка, обе темы и ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1050 }); const errors = []; page.on('pageerror', error => errors.push(error.message)); await page.goto('/demo');
  for (const lang of ['RU', 'KZ', 'EN']) {
    await page.locator('.account-header').getByRole('button', { name: lang, exact: true }).click();
    for (let index = 0; index < 4; index++) { await page.locator('.account-nav').getByRole('button').nth(index).click(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  }
  await page.locator('.account-header .theme-toggle').click(); await page.screenshot({ path: info.outputPath('dark-health.png'), fullPage: true });
  await page.locator('.account-nav').getByRole('button').nth(1).click(); await page.screenshot({ path: info.outputPath('dark-today.png'), fullPage: true });
  await page.locator('.account-header .theme-toggle').click(); await page.screenshot({ path: info.outputPath('today.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});
