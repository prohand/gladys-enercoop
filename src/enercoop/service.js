// -----------------------------------------------------------------------------
// The Enercoop service: everything the integration does, behind one object
// index.js wires to the SDK, and the tests drive with a fake Gladys and a fake
// fetch.
//
//   sync()           Linky readings -> publishEnergyConsumption, then the
//                    `daily_consumption_available` / `daily_threshold_exceeded`
//                    scene events
//   publishHolidays() the holidays-fr tariff calendar (French public holidays)
//   refreshContracts() the users' Enercoop contracts (getEnergyContracts)
//   checkTariff()    off-peak <-> peak switch -> `tariff_period_changed`
//   testConnection() the "Test the connection" button
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { GRANULARITIES, isConfigured, isValidPrm, maskPrm } from '../config.js';
import { DATA_TYPES, fetchWindow, tokenPrms } from '../conso/client.js';
import { dailyTotals, parseDaily, parseLoadCurve } from '../conso/parse.js';
import { meter } from '../devices/meter.js';
import { formatNumber, localize, pick, texts } from '../i18n.js';
import { addDays, localParts, MINUTE_MS, today } from '../time.js';
import { MESSAGES, UserError, explainError } from './messages.js';
import {
  HOLIDAYS_CALENDAR,
  PERIOD_LABELS,
  currentTariff,
  findTemplate,
  holidayEntries,
  pickContract,
} from './tariffs.js';

const logger = createLogger({ name: 'enercoop' });

/** Scene trigger keys, as declared in the manifest `scene_triggers`. */
export const SCENE_TRIGGERS = {
  DAILY_CONSUMPTION_AVAILABLE: 'daily_consumption_available',
  DAILY_THRESHOLD_EXCEEDED: 'daily_threshold_exceeded',
  TARIFF_PERIOD_CHANGED: 'tariff_period_changed',
};

// publishEnergyConsumption takes at most 2,000 intervals per call.
const MAX_INTERVALS_PER_CALL = 2000;
const SLOT_MS = 30 * MINUTE_MS;

// The holidays-fr calendar is fed over a year back (an older contract start
// keeps its prices) and up to 7 days ahead, the most Gladys accepts.
const HOLIDAYS_DAYS_BACK = 400;
const HOLIDAYS_DAYS_AHEAD = 7;

/**
 * @param {object} deps
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} deps.gladys
 * @param {ReturnType<import('../state.js').createStore>} deps.store
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {() => number} [deps.clock]
 */
export function createService({ gladys, store, fetchImpl = fetch, clock = Date.now }) {
  let config = null;
  let contracts = [];
  let lastTariff = null;
  let running = null;

  const holidayOptions = () => ({ alsaceMoselle: config?.alsace_moselle === true });

  function contract() {
    return pickContract(contracts);
  }

  function tariffNow() {
    const current = contract();
    return current ? currentTariff(current, clock(), holidayOptions()) : null;
  }

  async function publishIntervals(featureExternalId, intervals) {
    let count = 0;
    for (let i = 0; i < intervals.length; i += MAX_INTERVALS_PER_CALL) {
      const result = await gladys.publishEnergyConsumption(
        featureExternalId,
        intervals.slice(i, i + MAX_INTERVALS_PER_CALL),
      );
      count += result?.count ?? 0;
    }
    return count;
  }

  // Fire the daily events for the newest complete day, once per day: the
  // first sync after an install does not replay a month of events.
  async function announce(days) {
    const state = store.state;
    const newest = days.at(-1);
    if (!newest) {
      return;
    }
    if (!state.lastAnnouncedDay || newest.date > state.lastAnnouncedDay) {
      await gladys.publishSceneEvent(SCENE_TRIGGERS.DAILY_CONSUMPTION_AVAILABLE, {
        date: newest.date,
        kwh: newest.kwh,
      });
      state.lastAnnouncedDay = newest.date;
    }
    const threshold = config.daily_threshold_kwh;
    if (
      threshold > 0 &&
      newest.kwh > threshold &&
      (!state.lastThresholdDay || newest.date > state.lastThresholdDay)
    ) {
      await gladys.publishSceneEvent(SCENE_TRIGGERS.DAILY_THRESHOLD_EXCEEDED, {
        date: newest.date,
        kwh: newest.kwh,
        threshold_kwh: threshold,
      });
      state.lastThresholdDay = newest.date;
    }
  }

  async function runSync() {
    if (!isConfigured(config)) {
      throw new UserError(isValidPrm(config.prm) ? MESSAGES.notConfigured : MESSAGES.invalidPrm);
    }
    const state = store.state;
    const now = clock();
    const end = today(now); // exclusive: Enedis serves up to yesterday
    const key = `${config.prm}:${config.granularity}`;
    const oldest = addDays(end, -config.history_days);
    const last = state.lastIntervalEnd[key];
    // Read the last day published, and the one before, again: Enedis
    // completes or corrects them overnight.
    let start = last ? addDays(localParts(Date.parse(last) - 1).date, -1) : oldest;
    if (start < oldest) {
      start = oldest;
    }
    if (start >= end) {
      return { published: 0, day: state.days[addDays(end, -1)] ?? null };
    }

    const loadCurve = config.granularity === GRANULARITIES.THIRTY_MINUTES;
    const featureExternalId = meter.featureExternalId(gladys, config);
    let published = 0;
    let days;
    try {
      if (loadCurve) {
        const answers = await fetchWindow(config, DATA_TYPES.LOAD_CURVE, start, end, { fetchImpl });
        const intervals = parseLoadCurve(answers).filter(
          ({ starts_at: startsAt }) => Date.parse(startsAt) + SLOT_MS <= now,
        );
        if (intervals.length > 0) {
          published = await publishIntervals(featureExternalId, intervals);
          state.lastIntervalEnd[key] = new Date(
            Date.parse(intervals.at(-1).starts_at) + SLOT_MS,
          ).toISOString();
        }
        days = dailyTotals(intervals).filter((day) => day.complete);
      } else {
        const answers = await fetchWindow(config, DATA_TYPES.DAILY, start, end, { fetchImpl });
        days = parseDaily(answers).filter((day) => day.date < end);
        if (days.length > 0) {
          published = await publishIntervals(
            featureExternalId,
            days.map(({ date, kwh }) => ({ date, kwh })),
          );
          state.lastIntervalEnd[key] = `${days.at(-1).date}T12:00:00.000Z`;
        }
      }
    } catch (err) {
      throw new UserError(explainError(err, { loadCurve }), err);
    }

    for (const day of days) {
      state.days[day.date] = day.kwh;
    }
    state.lastSync = new Date(now).toISOString();
    state.lastError = null;
    await announce(days);
    await store.save();
    logger.info(
      `Sync of ${maskPrm(config.prm)}: ${published} interval(s) published, ${days.length} complete day(s)`,
    );
    const newest = days.at(-1) ?? null;
    return { published, day: newest };
  }

  return {
    store,

    /** The service clock (fixed in the tests). */
    now: clock,

    get config() {
      return config;
    },

    setConfig(next) {
      config = next;
    },

    /** The contract the integration follows, null without one. */
    contract,

    /** Name of the template of the followed contract, multi-language. */
    contractName() {
      const current = contract();
      return current ? findTemplate(current.template_key).name : null;
    },

    tariffNow,

    /**
     * Read the meter and publish what is new. Concurrent calls share the
     * same run (a scene and the timer firing together read Enedis once).
     * @returns {Promise<{ published: number, day: { date: string, kwh: number } | null }>}
     */
    sync() {
      if (!running) {
        running = runSync()
          .catch(async (err) => {
            store.state.lastError = {
              at: new Date(clock()).toISOString(),
              message: err.userMessage ?? MESSAGES.unknown(err.message),
            };
            await store.save();
            logger.warn(`Sync failed: ${err.cause?.message ?? err.message}`);
            throw err;
          })
          .finally(() => {
            running = null;
            gladys.requestWidgetRefresh?.('enercoop');
          });
      }
      return running;
    },

    /** The transport badge of the meter: Conso API is the cloud channel. */
    transportEntries() {
      if (!isValidPrm(config?.prm)) {
        return [];
      }
      const failed = Boolean(store.state.lastError);
      return [
        {
          external_id: meter.deviceExternalId(gladys, config),
          transport: failed ? DEVICE_TRANSPORTS.UNREACHABLE : DEVICE_TRANSPORTS.CLOUD,
          ...(failed ? { message: store.state.lastError.message } : {}),
        },
      ];
    },

    /** Feed the holidays-fr calendar. A 403 means another integration owns it. */
    async publishHolidays() {
      const day = today(clock());
      const entries = holidayEntries(
        addDays(day, -HOLIDAYS_DAYS_BACK),
        addDays(day, HOLIDAYS_DAYS_AHEAD),
        holidayOptions(),
      );
      try {
        await gladys.publishEnergyCalendar(HOLIDAYS_CALENDAR, entries);
        return true;
      } catch (err) {
        if (err.status === 403) {
          logger.info(`The ${HOLIDAYS_CALENDAR} calendar is fed by another integration`);
          return false;
        }
        throw err;
      }
    },

    /** Reload the users' Enercoop contracts. */
    async refreshContracts() {
      const previous = contract();
      contracts = await gladys.getEnergyContracts();
      const next = contract();
      if (previous?.id !== next?.id || JSON.stringify(previous) !== JSON.stringify(next)) {
        // Another contract (or other prices): start the period watch afresh,
        // a change of contract is not a change of period.
        lastTariff = null;
      }
      return next;
    },

    /**
     * Compare the tariff period with the last one seen, and fire
     * `tariff_period_changed` when it switched.
     * @returns {Promise<boolean>} whether the event fired
     */
    async checkTariff() {
      const tariff = tariffNow();
      const previous = lastTariff;
      lastTariff = tariff;
      if (!tariff || !previous || previous.label === tariff.label) {
        return false;
      }
      await gladys.publishSceneEvent(SCENE_TRIGGERS.TARIFF_PERIOD_CHANGED, {
        period: tariff.period,
        label: tariff.label,
        price: tariff.price,
      });
      gladys.requestWidgetRefresh?.('enercoop');
      logger.info(`Tariff period: ${previous.label} -> ${tariff.label}`);
      return true;
    },

    /** The "Test the connection" button: a live read of the last days. */
    async testConnection() {
      if (!isValidPrm(config.prm)) {
        return MESSAGES.invalidPrm;
      }
      if (!config.token) {
        return MESSAGES.notConfigured;
      }
      const prms = tokenPrms(config.token);
      if (prms.length > 0 && !prms.includes(config.prm)) {
        return MESSAGES.tokenOtherPrm;
      }
      const end = today(clock());
      let days;
      try {
        days = parseDaily(
          await fetchWindow(config, DATA_TYPES.DAILY, addDays(end, -7), end, { fetchImpl }),
        );
      } catch (err) {
        return explainError(err);
      }
      const name = this.contractName();
      return localize((language) => {
        const reading = days.at(-1)
          ? pick(language, {
              en: `last reading ${days.at(-1).date}: ${formatNumber(language, days.at(-1).kwh)} kWh`,
              fr: `dernier relevé le ${days.at(-1).date} : ${formatNumber(language, days.at(-1).kwh)} kWh`,
              de: `letzter Messwert am ${days.at(-1).date}: ${formatNumber(language, days.at(-1).kwh)} kWh`,
              es: `última lectura el ${days.at(-1).date}: ${formatNumber(language, days.at(-1).kwh)} kWh`,
            })
          : pick(language, {
              en: 'no reading yet for the last 7 days',
              fr: 'aucun relevé sur les 7 derniers jours',
              de: 'noch kein Messwert der letzten 7 Tage',
              es: 'ninguna lectura en los últimos 7 días',
            });
        const contractText = name
          ? pick(language, {
              en: `contract: ${pick(language, name)}`,
              fr: `contrat : ${pick(language, name)}`,
              de: `Vertrag: ${pick(language, name)}`,
              es: `contrato: ${pick(language, name)}`,
            })
          : pick(language, MESSAGES.noContract);
        const ok = pick(
          language,
          texts('Connection OK', 'Connexion OK', 'Verbindung OK', 'Conexión OK'),
        );
        return `${ok} (${maskPrm(config.prm)}), ${reading}. ${contractText}`;
      });
    },

    /** The multi-language label of a period, for the widget and the scenes. */
    periodLabel(period) {
      return PERIOD_LABELS[period];
    },
  };
}
