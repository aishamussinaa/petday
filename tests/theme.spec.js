import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
const url = testDatabaseUrl(), origin = 'http://127.0.0.1:5183', emails = [];
const darkButton = page => page.getByRole('button', { name: 'Включить тёмную тему', exact: true });
const lightButton = page => page.getByRole('button', { name: 'Включить светлую тему', exact: true });
async function keyboardClick(page, button) {
  for (let n = 0; n < 40; n++) {
    if (await button.evaluate(el => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(button).toBeFocused(); await page.keyboard.press('Enter');
}
test.afterAll(async () => {
  if (!url || !emails.length) return;
  const db = new pg.Client({ connectionString: url });
  try { await db.connect(); await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [emails]); } finally { await db.end(); }
});

test('theme: early paint, system preference, keyboard toggle, persistence and tabs', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/src/main.jsx', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(32, 28, 36)');
  await page.unroute('**/src/main.jsx'); await page.reload();
  await expect(lightButton(page)).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await keyboardClick(page, darkButton(page)); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(lightButton(page)).toBeFocused();
  expect(await lightButton(page).evaluate(el => { const box=el.getBoundingClientRect(); return box.width===box.height && getComputedStyle(el).borderRadius==='50%'; })).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('petday.theme'))).toBe('dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const other = await context.newPage(); await other.goto('/login'); await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await keyboardClick(page, lightButton(page)); await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
});

test('theme: blocked storage still permits switching', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.goto('/'); await darkButton(page).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.hero-copy').getByRole('link', { name: 'Открыть демо', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await lightButton(page).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme: landing and demo responsive layouts and dialog draft', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/'); await darkButton(page).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const language of ['EN', 'KZ', 'RU']) {
      await page.getByRole('button', { name: language, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.theme-toggle')).toBeVisible();
    }
    await page.screenshot({ path: testInfo.outputPath(`landing-dark-${width}.png`), fullPage: true });
  }
  await page.goto('/demo'); await page.getByRole('button', { name: 'Добавить дело', exact: true }).click();
  const modal = page.getByRole('dialog'); await modal.locator('#task-title').fill('Черновик сохраняется');
  await lightButton(modal).click(); await expect(modal.locator('#task-title')).toHaveValue('Черновик сохраняется');
  await darkButton(modal).click(); await page.screenshot({ path: testInfo.outputPath('dialog-dark.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('demo-dark-mobile.png'), fullPage: true });
});

test('theme: account cards, health, food and forms in dark mode', async ({ page }, testInfo) => {
  test.skip(!url, 'TEST_DATABASE_URL is required');
  const session=await(await page.request.get('/api/auth/session')).json();
  const email=`theme-${randomUUID()}@example.test`;emails.push(email);
  const registered=await page.request.post('/api/auth/register',{headers:{Origin:origin,'X-CSRF-Token':session.csrfToken},data:{email,password:`Fixture-${randomUUID()}`}});expect(registered.status()).toBe(201);
  const headers={Origin:origin,'X-CSRF-Token':(await registered.json()).csrfToken};
  const petResponse=await page.request.post('/api/pets',{headers,multipart:{data:JSON.stringify({name:'Томми',species:'dog',breed:'',sex:'unknown',birthDate:'2020-05-01',birthApproximate:false,features:'',allergies:'Реакция на курицу',notes:'',photoAction:'keep'})}});expect(petResponse.status()).toBe(201);
  const pet=(await petResponse.json()).pet;
  expect((await page.request.post(`/api/pets/${pet.id}/health`,{headers,data:{id:randomUUID(),kind:'visit',status:'planned',title:'Осмотр',date:'2024-05-01',nextDate:null,clinic:'Ветклиника',vet:'Анна',notes:'Уточнить дату повторного приёма',timeZone:'UTC'}})).status()).toBe(201);
  await page.emulateMedia({colorScheme:'dark'});await page.goto('/app');await expect(page.locator('.account-pet-grid')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('account-dark-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:950});
  for(const name of ['Сегодня','Питание','Здоровье']){
    await page.locator('.account-nav').getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.account-main > [role=status]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await expect(page.locator('.medical-record')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('health-dark-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Добавить прививку',exact:true}).click();
  const modal=page.getByRole('dialog');await modal.getByLabel('Название прививки *',{exact:true}).fill('Черновик');
  await lightButton(modal).click();await expect(modal.getByLabel('Название прививки *',{exact:true})).toHaveValue('Черновик');
  await darkButton(modal).click();await page.keyboard.press('Escape');
  await page.clock.setFixedTime(new Date('2027-05-01T12:00:00'));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.birthday-party')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('birthday-dark-mobile.png'),fullPage:true});
});
