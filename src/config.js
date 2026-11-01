// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of the manifest;
// the SDK fetches it (`gladys.getConfig()`) and notifies every change
// (`gladys.onConfigUpdated()`). This module only applies the defaults and
// normalizes the types, so the rest of the code never deals with `undefined`
// or with a boolean typed as a string.
//
// The integration reads no meter: the one setting left is which public
// holidays the "night and weekend" offer prices off-peak.
// -----------------------------------------------------------------------------

// MUST stay consistent with the `default` values of the manifest
// (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  alsace_moselle: false,
};

/**
 * Merge the user config with the defaults and force the types.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const value = (key) => raw[key] ?? DEFAULT_CONFIG[key];
  return {
    alsace_moselle: value('alsace_moselle') === true || value('alsace_moselle') === 'true',
  };
}
