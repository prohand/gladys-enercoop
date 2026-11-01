// -----------------------------------------------------------------------------
// Entry point of the Enercoop integration for Gladys Assistant.
//
// SDK wiring only — the work lives in src/enercoop/service.js:
//   1. instantiate the SDK (connection, auth, reconnection: handled for it);
//   2. register every handler BEFORE connect();
//   3. on each (re)connection: config, contracts, holidays, and the timers
//      (tariff watch, contracts, holiday calendar).
//
// A `provider` integration: no device. The consumption comes from the meter
// the user already has in Gladys, priced with the Enercoop contract they
// attach to it.
//
// Environment variables injected by the Gladys supervisor, read by the SDK:
// GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { createService } from './src/enercoop/service.js';
import { SCENE_ACTIONS } from './src/capabilities/scenes.js';
import { WIDGETS } from './src/capabilities/widget.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const CONTRACTS_REFRESH_MS = 15 * MINUTE_MS;
const HOLIDAYS_REFRESH_MS = 12 * HOUR_MS;

const gladys = new GladysIntegration();
const service = createService({ gladys });
service.setConfig(normalizeConfig());

let periodicTimers = [];

// --- Configuration screen button ---------------------------------------------
gladys.onAction('test_connection', () => service.checkContract());

// --- Scene actions -----------------------------------------------------------
for (const [actionKey, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(actionKey, (fields) => handler(service, { fields }));
}

// --- Dashboard widget --------------------------------------------------------
for (const [widgetKey, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(widgetKey, (request) => widget.get(service, request));
}

// --- Configuration updated ---------------------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('Configuration updated');
  service.setConfig(normalizeConfig(newConfig));
  await initialize();
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  service.setConfig(normalizeConfig(await gladys.getConfig()));
  await initialize();
});

gladys.on('disconnected', () => {
  stopTimers();
});

async function initialize() {
  stopTimers();
  try {
    await service.refreshContracts().catch((err) => logger.warn('Contracts', err.message));
    await service.publishHolidays().catch((err) => logger.warn('Holidays', err.message));
    await service.checkTariff();
    startTimers();
    await gladys.setConnectionStatus(true).catch(() => {});
  } catch (err) {
    logger.error('Initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        de: 'Initialisierung fehlgeschlagen, prüfe die Logs der Integration.',
        es: 'La inicialización ha fallado, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
}

function startTimers() {
  // The tariff watch ticks on the minute, so a switch at 22:00 fires at 22:00.
  const align = setTimeout(
    () => {
      service.checkTariff().catch((err) => logger.warn('Tariff', err.message));
      periodicTimers.push(
        setInterval(() => {
          service.checkTariff().catch((err) => logger.warn('Tariff', err.message));
        }, MINUTE_MS),
      );
    },
    MINUTE_MS - (Date.now() % MINUTE_MS),
  );
  periodicTimers.push(
    align,
    setInterval(() => {
      service.refreshContracts().catch((err) => logger.warn('Contracts', err.message));
    }, CONTRACTS_REFRESH_MS),
    setInterval(() => {
      service.publishHolidays().catch((err) => logger.warn('Holidays', err.message));
    }, HOLIDAYS_REFRESH_MS),
  );
}

function stopTimers() {
  for (const timer of periodicTimers) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  periodicTimers = [];
}

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  stopTimers();
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', err);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Enercoop integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
