// -----------------------------------------------------------------------------
// French public holidays, computed locally.
//
// The "Flexibilité nuit et week-end" offer of Enercoop prices public holidays
// at the off-peak rate. The Gladys rule engine reads them from the
// `holidays-fr` tariff calendar, which this integration declares and feeds:
// the dates are fixed by law (Code du travail, L3133-1) or follow Easter, so no
// network call is needed. Alsace and Moselle add Good Friday and Saint
// Stephen's Day (L3134-13).
// -----------------------------------------------------------------------------

import { addDays } from './time.js';

/** Easter Sunday of a year (anonymous Gregorian algorithm), `YYYY-MM-DD`. */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The public holidays of a year in France, sorted.
 * @param {number} year
 * @param {{ alsaceMoselle?: boolean }} [options]
 * @returns {string[]} `YYYY-MM-DD` dates
 */
export function frenchHolidays(year, { alsaceMoselle = false } = {}) {
  const easter = easterSunday(year);
  const dates = [
    `${year}-01-01`, // Jour de l'an
    addDays(easter, 1), // Lundi de Pâques
    `${year}-05-01`, // Fête du travail
    `${year}-05-08`, // Victoire 1945
    addDays(easter, 39), // Ascension
    addDays(easter, 50), // Lundi de Pentecôte
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ];
  if (alsaceMoselle) {
    dates.push(addDays(easter, -2), `${year}-12-26`);
  }
  return dates.sort();
}

/** Whether a local date is a public holiday. */
export function isHoliday(date, options) {
  return frenchHolidays(Number(date.slice(0, 4)), options).includes(date);
}
