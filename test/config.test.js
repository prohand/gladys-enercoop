import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  isConfigured,
  isValidPrm,
  maskPrm,
  normalizeConfig,
} from '../src/config.js';

test('an empty config gets the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.equal(isConfigured(normalizeConfig()), false);
});

test('values typed in a form are given their types and bounds', () => {
  const config = normalizeConfig({
    prm: '1234 5678 9012 34',
    token: '  abc  ',
    granularity: 'weekly',
    history_days: '400',
    sync_interval_hours: '0',
    daily_threshold_kwh: 'not a number',
    alsace_moselle: 'true',
  });
  assert.equal(config.prm, '12345678901234');
  assert.equal(config.token, 'abc');
  assert.equal(config.granularity, 'thirty_minutes');
  assert.equal(config.history_days, 365);
  assert.equal(config.sync_interval_hours, 1);
  assert.equal(config.daily_threshold_kwh, 0);
  assert.equal(config.alsace_moselle, true);
  assert.equal(isConfigured(config), true);
});

test('PRM checks and masking', () => {
  assert.equal(isValidPrm('12345678901234'), true);
  assert.equal(isValidPrm('1234567890123'), false);
  assert.equal(maskPrm('12345678901234'), '1234 •••••• 1234');
  assert.equal(maskPrm(''), '—');
});
