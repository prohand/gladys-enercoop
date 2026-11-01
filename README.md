# Enercoop for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that brings your **Enercoop** electricity
into Gladys: the **Linky** consumption of your delivery point, the **Enercoop energy contracts** to price it, and
off-peak hours you can build scenes on.

Built from the official [JavaScript template](https://github.com/GladysAssistant/integration-template-js) with the
SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js). Requires
**Gladys 5.3+**.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) ·
[Español](docs/es.md).

## Features

| Surface               | What it does                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Device                | `Linky Enercoop` meter, one consumption feature: every 30 minutes (load curve) or daily           |
| Energy contracts      | Templates **Base**, **Flexibilité heures creuses**, **Flexibilité nuit et week-end** (rules mode) |
| Tariff calendar       | `holidays-fr`: French public holidays (+ Alsace-Moselle), computed locally                        |
| Scene triggers        | `daily_consumption_available`, `daily_threshold_exceeded`, `tariff_period_changed`                |
| Scene actions         | `sync_consumption`, `get_current_tariff`                                                          |
| Dashboard widget      | `enercoop`: last day, price and period now, 14-day chart, next change, sync status, Sync button   |
| Configuration buttons | Test the connection, Sync now                                                                     |
| Transport tag         | **cloud** (Enedis → Conso API → Gladys); the device badge turns "unreachable" when a sync fails   |
| Languages             | English, French, German, Spanish (manifest, messages, widget, documentation)                      |

### Where the data comes from

Enercoop supplies the electricity, **Enedis** reads the meter. The readings come from the Enedis "Mesure synchrone
V2" API through [Conso API](https://conso.boris.sh), a free open-source relay: the user gives their consent once and
pastes a token. Readings of a day arrive the next morning, so the integration publishes **dated consumption**
(`publishEnergyConsumption`) rather than an index or live states, and Gladys prices every half-hour with the
Enercoop contract the user attached to the meter.

### Energy contracts

The three templates live in the manifest `energy_contracts` field: Gladys offers them in its contract wizard and
computes the costs with its own rule engine. Prices are template **inputs** (incl. VAT, defaults indicative for
6 kVA in October 2026): the user copies the ones of their bill. The integration reads the same rules
(`src/enercoop/tariffs.js`) to know the current period and price for the widget, the `tariff_period_changed` trigger
and the `get_current_tariff` action — one source, no drift.

## Project structure

```
.
├─ index.js                         # SDK wiring, timers, lifecycle
├─ src/
│  ├─ config.js, i18n.js, time.js, holidays.js, state.js
│  ├─ conso/                        # Conso API client + Enedis answer parsing
│  ├─ devices/meter.js              # the Linky device
│  ├─ enercoop/                     # service (sync, events, contracts), tariffs, messages
│  └─ capabilities/                 # scene actions, widget
├─ docs/{en,fr,de,es}.md            # user documentation (re-hosted by Gladys)
├─ test/                            # node --test, SDK fake Gladys, fake fetch
├─ gladys-assistant-integration.json
├─ Dockerfile                       # Node 24 Alpine, read-only rootfs, writes only /data
├─ CHANGELOG.md · CLAUDE.md · SECURITY.md
├─ .github/workflows/               # ci, release, build, github-release
├─ .github/scripts/changelog-release.mjs
├─ .github/dependabot.yml
└─ cover.png                        # 800×534, catalog cover
```

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
```

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="enercoop" \
DATA_DIR=./data LOG_LEVEL=debug \
npm start
```

## Workflows

Same pipeline as [prohand/gladys-devmel](https://github.com/prohand/gladys-devmel):

- **CI** (`ci.yml`): Prettier, ESLint, tests on Node 22 and 24; on pull requests, the store admission checks and a
  Docker build.
- **Release** (`release.yml`, from the GitHub UI: Actions → Release → patch / minor / major): bumps the version in
  `package.json`, `package-lock.json` and the manifest, rolls `CHANGELOG.md`, tags `vX.Y.Z`, builds the image, runs
  the full store check and publishes the GitHub Release.
- **Build** (`build.yml`): multi-arch image `linux/amd64` + `linux/arm64` to `ghcr.io/prohand/gladys-enercoop`.
- **GitHub releases** (`github-release.yml`): one Release per version tag, notes from the changelog.
- **Dependabot**: npm weekly, GitHub Actions and the Docker base image monthly.

## Publish

1. Make sure the code is on the `main` branch (the store reads the manifest of the default branch).
2. Add the GitHub topic `gladys-assistant-integration` to the repository and make it public.
3. Turn on **Private vulnerability reporting** (Settings → Security), used by [`SECURITY.md`](SECURITY.md).
4. Run **Actions → Release → major**: the first release goes from `0.0.0` to `1.0.0`.

## License

Apache-2.0
