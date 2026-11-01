# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and to human contributors working in this
repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime dependency:
`@gladysassistant/integration-sdk`) for **Enercoop**, the French cooperative electricity supplier. It started from
the official template (`GladysAssistant/integration-template-js`) and follows the layout and workflows of
`prohand/gladys-devmel`. Requires Gladys 5.3+.

- Reads the **Linky** consumption of one delivery point (PRM) from Enedis through **Conso API**
  (`https://conso.boris.sh`, the cloud channel: manifest `transports: ["cloud"]`), every 30 minutes (load curve)
  or daily, and publishes it with `publishEnergyConsumption` on a `thirty-minutes-consumption` /
  `daily-consumption` feature. No index, no `publishStates`: the readings arrive the day after.
- Declares three **energy contract templates** (manifest `energy_contracts`, `rules` mode): Base, Flexibilité
  heures creuses, Flexibilité nuit et week-end. Gladys' rule engine prices the consumption; the integration never
  prices anything.
- Feeds the **`holidays-fr`** tariff calendar (French public holidays, computed locally, Alsace-Moselle option).
- Scene triggers (`daily_consumption_available`, `daily_threshold_exceeded`, `tariff_period_changed`), scene actions
  (`sync_consumption`, `get_current_tariff`) and the `enercoop` dashboard widget.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/tariffs.test.js            # one file
node --test --test-name-pattern "holiday"   # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
```

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on Node 22 and 24; pull requests also run the
store admission checks (`npx github:GladysAssistant/integration-store --skip-image-check .`) and build the image.
Releases: **Actions → Release** only (bumps `package.json`, `package-lock.json`, manifest `version` +
`docker_image`, rolls `CHANGELOG.md`, tags, builds the multi-arch image, publishes the GitHub Release).

## Architecture

```
index.js                     SDK wiring only: handlers, timers (sync, tariff watch, holidays), lifecycle
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults) + normalization, PRM helpers
src/i18n.js                  LANGUAGES (en, fr, de, es), pick / localize / texts / formatNumber
src/time.js                  Europe/Paris wall clock <-> instants (Intl only), time intervals
src/holidays.js              French public holidays (Easter computus)
src/state.js                 /data/state.json: last sync, last reading, daily totals, events already fired
src/conso/client.js          Conso API requests (French endpoint names since Oct. 2026), errors, token PRMs
src/conso/parse.js           Enedis answers -> { starts_at, kwh } / { date, kwh }, daily totals
src/devices/meter.js         the Linky device (one consumption feature, chosen by `granularity`)
src/enercoop/service.js      sync, scene events, holidays calendar, contracts, tariff watch, test connection
src/enercoop/tariffs.js      evaluates the MANIFEST tariff rules (current price / period / next change)
src/enercoop/messages.js     user-facing errors in four languages
src/capabilities/scenes.js   scene action handlers
src/capabilities/widget.js   widget content + button action
test/                        node --test, against the SDK fake Gladys and a fake fetch (helpers/)
```

### Invariants worth knowing

- **External ids are forever.** The device id is built from the PRM (`gladys.externalIds('linky', prm)`); feature
  keys `consumption-30min` / `consumption-daily`, template keys, the `holidays-fr` calendar key, trigger, action and
  widget keys are stored by users: never rename them.
- **The manifest is the single source of the tariffs.** `src/enercoop/tariffs.js` reads
  `gladys-assistant-integration.json` and evaluates its rules: change a template there, not in code. A rule `label`
  must be `Base`, `Heures pleines` or `Heures creuses` (it gives the period; tested).
- A new template `version` never changes a user's contract silently: bump it when the default prices change.
- **Enedis dates are local French time**, the load curve point is the END of its interval and a power (W): energy =
  power × duration, spread over 30-minute slots. `null` readings are skipped, never published as 0.
- `publishEnergyConsumption`: ≤ 2,000 intervals per call, elapsed slots only, 404 until the user creates the meter
  (the next sync retries the same window).
- The `holidays-fr` calendar gets a value for **every** day (`holiday` / `regular`), from 400 days back to 7 days
  ahead (Gladys' limit). A 403 means another integration owns the key: fine.
- Daily scene events fire once per new day (remembered in `/data`), never for the whole history.
- **The token is a secret**: never logged, sent only to Conso API. The PRM is masked in logs and widget.
- The container rootfs is read-only: write only under `/data` (`DATA_DIR` in tests).

### Manifest

`test/manifest.test.js` keeps `gladys-assistant-integration.json` in sync with the code: every text in en/fr/de/es,
config defaults = `DEFAULT_CONFIG`, actions / scene actions / triggers / widgets registered, energy contract rules
(inputs, calendars, fallback), version = `package.json`, docs in four languages, cover size.

## Conventions

- **Versions belong to the Release workflow**: never edit `version` or the `docker_image` tag by hand.
- **Changelog**: every user-visible change adds a line under `## [Unreleased]` in `CHANGELOG.md` (`### Added`,
  `Changed`, `Fixed`, `Removed`, `Security`). Never write a version heading.
- **User-facing text** is `{ en, fr, de, es }` (built with `src/i18n.js`); user docs in `docs/en.md`, `docs/fr.md`,
  `docs/de.md`, `docs/es.md`, kept in sync.
- Prettier formats, ESLint catches mistakes. Comments explain **why**, in English. Tests never touch the network.
