import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_ACTIONS } from '../src/capabilities/scenes.js';
import { MANIFEST } from '../src/enercoop/tariffs.js';
import { setup } from './helpers/setup.js';

const declaredOutputs = (key) =>
  MANIFEST.scene_actions.find((action) => action.key === key).outputs.map((output) => output.key);

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
  const { gladys, service, clock } = await setup({
    now: '2026-04-07T20:59:00Z', // Tuesday 22:59 in Paris
    contracts: [
      { id: 'c', template_key: 'enercoop-flexibilite-nuit-week-end', inputs: {}, status: 'active' },
    ],
  });
  await service.refreshContracts();
  await service.checkTariff();
  clock.now += 60_000;
  assert.equal(await service.checkTariff(), true);
  assert.equal(gladys.fake.sceneEvents.length, 1);
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
