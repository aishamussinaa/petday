import { test, expect } from '@playwright/test';
import { monthEvents } from '../client/src/account/events.js';

test('month events keep leap birthdays, follow-ups and multiple pets on the same day', () => {
  const pets = [{ id:'a', name:'A', birthDate:'2020-02-29' }, { id:'b', name:'B', birthDate:null }];
  const journals = { b:[{ id:'v', kind:'visit', date:'2024-12-20', nextDate:'2025-02-28' }] };
  const events = monthEvents('2025-02',pets,journals);
  expect(events.map(e=>[e.date,e.kind])).toEqual([['2025-02-28','birthday'],['2025-02-28','visit']]);
  expect(events[1].followUp).toBe(true);
  expect(monthEvents('2024-02',pets,journals)[0].date).toBe('2024-02-29');
  expect(monthEvents('2019-02',pets,journals)).toHaveLength(0);
});

test('calendar shows all pets, opens the correct medical record and reflects changed dates',async({page})=>{
  await page.clock.setFixedTime(new Date(2026,4,15,12));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/demo');
  const nav=page.locator('.account-nav');
  const openCalendar=()=>nav.getByRole('button',{name:'Календарь',exact:true}).click();
  await openCalendar();
  const calendar=page.locator('.event-calendar'), agenda=calendar.locator('.events-agenda');
  await expect(agenda.locator('.event-entry')).toHaveCount(2);
  await calendar.getByRole('combobox').selectOption('uma');
  await expect(agenda.locator('.event-entry')).toHaveCount(1);
  await agenda.locator('.event-entry').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('#health-date')).toHaveValue('2026-05-16');
  await dialog.locator('#health-title').fill('Проверка Умы');
  await dialog.locator('#health-date').fill('2026-06-02');
  await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await openCalendar();
  await expect(agenda.locator('.event-entry')).toHaveCount(1);
  await calendar.getByRole('button',{name:'Следующий месяц'}).click();
  await expect(agenda.locator('.event-entry')).toHaveText('Проверка Умы · Ума');
  await calendar.locator('.events-grid button').nth(1).click();
  await expect(agenda.locator('time')).toHaveAttribute('datetime','2026-06-02');
  await calendar.getByRole('button',{name:'Этот месяц'}).click();
  await calendar.getByRole('button',{name:'Предыдущий месяц'}).click();
  await expect(agenda.locator('.event-entry')).toHaveCount(2);
  await expect(agenda).toContainText('Прививка');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
