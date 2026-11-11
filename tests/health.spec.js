import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
const url = testDatabaseUrl(), origin = 'http://127.0.0.1:5183', emails = [];
test.skip(!url, 'TEST_DATABASE_URL is required');
const petInput = name => ({ name, species: 'dog', breed: '', sex: 'unknown', birthDate: null, birthApproximate: false, features: '', allergies: 'Реакция на курицу', notes: '', photoAction: 'keep' });
async function setup(context) {
  const session = await (await context.get('/api/auth/session')).json();
  const email = `health-${randomUUID()}@example.test`; emails.push(email);
  const response = await context.post('/api/auth/register', { headers: { Origin: origin, 'X-CSRF-Token': session.csrfToken }, data: { email, password: `Fixture-${randomUUID()}` } });
  expect(response.status()).toBe(201);
  const headers = { Origin: origin, 'X-CSRF-Token': (await response.json()).csrfToken };
  const pet = await context.post('/api/pets', { headers, multipart: { data: JSON.stringify(petInput('Томми')) } }); expect(pet.status()).toBe(201);
  return { headers, base: `/api/pets/${(await pet.json()).pet.id}/health` };
}
const input = () => ({ id: randomUUID(), kind: 'vaccine', status: 'completed', title: 'Прививка по назначению врача', date: '2024-05-01', nextDate: '2025-05-01', clinic: 'Ветклиника', vet: 'Анна', notes: 'Запись из ветпаспорта', timeZone: 'Asia/Almaty' });
test.afterAll(async () => {
  if (!url || !emails.length) return;
  const db = new pg.Client({ connectionString: url });
  try { await db.connect(); await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [emails]); } finally { await db.end(); }
});

test('health API: ownership, validation, retry, concurrency and deletion', async ({ playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: origin }), stranger = await playwright.request.newContext({ baseURL: origin });
  try {
    const { headers, base } = await setup(owner), other = await setup(stranger), data = input();
    expect((await owner.post(base, { data })).status()).toBe(403);
    expect((await stranger.get(base)).status()).toBe(404);
    expect((await stranger.post(base, { headers: other.headers, data })).status()).toBe(404);
    for (const invalid of [{ title: ' ' }, { kind: 'fake' }, { status: 'fake' }, { date: '2024-02-30' }, { date: '2099-01-01', nextDate: '' }, { nextDate: '2024-04-30' }, { nextDate: '2024-05-01' }, { notes: 'x'.repeat(4001) }]) {
      expect((await owner.post(base, { headers, data: { ...data, ...invalid } })).status()).toBe(400);
    }
    let response = await owner.post(base, { headers, data }); expect(response.status()).toBe(201);
    let record = (await response.json()).record;
    expect(record.date).toBe(data.date); expect(record.nextDate).toBe(data.nextDate);
    expect((await owner.post(base, { headers, data })).status()).toBe(200);
    expect((await owner.post(base, { headers, data: { ...data, title: 'Другой текст' } })).status()).toBe(409);
    expect((await (await owner.get(base)).json()).records).toHaveLength(1);
    expect((await (await stranger.get(other.base)).json()).records).toHaveLength(0);
    const otherPet = await owner.post('/api/pets', { headers, multipart: { data: JSON.stringify(petInput('Луна')) } });
    const otherBase = `/api/pets/${(await otherPet.json()).pet.id}/health`;
    expect((await owner.put(`${otherBase}/${record.id}`, { headers, data: { ...data, version: record.version } })).status()).toBe(404);
    expect((await stranger.delete(`${base}/${record.id}`, { headers: other.headers, data: { version: record.version } })).status()).toBe(404);
    const update = { ...data, title: 'Обновлённая запись', version: record.version };
    const race = await Promise.all([owner.put(`${base}/${record.id}`, { headers, data: update }), owner.put(`${base}/${record.id}`, { headers, data: update })]);
    expect(race.map(r => r.status()).sort()).toEqual([200, 409]);
    record = (await (await owner.get(base)).json()).records[0]; expect(record.version).toBe(2);
    const plan = { ...input(), kind: 'visit', status: 'planned', date: '2099-05-01', nextDate: null };
    expect((await owner.post(base, { headers, data: plan })).status()).toBe(201);
    expect((await owner.delete(`${base}/${record.id}`, { headers, data: { version: 1 } })).status()).toBe(409);
    expect((await owner.delete(`${base}/${record.id}`, { headers, data: { version: record.version } })).status()).toBe(204);
    expect((await owner.post(base, { headers, data })).status()).toBe(409);
    expect((await (await owner.get(base)).json()).records.map(r => r.id)).toEqual([plan.id]);
  } finally { await owner.dispose(); await stranger.dispose(); }
});

test('health UI: history, plans, languages, network retry, edit, isolation and delete', async ({ page }, testInfo) => {
  const { headers } = await setup(page.request);
  await page.request.post('/api/pets', { headers, multipart: { data: JSON.stringify(petInput('Луна')) } });
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto('/app');
  await page.getByRole('button', { name: 'Здоровье', exact: true }).click();
  await expect(page.locator('.health-allergies')).toContainText('Реакция на курицу');
  await expect(page.getByText('История здоровья начинается здесь', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить прививку', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Название прививки *', { exact: true }).fill('Комплексная прививка');
  await modal.getByLabel('Статус', { exact: true }).selectOption('completed');
  await modal.getByLabel('Дата *', { exact: true }).fill('2024-05-01');
  await modal.getByLabel('Следующая дата', { exact: true }).fill('2099-05-01');
  await modal.getByLabel('Клиника', { exact: true }).fill('Добрый доктор');
  await modal.getByLabel('Врач', { exact: true }).fill('Анна');
  await modal.getByLabel('Заметки и рекомендации врача', { exact: true }).fill('Название и дата перенесены из ветпаспорта.');
  for (const language of ['EN', 'KZ', 'RU']) {
    await modal.getByRole('button', { name: language, exact: true }).click();
    await expect(page.locator('#health-title')).toHaveValue('Комплексная прививка');
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.route('**/api/pets/*/health', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(modal.getByRole('alert')).toBeVisible(); await expect(page.locator('#health-title')).toHaveValue('Комплексная прививка');
  await page.unroute('**/api/pets/*/health');
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(modal).not.toBeVisible();
  await expect(page.locator('.medical-record')).toHaveCount(1);
  await page.getByRole('button', { name: 'Добавить визит', exact: true }).click();
  await modal.getByLabel('Причина визита *', { exact: true }).fill('Плановый осмотр');
  await modal.getByLabel('Дата *', { exact: true }).fill('2099-06-01');
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(modal).not.toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Здоровье', exact: true }).click();
  await expect(page.locator('.medical-record')).toHaveCount(2);
  for (const language of ['EN', 'KZ', 'RU']) {
    await page.getByRole('button', { name: language, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.health-panel')).not.toContainText('medical.');
  }
  await page.screenshot({ path: testInfo.outputPath('health-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 }); await page.screenshot({ path: testInfo.outputPath('health-desktop.png'), fullPage: true });
  await page.locator('.real-pet-selector button').filter({ hasText: 'Луна' }).click(); await expect(page.locator('.medical-record')).toHaveCount(0);
  await page.locator('.real-pet-selector button').filter({ hasText: 'Томми' }).click(); await expect(page.locator('.medical-record')).toHaveCount(2);
  await page.getByRole('button', { name: 'Визит', exact: true }).click(); await expect(page.locator('.medical-record')).toHaveCount(1);
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await modal.getByLabel('Дата *', { exact: true }).fill('2024-06-01');
  await modal.getByLabel('Статус', { exact: true }).selectOption('completed');
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(modal).not.toBeVisible();
  await expect(page.locator('.medical-record')).toContainText('Выполнено');
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await modal.getByRole('button', { name: 'Отмена', exact: true }).click(); await expect(page.locator('.medical-record')).toHaveCount(1);
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await modal.getByRole('button', { name: 'Удалить', exact: true }).click(); await expect(modal).not.toBeVisible();
  await expect(page.locator('.medical-record')).toHaveCount(0);
  await page.getByRole('button', { name: 'Все записи', exact: true }).click(); await expect(page.locator('.medical-record')).toHaveCount(1);
});
