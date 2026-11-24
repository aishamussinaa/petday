import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
const url = testDatabaseUrl(), origin = 'http://127.0.0.1:5183', emails = [];

// Exercise native sequential focus: never click or focus the target directly.
async function tabTo(page, target, backwards = false) {
  await expect(target).toHaveCount(1);
  for (let attempt = 0; attempt < 70; attempt++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  await expect(target).toBeFocused();
}
async function activate(page, target) { await tabTo(page, target); await page.keyboard.press('Enter'); }
async function account(page) {
  const session = await (await page.request.get('/api/auth/session')).json();
  const email = `keyboard-${randomUUID()}@example.test`, password = `Fixture-${randomUUID()}`; emails.push(email);
  const registered = await page.request.post('/api/auth/register', { headers: { Origin: origin, 'X-CSRF-Token': session.csrfToken }, data: { email, password } }); expect(registered.status()).toBe(201);
  const headers = { Origin: origin, 'X-CSRF-Token': (await registered.json()).csrfToken };
  const pet = await page.request.post('/api/pets', { headers, multipart: { data: JSON.stringify({ name: 'Томми', species: 'dog', breed: '', sex: 'unknown', birthDate: null, birthApproximate: false, features: '', allergies: '', notes: '', photoAction: 'keep' }) } }); expect(pet.status()).toBe(201);
  return { email, password };
}
test.afterAll(async () => {
  if (!url || !emails.length) return;
  const db = new pg.Client({ connectionString: url });
  try { await db.connect(); await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [emails]); } finally { await db.end(); }
});

test('keyboard: landing skip link, native links and mobile menu trap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto('/');
  await page.keyboard.press('Tab'); await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#landing-main')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('switch', { name: 'Анимация декора' })).toBeFocused();
  const menu = page.getByRole('button', { name: 'Меню', exact: true });
  await activate(page, menu); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  const first = dialog.getByRole('button', { name: 'RU', exact: true });
  const last = dialog.getByRole('link', { name: 'Открыть кабинет', exact: true });
  await tabTo(page, first); await page.keyboard.press('Shift+Tab'); await expect(last).toBeFocused();
  await page.keyboard.press('Tab'); await expect(first).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(menu).toBeFocused();
  await activate(page, page.locator('.hero-copy').getByRole('link', { name: 'Открыть демо', exact: true }));
  await expect(page).toHaveURL(/\/demo$/); await expect(page.locator('main')).toBeFocused();
  await activate(page, page.locator('.bottom-nav').getByRole('button', { name: 'Питание', exact: true }));
  await expect(page.getByRole('heading', { name: 'Журнал кормлений' })).toBeVisible();
});

test('keyboard: login, all account sections, forms and visible focus without mouse', async ({ page }, testInfo) => {
  test.skip(!url, 'TEST_DATABASE_URL is required');
  const credentials = await account(page); await page.context().clearCookies();
  await page.goto('/');
  await activate(page, page.locator('.nav-demo'));
  await expect(page).toHaveURL(/\/app$/);
  await tabTo(page, page.locator('#auth-email')); await page.keyboard.insertText(credentials.email);
  await page.keyboard.press('Tab'); await expect(page.locator('#auth-password')).toBeFocused(); await page.keyboard.insertText(credentials.password);
  await page.keyboard.press('Tab'); await expect(page.locator('.auth-submit')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Мои питомцы', exact: true })).toBeVisible();
  const jump = page.getByRole('link', { name: 'Перейти к разделам', exact: true });
  await activate(page, jump); await expect(page.locator('#account-navigation')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Питомцы', exact: true })).toBeFocused();
  for (const [name, panel] of [['Сегодня', '.today-panel'], ['Питание', '.feeding-panel'], ['Здоровье', '.health-panel']]) {
    const button = page.locator('.account-nav').getByRole('button', { name, exact: true });
    await activate(page, button); await expect(page.locator(panel)).toBeVisible(); await expect(button).toBeFocused();
    expect(await button.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
    expect(await button.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none');
  }
  await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'Питание', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Здоровье', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('keyboard-focus-desktop.png'), fullPage: true });
  const add = page.getByRole('button', { name: 'Добавить визит', exact: true });
  await activate(page, add); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await tabTo(page, page.locator('#health-title')); await page.keyboard.insertText('Плановый осмотр');
  const save = dialog.getByRole('button', { name: 'Сохранить', exact: true });
  await tabTo(page, save); await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'RU', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(save).toBeFocused();
  await page.keyboard.press('Enter'); await expect(dialog).not.toBeVisible(); await expect(add).toBeFocused();
  await expect(page.locator('.medical-record')).toContainText('Плановый осмотр');
  await activate(page, page.locator('.medical-record').getByRole('button', { name: 'Редактировать', exact: true }));
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(page.locator('.medical-record').getByRole('button', { name: 'Редактировать', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 900 });
  await tabTo(page, page.getByRole('button', { name: 'Питание', exact: true })); await page.keyboard.press('Enter');
  await page.screenshot({ path: testInfo.outputPath('keyboard-focus-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
