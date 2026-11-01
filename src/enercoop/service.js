// -----------------------------------------------------------------------------
// The Enercoop service: everything the integration does, behind one object
// index.js wires to the SDK, and the tests drive with a fake Gladys.
//
// The integration reads no meter. The consumption comes from the meter the
// user already has in Gladys (Linky through the Enedis integration of Gladys
// Plus, a Lixee TIC, a Shelly EM…); Gladys prices it with the Enercoop
// contract the user attaches to that meter. What is left here:
//
//   publishHolidays()  the holidays-fr tariff calendar (French public holidays)
//   refreshContracts() the users' Enercoop contracts (getEnergyContracts)
//   checkTariff()      off-peak <-> peak switch -> `tariff_period_changed`
//   checkContract()    the "Check the contract" button
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { formatNumber, localize, pick } from '../i18n.js';
import { addDays, localParts, today } from '../time.js';
import { MESSAGES } from './messages.js';
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
  TARIFF_PERIOD_CHANGED: 'tariff_period_changed',
};

// The holidays-fr calendar is fed over a year back (an older contract start
// keeps its prices) and up to 7 days ahead, the most Gladys accepts.
const HOLIDAYS_DAYS_BACK = 400;
const HOLIDAYS_DAYS_AHEAD = 7;

/**
 * @param {object} deps
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} deps.gladys
 * @param {() => number} [deps.clock]
 */
export function createService({ gladys, clock = Date.now }) {
  let config = null;
  let contracts = [];
  let lastTariff = null;

  const holidayOptions = () => ({ alsaceMoselle: config?.alsace_moselle === true });

  function contract() {
    return pickContract(contracts);
  }

  function contractName() {
    const current = contract();
    return current ? findTemplate(current.template_key).name : null;
  }

  function tariffNow() {
    const current = contract();
    return current ? currentTariff(current, clock(), holidayOptions()) : null;
  }

  return {
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
    contractName,

    tariffNow,

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
        gladys.requestWidgetRefresh?.('enercoop');
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

    /**
     * The "Check the contract" button: reload the contracts and say which one
     * is followed, the price right now and the next change.
     */
    async checkContract() {
      await this.refreshContracts();
      const name = contractName();
      const tariff = tariffNow();
      if (!name || !tariff) {
        return MESSAGES.noContract;
      }
      const at = tariff.next ? localParts(Date.parse(tariff.valid_until)).time : null;
      return localize((language) => {
        const offer = pick(language, name);
        const period = pick(language, PERIOD_LABELS[tariff.period]);
        const price = formatNumber(language, tariff.price, 4);
        const next = tariff.next ? pick(language, PERIOD_LABELS[tariff.next.period]) : null;
        return pick(language, {
          en: `Contract found: ${offer}. Now: ${period}, ${price} €/kWh${next ? `. ${next} at ${at}` : ''}.`,
          fr: `Contrat trouvé : ${offer}. En ce moment : ${period}, ${price} €/kWh${next ? `. ${next} à ${at}` : ''}.`,
          de: `Vertrag gefunden: ${offer}. Gerade: ${period}, ${price} €/kWh${next ? `. ${next} um ${at}` : ''}.`,
          es: `Contrato encontrado: ${offer}. Ahora: ${period}, ${price} €/kWh${next ? `. ${next} a las ${at}` : ''}.`,
        });
      });
    },

    /** The multi-language label of a period, for the widget and the scenes. */
    periodLabel(period) {
      return PERIOD_LABELS[period];
    },
  };
}
