import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
const url = testDatabaseUrl(), origin = 'http://127.0.0.1:5183', emails = [];
test.skip(!url, 'TEST_DATABASE_URL is required');
test.use({ timezoneId: 'Asia/Almaty' });
async function setup(page, birthDate = '2020-05-01', birthApproximate = false) {
  const session = await (await page.request.get('/api/auth/session')).json();
  const email = `birthday-${randomUUID()}@example.test`; emails.push(email);
  const response = await page.request.post('/api/auth/register', { headers: { Origin: origin, 'X-CSRF-Token': session.csrfToken }, data: { email, password: `Fixture-${randomUUID()}` } });
  expect(response.status()).toBe(201);
  const headers = { Origin: origin, 'X-CSRF-Token': (await response.json()).csrfToken };
  const pet = await page.request.post('/api/pets', { headers, multipart: { data: JSON.stringify({ name: 'Томми', species: 'dog', breed: '', sex: 'unknown', birthDate, birthApproximate, features: '', allergies: '', notes: '', photoAction: 'keep' }) } });
  expect(pet.status()).toBe(201);
  return (await pet.json()).pet;
}
async function date(page, value) {
  await page.clock.setFixedTime(new Date(`${value}T12:00:00+05:00`));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}
test.afterAll(async () => {
  if (!url || !emails.length) return;
  const db = new pg.Client({ connectionString: url });
  try { await db.connect(); await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [emails]); } finally { await db.end(); }
});

test('birthday countdown: week boundaries, day changes and approximate date', async ({ page }, testInfo) => {
  await setup(page, '2020-05-01', true);
  await page.clock.setFixedTime(new Date('2027-04-23T12:00:00+05:00'));
  await page.goto('/app'); await expect(page.getByRole('heading', { name: 'Мои питомцы' })).toBeVisible();
  await expect(page.locator('.birthday-card')).toHaveCount(0);
  await date(page, '2027-04-24');
  await expect(page.locator('.birthday-card')).toContainText('Томми: до дня рождения 7 дней');
  await expect(page.locator('.birthday-card')).toContainText('Дата рождения указана примерно');
  await expect(page.locator('.account-title .date-line')).toContainText('24 апреля');
  await expect(page.locator('.real-birth')).toContainText('7 дней');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: testInfo.outputPath('countdown-mobile.png'), fullPage: true });
  await date(page, '2027-04-25'); await expect(page.locator('.birthday-number strong')).toHaveText('6');
  await date(page, '2027-04-29'); await expect(page.locator('.birthday-card')).toContainText('2 дня');
  await date(page, '2027-04-30'); await expect(page.locator('.birthday-card')).toContainText('1 день');
  await date(page, '2027-05-01'); await expect(page.locator('.birthday-party')).toContainText('С днём рождения, Томми!');
  await expect(page.locator('.real-birth')).toContainText('День рождения сегодня');
  await date(page, '2027-05-02'); await expect(page.locator('.birthday-card')).toHaveCount(0);
});

test('birthday animation: once per birthday, replay, motion setting and mobile layout', async ({ page }, testInfo) => {
  await setup(page); await page.clock.setFixedTime(new Date('2027-05-01T12:00:00+05:00'));
  await page.goto('/app');
  await expect(page.locator('.birthday-confetti i')).toHaveCount(24);
  await expect(page.locator('.birthday-cake')).toBeVisible();
  await expect.poll(() => page.locator('.cake-flame').evaluate(el => getComputedStyle(el).animationName)).toBe('birthday-flicker');
  await page.screenshot({ path: testInfo.outputPath('birthday-desktop.png'), fullPage: true });
  await page.reload(); await expect(page.locator('.birthday-party')).toBeVisible();
  await expect(page.locator('.birthday-confetti')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ещё конфетти!', exact: true }).click();
  await expect(page.locator('.birthday-confetti')).toHaveCount(1);
  await page.getByRole('button', { name: 'Выключить анимацию', exact: true }).click();
  await expect(page.locator('.birthday-confetti')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ещё конфетти!', exact: true })).toBeDisabled();
  await page.reload(); await expect(page.getByRole('button', { name: 'Включить анимацию', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  for (const language of ['EN', 'KZ', 'RU']) {
    await page.getByRole('button', { name: language, exact: true }).click();
    await expect(page.locator('.birthday-card')).not.toContainText('party.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('birthday-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Включить анимацию', exact: true }).click();
  await page.getByRole('button', { name: 'Ещё конфетти!', exact: true }).click();
  await expect(page.locator('.birthday-confetti')).toHaveCount(1);
  await expect(page.locator('.birthday-confetti')).toHaveCount(0, { timeout: 6000 });
});

test('automatic birthday greeting respects reduced motion', async ({ page }) => {
  await setup(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2027-05-01T12:00:00+05:00'));
  await page.goto('/app');
  const greeting = page.locator('.birthday-party');
  await expect(greeting.locator('.birthday-cake')).toBeVisible();
  await expect(greeting.locator('.birthday-confetti')).toHaveCount(0);
  await expect(greeting.getByRole('button', { name: 'Ещё конфетти!', exact: true })).toBeDisabled();
  await expect(greeting).toContainText('Анимация отключена в настройках устройства.');
  await date(page, '2027-05-02'); await expect(greeting).toHaveCount(0);
});

test('unknown birthday has no automatic celebration', async ({ page }) => {
  await setup(page, null); await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Мои питомцы' })).toBeVisible();
  await expect(page.locator('.birthday-card')).toHaveCount(0);
});
