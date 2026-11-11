import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';
const url=testDatabaseUrl(),origin='http://127.0.0.1:5183',emails=[];
test.skip(!url,'TEST_DATABASE_URL is required');
const historical='2024-06-17'; // Monday
async function setup(context){
 const session=await(await context.get('/api/auth/session')).json();const email=`routine-${randomUUID()}@example.test`;emails.push(email);
 const response=await context.post('/api/auth/register',{headers:{Origin:origin,'X-CSRF-Token':session.csrfToken},data:{email,password:`Fixture-${randomUUID()}`}});expect(response.status()).toBe(201);
 const headers={Origin:origin,'X-CSRF-Token':(await response.json()).csrfToken};
 const pet=await context.post('/api/pets',{headers,multipart:{data:JSON.stringify({name:'Тестовый Томми',species:'dog',breed:'',sex:'unknown',birthDate:null,birthApproximate:false,features:'',allergies:'',notes:'',photoAction:'keep'})}});expect(pet.status()).toBe(201);
 return {headers,base:`/api/pets/${(await pet.json()).pet.id}/tasks`};
}
test.afterAll(async()=>{if(!url||!emails.length)return;const db=new pg.Client({connectionString:url});try{await db.connect();await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])',[emails]);}finally{await db.end();}});
const input=()=>({id:randomUUID(),day:historical,title:'Прогулки',category:'walk',time:'',notes:'Взять воду',targetCount:3,weekdays:[1,3,5]});
test('routines API: weekdays, duplicate generation, isolated counts, concurrency and stopping',async({playwright})=>{
 const client=await playwright.request.newContext({baseURL:origin}),stranger=await playwright.request.newContext({baseURL:origin});
 try{
  const {headers,base}=await setup(client),other=await setup(stranger),rule=input();
  for(const invalid of [{targetCount:0},{targetCount:21},{targetCount:1.5},{weekdays:[]},{weekdays:[1,1]},{weekdays:[7]}])expect((await client.post(`${base}/routines`,{headers,data:{...rule,...invalid}})).status()).toBe(400);
  expect((await stranger.post(`${base}/routines`,{headers:other.headers,data:rule})).status()).toBe(404);
  expect((await client.post(`${base}/routines`,{headers,data:rule})).status()).toBe(201);
  expect((await client.post(`${base}/routines`,{headers,data:rule})).status()).toBe(200);
  const lists=await Promise.all([client.get(`${base}?date=${historical}`),client.get(`${base}?date=${historical}`)]);
  const first=await lists[0].json(),second=await lists[1].json();expect(first.tasks).toHaveLength(1);expect(first.tasks[0].id).toBe(second.tasks[0].id);
  expect((await(await client.get(`${base}?date=2024-06-18`)).json()).tasks).toHaveLength(0);
  expect((await(await client.get(`${base}?date=2024-06-14`)).json()).tasks).toHaveLength(0);
  let task=first.tasks[0];expect(task.completedCount).toBe(0);expect(task.targetCount).toBe(3);
  const patch=()=>client.patch(`${base}/${task.id}/count`,{headers,data:{version:task.version,delta:1,timeZone:'UTC'}});
  const race=await Promise.all([patch(),patch()]);expect(race.map(r=>r.status()).sort()).toEqual([200,409]);
  task=(await(await client.get(`${base}?date=${historical}`)).json()).tasks[0];expect(task.completedCount).toBe(1);expect(task.completedAt).toBeNull();
  for(let count=2;count<=3;count++){const r=await patch();expect(r.status()).toBe(200);task=(await r.json()).task;expect(task.completedCount).toBe(count);}
  expect(task.completedAt).not.toBeNull();expect((await patch()).status()).toBe(400);
  expect((await client.put(`${base}/${task.id}`,{headers,data:{...task,targetCount:2}})).status()).toBe(400);
  const undo=await client.patch(`${base}/${task.id}/count`,{headers,data:{version:task.version,delta:-1}});expect(undo.status()).toBe(200);task=(await undo.json()).task;expect(task.completedCount).toBe(2);expect(task.completedAt).toBeNull();
  const next=(await(await client.get(`${base}?date=2024-06-19`)).json()).tasks[0];expect(next.completedCount).toBe(0);
  expect((await client.delete(`${base}/${next.id}`,{headers,data:{version:next.version}})).status()).toBe(200);
  expect((await(await client.get(`${base}?date=2024-06-19`)).json()).tasks).toHaveLength(0);
  // Materialize a future Monday, then ensure stopping removes cached future tasks too.
  expect((await(await client.get(`${base}?date=2099-06-15`)).json()).tasks).toHaveLength(1);
  expect((await stranger.post(`${base}/routines/${rule.id}/stop`,{headers:other.headers,data:{timeZone:'UTC'}})).status()).toBe(404);
  expect((await client.post(`${base}/routines/${rule.id}/stop`,{headers,data:{timeZone:'UTC'}})).status()).toBe(200);
  expect((await(await client.get(`${base}?date=2099-06-15`)).json()).tasks).toHaveLength(0);
  const past=await(await client.get(`${base}?date=${historical}`)).json();expect(past.tasks[0].completedCount).toBe(2);expect(past.events.filter(e=>e.action==='progressed')).toHaveLength(3);expect(past.events.filter(e=>e.action==='reduced')).toHaveLength(1);
 }finally{await client.dispose();await stranger.dispose();}
});
test('daily goal UI: three walks, undo, reload and independent next day',async({page},testInfo)=>{
 await setup(page.request);await page.setViewportSize({width:390,height:900});await page.goto('/app');
 await page.getByRole('button',{name:'Сегодня',exact:true}).click();await page.getByLabel('Дата плана',{exact:true}).fill(historical);
 await page.getByRole('button',{name:'Добавить дело',exact:true}).first().click();const modal=page.getByRole('dialog');
 await modal.getByLabel('Название дела *',{exact:true}).fill('Погулять с Томми');await modal.getByLabel('Категория',{exact:true}).selectOption('walk');await modal.getByLabel('Сколько раз за день',{exact:true}).fill('3');await modal.getByLabel('Повторять',{exact:true}).selectOption('daily');
 await modal.getByRole('button',{name:'EN',exact:true}).click();await expect(page.locator('#task-target')).toHaveValue('3');await modal.getByRole('button',{name:'KZ',exact:true}).click();await expect(page.locator('#task-repeat')).toHaveValue('daily');await modal.getByRole('button',{name:'RU',exact:true}).click();
 await modal.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(modal).not.toBeVisible();
 const plus=page.getByRole('button',{name:'Добавить выполнение: Погулять с Томми',exact:true});
 for(let count=1;count<=3;count++){await plus.click();await expect(page.locator('.goal-counter [role=status]')).toHaveText(`${count} из 3`);}
 await expect(plus).toBeDisabled();await expect(page.locator('.today-progress')).toContainText('Выполнено 1 из 1');
 await page.getByRole('button',{name:'Отменить выполнение: Погулять с Томми',exact:true}).click();await expect(page.locator('.goal-counter [role=status]')).toHaveText('2 из 3');
 await page.reload();await page.getByRole('button',{name:'Сегодня',exact:true}).click();await page.getByLabel('Дата плана',{exact:true}).fill(historical);await expect(page.locator('.goal-counter [role=status]')).toHaveText('2 из 3');
 await page.screenshot({path:testInfo.outputPath('recurring-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:testInfo.outputPath('recurring-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Следующий день',exact:true}).click();await expect(page.locator('.goal-counter [role=status]')).toHaveText('0 из 3');
 await page.locator('.today-routines summary').click();await page.getByRole('button',{name:'Остановить повторение',exact:true}).click();await modal.getByRole('button',{name:'Остановить повторение',exact:true}).click();await expect(modal).not.toBeVisible();await expect(page.locator('.today-routines summary')).toContainText('0');
 await page.getByLabel('Дата плана',{exact:true}).fill('2099-06-15');await expect(page.getByText('На этот день дел пока нет',{exact:true})).toBeVisible();
});
