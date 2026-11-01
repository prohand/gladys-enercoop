// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of the manifest;
// the SDK fetches it (`gladys.getConfig()`) and notifies every change
// (`gladys.onConfigUpdated()`). This module only applies the defaults and
// normalizes the types, so the rest of the code never deals with `undefined`
// or with a number typed as a string.
// -----------------------------------------------------------------------------

export const GRANULARITIES = {
  THIRTY_MINUTES: 'thirty_minutes',
  DAILY: 'daily',
};

// MUST stay consistent with the `default` values of the manifest
// (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  prm: '',
  token: '',
  granularity: GRANULARITIES.THIRTY_MINUTES,
  history_days: 30,
  sync_interval_hours: 6,
  daily_threshold_kwh: 0,
  alsace_moselle: false,
};

const LIMITS = {
  history_days: [1, 365],
  sync_interval_hours: [1, 24],
  daily_threshold_kwh: [0, 500],
};

function clampNumber(value, key) {
  const number = Number(value);
  const [min, max] = LIMITS[key];
  if (!Number.isFinite(number)) {
    return DEFAULT_CONFIG[key];
  }
  return Math.min(max, Math.max(min, number));
}

/**
 * Merge the user config with the defaults and force the types.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const value = (key) => raw[key] ?? DEFAULT_CONFIG[key];
  return {
    // The PRM is printed with spaces on some bills: keep the digits only.
    prm: String(value('prm')).replace(/\D/g, ''),
    token: String(value('token')).trim(),
    granularity: Object.values(GRANULARITIES).includes(raw.granularity)
      ? raw.granularity
      : DEFAULT_CONFIG.granularity,
    history_days: Math.round(clampNumber(value('history_days'), 'history_days')),
    sync_interval_hours: clampNumber(value('sync_interval_hours'), 'sync_interval_hours'),
    daily_threshold_kwh: clampNumber(value('daily_threshold_kwh'), 'daily_threshold_kwh'),
    alsace_moselle: value('alsace_moselle') === true || value('alsace_moselle') === 'true',
  };
}

/** A PRM (point de livraison) is 14 digits. */
export function isValidPrm(prm) {
  return /^\d{14}$/.test(prm ?? '');
}

/** Whether the integration has what it needs to read the meter. */
export function isConfigured(config) {
  return isValidPrm(config.prm) && config.token.length > 0;
}

/** The PRM with its middle hidden, for logs and widgets: `1234 •••••• 5678`. */
export function maskPrm(prm) {
  if (!prm || prm.length < 8) {
    return prm || '—';
  }
  return `${prm.slice(0, 4)} •••••• ${prm.slice(-4)}`;
}
