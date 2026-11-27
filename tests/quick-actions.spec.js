import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './database-guard.mjs';

for (const demo of [true, false]) test('Today quick actions in ' + (demo ? 'demo' : 'a personal account'), async ({ page }) => {
  const dbUrl = demo ? null : testDatabaseUrl();
  test.skip(!demo && !dbUrl, 'Test database required');
  const email = 'quick-' + randomUUID() + '@example.test';
  const nav = page.locator('.account-nav');
  try {
    if (!demo) {
      const client = page.request, origin = 'http://127.0.0.1:5183';
      const session = await (await client.get('/api/auth/session')).json();
      const registration = await client.post('/api/auth/register', { headers: { Origin: origin, 'X-CSRF-Token': session.csrfToken }, data: { email, password: 'Fixture-' + randomUUID() } });
      expect(registration.status()).toBe(201);
      const headers = { Origin: origin, 'X-CSRF-Token': (await registration.json()).csrfToken };
      const data = { name:'Quick', species:'dog', breed:'', sex:'unknown', birthDate:null, birthApproximate:false, features:'', allergies:'', notes:'', photoAction:'keep' };
      expect((await client.post('/api/pets', { headers, multipart:{ data:JSON.stringify(data) } })).status()).toBe(201);
    }
    await page.setViewportSize({ width:390, height:844 });
    await page.goto(demo ? '/demo' : '/app');
    await nav.getByRole('button', { name:'Сегодня',exact:true }).click();
    const actions = page.locator('.quick-actions');
    await actions.getByRole('button',{ name:'Погуляли' }).click();
    await expect(actions.getByRole('status')).toHaveText('Прогулка отмечена.');
    if (demo) await expect(page.locator('.goal-counter [role=status]')).toHaveText('2 из 3');
    else await expect(page.locator('.today-task').getByRole('checkbox')).toBeChecked();
    await actions.getByRole('button',{name:'Покормили'}).click();
    await expect(page.locator('.care-summary article').nth(1).locator('strong')).toHaveText(demo ? '2' : '1');
    await actions.getByRole('button',{name:'Записать вес'}).click();
    await page.getByRole('dialog').locator('input[type=number]').fill('4.275');
    await page.getByRole('dialog').getByRole('button',{name:'Сохранить'}).click();
    await expect(actions.getByRole('status')).toHaveText('Вес сохранён в разделе «Здоровье».');
    await page.getByLabel('Дата плана',{exact:true}).fill('2024-01-01');
    await expect(actions).toHaveCount(0);
    await nav.getByRole('button',{name:'Питание',exact:true}).click();
    await expect(page.locator('.feeding-entry').filter({hasText:'Кормление'})).toHaveCount(1);
    await nav.getByRole('button',{name:'Здоровье',exact:true}).click();
    await expect(page.locator('.weight-latest')).toContainText('4,275');
  } finally {
    if (dbUrl) { const db = new pg.Client({connectionString:dbUrl}); try { await db.connect(); await db.query('DELETE FROM "User" WHERE email=$1',[email]); } finally { await db.end(); } }
  }
});
