import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import {
  ENERCOOP_WIDGET,
  WIDGETS,
  WIDGET_ACTIONS,
  buildContent,
} from '../src/capabilities/widget.js';
import { createFakeFetch, dayOfLoadCurve, loadCurveAnswer } from './helpers/fixtures.js';
import { setup } from './helpers/setup.js';

const CONTRACT = {
  id: 'c1',
  template_key: 'enercoop-flexibilite-nuit-week-end',
  inputs: {},
  status: 'active',
};

const fetchImpl = createFakeFetch(() =>
  loadCurveAnswer([...dayOfLoadCurve('2026-04-02', 1000), ...dayOfLoadCurve('2026-04-03', 500)]),
);

test('the widget content renders exactly as sent, in every language', async () => {
  const { service } = await setup({ fetchImpl, contracts: [CONTRACT] });
  await service.refreshContracts();
  await service.sync();
  for (const language of ['en', 'fr', 'de', 'es']) {
    const content = buildContent(service, { language });
    assert.deepEqual(validateWidgetContent(content), [], language);
  }
  const content = buildContent(service, { language: 'fr' });
  const types = content.components.map((component) => component.type);
  assert.deepEqual(types, ['value', 'value', 'value', 'chart', 'status', 'button']);
  assert.equal(content.components[0].value, 12, 'the last complete day');
  assert.equal(content.components[3].series[0].points.length, 2);
});

test('the widget says what is missing before the configuration is done', async () => {
  const { service } = await setup({ config: { prm: '' }, createMeter: false });
  const content = buildContent(service, { language: 'fr' });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
});

test('a failed sync shows on the widget, still valid', async () => {
  const { service } = await setup({
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  await service.sync().catch(() => {});
  const content = buildContent(service, { language: 'de' });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(content.components.some((component) => component.type === 'text'));
});

test('the Sync button reads the meter and answers a toast', async () => {
  const { service } = await setup({ fetchImpl });
  const message = await WIDGETS[ENERCOOP_WIDGET].action(service, {
    actionKey: WIDGET_ACTIONS.SYNC,
  });
  assert.match(message.fr, /relevé\(s\) reçu\(s\)/);
  assert.ok(message.en.length <= 200);
  await assert.rejects(WIDGETS[ENERCOOP_WIDGET].action(service, { actionKey: 'nope' }));
});
