import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
import { calendarDistance, healthReminders, dayKey } from '../client/src/account/careOverview.js';
const url = testDatabaseUrl(), origin = 'http://127.0.0.1:5183', emails = [];
async function setup(context) {
  const session = await (await context.get('/api/auth/session')).json();
  const email = `care-${randomUUID()}@example.test`; emails.push(email);
  const response = await context.post('/api/auth/register', { headers: { Origin: origin, 'X-CSRF-Token': session.csrfToken }, data: { email, password: `Fixture-${randomUUID()}` } }); expect(response.status()).toBe(201);
  const headers = { Origin: origin, 'X-CSRF-Token': (await response.json()).csrfToken };
  const result = await context.post('/api/pets', { headers, multipart: { data: JSON.stringify({ name: 'Томми', species: 'dog', breed: 'Пудель', sex: 'unknown', birthDate: null, birthApproximate: false, features: '', allergies: 'Курица', notes: '', photoAction: 'keep' }) } }); expect(result.status()).toBe(201);
  return { headers, base: `/api/pets/${(await result.json()).pet.id}` };
}
test.afterAll(async () => {
  if (!url || !emails.length) return;
  const db = new pg.Client({ connectionString: url }); try { await db.connect(); await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [emails]); } finally { await db.end(); }
});
test('care reminders: calendar boundaries, follow-up dates and overdue plans', () => {
  expect(calendarDistance('2026-03-28','2026-03-30')).toBe(2);
  const records = [{id:'a', status:'completed',date:'2026-11-01',nextDate:'2026-11-25'}, {id:'b',status:'planned',date:'2026-11-24'}, {id:'c',status:'planned',date:'2026-11-22'}, {id:'d',status:'planned',date:'2026-12-02'}];
  expect(healthReminders(records,'2026-11-24').map(r=>[r.key,r.days])).toEqual([['c:plan',-2],['b:plan',0],['a:next',1]]);
});
test('weights API: privacy, dates, precision, retry, conflicts and deletion', async ({playwright}) => {
  test.skip(!url);
  const owner=await playwright.request.newContext({baseURL:origin}), stranger=await playwright.request.newContext({baseURL:origin});
  try {
    const {headers,base}=await setup(owner), other=await setup(stranger), endpoint=`${base}/weights`;
    expect((await stranger.get(endpoint)).status()).toBe(404);
    const body={id:randomUUID(),kg:3.456,date:'2024-05-01',notes:'После прогулки',timeZone:'Asia/Qyzylorda'};
    expect((await owner.post(endpoint,{data:body})).status()).toBe(403);
    for(const invalid of [{kg:0},{kg:-1},{kg:2001},{kg:3.1234},{kg:'3'},{date:'2099-01-01'},{date:'2024-02-30'},{notes:'x'.repeat(1001)}]) expect((await owner.post(endpoint,{headers,data:{...body,...invalid}})).status()).toBe(400);
    const created=await owner.post(endpoint,{headers,data:body}); expect(created.status()).toBe(201); let record=(await created.json()).record;
    expect((await owner.post(endpoint,{headers,data:body})).status()).toBe(200);
    expect((await owner.post(`${other.base}/weights`,{headers,data:body})).status()).toBe(404);
    expect((await stranger.delete(`${endpoint}/${record.id}`,{headers:other.headers,data:{version:1}})).status()).toBe(404);
    const update={...body,version:1,kg:3.5};
    const race=await Promise.all([owner.put(`${endpoint}/${record.id}`,{headers,data:update}),owner.put(`${endpoint}/${record.id}`,{headers,data:update})]);expect(race.map(r=>r.status()).sort()).toEqual([200,409]);
    const list=(await (await owner.get(endpoint)).json()).records;expect(list).toHaveLength(1);expect(list[0].kg).toBe(3.5);expect(list[0].version).toBe(2);
    expect((await owner.delete(`${endpoint}/${record.id}`,{headers,data:{version:1}})).status()).toBe(409);
    expect((await owner.delete(`${endpoint}/${record.id}`,{headers,data:{version:2}})).status()).toBe(204);
    expect((await owner.post(endpoint,{headers,data:body})).status()).toBe(409);
    expect((await (await owner.get(endpoint)).json()).records).toEqual([]);
  } finally {await owner.dispose();await stranger.dispose();}
});
test('care UI: daily summary, partial failure, weight CRUD and PDF download', async ({page},info) => {
  test.skip(!url); const {headers,base}=await setup(page.request);const day=dayKey();
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const health=await page.request.post(`${base}/health`,{headers,data:{id:randomUUID(),kind:'visit',status:'planned',title:'Плановый осмотр',date:dayKey(tomorrow),nextDate:null,clinic:'Клиника',vet:'Анна',notes:'Взять ветпаспорт',timeZone:'Asia/Qyzylorda'}});expect(health.status()).toBe(201);
  expect((await page.request.post(`${base}/meals`,{headers,data:{id:randomUUID(),title:'Завтрак',day,time:'08:00',kind:'dry',amount:50,unit:'g',notes:'',timeZone:'Asia/Qyzylorda'}})).status()).toBe(201);
  expect((await page.request.post(`${base}/tasks`,{headers,data:{id:randomUUID(),title:'Прогулки',day,time:'00:01',category:'walk',notes:'',targetCount:3}})).status()).toBe(201);
  await page.goto('/app');await page.getByRole('button',{name:'Сегодня',exact:true}).first().click();
  await expect(page.locator('.care-reminders')).toContainText('Завтра');await expect(page.locator('.care-reminders')).toContainText('Прогулки');
  await expect(page.locator('.care-summary article').nth(1).locator('strong')).toHaveText('1');
  await page.getByRole('button',{name:'Открыть питание',exact:true}).click();await expect(page.locator('.feeding-entry')).toHaveCount(1);
  await page.route('**/api/pets/*/health',route=>route.abort());await page.locator('.account-nav').getByRole('button',{name:'Сегодня',exact:true}).click();await expect(page.locator('.care-reminders')).toContainText('Часть данных не загрузилась');
  await page.unroute('**/api/pets/*/health');await page.locator('.care-reminders').getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.locator('.care-reminders')).toContainText('Завтра');
  await page.getByRole('button',{name:'Открыть здоровье',exact:true}).click();const panel=page.locator('.weight-panel');await expect(panel).toContainText('Измерений пока нет');
  await panel.getByRole('button',{name:'Записать вес'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Вес, кг').fill('3.4');await dialog.getByLabel('Заметки').fill('Контрольный вес');
  await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(panel.locator('.weight-latest')).toContainText('3,4 кг');
  await page.reload();await page.locator('.account-nav').getByRole('button',{name:'Здоровье',exact:true}).click();await expect(panel.locator('.weight-latest')).toContainText('3,4 кг');
  await panel.locator('summary').click();await panel.getByRole('button',{name:'Редактировать',exact:true}).click();await dialog.getByLabel('Вес, кг').fill('3.55');await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(panel.locator('.weight-latest')).toContainText('3,55 кг');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать отчёт PDF'}).click();const file=await downloaded;await file.saveAs(info.outputPath('account-report.pdf'));expect((await fs.readFile(info.outputPath('account-report.pdf'))).subarray(0,5).toString()).toBe('%PDF-');
  await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'Включить тёмную тему'}).click();await page.screenshot({path:info.outputPath('health-mobile.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel.getByRole('button',{name:'Удалить',exact:true}).click();await dialog.getByRole('button',{name:'Отмена',exact:true}).click();await expect(panel.locator('.weight-history li')).toHaveCount(1);
  await panel.getByRole('button',{name:'Удалить',exact:true}).click();await dialog.getByRole('button',{name:'Удалить',exact:true}).click();await expect(panel).toContainText('Измерений пока нет');
});
test('demo: weights, PDF in three languages and responsive today',async({page},info)=>{
  await page.goto('/demo');await expect(page.locator('.care-summary')).toBeVisible();await page.screenshot({path:info.outputPath('today-desktop.png'),fullPage:true});
  await page.locator('.side-nav').getByRole('button',{name:'Здоровье',exact:true}).click();await expect(page.locator('.weight-latest')).toContainText('3,6');
  for(const [lang,label] of [['RU','Скачать отчёт PDF'],['KZ','PDF есебін жүктеу'],['EN','Download PDF report']]){
    await page.locator('.sidebar').getByRole('button',{name:lang,exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();await (await wait).saveAs(info.outputPath(`demo-${lang}.pdf`));
  }
  await page.setViewportSize({width:390,height:900});await page.locator('.bottom-nav').getByRole('button',{name:'Today',exact:true}).click();await page.screenshot({path:info.outputPath('today-mobile.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Install PetDay',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Safari');
});
test('PWA: manifest, icons, offline fallback and no private caches',async({page})=>{
  await page.goto('/');const response=await page.request.get('/manifest.webmanifest');const manifest=await response.json();expect(manifest.display).toBe('standalone');for(const icon of manifest.icons)expect((await page.request.get(icon.src)).ok()).toBe(true);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  const cached=await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.filter(k=>k.startsWith('petday-')).map(async k=>(await(await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat()});expect(cached).toEqual(['/offline.html']);
  await page.context().setOffline(true);await page.goto('/app');await expect(page.getByRole('heading',{name:'Нет подключения'})).toBeVisible();await page.context().setOffline(false);await page.getByRole('button',{name:'Попробовать снова'}).click();await expect(page.locator('.auth-card')).toBeVisible();
});
