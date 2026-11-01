import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConsoApiError,
  DATA_TYPES,
  USER_AGENT,
  fetchReadings,
  fetchWindow,
  splitWindow,
  tokenPrms,
} from '../src/conso/client.js';
import { PRM, createFakeFetch, dailyAnswer, errorResponse, makeToken } from './helpers/fixtures.js';

const config = { prm: PRM, token: makeToken() };

test('a request carries the new Enedis parameter names, the token and a user agent', async () => {
  const fakeFetch = createFakeFetch(() => dailyAnswer([['2026-04-01', 9271]]));
  await fetchReadings(config, DATA_TYPES.DAILY, '2026-04-01', '2026-04-02', {
    fetchImpl: fakeFetch,
  });
  const [call] = fakeFetch.calls;
  assert.equal(call.type, 'consommation_quotidienne');
  assert.deepEqual(call.params, { pointId: PRM, dateDebut: '2026-04-01', dateFin: '2026-04-02' });
  assert.equal(call.headers.Authorization, `Bearer ${config.token}`);
  assert.equal(call.headers['User-Agent'], USER_AGENT);
  assert.match(USER_AGENT, /^gladys-enercoop\/\d+\.\d+\.\d+/);
});

test('an error answer becomes a ConsoApiError with the Enedis description', async () => {
  const fakeFetch = createFakeFetch(() =>
    errorResponse(400, {
      status: 400,
      message: 'The Enedis API returned an error',
      error: { error: 'ADAM-ERR0002', error_description: 'La date de fin doit être supérieure.' },
    }),
  );
  await assert.rejects(
    fetchReadings(config, DATA_TYPES.DAILY, '2026-04-02', '2026-04-01', { fetchImpl: fakeFetch }),
    (err) =>
      err instanceof ConsoApiError &&
      err.status === 400 &&
      err.message === 'La date de fin doit être supérieure.',
  );
});

test('the token never appears in an error', async () => {
  const fakeFetch = createFakeFetch(() => errorResponse(401, { message: 'Token invalide' }));
  await assert.rejects(
    fetchReadings(config, DATA_TYPES.DAILY, '2026-04-01', '2026-04-02', { fetchImpl: fakeFetch }),
    (err) => !String(err.message).includes(config.token) && err.status === 401,
  );
});

test('long windows are split into the chunks Enedis accepts', async () => {
  assert.deepEqual(splitWindow('2026-04-01', '2026-04-16', 7), [
    ['2026-04-01', '2026-04-08'],
    ['2026-04-08', '2026-04-15'],
    ['2026-04-15', '2026-04-16'],
  ]);
  assert.deepEqual(splitWindow('2026-04-01', '2026-04-01', 7), []);
  const fakeFetch = createFakeFetch(() => dailyAnswer([]));
  await fetchWindow(config, DATA_TYPES.LOAD_CURVE, '2026-04-01', '2026-04-16', {
    fetchImpl: fakeFetch,
  });
  assert.equal(fakeFetch.calls.length, 3, 'one request per 7 days of load curve');
});

test('tokenPrms reads the PRMs of a token, and nothing of garbage', () => {
  assert.deepEqual(tokenPrms(makeToken([PRM, '22222222222222'])), [PRM, '22222222222222']);
  assert.deepEqual(tokenPrms('not-a-jwt'), []);
});
