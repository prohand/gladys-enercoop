import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyTotals, parseDaily, parseLoadCurve, periodMinutes } from '../src/conso/parse.js';
import { dailyAnswer, dayOfLoadCurve, loadCurveAnswer } from './helpers/fixtures.js';

test('daily readings: Wh -> kWh, null skipped, one value per day', () => {
  const days = parseDaily([
    dailyAnswer([
      ['2026-04-01', 9271],
      ['2026-04-02', null],
      ['2026-04-03', 14054],
    ]),
  ]);
  assert.deepEqual(days, [
    { date: '2026-04-01', kwh: 9.271 },
    { date: '2026-04-03', kwh: 14.054 },
  ]);
});

test('load curve: average W over 30 min -> kWh, dated by the START of the slot, in UTC', () => {
  const intervals = parseLoadCurve([
    loadCurveAnswer([
      ['2026-04-01 00:30:00', 110],
      ['2026-04-01 01:00:00', 408],
      ['2026-04-01 01:30:00', null],
    ]),
  ]);
  assert.deepEqual(intervals, [
    { starts_at: '2026-03-31T22:00:00.000Z', kwh: 0.055 },
    { starts_at: '2026-03-31T22:30:00.000Z', kwh: 0.204 },
  ]);
});

test('an hourly reading is split in two halves, 10-minute ones summed', () => {
  assert.deepEqual(parseLoadCurve([loadCurveAnswer([['2026-04-01 01:00:00', 1000]], 'PT60M')]), [
    { starts_at: '2026-03-31T22:00:00.000Z', kwh: 0.5 },
    { starts_at: '2026-03-31T22:30:00.000Z', kwh: 0.5 },
  ]);
  assert.deepEqual(
    parseLoadCurve([
      loadCurveAnswer(
        [
          ['2026-04-01 00:10:00', 600],
          ['2026-04-01 00:20:00', 600],
          ['2026-04-01 00:30:00', 600],
        ],
        'PT10M',
      ),
    ]),
    [{ starts_at: '2026-03-31T22:00:00.000Z', kwh: 0.3 }],
  );
  assert.equal(periodMinutes('PT1H'), 60);
  assert.equal(periodMinutes(undefined), 30);
});

test('daily totals by local day, complete when 23:30 is there', () => {
  const intervals = parseLoadCurve([
    loadCurveAnswer([...dayOfLoadCurve('2026-04-01', 1000), ['2026-04-02 00:30:00', 1000]]),
  ]);
  assert.deepEqual(dailyTotals(intervals), [
    { date: '2026-04-01', kwh: 24, complete: true },
    { date: '2026-04-02', kwh: 0.5, complete: false },
  ]);
});
