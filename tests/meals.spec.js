import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
const url = testDatabaseUrl(), origin = 'http://127.0.0.1:5183', emails = [];
test.skip(!url, 'TEST_DATABASE_URL is required');
const day = '2024-06-17';
const petData = name => ({ name, species: 'dog', breed: '', sex: 'unknown', birthDate: null, birthApproximate: false, features: '', allergies: 'Реакция на курицу', notes: '', photoAction: 'keep' });
async function setup(context) {
  const session = await (await context.get('/api/auth/session')).json();
  const email = `meals-${randomUUID()}@example.test`; emails.push(email);
  const response = await context.post('/api/auth/register', { headers: { Origin: origin, 'X-CSRF-Token': session.csrfToken }, data: { email, password: `Fixture-${randomUUID()}` } }); expect(response.status()).toBe(201);
  const headers = { Origin: origin, 'X-CSRF-Token': (await response.json()).csrfToken };
  const pet = await context.post('/api/pets', { headers, multipart: { data: JSON.stringify(petData('Томми')) } }); expect(pet.status()).toBe(201);
  return { headers, base: `/api/pets/${(await pet.json()).pet.id}/meals` };
}
const input = () => ({ id: randomUUID(), day, title: 'Сухой корм', kind: 'dry', time: '09:00', amount: 45.5, unit: 'g', notes: 'Утреннее кормление', timeZone: 'Asia/Almaty' });
test.afterAll(async () => {
  if (!url || !emails.length) return;
  const db = new pg.Client({ connectionString: url });
  try { await db.connect(); await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [emails]); } finally { await db.end(); }
});

test('meals API: validation, private dates and pets, safe retries and concurrent edits', async ({ playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: origin }), stranger = await playwright.request.newContext({ baseURL: origin });
  try {
    const { base, headers } = await setup(owner), other = await setup(stranger), data = input();
    expect((await owner.post(base, { data })).status()).toBe(403);
    expect((await stranger.get(`${base}?date=${day}`)).status()).toBe(404);
    expect((await stranger.post(base, { headers: other.headers, data })).status()).toBe(404);
    expect((await owner.get(`${base}?date=2024-02-30`)).status()).toBe(400);
    for (const invalid of [{ title: '' }, { kind: 'fake' }, { day: '2024-02-30' }, { day: '2099-01-01' }, { amount: 0 }, { amount: -1 }, { amount: 1.234 }, { amount: '20' }, { amount: 100001 }, { unit: 'kg' }, { time: '24:00' }, { notes: 'x'.repeat(2001) }]) expect((await owner.post(base, { headers, data: { ...data, ...invalid } })).status()).toBe(400);
    let response = await owner.post(base, { headers, data }); expect(response.status()).toBe(201);
    let meal = (await response.json()).meal; expect(meal.amount).toBe(45.5); expect(meal.day).toBe(day);
    expect((await owner.post(base, { headers, data })).status()).toBe(200);
    expect((await owner.post(base, { headers, data: { ...data, title: 'Changed' } })).status()).toBe(409);
    expect((await (await owner.get(`${base}?date=${day}`)).json()).meals).toHaveLength(1);
    expect((await (await owner.get(`${base}?date=2024-06-18`)).json()).meals).toHaveLength(0);
    const secondPet = await owner.post('/api/pets', { headers, multipart: { data: JSON.stringify(petData('Луна')) } });
    const otherBase = `/api/pets/${(await secondPet.json()).pet.id}/meals`;
    expect((await owner.put(`${otherBase}/${meal.id}`, { headers, data: { ...data, version: 1 } })).status()).toBe(404);
    expect((await stranger.delete(`${base}/${meal.id}`, { headers: other.headers, data: { version: 1 } })).status()).toBe(404);
    const update = { ...data, amount: 60, version: 1 };
    const race = await Promise.all([owner.put(`${base}/${meal.id}`, { headers, data: update }), owner.put(`${base}/${meal.id}`, { headers, data: update })]);
    expect(race.map(r => r.status()).sort()).toEqual([200, 409]);
    meal = (await (await owner.get(`${base}?date=${day}`)).json()).meals[0]; expect(meal.amount).toBe(60); expect(meal.version).toBe(2);
    const unknown = { ...input(), amount: null, time: '' };
    expect((await owner.post(base, { headers, data: unknown })).status()).toBe(201);
    expect((await owner.post(base, { headers, data: unknown })).status()).toBe(200);
    expect((await owner.delete(`${base}/${meal.id}`, { headers, data: { version: 1 } })).status()).toBe(409);
    expect((await owner.delete(`${base}/${meal.id}`, { headers, data: { version: 2 } })).status()).toBe(204);
    expect((await owner.post(base, { headers, data })).status()).toBe(409);
    expect((await (await owner.get(`${base}?date=${day}`)).json()).meals.map(item => item.id)).toEqual([unknown.id]);
  } finally { await owner.dispose(); await stranger.dispose(); }
});

test('feeding diary UI: totals by unit, draft retry, languages, dates, edit and delete', async ({ page }, testInfo) => {
  const { base, headers } = await setup(page.request);
  await page.request.post('/api/pets', { headers, multipart: { data: JSON.stringify(petData('Луна')) } });
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto('/app');
  await page.getByRole('button', { name: 'Питание', exact: true }).click();
  await page.getByLabel('Дата дневника', { exact: true }).fill(day);
  await expect(page.getByText('На этот день кормлений пока нет', { exact: true })).toBeVisible();
  await expect(page.locator('.feeding-allergies')).toContainText('Реакция на курицу');
  await page.getByRole('button', { name: 'Добавить кормление', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Название еды или корма *', { exact: true }).fill('Корм для Томми');
  await modal.getByLabel('Время', { exact: true }).fill('09:00');
  await modal.getByLabel('Количество', { exact: true }).fill('45.5');
  await modal.getByLabel('Заметки', { exact: true }).fill('Утренняя порция после прогулки');
  for (const language of ['EN', 'KZ', 'RU']) {
    await modal.getByRole('button', { name: language, exact: true }).click();
    await expect(page.locator('#meal-title')).toHaveValue('Корм для Томми');
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.route('**/api/pets/*/meals', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(modal.getByRole('alert')).toBeVisible();
  await expect(page.locator('#meal-amount')).toHaveValue('45.5'); await page.unroute('**/api/pets/*/meals');
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(modal).not.toBeVisible();
  await expect(page.locator('.feeding-summary')).toContainText('45,5 г');
  const extra = [
    { ...input(), title: 'Вечерняя порция', amount: 54.5, time: '18:00' },
    { ...input(), title: 'Лакомство', amount: 2, kind: 'treat', unit: 'pcs', time: '15:00' },
    { ...input(), title: 'Без взвешивания', amount: null, time: '' },
  ];
  for (const data of extra) expect((await page.request.post(base, { headers, data })).status()).toBe(201);
  await page.reload(); await page.getByRole('button', { name: 'Питание', exact: true }).click(); await page.getByLabel('Дата дневника', { exact: true }).fill(day);
  await expect(page.locator('.feeding-entry')).toHaveCount(4);
  await expect(page.locator('.feeding-summary')).toContainText('100 г · 2 шт.');
  await expect(page.locator('.feeding-entry').last()).toContainText('Количество не указано');
  for (const language of ['EN', 'KZ', 'RU']) { await page.getByRole('button', { name: language, exact: true }).click(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await expect(page.locator('.feeding-panel')).not.toContainText('nutrition.'); }
  await page.screenshot({ path: testInfo.outputPath('feeding-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 }); await page.screenshot({ path: testInfo.outputPath('feeding-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Следующий день', exact: true }).click(); await expect(page.locator('.feeding-entry')).toHaveCount(0);
  await page.getByRole('button', { name: 'Предыдущий день', exact: true }).click(); await expect(page.locator('.feeding-entry')).toHaveCount(4);
  const card = page.locator('.feeding-entry').filter({ has: page.getByRole('heading', { name: 'Корм для Томми', exact: true }) });
  await card.getByRole('button', { name: 'Редактировать', exact: true }).click(); await modal.getByLabel('Количество', { exact: true }).fill('50');
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(modal).not.toBeVisible(); await expect(page.locator('.feeding-summary')).toContainText('104,5 г · 2 шт.');
  await card.getByRole('button', { name: 'Удалить', exact: true }).click(); await modal.getByRole('button', { name: 'Отмена', exact: true }).click(); await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Удалить', exact: true }).click(); await modal.getByRole('button', { name: 'Удалить', exact: true }).click(); await expect(modal).not.toBeVisible(); await expect(card).toHaveCount(0);
  await expect(page.locator('.feeding-summary')).toContainText('54,5 г · 2 шт.');
  await page.locator('.real-pet-selector button').filter({ hasText: 'Луна' }).click(); await page.getByLabel('Дата дневника', { exact: true }).fill(day); await expect(page.locator('.feeding-entry')).toHaveCount(0);
});

test('feeding diary advances today at midnight and preserves a historical selection', async ({ page }) => {
  await setup(page.request); await page.clock.setFixedTime(new Date('2024-06-17T12:00:00'));
  await page.goto('/app'); await page.getByRole('button', { name: 'Питание', exact: true }).click();
  await expect(page.getByLabel('Дата дневника', { exact: true })).toHaveValue('2024-06-17');
  await page.clock.setFixedTime(new Date('2024-06-18T12:00:00')); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByLabel('Дата дневника', { exact: true })).toHaveValue('2024-06-18');
  await page.getByLabel('Дата дневника', { exact: true }).fill('2024-06-16');
  await page.clock.setFixedTime(new Date('2024-06-19T12:00:00')); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByLabel('Дата дневника', { exact: true })).toHaveValue('2024-06-16');
});
