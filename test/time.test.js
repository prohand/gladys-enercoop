import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  inTimeIntervals,
  localParts,
  localToInstant,
  toMinutes,
  weekdayOf,
} from '../src/time.js';

test('localToInstant reads the French wall clock, winter and summer time', () => {
  assert.equal(localToInstant('2026-01-15 12:00:00').toISOString(), '2026-01-15T11:00:00.000Z');
  assert.equal(localToInstant('2026-07-15 12:00').toISOString(), '2026-07-15T10:00:00.000Z');
  assert.equal(localToInstant('2026-04-01').toISOString(), '2026-03-31T22:00:00.000Z');
});

test('localToInstant takes the summer occurrence of the hour repeated in October', () => {
  // 25 October 2026: 03:00 summer time becomes 02:00 winter time.
  assert.equal(localToInstant('2026-10-25 02:30').toISOString(), '2026-10-25T00:30:00.000Z');
  assert.equal(localToInstant('2026-10-25 03:30').toISOString(), '2026-10-25T02:30:00.000Z');
});

test('localToInstant refuses what is not a date', () => {
  assert.throws(() => localToInstant('yesterday'));
});

test('localParts gives the local date, time and weekday', () => {
  assert.deepEqual(localParts(Date.parse('2026-11-01T22:30:00Z')), {
    date: '2026-11-01',
    time: '23:30',
    minutes: 23 * 60 + 30,
    weekday: 'sun',
  });
  assert.equal(localParts(Date.parse('2026-11-01T23:30:00Z')).date, '2026-11-02');
});

test('date helpers', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(weekdayOf('2026-11-01'), 'sun');
  assert.equal(toMinutes('24:00'), 1440);
});

test('inTimeIntervals follows the tariff grammar (end exclusive, midnight crossing)', () => {
  const night = [['22:00', '06:00']];
  assert.equal(inTimeIntervals(toMinutes('22:00'), night), true);
  assert.equal(inTimeIntervals(toMinutes('03:00'), night), true);
  assert.equal(inTimeIntervals(toMinutes('06:00'), night), false);
  assert.equal(inTimeIntervals(toMinutes('12:00'), night), false);
  const split = [
    ['01:30', '07:30'],
    ['12:30', '14:30'],
  ];
  assert.equal(inTimeIntervals(toMinutes('13:00'), split), true);
  assert.equal(inTimeIntervals(toMinutes('14:30'), split), false);
  assert.equal(inTimeIntervals(toMinutes('10:00'), [['00:00', '00:00']]), true, 'whole day');
  assert.equal(inTimeIntervals(toMinutes('23:59'), [['20:00', '24:00']]), true);
});
