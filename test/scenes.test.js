import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_ACTIONS } from '../src/capabilities/scenes.js';
import { MANIFEST } from '../src/enercoop/tariffs.js';
import { createFakeFetch, dayOfLoadCurve, loadCurveAnswer } from './helpers/fixtures.js';
import { setup } from './helpers/setup.js';

const declaredOutputs = (key) =>
  MANIFEST.scene_actions.find((action) => action.key === key).outputs.map((output) => output.key);

test('sync_consumption returns its declared outputs', async () => {
  const { service } = await setup({
    fetchImpl: createFakeFetch(() => loadCurveAnswer(dayOfLoadCurve('2026-04-03', 1000))),
  });
  const outputs = await SCENE_ACTIONS.sync_consumption(service, { fields: {} });
  assert.deepEqual(outputs, { published: 48, last_day: '2026-04-03', last_day_kwh: 24 });
  assert.deepEqual(Object.keys(outputs).sort(), declaredOutputs('sync_consumption').sort());
});

test('get_current_tariff returns the price of the contract, or fails without one', async () => {
  const { service } = await setup({
    now: '2026-04-04T08:00:00Z', // a Saturday
    contracts: [
      { id: 'c', template_key: 'enercoop-flexibilite-nuit-week-end', inputs: {}, status: 'active' },
    ],
  });
  await assert.rejects(SCENE_ACTIONS.get_current_tariff(service, { fields: {} }));
  await service.refreshContracts();
  const outputs = await SCENE_ACTIONS.get_current_tariff(service, { fields: {} });
  assert.deepEqual(outputs, {
    period: 'off_peak',
    label: 'Heures creuses',
    price: 0.1729,
    is_off_peak: true,
  });
  assert.deepEqual(Object.keys(outputs).sort(), declaredOutputs('get_current_tariff').sort());
});

test('the scene events only carry the keys their trigger declares', async () => {
  const { gladys, service } = await setup({
    config: { daily_threshold_kwh: 1 },
    fetchImpl: createFakeFetch(() => loadCurveAnswer(dayOfLoadCurve('2026-04-03', 1000))),
  });
  await service.sync();
  assert.equal(gladys.fake.sceneEvents.length, 2);
  for (const { key, data } of gladys.fake.sceneEvents) {
    const trigger = MANIFEST.scene_triggers.find((entry) => entry.key === key);
    assert.ok(trigger, `${key} is not declared`);
    const declared = [...(trigger.fields ?? []), ...(trigger.variables ?? [])].map((f) => f.key);
    for (const [name, value] of Object.entries(data)) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
      assert.notEqual(typeof value, 'object', `${key}: data.${name} must be a primitive`);
    }
  }
});
