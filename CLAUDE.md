# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and to human contributors working in this
repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime dependency:
`@gladysassistant/integration-sdk`) for **Enercoop**, the French cooperative electricity supplier. It started from
the official template (`GladysAssistant/integration-template-js`) and follows the layout and workflows of
`prohand/gladys-devmel`. Requires Gladys 5.3+.

- A manifest **`type: "provider"`**: no device, no meter reading, no Internet access. The consumption comes from
  the meter the user already has in Gladys (Linky through the Enedis integration of Gladys Plus, Lixee TIC, Shelly
  EM…). Version 0.0.1 read the Linky through Conso API: removed on purpose (it competed with Gladys Plus and only
  served Enedis meters). **Do not add a meter reading back.**
- Declares three **energy contract templates** (manifest `energy_contracts`, `rules` mode): Base, Flexibilité
  heures creuses, Flexibilité nuit et week-end. Gladys' rule engine prices the consumption; the integration never
  prices anything.
- Feeds the **`holidays-fr`** tariff calendar (French public holidays, computed locally, Alsace-Moselle option).
- Scene trigger `tariff_period_changed`, scene action `get_current_tariff`, the `enercoop` dashboard widget (price
  and period now, next change) and a "Check the contract" button (action key `test_connection`).

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
index.js                     SDK wiring only: handlers, timers (tariff watch, contracts, holidays), lifecycle
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js                  LANGUAGES (en, fr, de, es), pick / localize / texts / formatNumber
src/time.js                  Europe/Paris wall clock <-> instants (Intl only), time intervals
src/holidays.js              French public holidays (Easter computus)
src/enercoop/service.js      holidays calendar, contracts, tariff watch, check the contract
src/enercoop/tariffs.js      evaluates the MANIFEST tariff rules (current price / period / next change)
src/enercoop/messages.js     user-facing errors in four languages
src/capabilities/scenes.js   scene action handlers
src/capabilities/widget.js   widget content
test/                        node --test, against the SDK fake Gladys (helpers/)
```

### Invariants worth knowing

- **Keys are forever.** Template keys, the `holidays-fr` calendar key, trigger, scene action and widget keys are
  stored by users: never rename them.
- **The manifest is the single source of the tariffs.** `src/enercoop/tariffs.js` reads
  `gladys-assistant-integration.json` and evaluates its rules: change a template there, not in code. A rule `label`
  must be `Base`, `Heures pleines` or `Heures creuses` (it gives the period; tested).
- A new template `version` never changes a user's contract silently: bump it when the default prices change.
- The `holidays-fr` calendar gets a value for **every** day (`holiday` / `regular`), from 400 days back to 7 days
  ahead (Gladys' limit). A 403 means another integration owns the key: fine.
- The tariff watch ticks on the minute; the first look after a (re)start or a contract change only remembers the
  period, it never fires `tariff_period_changed`.
- The container rootfs is read-only: nothing is written at all (no state file).

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
