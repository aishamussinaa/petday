import test from 'node:test';
import assert from 'node:assert/strict';
import { birthdayWindow } from '../client/src/account/birthday.js';
const day = (year, month, date, hour=12) => new Date(year, month-1, date, hour);
test('birthday window includes seven days, today and year rollover, excluding other days', () => {
  assert.equal(birthdayWindow('2020-01-03',day(2026,12,26)),null);
  assert.equal(birthdayWindow('2020-01-03',day(2026,12,27)).days,7);
  assert.equal(birthdayWindow('2020-01-03',day(2027,1,2,23)).days,1);
  assert.equal(birthdayWindow('2020-01-03',day(2027,1,3,0)).days,0);
  assert.equal(birthdayWindow('2020-01-03',day(2027,1,4)),null);
});
test('birthday window handles leap days and absent, invalid or future birth dates', () => {
  assert.equal(birthdayWindow('2020-02-29',day(2027,2,21)).days,7);
  assert.equal(birthdayWindow('2020-02-29',day(2027,2,28)).days,0);
  assert.equal(birthdayWindow('2020-02-29',day(2028,2,28)).days,1);
  for(const value of [null,'','bad','2020-02-31','2999-01-01']) assert.equal(birthdayWindow(value,day(2027,1,1)),null);
});
