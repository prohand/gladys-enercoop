import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { ENERCOOP_WIDGET, WIDGETS, buildContent } from '../src/capabilities/widget.js';
import { setup } from './helpers/setup.js';

const CONTRACT = {
  id: 'c1',
  template_key: 'enercoop-flexibilite-nuit-week-end',
  inputs: {},
  status: 'active',
};

test('the widget content renders exactly as sent, in every language', async () => {
  // Friday 3 April 2026, 10:00 in Paris: peak hours until 23:00.
  const { service } = await setup({ now: '2026-04-03T08:00:00Z', contracts: [CONTRACT] });
  await service.refreshContracts();
  for (const language of ['en', 'fr', 'de', 'es']) {
    const content = buildContent(service, { language });
    assert.deepEqual(validateWidgetContent(content), [], language);
  }
  const content = buildContent(service, { language: 'fr' });
  const types = content.components.map((component) => component.type);
  assert.deepEqual(types, ['value', 'value', 'status']);
  assert.equal(content.components[0].value, 0.3064);
  assert.equal(content.components[1].value.fr, 'HP');
  const [contract, next] = content.components[2].items;
  assert.equal(contract.value, 'Flexibilité nuit et week-end');
  assert.equal(next.value, 'Heures creuses · 23:00');
});

test('without a contract the widget says what to do', async () => {
  const { service } = await setup();
  const content = await WIDGETS[ENERCOOP_WIDGET].get(service, { language: 'fr' });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
});
