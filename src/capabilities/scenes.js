// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// A scene action returns the declared `outputs` (scalars), readable by the
// following actions of the scene. Throwing fails THIS action only: the scene
// logs the message and carries on.
//
// The scene TRIGGER is fired by the service (src/enercoop/service.js):
//   - tariff_period_changed        off-peak <-> peak hours of the contract
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { PERIODS } from '../enercoop/tariffs.js';
import { MESSAGES, UserError } from '../enercoop/messages.js';

export { SCENE_TRIGGERS } from '../enercoop/service.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTIONS = {
  // The price right now, for a condition on the price or the period
  // ("start the dishwasher if off-peak").
  async get_current_tariff(service) {
    logger.debug('Scene action get_current_tariff');
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
