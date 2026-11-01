// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// A scene action returns the declared `outputs` (scalars), readable by the
// following actions of the scene. Throwing fails THIS action only: the scene
// logs the message and carries on.
//
// The scene TRIGGERS are fired by the service (src/enercoop/service.js):
//   - daily_consumption_available  a new day of readings is in Gladys
//   - daily_threshold_exceeded     that day went over the configured limit
//   - tariff_period_changed        off-peak <-> peak hours of the contract
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { PERIODS } from '../enercoop/tariffs.js';
import { MESSAGES, UserError } from '../enercoop/messages.js';

export { SCENE_TRIGGERS } from '../enercoop/service.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTIONS = {
  // Read the meter now, instead of waiting for the next scheduled sync.
  async sync_consumption(service) {
    logger.info('Scene action sync_consumption');
    const { published, day } = await service.sync();
    return {
      published,
      last_day: day?.date ?? '',
      last_day_kwh: day?.kwh ?? 0,
    };
  },

  // The price right now, for a condition on the price or the period
  // ("start the dishwasher if off-peak").
  async get_current_tariff(service) {
    const tariff = service.tariffNow();
    if (!tariff) {
      throw new UserError(MESSAGES.noContract);
    }
    return {
      period: tariff.period,
      label: tariff.label,
      price: tariff.price,
      is_off_peak: tariff.period === PERIODS.OFF_PEAK,
    };
  },
};
