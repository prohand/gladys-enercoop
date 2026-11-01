import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIODS,
  TEMPLATES,
  currentTariff,
  holidayEntries,
  pickContract,
  substituteInputs,
  tariffAt,
} from '../src/enercoop/tariffs.js';
import { localToInstant } from '../src/time.js';

const at = (local) => localToInstant(local).getTime();
const contract = (template_key, inputs = {}) => ({ template_key, inputs, status: 'active' });

const BASE = contract('enercoop-base');
const HC = contract('enercoop-flexibilite-heures-creuses');
const NWE = contract('enercoop-flexibilite-nuit-week-end');

test('every rule label of every template maps to a known period', () => {
  for (const template of TEMPLATES) {
    const energy = template.tariff.components.find((c) => c.kind === 'consumption');
    for (const rule of [...(energy.rules ?? []), energy.fallback]) {
      assert.ok(
        ['Base', 'Heures pleines', 'Heures creuses'].includes(rule.label),
        `${template.key}: unknown label "${rule.label}"`,
      );
    }
  }
});

test('Base offer: one price all day', () => {
  assert.deepEqual(tariffAt(BASE, at('2026-11-02 03:00')), {
    period: PERIODS.BASE,
    label: 'Base',
    price: 0.2531,
  });
  assert.equal(
    tariffAt(contract('enercoop-base', { price_kwh: 0.3 }), at('2026-11-02 12:00')).price,
    0.3,
  );
});

test('Off-peak hours: the slots of the contract, default 22:00-06:00', () => {
  assert.equal(tariffAt(HC, at('2026-11-02 23:00')).period, PERIODS.OFF_PEAK);
  assert.equal(tariffAt(HC, at('2026-11-02 05:59')).period, PERIODS.OFF_PEAK);
  assert.equal(tariffAt(HC, at('2026-11-02 06:00')).period, PERIODS.PEAK);
  assert.equal(
    tariffAt(HC, at('2026-11-07 12:00')).period,
    PERIODS.PEAK,
    'weekends are not off-peak',
  );
  const custom = contract('enercoop-flexibilite-heures-creuses', {
    off_peak_slots: [
      ['01:30', '07:30'],
      ['12:30', '14:30'],
    ],
    off_peak_price: 0.15,
  });
  assert.deepEqual(tariffAt(custom, at('2026-11-02 13:00')), {
    period: PERIODS.OFF_PEAK,
    label: 'Heures creuses',
    price: 0.15,
  });
  assert.equal(tariffAt(custom, at('2026-11-02 23:00')).period, PERIODS.PEAK);
});

test('Night and weekend: nights, weekends and public holidays are off-peak', () => {
  assert.equal(tariffAt(NWE, at('2026-11-02 12:00')).period, PERIODS.PEAK, 'Monday noon');
  assert.equal(tariffAt(NWE, at('2026-11-03 23:30')).period, PERIODS.OFF_PEAK, 'Tuesday night');
  assert.equal(tariffAt(NWE, at('2026-11-04 05:00')).period, PERIODS.OFF_PEAK, 'early morning');
  assert.equal(tariffAt(NWE, at('2026-11-07 15:00')).period, PERIODS.OFF_PEAK, 'Saturday');
  assert.equal(tariffAt(NWE, at('2026-11-08 15:00')).period, PERIODS.OFF_PEAK, 'Sunday');
  assert.equal(tariffAt(NWE, at('2026-11-11 15:00')).period, PERIODS.OFF_PEAK, '11 November');
  assert.equal(tariffAt(NWE, at('2026-12-26 15:00')).period, PERIODS.OFF_PEAK, 'a Saturday anyway');
  assert.equal(tariffAt(NWE, at('2027-12-24 15:00')).period, PERIODS.PEAK);
  // 26 December 2025 is a Friday: off-peak in Alsace-Moselle only.
  assert.equal(tariffAt(NWE, at('2025-12-26 15:00')).period, PERIODS.PEAK);
  assert.equal(
    tariffAt(NWE, at('2025-12-26 15:00'), { alsaceMoselle: true }).period,
    PERIODS.OFF_PEAK,
  );
});

test('currentTariff tells when the price changes next', () => {
  const friday = currentTariff(NWE, at('2026-11-06 18:00'));
  assert.equal(friday.period, PERIODS.PEAK);
  assert.equal(friday.valid_until, localToInstant('2026-11-06 23:00').toISOString());
  assert.equal(friday.next.period, PERIODS.OFF_PEAK);

  // Off-peak from Friday 23:00 to Monday 06:00, in one go.
  const saturday = currentTariff(NWE, at('2026-11-07 10:00'));
  assert.equal(saturday.valid_until, localToInstant('2026-11-09 06:00').toISOString());

  assert.equal(currentTariff(BASE, at('2026-11-02 12:00')).valid_until, null);
  assert.equal(currentTariff(contract('unknown'), at('2026-11-02 12:00')), null);
});

test('pickContract follows the active Enercoop contract', () => {
  assert.equal(pickContract([]), null);
  assert.equal(pickContract([{ template_key: 'other', status: 'active' }]), null);
  const scheduled = { ...HC, id: 'b', status: 'scheduled' };
  const active = { ...NWE, id: 'c' };
  assert.equal(pickContract([scheduled, active]).id, 'c');
  assert.equal(pickContract([scheduled, { ...BASE, status: 'expired' }]).id, 'b');
});

test('the holidays-fr calendar gives a value to every day', () => {
  const entries = holidayEntries('2026-12-20', '2027-01-02');
  assert.equal(entries.length, 14);
  assert.deepEqual(
    entries.filter((entry) => entry.value === 'holiday').map((entry) => entry.date),
    ['2026-12-25', '2027-01-01'],
  );
  assert.ok(entries.every((entry) => ['holiday', 'regular'].includes(entry.value)));
});

test('substituteInputs replaces whole placeholders only', () => {
  assert.deepEqual(
    substituteInputs({ a: '{{input:x}}', b: ['{{input:y}}', 'z'] }, { x: 1, y: [2] }),
    {
      a: 1,
      b: [[2], 'z'],
    },
  );
});
