# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

## [Unreleased]

### Changed

- The integration no longer reads any meter: it becomes a `provider` integration (no device) that only brings the
  Enercoop contracts. The consumption now comes from the meter you already have in Gladys (Linky through the
  Enedis integration of Gladys Plus, Lixee TIC, Shelly EM…): attach your Enercoop contract to it in the Energy
  settings, then delete the former "Linky Enercoop" device.
- The "Enercoop" widget shows the current price and period, the followed offer and the next change.
- The Configuration button becomes "Check the contract": offer, price now and next change.
- New cover: Enercoop contracts, off-peak hours, weekends and public holidays.

### Removed

- Linky readings through Conso API, with the PRM, token, readings, history, sync interval and daily threshold
  settings, the "Linky Enercoop" device and the "Sync now" button.
- Scene triggers "new daily consumption" and "daily consumption over the threshold", scene action "read the meter
  now".

## [0.0.1] - 2026-11-01

### Added

- Linky consumption of an Enercoop delivery point (PRM), read from Enedis through Conso API: every
  30 minutes (load curve) or daily, published as dated consumption Gladys prices itself.
- Three Enercoop energy contract templates for the Gladys contract wizard: Base offer, Flexibility
  off-peak hours, Flexibility night and weekend.
- The `holidays-fr` tariff calendar (French public holidays, Alsace-Moselle option), computed
  locally.
- Scene triggers: new daily consumption, daily consumption over a threshold, tariff period changed.
- Scene actions: read the meter now, get the current price.
- "Enercoop" dashboard widget: last day, current price and period, 14-day chart, next change,
  sync status, Sync button.
- "Test the connection" and "Sync now" buttons in the Configuration screen.
- English, French, German and Spanish texts and documentation.
- `SECURITY.md`, `CHANGELOG.md` and `CLAUDE.md`; CI, release, build and GitHub release workflows.

[Unreleased]: https://github.com/prohand/gladys-enercoop/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/prohand/gladys-enercoop/releases/tag/v0.0.1
