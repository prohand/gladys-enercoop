// -----------------------------------------------------------------------------
// The Enercoop energy contracts, as the integration reads them.
//
// The contract TEMPLATES live in the manifest (`energy_contracts.templates`):
// Gladys offers them in its contract wizard and its own rule engine computes
// the costs from them. The integration does not price anything — but it does
// need to know, right now, whether the house is in off-peak hours and at what
// price, to fire the `tariff_period_changed` scene trigger, answer the
// `get_current_tariff` scene action and fill the widget.
//
// Rather than writing the Enercoop schedules a second time (and letting the
// two copies drift), this module evaluates the manifest tariff itself, with
// the inputs of the user's contract substituted: the subset of the grammar the
// templates use (time, weekdays, months, season, dates, the holidays-fr
// calendar). test/tariffs.test.js keeps it honest on every template.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { isHoliday } from '../holidays.js';
import { addDays, inTimeIntervals, localParts, localToInstant, toMinutes } from '../time.js';

export const MANIFEST = JSON.parse(
  readFileSync(new URL('../../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

export const TEMPLATES = MANIFEST.energy_contracts.templates;

export const HOLIDAYS_CALENDAR = 'holidays-fr';

/** Values of the holidays-fr calendar. */
export const DAY_KINDS = { HOLIDAY: 'holiday', REGULAR: 'regular' };

/** The tariff periods, from the rule labels of the manifest. */
export const PERIODS = { BASE: 'base', PEAK: 'peak', OFF_PEAK: 'off_peak' };

const PERIOD_BY_LABEL = {
  Base: PERIODS.BASE,
  'Heures pleines': PERIODS.PEAK,
  'Heures creuses': PERIODS.OFF_PEAK,
};

/** How each period reads, in every language of the interface. */
export const PERIOD_LABELS = {
  [PERIODS.BASE]: { en: 'Base', fr: 'Base', de: 'Grundtarif', es: 'Base' },
  [PERIODS.PEAK]: { en: 'Peak', fr: 'Heures pleines', de: 'Hochtarif', es: 'Horas punta' },
  [PERIODS.OFF_PEAK]: {
    en: 'Off-peak',
    fr: 'Heures creuses',
    de: 'Niedertarif',
    es: 'Horas valle',
  },
};

/** Short form for a widget tile (12 characters at most). */
export const PERIOD_SHORT = {
  [PERIODS.BASE]: { en: 'Base', fr: 'Base', de: 'Grund', es: 'Base' },
  [PERIODS.PEAK]: { en: 'Peak', fr: 'HP', de: 'HT', es: 'Punta' },
  [PERIODS.OFF_PEAK]: { en: 'Off-peak', fr: 'HC', de: 'NT', es: 'Valle' },
};

export function findTemplate(key) {
  return TEMPLATES.find((template) => template.key === key);
}

/** The value of every input: the contract's, else the template default. */
export function resolveInputs(template, inputs = {}) {
  const values = {};
  for (const input of template.inputs ?? []) {
    values[input.key] = inputs[input.key] ?? input.default;
  }
  return values;
}

/** Replace every `"{{input:key}}"` of the tariff by the value of the input. */
export function substituteInputs(node, values) {
  if (typeof node === 'string') {
    const match = /^\{\{input:([a-z0-9_]+)\}\}$/.exec(node);
    return match ? values[match[1]] : node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => substituteInputs(item, values));
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, substituteInputs(value, values)]),
    );
  }
  return node;
}

function monthDay(date) {
  return date.slice(5);
}

function matchesCalendar(condition, local, options) {
  return Object.entries(condition).every(([key, expected]) => {
    if (key !== HOLIDAYS_CALENDAR) {
      return false; // a calendar this integration does not know: no match
    }
    const value = isHoliday(local.date, options) ? DAY_KINDS.HOLIDAY : DAY_KINDS.REGULAR;
    return [].concat(expected).includes(value);
  });
}

/** Whether a rule `when` holds at a local time. */
export function matches(when, local, options = {}) {
  if (!when) {
    return true;
  }
  return Object.entries(when).every(([kind, condition]) => {
    switch (kind) {
      case 'time':
        return inTimeIntervals(local.minutes, condition);
      case 'weekdays':
        return condition.includes(local.weekday);
      case 'months':
        return condition.includes(Number(local.date.slice(5, 7)));
      case 'season': {
        const day = monthDay(local.date);
        return condition.from <= condition.to
          ? day >= condition.from && day <= condition.to
          : day >= condition.from || day <= condition.to;
      }
      case 'dates':
        return local.date >= condition.from && (!condition.to || local.date <= condition.to);
      case 'calendar':
        return matchesCalendar(condition, local, options);
      case 'not_calendar':
        return !matchesCalendar(condition, local, options);
      default:
        return false; // tier, power_threshold: never used by these templates
    }
  });
}

/**
 * The energy price of a contract at an instant.
 * @param {{ template_key: string, inputs?: object }} contract
 * @param {Date|number} instant
 * @param {{ alsaceMoselle?: boolean }} [options]
 * @returns {{ period: string, label: string, price: number } | null} null for
 *   a template this version does not know
 */
export function tariffAt(contract, instant, options = {}) {
  const template = findTemplate(contract.template_key);
  if (!template?.tariff) {
    return null;
  }
  const tariff = substituteInputs(template.tariff, resolveInputs(template, contract.inputs));
  const energy = tariff.components.find((component) => component.kind === 'consumption');
  const local = localParts(instant);
  const rule =
    (energy.rules ?? []).find((candidate) => matches(candidate.when, local, options)) ??
    energy.fallback;
  return {
    period: PERIOD_BY_LABEL[rule.label] ?? PERIODS.BASE,
    label: rule.label,
    price: Number(rule.price),
  };
}

// Every local time a rule of the tariff can start or stop at.
function boundaries(tariff) {
  const minutes = new Set([0]);
  for (const component of tariff.components) {
    for (const rule of component.rules ?? []) {
      for (const [start, end] of rule.when?.time ?? []) {
        minutes.add(toMinutes(start) % 1440);
        minutes.add(toMinutes(end) % 1440);
      }
    }
  }
  return [...minutes].sort((a, b) => a - b);
}

/**
 * The current tariff and the next change, within 8 days.
 * @returns {{ period, label, price, valid_until: string|null, next: object|null } | null}
 */
export function currentTariff(contract, now = Date.now(), options = {}) {
  const current = tariffAt(contract, now, options);
  if (!current) {
    return null;
  }
  const template = findTemplate(contract.template_key);
  const tariff = substituteInputs(template.tariff, resolveInputs(template, contract.inputs));
  const startDate = localParts(now).date;
  const times = boundaries(tariff);
  for (let day = 0; day <= 8; day += 1) {
    const date = addDays(startDate, day);
    for (const minute of times) {
      const hh = String(Math.floor(minute / 60)).padStart(2, '0');
      const mm = String(minute % 60).padStart(2, '0');
      const instant = localToInstant(`${date} ${hh}:${mm}`).getTime();
      if (instant <= now) {
        continue;
      }
      const next = tariffAt(contract, instant, options);
      if (next.label !== current.label || next.price !== current.price) {
        return { ...current, valid_until: new Date(instant).toISOString(), next };
      }
    }
  }
  return { ...current, valid_until: null, next: null };
}

/**
 * The contract the integration follows: the first active one referencing an
 * Enercoop template, else the first scheduled one.
 * @param {Array<{ template_key: string, status: string }>} contracts
 */
export function pickContract(contracts = []) {
  const ours = contracts.filter((contract) => findTemplate(contract.template_key));
  return (
    ours.find((contract) => contract.status === 'active') ??
    ours.find((contract) => contract.status === 'scheduled') ??
    null
  );
}

/**
 * Entries of the holidays-fr calendar: one value per local day, holidays and
 * regular days alike — a day without a value would make the rule engine apply
 * the fallback price instead of reading it as a regular day.
 * @param {string} from first local date
 * @param {string} to last local date, inclusive
 */
export function holidayEntries(from, to, options = {}) {
  const entries = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    entries.push({
      date,
      value: isHoliday(date, options) ? DAY_KINDS.HOLIDAY : DAY_KINDS.REGULAR,
    });
  }
  return entries;
}
