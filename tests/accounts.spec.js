import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';

const databaseUrl = testDatabaseUrl();
test.skip(!databaseUrl, 'Configure a separate TEST_DATABASE_URL');
const emails = [];
const password = 'Fixture-only-' + randomUUID();
const origin = 'http://127.0.0.1:5183';
const newEmail = () => { const value = `petday-${randomUUID()}@example.test`; emails.push(value); return value; };
const petData = { name: 'Тестовый питомец', species: 'cat', breed: '', sex: 'unknown', birthDate: '2024-02-29', birthApproximate: false, features: '', allergies: '', notes: '', photoAction: 'keep', timeZone: 'Asia/Almaty' };

test.afterAll(async () => {
  if (!databaseUrl || !emails.length) return;
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    // Only accounts created by this run, only in the guarded test database.
    await client.query('DELETE FROM "User" WHERE email = ANY($1::text[])', [emails]);
  } finally { await client.end(); }
});

test('accounts: private photos, validation, concurrency and persistence after login', async ({ playwright }) => {
  const contexts = [];
  async function account() {
    const context = await playwright.request.newContext({ baseURL: origin }); contexts.push(context);
    let token = (await (await context.get('/api/auth/session')).json()).csrfToken;
    const email = newEmail();
    const registered = await context.post('/api/auth/register', { headers: { Origin: origin, 'X-CSRF-Token': token }, data: { email, password } });
    expect(registered.status()).toBe(201);
    const body = await registered.json(); token = body.csrfToken;
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(registered.headers()['set-cookie']).toContain('HttpOnly');
    return { context, email, headers: { Origin: origin, 'X-CSRF-Token': token } };
  }
  let owner, stranger, id;
  try {
    owner = await account(); stranger = await account();
    expect((await owner.context.post('/api/pets', { multipart: { data: JSON.stringify(petData) } })).status()).toBe(403);
    const image = await import('sharp');
    const png = await image.default({ create: { width: 80, height: 60, channels: 3, background: '#f29bc1' } }).png().toBuffer();
    const created = await owner.context.post('/api/pets', { headers: owner.headers, multipart: {
      data: JSON.stringify({ ...petData, photoAction: 'replace', crop: { x: .5, y: .5, zoom: 1 } }),
      photo: { name: 'test.png', mimeType: 'image/png', buffer: png },
    } });
    expect(created.status()).toBe(201);
    const pet = (await created.json()).pet; id = pet.id;
    expect(pet.birthDate).toBe('2024-02-29');
    const photo = await owner.context.get(pet.photoUrl);
    expect(photo.status()).toBe(200); expect(photo.headers()['content-type']).toContain('image/webp');
    expect((await stranger.context.get(`/api/pets/${id}`)).status()).toBe(404);
    expect((await stranger.context.get(pet.photoUrl)).status()).toBe(404);
    expect((await stranger.context.delete(`/api/pets/${id}`, { headers: stranger.headers, data: {version:1} })).status()).toBe(404);
    const invalid = await owner.context.put(`/api/pets/${id}`, { headers: owner.headers, multipart: { data: JSON.stringify({ ...petData, version:1, birthDate:'2999-01-01' }) } });
    expect(invalid.status()).toBe(400);
    const damaged = await owner.context.put(`/api/pets/${id}`, { headers: owner.headers, multipart: {
      data: JSON.stringify({ ...petData, version:1, photoAction:'replace', crop:{x:.5,y:.5,zoom:1} }),
      photo: { name:'fake.png', mimeType:'image/png', buffer:Buffer.from('not an image') },
    } });
    expect(damaged.status()).toBe(400); expect((await owner.context.get(pet.photoUrl)).status()).toBe(200);
    const updates = await Promise.all(['Первое изменение','Второе изменение'].map(name => owner.context.put(`/api/pets/${id}`, { headers:owner.headers, multipart:{data:JSON.stringify({...petData,name,version:1})} })));
    expect(updates.map(r=>r.status()).sort()).toEqual([200,409]);
    expect((await owner.context.post('/api/auth/logout',{headers:owner.headers})).status()).toBe(204);
    expect((await owner.context.get(`/api/pets/${id}`)).status()).toBe(401);
    const anonymous = await (await owner.context.get('/api/auth/session')).json();
    const login = await owner.context.post('/api/auth/login',{headers:{Origin:origin,'X-CSRF-Token':anonymous.csrfToken},data:{email:owner.email,password}});
    expect(login.status()).toBe(200); owner.headers['X-CSRF-Token']=(await login.json()).csrfToken;
    expect((await (await owner.context.get(`/api/pets/${id}`)).json()).pet.version).toBe(2);
  } finally {
    if (owner && id) {
      const result = await owner.context.get(`/api/pets/${id}`);
      if (result.ok()) await owner.context.delete(`/api/pets/${id}`,{headers:owner.headers,data:{version:(await result.json()).pet.version}});
    }
    for (const context of contexts) await context.dispose();
  }
});

test('account UI: registration, draft languages, photo, network retry, reload and deletion', async ({ page }, testInfo) => {
  await page.setViewportSize({width:390,height:900});
  await page.goto('/register');
  await page.getByLabel('Email',{exact:true}).fill(newEmail());
  await page.getByLabel('Пароль',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Создать аккаунт',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Мои питомцы',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Создать первый профиль'}).click();
  await page.getByLabel('Имя *',{exact:true}).fill('Проверка сохранения');
  await page.getByRole('dialog').getByLabel('Порода',{exact:true}).fill('Черновик');
  await page.getByRole('dialog').getByRole('button',{name:'EN',exact:true}).click();
  await expect(page.locator('#pet-name')).toHaveValue('Проверка сохранения');
  await page.getByRole('dialog').getByRole('button',{name:'KZ',exact:true}).click();
  await expect(page.locator('#pet-breed')).toHaveValue('Черновик');
  await page.getByRole('dialog').getByRole('button',{name:'RU',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Выбрать фотографию',{exact:true}).setInputFiles('client/public/images/poodle.jpg');
  await expect(page.locator('.crop-preview')).toBeVisible();
  await page.route('**/api/pets', route => route.request().method()==='POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Имя *',{exact:true})).toHaveValue('Проверка сохранения');
  await page.unroute('**/api/pets');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'Проверка сохранения',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Проверка сохранения',exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('account-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:testInfo.outputPath('account-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Посмотреть профиль',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Удалить профиль',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Удалить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Добавьте первого питомца'})).toBeVisible();
});
