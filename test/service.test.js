import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../src/enercoop/messages.js';
import { SCENE_TRIGGERS } from '../src/enercoop/service.js';
import { setup } from './helpers/setup.js';

const HC_CONTRACT = {
  id: 'c1',
  template_key: 'enercoop-flexibilite-heures-creuses',
  template_version: '2026-10-01',
  pricing_mode: 'rules',
  inputs: { off_peak_slots: [['22:00', '06:00']], peak_price: 0.28, off_peak_price: 0.19 },
  valid_from: '2026-01-01',
  valid_to: null,
  timezone: 'Europe/Paris',
  currency: 'EUR',
  billing_period_start_day: 1,
  status: 'active',
};

test('the holidays-fr calendar is fed from a year back to 7 days ahead', async () => {
  const { gladys, service } = await setup();
  assert.equal(await service.publishHolidays(), true);
  const [batch] = gladys.fake.publishedEnergyCalendars;
  assert.equal(batch.calendar_key, 'holidays-fr');
  assert.equal(batch.entries.at(-1).date, '2026-04-11');
  assert.ok(
    batch.entries.some((entry) => entry.date === '2026-04-06' && entry.value === 'holiday'),
  );
});

test('the Alsace-Moselle option adds Good Friday to the calendar', async () => {
  const { gladys, service } = await setup({ config: { alsace_moselle: true } });
  await service.publishHolidays();
  const [batch] = gladys.fake.publishedEnergyCalendars;
  assert.ok(
    batch.entries.some((entry) => entry.date === '2026-04-03' && entry.value === 'holiday'),
  );
});

test('the tariff watch fires tariff_period_changed when off-peak hours start', async () => {
  const { gladys, service, clock } = await setup({
    now: '2026-04-06T19:59:00Z', // Monday 21:59 in Paris (an Easter Monday: holiday!)
    contracts: [HC_CONTRACT],
  });
  await service.refreshContracts();
  assert.equal(await service.checkTariff(), false, 'the first look only remembers');
  clock.now += 60_000;
  assert.equal(await service.checkTariff(), true);
  assert.deepEqual(gladys.fake.sceneEvents.at(-1), {
    key: SCENE_TRIGGERS.TARIFF_PERIOD_CHANGED,
    data: { period: 'off_peak', label: 'Heures creuses', price: 0.19 },
  });
  clock.now += 60_000;
  assert.equal(await service.checkTariff(), false, 'still off-peak');
});

test('a change of contract is not a change of period', async () => {
  const { gladys, service, clock } = await setup({
    now: '2026-04-07T19:59:00Z', // Tuesday 21:59 in Paris
    contracts: [HC_CONTRACT],
  });
  await service.refreshContracts();
  await service.checkTariff();
  gladys.fake.energyContracts = [
    { ...HC_CONTRACT, inputs: { ...HC_CONTRACT.inputs, peak_price: 0.3 } },
  ];
  await service.refreshContracts();
  clock.now += 60_000;
  assert.equal(await service.checkTariff(), false, 'the watch starts afresh');
});

test('Check the contract: which offer, the price now and the next change', async () => {
  const { service } = await setup({ now: '2026-04-07T08:00:00Z', contracts: [HC_CONTRACT] });
  const message = await service.checkContract();
  assert.equal(
    message.fr,
    'Contrat trouvé : Enercoop – Flexibilité heures creuses. En ce moment : Heures pleines, 0,28 €/kWh. Heures creuses à 22:00.',
  );
  assert.match(message.en, /^Contract found: .*0\.28 €\/kWh/);
  assert.ok(message.de && message.es);

  const none = await setup();
  assert.deepEqual(await none.service.checkContract(), MESSAGES.noContract);
});

test('a contract of another integration is ignored', async () => {
  const { service } = await setup({
    contracts: [{ id: 'x', template_key: 'edf-tempo', inputs: {}, status: 'active' }],
  });
  await service.refreshContracts();
  assert.equal(service.contract(), null);
  assert.equal(service.tariffNow(), null);
});
