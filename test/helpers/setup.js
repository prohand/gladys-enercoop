import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../../src/config.js';
import { meter } from '../../src/devices/meter.js';
import { createService } from '../../src/enercoop/service.js';
import { createStore } from '../../src/state.js';
import { PRM, makeToken } from './fixtures.js';

/**
 * A service wired to a fake Gladys, a fake fetch, a fixed clock and a
 * throw-away /data.
 */
export async function setup({
  config = {},
  fetchImpl,
  now = '2026-04-04T08:00:00Z',
  createMeter = true,
  contracts = [],
} = {}) {
  const gladys = createFakeGladys({
    energyCalendars: { 'holidays-fr': [] },
    energyContracts: contracts,
  });
  const fullConfig = normalizeConfig({ prm: PRM, token: makeToken(), history_days: 3, ...config });
  if (createMeter) {
    gladys.fake.devices.push(meter.buildDevice(gladys, fullConfig));
  }
  const store = createStore(await mkdtemp(join(tmpdir(), 'enercoop-')));
  await store.load();
  const clock = { now: Date.parse(now) };
  const service = createService({ gladys, store, fetchImpl, clock: () => clock.now });
  service.setConfig(fullConfig);
  return { gladys, store, service, clock, config: fullConfig };
}
