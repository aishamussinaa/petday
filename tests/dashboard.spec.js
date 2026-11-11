import { test, expect } from '@playwright/test';
import { calendarAge, dayDistance, nextBirthday } from '../client/src/dateUtils.js';

test('календарный возраст и ближайший день рождения', () => {
  expect(calendarAge(new Date(2020, 0, 31), new Date(2023, 1, 28))).toEqual({ years: 3, months: 1, days: 0 });
  const today = new Date(2026, 11, 25);
  expect(dayDistance(today, nextBirthday(new Date(2020, 0, 4), today))).toBe(10);
  expect(dayDistance(new Date(2025, 1, 27), nextBirthday(new Date(2020, 1, 29), new Date(2025, 1, 27)))).toBe(1);
});

test('выбор питомца, независимый прогресс, отметка и отмена', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('План на сегодня');
  const progress = page.getByRole('progressbar');
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  const water = page.getByRole('checkbox', { name: 'Выполнение: Обновить воду' });
  await water.check();
  await expect(progress).toHaveAttribute('aria-valuenow', '3');
  await page.getByRole('button', { name: 'Ума Кошка' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(water).not.toBeChecked();
  await expect(page.locator('.pet-name-row h2')).toHaveText('Ума');
  await page.getByRole('button', { name: 'Томми Собака' }).click();
  await expect(water).toBeChecked();
  await water.uncheck();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
});

test('форма, переводы без потери состояния, локализованная ошибка', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Ума Кошка' }).click();
  await page.getByRole('checkbox', { name: 'Выполнение: Обновить воду' }).check();
  const add = page.getByRole('button', { name: 'Добавить дело' });
  await add.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Введите название дела.');
  await dialog.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Enter a task title.');
  await dialog.getByLabel('Title', { exact: true }).fill('Помыть любимую миску');
  await dialog.getByLabel('Time', { exact: true }).fill('15:45');
  await dialog.getByLabel('Category', { exact: true }).selectOption('care');
  await dialog.getByRole('button', { name: 'KZ', exact: true }).click();
  await expect(dialog.getByLabel('Атауы')).toHaveValue('Помыть любимую миску');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await dialog.getByRole('button', { name: 'Қосу', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
  await expect(page.locator('.pet-name-row h2')).toHaveText('Ума');
  await expect(page.getByText('Помыть любимую миску', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByText('Помыть любимую миску', { exact: true })).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('petday.language', 'invalid'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});

test('навигация, журнал, диалог и возврат фокуса по Escape', async ({ page }) => {
  await page.goto('/demo');
  const profile = page.getByRole('button', { name: 'Посмотреть профиль' });
  await profile.click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Томми');
  await expect(page.getByText('Дата рождения', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Нет данных', { exact: true })).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(profile).toBeFocused();
  await page.getByRole('navigation').getByRole('button', { name: 'Питомцы', exact: true }).click();
  await expect(page.locator('.pets-grid .pet-card')).toHaveCount(2);
  await page.getByRole('navigation').getByRole('button', { name: 'Питание', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Журнал кормлений' })).toBeVisible();
  await expect(page.locator('.journal-row')).toHaveCount(2);
  await page.getByRole('navigation').getByRole('button', { name: 'Здоровье', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Визиты и записи' })).toBeVisible();
  await expect(page.locator('.health-record')).toHaveCount(2);
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить дело' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Добавить', exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Добавить дело' })).toBeFocused();
});

test('диагностика в сворачиваемой панели, ошибка API и восстановление', async ({ page }) => {
  await page.route('**/api/health', route => route.abort('connectionrefused'));
  await page.goto('/demo');
  await expect(page.locator('.dev-panel')).not.toHaveAttribute('open');
  await page.locator('.dev-panel summary').click();
  await expect(page.getByRole('status')).toContainText('Сервер не ответил');
  await page.getByLabel('Тестовое поле', { exact: true }).fill('Сохрани меня');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByLabel('Test field', { exact: true })).toHaveValue('Сохрани меня');
  await page.unroute('**/api/health');
  for (const response of [{ status: 503, contentType: 'application/json', body: '{"status":"ok"}' }, { status: 200, contentType: 'application/json', body: '{"status":"wrong"}' }, { status: 200, contentType: 'text/html', body: '<html>Unexpected</html>' }]) {
    await page.route('**/api/health', route => route.fulfill(response));
    await page.getByRole('button', { name: 'Check again' }).click();
    await expect(page.getByRole('status')).toContainText('The server did not respond');
    await page.unroute('**/api/health');
  }
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('status')).toHaveText('Connected to the server.');
});

for (const width of [390, 768, 1440]) {
  test(`скриншоты и отсутствие переполнения: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/demo');
    await page.locator('.pet-photo img').evaluate(img => img.decode());
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
    for (const lang of ['RU', 'KZ', 'EN']) {
      await page.getByRole('button', { name: lang, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const nav = page.getByRole('navigation');
      for (let index = 0; index < 4; index++) {
        await nav.getByRole('button').nth(index).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    await page.getByRole('button', { name: 'RU', exact: true }).click();
    await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
    await page.getByRole('button', { name: 'Добавить дело' }).click();
    await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: `test-results/form-${width}.png` });
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}
