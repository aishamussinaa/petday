import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';

test('Undo across sections restores original meals, health records, weight and partial routine progress', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/demo');
  const nav = name => page.locator('.account-nav').getByRole('button',{name,exact:true}).click();
  const confirm = () => page.getByRole('dialog').locator('.button.danger').click();
  const undo = () => page.locator('.undo-notice').getByRole('button',{name:'Вернуть',exact:true}).click();
  const walk = page.locator('.today-task').filter({has:page.locator('.goal-counter')});
  await expect(walk.locator('.goal-counter [role=status]')).toHaveText('1 из 3');
  await walk.locator('.today-remove').click(); await confirm();
  await expect(walk).toHaveCount(0);
  await nav('Питание');
  const meal=page.locator('.feeding-entry');
  await meal.locator('.feeding-remove').click(); await confirm();
  await expect(meal).toHaveCount(0);
  await undo(); await expect(meal).toContainText('50');
  await undo(); await nav('Сегодня');
  await expect(walk.locator('.goal-counter [role=status]')).toHaveText('1 из 3');
  await nav('Здоровье');
  await page.locator('.medical-record').first().getByRole('button',{name:'Удалить',exact:true}).click();
  await confirm(); await expect(page.locator('.medical-record')).toHaveCount(1);
  await undo(); await expect(page.locator('.medical-record')).toHaveCount(2);
  await page.locator('.weight-history summary').click();
  await page.locator('.weight-history li').first().getByRole('button',{name:'Удалить',exact:true}).click();
  await confirm(); await expect(page.locator('.weight-history li')).toHaveCount(2);
  await undo(); await expect(page.locator('.weight-history li')).toHaveCount(3);
});

test('owner can restore the exact deletion once; stale versions, cross-pet access and missing CSRF are rejected',async({playwright})=>{
  const dbUrl=testDatabaseUrl();test.skip(!dbUrl,'Test database required');
  const origin='http://127.0.0.1:5183', emails=[];
  const owner=await playwright.request.newContext({baseURL:origin}), other=await playwright.request.newContext({baseURL:origin});
  async function setup(client){
    const {csrfToken}=await(await client.get('/api/auth/session')).json();
    const email='undo-'+randomUUID()+'@example.test';emails.push(email);
    const user=await client.post('/api/auth/register',{headers:{Origin:origin,'X-CSRF-Token':csrfToken},data:{email,password:'Test-'+randomUUID()}});
    expect(user.status()).toBe(201);
    const headers={Origin:origin,'X-CSRF-Token':(await user.json()).csrfToken};
    const data={name:'Undo',species:'dog',breed:'',sex:'unknown',birthDate:null,birthApproximate:false,features:'',allergies:'',notes:'',photoAction:'keep'};
    const pet=await client.post('/api/pets',{headers,multipart:{data:JSON.stringify(data)}});expect(pet.status()).toBe(201);
    return {headers,base:'/api/pets/'+(await pet.json()).pet.id};
  }
  try{
    const user=await setup(owner), stranger=await setup(other);
    const date='2024-05-12';
    for(const [kind,fields] of [
      ['tasks',{day:date,category:'walk',title:'Walk',targetCount:3,time:'',notes:''}],
      ['meals',{day:date,kind:'dry',title:'Meal',time:'',amount:55,unit:'g',notes:''}],
      ['weights',{date,kg:4.25,notes:'Measured'}],
      ['health',{date,kind:'visit',title:'Vet',status:'completed',nextDate:null,vet:'Vet',clinic:'Clinic',notes:''}],
    ]){
      const id=randomUUID(),headers=user.headers,collection=user.base+'/'+kind,url=collection+'/'+id;
      expect((await owner.post(collection,{headers,data:{...fields,id,timeZone:'UTC'}})).status()).toBe(201);
      expect((await owner.delete(url,{headers,data:{version:1}})).ok()).toBe(true);
      const restore=url+'/restore',data={version:2};
      expect((await other.post(restore,{headers:stranger.headers,data})).status()).toBe(404);
      expect((await other.post(stranger.base+'/'+kind+'/'+id+'/restore',{headers:stranger.headers,data})).status()).toBe(404);
      expect((await owner.post(restore,{data})).status()).toBe(403);
      expect((await owner.post(restore,{headers,data:{version:5}})).status()).toBe(409);
      const attempts=await Promise.all([owner.post(restore,{headers,data}),owner.post(restore,{headers,data})]);
      expect(attempts.map(result=>result.status())).toEqual([204,204]);
      const result=await(await owner.get(collection+'?date='+date)).json();
      expect(result.tasks || result.meals || result.records).toEqual([expect.objectContaining({id,version:3,...fields})]);
      if(kind==='tasks')expect(result.events.filter(e=>e.action==='restored')).toHaveLength(1);
      expect((await owner.delete(url,{headers,data:{version:3}})).ok()).toBe(true);
      expect((await owner.post(restore,{headers,data})).status()).toBe(409);
    }
  }finally{
    await owner.dispose();await other.dispose();const db=new pg.Client({connectionString:dbUrl});
    try{await db.connect();await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])',[emails]);}finally{await db.end();}
  }
});
