import test from 'node:test';
import assert from 'node:assert/strict';
import { validDate, validatePet } from '../server/src/validation.js';
import { calendarAge, nextBirthday, dayDistance } from '../client/src/dateUtils.js';

test('calendar-only dates reject future and impossible dates', () => {
  assert.equal(validDate('2024-02-29', '2026-10-22'), true);
  for (const date of ['2023-02-29', '2026-10-23', '2026-13-01', '2026-00-10', '2026-04-31', '1899-01-01', '2024-2-2', '2024-02-29T00:00:00Z']) assert.equal(validDate(date, '2026-10-22'), false, date);
});
test('unknown birthday is nullable and approximate needs a date', () => {
  const input = { name: '  Test  ', species: 'other', breed: '', sex: 'unknown', birthDate: '', birthApproximate: true, features: '', allergies: '', notes: '', photoAction: 'keep', timeZone: 'Asia/Qyzylorda' };
  const pet = validatePet(input);
  assert.equal(pet.birthDate, null); assert.equal(pet.birthApproximate, false); assert.equal(pet.name, 'Test');
  assert.throws(() => validatePet({ ...input, birthDate: '2999-01-01' }), error => error.fields.birthDate === 'INVALID_BIRTH_DATE');
  assert.throws(() => validatePet({ ...input, name: ' ' }));
  assert.throws(() => validatePet({ ...input, species: 'invalid' }));
});
test('leap birthday is February 28 in ordinary years and today is zero days away', () => {
  const birth = new Date(2024, 1, 29, 12);
  const today = new Date(2025, 1, 28, 12);
  assert.equal(dayDistance(today, nextBirthday(birth, today)), 0);
  assert.deepEqual(calendarAge(birth, today), { years: 1, months: 0, days: 0 });
  assert.equal(nextBirthday(birth, new Date(2028, 0, 1, 12)).getDate(), 29);
});
