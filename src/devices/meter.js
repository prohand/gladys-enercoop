// -----------------------------------------------------------------------------
// Device: the Linky meter of the Enercoop delivery point (PRM).
//
// Its readings arrive the day after (Enedis publishes them overnight), so the
// meter publishes NO index — an index published a day late would pile a whole
// day into one half-hour. It carries one consumption feature the integration
// feeds itself with `publishEnergyConsumption`, dated interval by interval:
//   - `thirty-minutes-consumption` with the load curve (what an off-peak
//     tariff needs to be priced right);
//   - `daily-consumption` when only the daily readings are available (enough
//     for the Base offer).
// Gladys derives the cost feature from it and prices it with the Enercoop
// contract the user attached to the meter.
//
// The device external id is built from the PRM: it never changes, and the
// history, the contract and the dashboards hang on it.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { GRANULARITIES, isValidPrm } from '../config.js';

export const DEVICE_TYPE = 'linky';

// Feature keys: stored by Gladys, never renamed.
export const FEATURES = {
  [GRANULARITIES.THIRTY_MINUTES]: 'consumption-30min',
  [GRANULARITIES.DAILY]: 'consumption-daily',
};

export const meter = {
  key: DEVICE_TYPE,

  ids(gladys, config) {
    return gladys.externalIds(DEVICE_TYPE, config.prm);
  },

  deviceExternalId(gladys, config) {
    return this.ids(gladys, config).device;
  },

  /** External id of the consumption feature the configuration feeds. */
  featureExternalId(gladys, config) {
    return this.ids(gladys, config).feature(FEATURES[config.granularity]);
  },

  buildDevice(gladys, config) {
    if (!isValidPrm(config.prm)) {
      return null;
    }
    const ids = this.ids(gladys, config);
    const thirtyMinutes = config.granularity === GRANULARITIES.THIRTY_MINUTES;
    return {
      name: `Linky Enercoop ${config.prm.slice(-4)}`,
      external_id: ids.device,
      // No poll_frequency: the readings come once a day, the integration
      // reads them on its own schedule (see src/enercoop/sync.js).
      features: [
        {
          name: thirtyMinutes ? 'Consumption (30 min)' : 'Daily consumption',
          external_id: ids.feature(FEATURES[config.granularity]),
          category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
          type: thirtyMinutes
            ? DEVICE_FEATURE_TYPES.ENERGY_SENSOR.THIRTY_MINUTES_CONSUMPTION
            : DEVICE_FEATURE_TYPES.ENERGY_SENSOR.DAILY_CONSUMPTION,
          unit: DEVICE_FEATURE_UNITS.KILOWATT_HOUR,
          min: 0,
          // 36 kVA for half an hour is 18 kWh, for a day 864 kWh.
          max: thirtyMinutes ? 20 : 1000,
          read_only: true,
          has_feedback: false,
          keep_history: true,
        },
      ],
    };
  },
};

export function buildDiscoveredDevices(gladys, config) {
  return [meter.buildDevice(gladys, config)].filter(Boolean);
}
