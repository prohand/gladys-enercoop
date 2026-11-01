# Enercoop for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that brings the **Enercoop energy
contracts** into Gladys: Gladys prices the consumption of the user's own meter with them, and the integration tells
when off-peak hours start (weekends and public holidays included) for scenes.

Built from the official [JavaScript template](https://github.com/GladysAssistant/integration-template-js) with the
SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js). Requires
**Gladys 5.3+**.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) ·
[Español](docs/es.md).

## Features

| Surface              | What it does                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Energy contracts     | Templates **Base**, **Flexibilité heures creuses**, **Flexibilité nuit et week-end** (rules mode) |
| Tariff calendar      | `holidays-fr`: French public holidays (+ Alsace-Moselle), computed locally                        |
| Scene trigger        | `tariff_period_changed`                                                                           |
| Scene action         | `get_current_tariff`                                                                              |
| Dashboard widget     | `enercoop`: price and period now, followed offer, next change                                     |
| Configuration button | Check the contract                                                                                |
| Languages            | English, French, German, Spanish (manifest, messages, widget, documentation)                      |

### No meter reading

A manifest `type: "provider"`: no device, no Internet access. The consumption comes from the meter the user already
has in Gladys — Linky through the Enedis integration of Gladys Plus, a Lixee TIC, a Shelly EM… — and Gladys prices
it with the Enercoop contract attached to that meter. Version 0.0.1 read the Linky itself through Conso API; that was
removed so the integration does not compete with the Enedis integration of Gladys Plus, and so it works for any meter.

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
│  ├─ config.js, i18n.js, time.js, holidays.js
│  ├─ enercoop/                     # service (contracts, holidays, tariff watch), tariffs, messages
│  └─ capabilities/                 # scene actions, widget
├─ docs/{en,fr,de,es}.md            # user documentation (re-hosted by Gladys)
├─ test/                            # node --test, SDK fake Gladys
├─ gladys-assistant-integration.json
├─ Dockerfile                       # Node 24 Alpine, read-only rootfs
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
LOG_LEVEL=debug \
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
