import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../../src/config.js';
import { createService } from '../../src/enercoop/service.js';

/** A service wired to a fake Gladys and a fixed clock. */
export async function setup({ config = {}, now = '2026-04-04T08:00:00Z', contracts = [] } = {}) {
  const gladys = createFakeGladys({
    energyCalendars: { 'holidays-fr': [] },
    energyContracts: contracts,
  });
  const fullConfig = normalizeConfig(config);
  const clock = { now: Date.parse(now) };
  const service = createService({ gladys, clock: () => clock.now });
  service.setConfig(fullConfig);
  return { gladys, service, clock, config: fullConfig };
}
