import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterSunday, frenchHolidays, isHoliday } from '../src/holidays.js';

test('Easter Sunday', () => {
  assert.equal(easterSunday(2024), '2024-03-31');
  assert.equal(easterSunday(2025), '2025-04-20');
  assert.equal(easterSunday(2026), '2026-04-05');
  assert.equal(easterSunday(2027), '2027-03-28');
});

test('the eleven French public holidays of 2026', () => {
  assert.deepEqual(frenchHolidays(2026), [
    '2026-01-01',
    '2026-04-06',
    '2026-05-01',
    '2026-05-08',
    '2026-05-14',
    '2026-05-25',
    '2026-07-14',
    '2026-08-15',
    '2026-11-01',
    '2026-11-11',
    '2026-12-25',
  ]);
});

test('Alsace-Moselle adds Good Friday and Saint Stephen', () => {
  const holidays = frenchHolidays(2026, { alsaceMoselle: true });
  assert.equal(holidays.length, 13);
  assert.ok(holidays.includes('2026-04-03'));
  assert.ok(holidays.includes('2026-12-26'));
  assert.equal(isHoliday('2026-12-26'), false);
  assert.equal(isHoliday('2026-12-26', { alsaceMoselle: true }), true);
});
