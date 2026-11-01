import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('an empty config gets the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('a boolean typed in a form is given its type', () => {
  assert.equal(normalizeConfig({ alsace_moselle: 'true' }).alsace_moselle, true);
  assert.equal(normalizeConfig({ alsace_moselle: true }).alsace_moselle, true);
  assert.equal(normalizeConfig({ alsace_moselle: 'false' }).alsace_moselle, false);
});

test('the settings of the former meter reading are ignored', () => {
  // 0.0.1 stored a PRM and a Conso API token: they must never come back.
  assert.deepEqual(normalizeConfig({ prm: '12345678901234', token: 'secret' }), DEFAULT_CONFIG);
});
