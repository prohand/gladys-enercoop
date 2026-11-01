// -----------------------------------------------------------------------------
// Dates in the timezone of the French electricity market.
//
// Enedis dates its readings in local French time ("2026-04-01 00:30:00", the
// END of a 30-minute interval), the Enercoop tariffs switch on local hours and
// the public holidays are local dates. Gladys wants instants. This module is
// the only place that converts between the two, with nothing but `Intl`: no
// dependency, and the daylight saving changes handled by the runtime's own
// timezone database.
// -----------------------------------------------------------------------------

export const TIMEZONE = 'Europe/Paris';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

/**
 * The local French wall clock of an instant.
 * @param {Date|number} instant
 * @returns {{ date: string, time: string, minutes: number, weekday: string }}
 *   `date` YYYY-MM-DD, `time` HH:mm, `minutes` since local midnight, `weekday` mon..sun
 */
export function localParts(instant) {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]),
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minutes: hour * 60 + minute,
    weekday: parts.weekday.slice(0, 3).toLowerCase(),
  };
}

// Offset of the local clock from UTC at an instant, in milliseconds.
function offsetAt(instant) {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant of a local French wall clock time. For the hour repeated when
 * daylight saving ends, the first occurrence (summer time) is returned; a
 * time inside the hour skipped when it starts (Enedis never dates one) reads
 * an hour earlier.
 * @param {string} local `YYYY-MM-DD`, `YYYY-MM-DD HH:mm` or `YYYY-MM-DD HH:mm:ss`
 * @returns {Date}
 */
export function localToInstant(local) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(local.trim());
  if (!match) {
    throw new Error(`Invalid local date: ${local}`);
  }
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  // The offsets in force half a day before and after: one of them is the
  // right one. Keep the candidates that read back as the asked wall clock
  // (two in the repeated hour: the earlier one wins).
  const candidates = [...new Set([offsetAt(wall - DAY_MS / 2), offsetAt(wall + DAY_MS / 2)])]
    .map((offset) => wall - offset)
    .sort((a, b) => a - b);
  const exact = candidates.find((instant) => instant + offsetAt(instant) === wall);
  return new Date(exact ?? candidates[0]);
}

/** The local date `days` after a local date (negative to go back). */
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The local date of today, in France. */
export function today(now = Date.now()) {
  return localParts(now).date;
}

/** Day of the week (`mon`..`sun`) of a local date. */
export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Minutes since midnight of an `HH:mm` time (`24:00` is 1440). */
export function toMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

/**
 * Whether a local time falls in one of the intervals, with the tariff grammar
 * of Gladys: start inclusive, end exclusive, an end at or before the start
 * crosses midnight (an end equal to the start covers the whole day).
 * @param {number} minutes minutes since local midnight
 * @param {Array<[string, string]>} intervals
 */
export function inTimeIntervals(minutes, intervals) {
  return (intervals ?? []).some(([start, end]) => {
    const from = toMinutes(start);
    const to = toMinutes(end);
    if (to > from) {
      return minutes >= from && minutes < to;
    }
    return minutes >= from || minutes < to;
  });
}

export { MINUTE_MS, DAY_MS };
