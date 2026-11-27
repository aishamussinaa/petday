import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
import { weeklySummary, shiftDay } from '../shared/weekly.js';
import { createDemoStore } from '../client/src/data/demoStore.js';
import { dayKey } from '../client/src/account/careOverview.js';

test('weekly calculation: calendar edges, virtual routines, deletions, edited goals and weight', () => {
  expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29'); expect(shiftDay('2025-01-02', -6)).toBe('2024-12-27');
  const routine={id:'r',startDay:'2024-06-17',stopDay:'2024-06-22',weekdays:[1,3,5],category:'walk',targetCount:3};
  const tasks=[{id:'a',day:'2024-06-17',routineId:'r',category:'walk',targetCount:2,completedCount:2},{id:'b',day:'2024-06-19',routineId:'r',category:'walk',targetCount:3,completedCount:1,deletedAt:'2024-06-20'}];
  const result=weeklySummary({end:'2024-06-23',routines:[routine],tasks,meals:[{day:'2024-06-18'},{day:'2024-06-18',deletedAt:'x'},{day:'2024-06-16'}],weights:[{id:'a',date:'2024-06-17',kg:3.4,createdAt:'1'},{id:'b',date:'2024-06-23',kg:3.55,createdAt:'2'},{id:'c',date:'2024-06-23',kg:9,deletedAt:'x'}]});
  expect(result).toMatchObject({done:2,target:5,walks:2,walkTarget:5,completeDays:1,plannedDays:2,meals:1,weight:{change:.15,count:2}});
  expect(result.days[2]).toMatchObject({target:0,done:0,allDone:false}); expect(result.days[4]).toMatchObject({target:3,done:0}); expect(tasks).toHaveLength(2);
  const empty=weeklySummary({end:'2024-06-30',routines:[routine]});expect(empty.target).toBe(0);expect(empty.completeDays).toBe(0);expect(empty.weight.change).toBeNull();
  expect(weeklySummary({end:'2024-06-23',weights:[{id:'a',date:'2024-06-17',kg:3.4}]}).weight.change).toBeNull();
});

test('demo weekly data updates after completion and reset, without creating tasks', async () => {
  const store=createDemoStore({t:key=>key,now:()=>new Date(2026,10,27,12)}),base='/pets/tommy/tasks';
  const get=()=>store.request(`${base}/weekly?end=2026-11-27`);
  expect(await get()).toMatchObject({done:17,target:24,walks:16,walkTarget:21,meals:7,completeDays:4,weight:{change:.1}});
  const {tasks}=await store.request(`${base}?date=2026-11-27`),walk=tasks.find(t=>t.category==='walk');
  await store.request(`${base}/${walk.id}/count`,{method:'PATCH',body:{version:walk.version,delta:1}});expect((await get()).walks).toBe(17);
  expect((await store.request('/pets/uma/tasks/weekly?end=2026-11-27')).walks).toBe(0);
  expect((await store.request(`${base}/weekly?end=2026-11-20`)).target).toBe(0);
  store.reset();expect((await get()).walks).toBe(16);store.dispose();
});

const dbUrl=testDatabaseUrl(),origin='http://127.0.0.1:5183',emails=[];
async function account(client){
  const session=await(await client.get('/api/auth/session')).json(),email=`weekly-${randomUUID()}@example.test`;emails.push(email);
  const response=await client.post('/api/auth/register',{headers:{Origin:origin,'X-CSRF-Token':session.csrfToken},data:{email,password:`Fixture-${randomUUID()}`}});expect(response.status()).toBe(201);
  const headers={Origin:origin,'X-CSRF-Token':(await response.json()).csrfToken};
  const r=await client.post('/api/pets',{headers,multipart:{data:JSON.stringify({name:'Weekly test',species:'dog',breed:'',sex:'unknown',birthDate:null,birthApproximate:false,features:'',allergies:'',notes:'',photoAction:'keep'})}});expect(r.status()).toBe(201);
  const id=(await r.json()).pet.id;return {headers,id,base:`/api/pets/${id}`};
}
test.afterAll(async()=>{if(!dbUrl||!emails.length)return;const db=new pg.Client({connectionString:dbUrl});try{await db.connect();await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])',[emails]);}finally{await db.end();}});

test('weekly API: owner-only, read-only projection, retry and current data',async({playwright,page})=>{
  test.skip(!dbUrl,'Test database required');const client=page.request,stranger=await playwright.request.newContext({baseURL:origin});
  const db=new pg.Client({connectionString:dbUrl});await db.connect();
  try{
    const {headers,id,base}=await account(client);await account(stranger);
    const rule={id:randomUUID(),day:'2024-06-17',title:'Walk three times',category:'walk',time:'',notes:'',targetCount:3,weekdays:[1,3,5]};
    expect((await client.post(`${base}/tasks/routines`,{headers,data:rule})).status()).toBe(201);
    const url=`${base}/tasks/weekly?end=2024-06-23&timeZone=UTC`;
    expect((await stranger.get(url)).status()).toBe(404);
    for(const end of ['2024-02-30','1899-12-31','1900-01-01','2099-01-01'])expect((await client.get(`${base}/tasks/weekly?end=${end}&timeZone=UTC`)).status()).toBe(400);
    expect(await(await client.get(url)).json()).toMatchObject({done:0,target:9,plannedDays:3,completeDays:0});
    expect((await db.query('SELECT count(*)::int AS count FROM "CareTask" WHERE "petId"=$1',[id])).rows[0].count).toBe(0);
    let task=(await(await client.get(`${base}/tasks?date=2024-06-17`)).json()).tasks[0];
    task=(await(await client.patch(`${base}/tasks/${task.id}/count`,{headers,data:{version:1,delta:1,timeZone:'UTC'}})).json()).task;
    expect(await(await client.get(url)).json()).toMatchObject({done:1,target:9});
    const wed=(await(await client.get(`${base}/tasks?date=2024-06-19`)).json()).tasks[0];await client.delete(`${base}/tasks/${wed.id}`,{headers,data:{version:wed.version}});
    expect(await(await client.get(url)).json()).toMatchObject({done:1,target:6,plannedDays:2});
    expect((await client.post(`${base}/meals`,{headers,data:{id:randomUUID(),day:'2024-06-18',title:'Breakfast',kind:'dry',time:'08:00',amount:50,unit:'g',notes:'',timeZone:'UTC'}})).status()).toBe(201);
    for(const [date,kg] of [['2024-06-17',3.4],['2024-06-23',3.55]])expect((await client.post(`${base}/weights`,{headers,data:{id:randomUUID(),date,kg,notes:'',timeZone:'UTC'}})).status()).toBe(201);
    expect(await(await client.get(url)).json()).toMatchObject({meals:1,weight:{count:2,change:.15}});
    await page.goto('/app');await page.locator('.account-nav').getByRole('button',{name:'Сегодня',exact:true}).click();await page.getByLabel('Дата плана',{exact:true}).fill('2024-06-23');
    await page.route('**/tasks/weekly?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'DATABASE_UNAVAILABLE'}})}));
    await page.getByRole('button',{name:'За неделю',exact:true}).click();await expect(page.locator('.weekly-panel [role="alert"]')).toBeVisible();await expect(page.getByTestId('week-steps')).toHaveCount(0);
    await page.unroute('**/tasks/weekly?**');await page.locator('.weekly-panel').getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByTestId('week-steps')).toHaveText('1 / 6');
    await page.locator('.weekly-chart button').first().click();await expect(page.getByLabel('Дата плана',{exact:true})).toHaveValue('2024-06-17');
    await page.getByRole('button',{name:'Добавить выполнение: Walk three times'}).click();await page.getByRole('button',{name:'За неделю',exact:true}).click();await expect(page.getByTestId('week-steps')).toHaveText('2 / 3');
  }finally{await db.end();await stranger.dispose();}
});

test('mobile weekly demo: bottom navigation, keyboard, languages, themes, no API',async({page},info)=>{
  const errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/demo');
  const nav=page.locator('.account-nav');await expect(nav).toHaveCSS('position','fixed');
  await page.getByRole('button',{name:'За неделю',exact:true}).click();await expect(page.getByTestId('week-walks')).toHaveText('16 / 21');await expect(page.locator('.weekly-chart button')).toHaveCount(7);
  await page.getByRole('button',{name:'Раньше на неделю'}).click();await expect(page.getByTestId('week-steps')).toHaveText('0 / 0');await expect(page.locator('.weekly-chart')).toContainText('Нет плана');
  await page.getByRole('button',{name:'Последние 7 дней',exact:true}).click();await expect(page.getByTestId('week-steps')).toHaveText('17 / 24');
  const end=dayKey();await page.locator('.weekly-chart button').last().click();await expect(page.getByLabel('Дата плана',{exact:true})).toHaveValue(end);
  await page.getByRole('button',{name:'За неделю',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByTestId('week-steps')).toBeVisible();
  await page.locator('.real-pet-selector').getByRole('button',{name:'Ума',exact:true}).click();await page.getByRole('button',{name:'За неделю',exact:true}).click();await expect(page.getByTestId('week-walks')).toHaveText('0 / 0');
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const language of ['RU','KZ','EN']){await page.locator('.account-header').getByRole('button',{name:language,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
    if(width===390){await page.screenshot({path:info.outputPath('weekly-mobile-light.png'),fullPage:true});await page.locator('.account-header .theme-toggle').click();await page.screenshot({path:info.outputPath('weekly-mobile-dark.png'),fullPage:true});await page.locator('.account-header .theme-toggle').click();}
  }
  await page.setViewportSize({width:390,height:844});await nav.getByRole('button',{name:'Health',exact:true}).click();await expect(page.locator('#account-section')).toBeFocused();await expect(page.locator('.health-panel')).toBeVisible();
  await page.getByRole('button',{name:'Add vaccination',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Add vaccination',exact:true})).toBeFocused();
  const box=await nav.boundingBox();expect(box.y+box.height).toBeCloseTo(844,0);expect(errors).toEqual([]);expect(api).toEqual([]);
});
