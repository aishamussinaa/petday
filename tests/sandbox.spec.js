import { test, expect } from '@playwright/test';
import { createDemoStore } from '../client/src/data/demoStore.js';
import { dayKey } from '../client/src/account/careOverview.js';
import path from 'node:path';

const nav = (page, name) => page.locator('.account-nav').getByRole('button', { name, exact: true });
const pet = (page, name) => page.locator('.real-pet-selector').getByRole('button', { name, exact: true });
const save = page => page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true });
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return dayKey(date); };

test('sandbox store: isolated instances, routines, retry, versions, validation and soft deletes', async () => {
  const a = createDemoStore({ t: key => key, now: () => new Date(2026, 10, 24, 12) }), b = createDemoStore({ t: key => key, now: () => new Date(2026, 10, 24, 12) });
  const request = a.request, base = '/pets/tommy/tasks';
  const data = { id: crypto.randomUUID(), title: 'Walk', category: 'walk', time: '', notes: '', targetCount: 3, day: '2026-11-24', weekdays: [2, 4] };
  await request(`${base}/routines`, { method: 'POST', body: data }); await request(`${base}/routines`, { method: 'POST', body: data });
  let result = await request(`${base}?date=2026-11-24`); let task = result.tasks.find(item => item.routineId === data.id); expect(task.completedCount).toBe(0); expect(result.routines.filter(r => r.id === data.id)).toHaveLength(1);
  await request(`${base}/${task.id}/count`, { method: 'PATCH', body: { version: 1, delta: 1 } });
  await expect(request(`${base}/${task.id}/count`, { method: 'PATCH', body: { version: 1, delta: 1 } })).rejects.toMatchObject({ code: 'TASK_CHANGED' });
  result = await request(`${base}?date=2026-11-24`); expect(result.tasks.find(t => t.id === task.id).completedCount).toBe(1); expect(result.events[0].action).toBe('progressed');
  expect((await b.request(`${base}?date=2026-11-24`)).tasks.some(t => t.routineId === data.id)).toBe(false);
  expect((await request(`${base}?date=2026-11-25`)).tasks.some(t => t.routineId === data.id)).toBe(false);
  task = (await request(`${base}?date=2026-11-26`)).tasks.find(t => t.routineId === data.id);
  await expect(request(`${base}/${task.id}/count`, { method: 'PATCH', body: { version: 1, delta: 1 } })).rejects.toMatchObject({ code: 'TASK_FUTURE' });
  await request(`${base}/${task.id}`, { method: 'DELETE', body: { version: 1 } }); expect((await request(`${base}?date=2026-11-26`)).tasks.some(t => t.id === task.id)).toBe(false);
  await request(`${base}/routines/${data.id}/stop`, { method: 'POST' }); expect((await request(`${base}?date=2026-12-01`)).tasks.some(t => t.routineId === data.id)).toBe(false);
  await expect(request('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'API_NOT_FOUND' });
  await expect(request('/pets/tommy/weights', { method: 'POST', body: { id: 'bad', date: '2099-01-01', kg: 3, notes: '' } })).rejects.toMatchObject({ code: 'WEIGHT_DATE' });
  a.reset(); expect((await request(`${base}?date=2026-11-24`)).routines.some(r => r.id === data.id)).toBe(false); a.dispose(); b.dispose();
});

test('sandbox: no API requests, daily goal, repeat on another day, edit and stop', async ({ page }) => {
  const api = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url()); }); await page.route('**/api/**', route => route.abort());
  await page.goto('/demo'); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Попробуйте PetDay'); await expect(page.locator('.auth-card')).toHaveCount(0);
  const walks = page.locator('.today-task').filter({ has: page.getByRole('heading', { name: 'Прогулки с Томми', exact: true }) });
  await expect(walks.locator('[role="status"]')).toHaveText('1 из 3'); await walks.getByRole('button', { name: 'Добавить выполнение: Прогулки с Томми' }).click(); await expect(walks.locator('[role="status"]')).toHaveText('2 из 3');
  await pet(page, 'Ума').click(); await expect(walks).toHaveCount(0); await pet(page, 'Томми').click(); await expect(walks.locator('[role="status"]')).toHaveText('2 из 3');
  await page.getByRole('button', { name: 'Добавить дело', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.locator('#task-title').fill('Демо прогулки'); await dialog.locator('#task-target').fill('3'); await dialog.locator('#task-repeat').selectOption('daily'); await save(page).click();
  const added = page.locator('.today-task').filter({ has: page.getByRole('heading', { name: 'Демо прогулки', exact: true }) }); await added.getByRole('button', { name: 'Добавить выполнение: Демо прогулки' }).click(); await expect(added.locator('[role="status"]')).toHaveText('1 из 3');
  await page.getByLabel('Дата плана', { exact: true }).fill(tomorrow()); await expect(added.locator('[role="status"]')).toHaveText('0 из 3'); await expect(added.getByRole('button', { name: 'Добавить выполнение: Демо прогулки' })).toBeDisabled();
  await page.getByLabel('Дата плана', { exact: true }).fill(dayKey()); await expect(added.locator('[role="status"]')).toHaveText('1 из 3');
  await added.getByRole('button', { name: 'Изменить', exact: true }).click(); await dialog.locator('#task-title').fill('Изменённое дело'); await save(page).click(); await expect(page.locator('.today-task').filter({ hasText: 'Изменённое дело' })).toHaveCount(1);
  await page.locator('.today-routines summary').click(); const routine = page.locator('.today-routines article').filter({ hasText: 'Демо прогулки' }); await routine.getByRole('button', { name: 'Остановить повторение' }).click(); await dialog.getByRole('button', { name: 'Остановить повторение' }).click();
  await page.getByLabel('Дата плана', { exact: true }).fill(tomorrow()); await expect(added).toHaveCount(0); expect(api).toEqual([]);
});

test('sandbox: create pet, local photo crop, birthday, edit and delete', async ({ page }) => {
  const api = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url()); });
  await page.goto('/demo'); await page.getByRole('button', { name: 'Добавить питомца', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.locator('#pet-name').fill('Пиксель'); await dialog.locator('#pet-species').selectOption('cat');
  const birth = new Date(); birth.setFullYear(birth.getFullYear() - 1); await dialog.locator('#pet-birthDate').fill(dayKey(birth));
  await dialog.locator('#pet-photo').setInputFiles(path.resolve('client/public/images/poodle.jpg')); await expect(dialog.locator('#crop-zoom')).toBeVisible();
  await dialog.locator('#crop-zoom').fill('2'); await dialog.getByRole('button', { name: 'Сбросить кадр' }).click(); await expect(dialog.locator('#crop-zoom')).toHaveValue('1'); await dialog.locator('#crop-zoom').fill('1.5'); await save(page).click();
  await expect(dialog).not.toBeVisible(); await expect(page.locator('.birthday-party')).toContainText('Пиксель'); await expect(pet(page, 'Пиксель').locator('img')).toHaveAttribute('src', /^blob:/);
  const size = await pet(page, 'Пиксель').locator('img').evaluate(async img => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; }); expect(size[0]).toBe(size[1]);
  await nav(page, 'Питомцы').click(); let card = page.locator('.real-pet-card').filter({ has: page.getByRole('heading', { name: 'Пиксель', exact: true }) });
  await card.getByRole('button', { name: 'Редактировать', exact: true }).click(); await dialog.locator('#pet-name').fill('Пиксель 2'); await dialog.locator('#pet-allergies').fill('Пример аллергии'); await save(page).click();
  await nav(page, 'Здоровье').click(); await expect(page.locator('.health-allergies')).toContainText('Пример аллергии'); await nav(page, 'Питомцы').click(); card = page.locator('.real-pet-card').filter({ has: page.getByRole('heading', { name: 'Пиксель 2', exact: true }) });
  await card.getByRole('button', { name: 'Посмотреть профиль' }).click(); await dialog.getByRole('button', { name: 'Удалить профиль' }).click(); await dialog.getByRole('button', { name: 'Удалить', exact: true }).click(); await expect(pet(page, 'Пиксель 2')).toHaveCount(0); expect(api).toEqual([]);
});

test('sandbox: meal CRUD, health plans, weight PDF and reset confirmation', async ({ page }, info) => {
  const api=[]; page.on('request', r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url())}); await page.goto('/demo'); await nav(page,'Питание').click(); await page.getByRole('button',{name:'Добавить кормление'}).click();const dialog=page.getByRole('dialog');
  await dialog.locator('#meal-title').fill('Демо корм');await dialog.locator('#meal-amount').fill('75');await save(page).click();let meal=page.locator('.feeding-entry').filter({hasText:'Демо корм'});await expect(meal).toContainText('75 г');
  await meal.getByRole('button',{name:'Редактировать'}).click();await dialog.locator('#meal-amount').fill('80');await save(page).click();await expect(meal).toContainText('80 г');
  await nav(page,'Сегодня').click();await expect(page.locator('.care-summary article').nth(1).locator('strong')).toHaveText('2');await nav(page,'Питание').click();await meal.getByRole('button',{name:'Удалить',exact:true}).click();await dialog.getByRole('button',{name:'Удалить',exact:true}).click();await expect(meal).toHaveCount(0);
  await nav(page,'Здоровье').click();await page.getByRole('button',{name:'Добавить прививку'}).click();await dialog.locator('#health-title').fill('Демо прививка');await dialog.locator('#health-date').fill(tomorrow());await save(page).click();let health=page.locator('.medical-record').filter({hasText:'Демо прививка'});await expect(health).toBeVisible();
  await health.getByRole('button',{name:'Редактировать'}).click();await dialog.locator('#health-clinic').fill('Пример клиники');await save(page).click();await expect(health).toContainText('Пример клиники');
  await nav(page,'Сегодня').click();await expect(page.locator('.care-reminders')).toContainText('Демо прививка');await nav(page,'Здоровье').click();
  await page.getByRole('button',{name:'Записать вес'}).click();await dialog.locator('#weight-value').fill('3.75');await save(page).click();await expect(page.locator('.weight-latest')).toContainText('3,75');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать отчёт PDF'}).click();await(await download).saveAs(info.outputPath('full-demo-report.pdf'));
  await health.getByRole('button',{name:'Удалить',exact:true}).click();await dialog.getByRole('button',{name:'Удалить',exact:true}).click();await expect(health).toHaveCount(0);
  await page.getByRole('button',{name:'Сбросить демо'}).click();await dialog.getByRole('button',{name:'Отмена',exact:true}).click();await expect(page.locator('.weight-latest')).toContainText('3,75');
  await page.getByRole('button',{name:'Сбросить демо'}).click();await dialog.getByRole('button',{name:'Вернуть примеры'}).click();await nav(page,'Здоровье').click();await expect(page.locator('.weight-latest')).toContainText('3,6');expect(api).toEqual([]);
});

test('sandbox: tab isolation, reload reset, route persistence and keyboard access', async ({page,context})=>{
  await page.goto('/demo');await page.getByRole('button',{name:'Добавить дело',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.locator('#task-title').fill('Моя демозапись');await save(page).click();await expect(page.locator('.today-task').filter({hasText:'Моя демозапись'})).toHaveCount(1);
  await page.getByRole('link',{name:'На главную',exact:true}).click();await page.locator('.hero-copy').getByRole('link',{name:'Открыть демо',exact:true}).click();await expect(page.locator('.today-task').filter({hasText:'Моя демозапись'})).toHaveCount(1);
  const other=await context.newPage();await other.goto('/demo');await expect(other.locator('.today-task').filter({hasText:'Моя демозапись'})).toHaveCount(0);await other.close();
  await page.reload();await expect(page.locator('.today-task').filter({hasText:'Моя демозапись'})).toHaveCount(0);
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Перейти к содержимому',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#account-main')).toBeFocused();
  const add=page.getByRole('button',{name:'Добавить дело',exact:true});for(let i=0;i<40 && !await add.evaluate(el=>el===document.activeElement);i++)await page.keyboard.press('Tab');await expect(add).toBeFocused();await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(add).toBeFocused();
});
