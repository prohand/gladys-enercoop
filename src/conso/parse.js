// -----------------------------------------------------------------------------
// Enedis answers -> consumption intervals Gladys can store.
//
// Two shapes, both `{ grandeur: [{ unite, points: [{ v, d, p? }] }] }`:
//   - daily consumption: `unite: "Wh"`, `d` the local day, `v` its energy;
//   - load curve: `unite: "W"`, `d` the local END of the interval, `p` its
//     length (PT30M most of the time, PT10M / PT15M / PT60M on some meters),
//     `v` the AVERAGE power over it — energy = power x duration.
// Values are strings, and `null` when Enedis has no reading: those are
// skipped, never published as 0 (a 0 kWh would be priced and charted).
//
// Gladys stores 30-minute intervals by their start, aligned on its own clock:
// a reading of another length is spread over the 30-minute slots it covers.
// -----------------------------------------------------------------------------

import { localToInstant, localParts, MINUTE_MS } from '../time.js';

const SLOT_MS = 30 * MINUTE_MS;

const UNIT_FACTORS_KWH = { Wh: 0.001, kWh: 1 };
const UNIT_FACTORS_KW = { W: 0.001, kW: 1 };

function points(answer) {
  return (answer?.grandeur ?? []).flatMap((grandeur) =>
    (grandeur.points ?? []).map((point) => ({ ...point, unite: grandeur.unite })),
  );
}

function readValue(point) {
  if (point.v === null || point.v === undefined || point.v === '') {
    return null;
  }
  const value = Number(point.v);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** `PT30M` -> 30, `PT1H` -> 60; 30 when absent or unreadable. */
export function periodMinutes(period) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(period ?? '');
  if (!match || (!match[1] && !match[2])) {
    return 30;
  }
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

/**
 * Daily readings.
 * @param {object[]} answers raw `consommation_quotidienne` answers
 * @returns {Array<{ date: string, kwh: number }>} sorted by date, one per day
 */
export function parseDaily(answers) {
  const byDate = new Map();
  for (const point of answers.flatMap(points)) {
    const value = readValue(point);
    const factor = UNIT_FACTORS_KWH[point.unite] ?? UNIT_FACTORS_KWH.Wh;
    if (value === null || !/^\d{4}-\d{2}-\d{2}/.test(point.d ?? '')) {
      continue;
    }
    byDate.set(point.d.slice(0, 10), round(value * factor));
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, kwh]) => ({ date, kwh }));
}

/**
 * Load curve readings, as 30-minute intervals.
 * @param {object[]} answers raw `courbe_de_charge_consommation` answers
 * @returns {Array<{ starts_at: string, kwh: number }>} sorted, ISO UTC starts
 */
export function parseLoadCurve(answers) {
  const slots = new Map();
  for (const point of answers.flatMap(points)) {
    const value = readValue(point);
    if (value === null || !point.d) {
      continue;
    }
    const minutes = periodMinutes(point.p);
    const end = localToInstant(point.d).getTime();
    const start = end - minutes * MINUTE_MS;
    const kw = value * (UNIT_FACTORS_KW[point.unite] ?? UNIT_FACTORS_KW.W);
    // Spread the energy over the 30-minute slots the reading covers.
    for (let cursor = start; cursor < end;) {
      const slot = Math.floor(cursor / SLOT_MS) * SLOT_MS;
      const until = Math.min(end, slot + SLOT_MS);
      const kwh = (kw * (until - cursor)) / (60 * MINUTE_MS);
      slots.set(slot, (slots.get(slot) ?? 0) + kwh);
      cursor = until;
    }
  }
  return [...slots]
    .sort(([a], [b]) => a - b)
    .map(([slot, kwh]) => ({ starts_at: new Date(slot).toISOString(), kwh: round(kwh) }));
}

/**
 * Daily totals of 30-minute intervals, by local French date. A day counts as
 * complete when its last slot (23:30 local) is there.
 * @returns {Array<{ date: string, kwh: number, complete: boolean }>}
 */
export function dailyTotals(intervals) {
  const days = new Map();
  for (const { starts_at: startsAt, kwh } of intervals) {
    const { date, minutes } = localParts(Date.parse(startsAt));
    const day = days.get(date) ?? { date, kwh: 0, complete: false };
    day.kwh += kwh;
    if (minutes === 23 * 60 + 30) {
      day.complete = true;
    }
    days.set(date, day);
  }
  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({ ...day, kwh: round(day.kwh) }));
}

// Watt-hour precision: enough for a bill, and no float noise in the states.
function round(kwh) {
  return Math.round(kwh * 1000) / 1000;
}
