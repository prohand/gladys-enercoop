import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meter } from '../src/devices/meter.js';
import { MESSAGES } from '../src/enercoop/messages.js';
import { SCENE_TRIGGERS } from '../src/enercoop/service.js';
import {
  PRM,
  createFakeFetch,
  dailyAnswer,
  dayOfLoadCurve,
  errorResponse,
  loadCurveAnswer,
  makeToken,
} from './helpers/fixtures.js';
import { setup } from './helpers/setup.js';

// Enedis answers for 1-3 April 2026 (the clock says 4 April, 10:00 in Paris).
const loadCurveRouter = (type, params) => {
  assert.equal(type, 'courbe_de_charge_consommation');
  const points = [];
  for (const [date, watts] of [
    ['2026-04-01', 500],
    ['2026-04-02', 1000],
    ['2026-04-03', 2000],
  ]) {
    if (date >= params.dateDebut && date < params.dateFin) {
      points.push(...dayOfLoadCurve(date, watts));
    }
  }
  return loadCurveAnswer(points);
};

test('a sync publishes the load curve as dated 30-minute consumption', async () => {
  const fakeFetch = createFakeFetch(loadCurveRouter);
  const { gladys, service, store, config } = await setup({ fetchImpl: fakeFetch });

  const result = await service.sync();

  assert.equal(result.published, 144, 'three days of 48 slots');
  assert.deepEqual(result.day, { date: '2026-04-03', kwh: 48, complete: true });
  assert.deepEqual(fakeFetch.calls[0].params, {
    pointId: PRM,
    dateDebut: '2026-04-01',
    dateFin: '2026-04-04',
  });
  const featureId = meter.featureExternalId(gladys, config);
  const [batch] = gladys.fake.publishedEnergyConsumption;
  assert.equal(batch.device_feature_external_id, featureId);
  assert.deepEqual(batch.intervals[0], { starts_at: '2026-03-31T22:00:00.000Z', kwh: 0.25 });
  assert.deepEqual(store.state.days, { '2026-04-01': 12, '2026-04-02': 24, '2026-04-03': 48 });
  assert.equal(store.state.lastError, null);
  assert.ok(gladys.fake.widgetRefreshes.includes('enercoop'));
});

test('the next sync only asks for what is new, the last day read again', async () => {
  const fakeFetch = createFakeFetch(loadCurveRouter);
  const { service, clock } = await setup({ fetchImpl: fakeFetch });
  await service.sync();
  clock.now = Date.parse('2026-04-05T08:00:00Z');
  await service.sync();
  assert.deepEqual(fakeFetch.calls[1].params, {
    pointId: PRM,
    dateDebut: '2026-04-02',
    dateFin: '2026-04-05',
  });
});

test('the daily event fires once for the newest day, the threshold event above the limit', async () => {
  const { gladys, service, clock } = await setup({
    fetchImpl: createFakeFetch(loadCurveRouter),
    config: { daily_threshold_kwh: 30 },
  });
  await service.sync();
  assert.deepEqual(gladys.fake.sceneEvents, [
    {
      key: SCENE_TRIGGERS.DAILY_CONSUMPTION_AVAILABLE,
      data: { date: '2026-04-03', kwh: 48 },
    },
    {
      key: SCENE_TRIGGERS.DAILY_THRESHOLD_EXCEEDED,
      data: { date: '2026-04-03', kwh: 48, threshold_kwh: 30 },
    },
  ]);
  clock.now += 3600_000;
  await service.sync();
  assert.equal(gladys.fake.sceneEvents.length, 2, 'nothing new, nothing fired');
});

test('daily readings feed a daily-consumption feature, by date', async () => {
  const fakeFetch = createFakeFetch((type) => {
    assert.equal(type, 'consommation_quotidienne');
    return dailyAnswer([
      ['2026-04-01', 9271],
      ['2026-04-02', 12724],
      ['2026-04-03', 14054],
    ]);
  });
  const { gladys, service, store } = await setup({
    fetchImpl: fakeFetch,
    config: { granularity: 'daily' },
  });
  const result = await service.sync();
  assert.equal(result.published, 3);
  assert.deepEqual(gladys.fake.publishedEnergyConsumption[0].intervals[0], {
    date: '2026-04-01',
    kwh: 9.271,
  });
  assert.equal(store.state.days['2026-04-03'], 14.054);
});

test('a meter not created yet: the readings wait, the user is told what to do', async () => {
  const { service, store } = await setup({
    fetchImpl: createFakeFetch(loadCurveRouter),
    createMeter: false,
  });
  await assert.rejects(service.sync(), (err) => err.userMessage === MESSAGES.deviceNotCreated);
  assert.deepEqual(store.state.lastError.message, MESSAGES.deviceNotCreated);
  assert.deepEqual(store.state.lastIntervalEnd, {}, 'the same window is read again next time');
  assert.equal(service.transportEntries()[0].transport, 'unreachable');
});

test('Enedis errors are explained', async () => {
  const unauthorized = await setup({
    fetchImpl: createFakeFetch(() => errorResponse(401, { message: 'Token invalide' })),
  });
  await assert.rejects(
    unauthorized.service.sync(),
    (err) => err.userMessage === MESSAGES.unauthorized,
  );

  const refused = await setup({
    fetchImpl: createFakeFetch(() =>
      errorResponse(400, { error: { error_description: 'Pas de courbe de charge' } }),
    ),
  });
  await assert.rejects(
    refused.service.sync(),
    (err) => err.userMessage === MESSAGES.loadCurveRefused,
  );

  const down = await setup({ fetchImpl: createFakeFetch(() => errorResponse(503, {})) });
  await assert.rejects(down.service.sync(), (err) => err.userMessage === MESSAGES.unavailable);

  const offline = await setup({
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  await assert.rejects(offline.service.sync(), (err) => err.userMessage === MESSAGES.network);
});

test('without a PRM nothing is read', async () => {
  let called = false;
  const { service } = await setup({
    config: { prm: '' },
    createMeter: false,
    fetchImpl: async () => {
      called = true;
    },
  });
  await assert.rejects(service.sync(), (err) => err.userMessage === MESSAGES.invalidPrm);
  assert.equal(called, false);
  assert.deepEqual(service.transportEntries(), []);
});

test('two syncs asked together read Enedis once', async () => {
  const fakeFetch = createFakeFetch(loadCurveRouter);
  const { service } = await setup({ fetchImpl: fakeFetch });
  await Promise.all([service.sync(), service.sync()]);
  assert.equal(fakeFetch.calls.length, 1);
});

test('Test the connection', async () => {
  const ok = await setup({
    fetchImpl: createFakeFetch(() => dailyAnswer([['2026-04-03', 14054]])),
  });
  const message = await ok.service.testConnection();
  assert.match(message.fr, /^Connexion OK/);
  assert.match(message.fr, /14,05 kWh/);
  assert.match(message.en, /14\.05 kWh/);
  assert.ok(message.de && message.es);

  const otherPrm = await setup({ config: { token: makeToken(['22222222222222']) } });
  assert.deepEqual(await otherPrm.service.testConnection(), MESSAGES.tokenOtherPrm);

  const noToken = await setup({ config: { token: '' } });
  assert.deepEqual(await noToken.service.testConnection(), MESSAGES.notConfigured);
});

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

test('the tariff watch fires tariff_period_changed when off-peak hours start', async () => {
  const { gladys, service, clock } = await setup({
    now: '2026-04-06T19:59:00Z', // Monday 21:59 in Paris (an Easter Monday: holiday!)
    contracts: [
      {
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
      },
    ],
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
