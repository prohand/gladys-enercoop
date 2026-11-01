// -----------------------------------------------------------------------------
// Entry point of the Enercoop integration for Gladys Assistant.
//
// SDK wiring only — the work lives in src/enercoop/service.js:
//   1. instantiate the SDK (connection, auth, reconnection: handled for it);
//   2. register every handler BEFORE connect();
//   3. on each (re)connection: config, devices, contracts, holidays, sync,
//      and the timers (meter sync, tariff watch, holiday calendar).
//
// Environment variables injected by the Gladys supervisor, read by the SDK:
// GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { isConfigured, normalizeConfig } from './src/config.js';
import { buildDiscoveredDevices, meter } from './src/devices/meter.js';
import { createService } from './src/enercoop/service.js';
import { MESSAGES, explainError } from './src/enercoop/messages.js';
import { SCENE_ACTIONS } from './src/capabilities/scenes.js';
import { WIDGETS, ENERCOOP_WIDGET } from './src/capabilities/widget.js';
import { createStore } from './src/state.js';
import { localize, pick } from './src/i18n.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
// After a failed sync, try again sooner than the normal interval.
const RETRY_DELAY_MS = 30 * MINUTE_MS;
const CONTRACTS_REFRESH_MS = 15 * MINUTE_MS;
const HOLIDAYS_REFRESH_MS = 12 * HOUR_MS;

const gladys = new GladysIntegration();
const store = createStore();
const service = createService({ gladys, store });
service.setConfig(normalizeConfig());

let syncTimer = null;
let periodicTimers = [];

// --- Discovery ---------------------------------------------------------------
gladys.onScanRequest(async () => {
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, service.config));
});

// The user just created the meter: the readings refused with a 404 so far can
// be published now.
gladys.onDeviceCreated(async (device) => {
  if (device.external_id === meter.deviceExternalId(gladys, service.config)) {
    logger.info('Meter created in Gladys -> sync');
    await syncNow();
  }
});

// --- Configuration screen buttons --------------------------------------------
gladys.onAction('test_connection', () => service.testConnection());

gladys.onAction('sync_now', async () => {
  try {
    const { published, day } = await service.sync();
    await publishTransports();
    return localize((language) =>
      pick(language, {
        en: `Sync done: ${published} reading(s) published${day ? `, last day ${day.date}` : ''}.`,
        fr: `Synchronisation terminée : ${published} relevé(s) publié(s)${day ? `, dernier jour ${day.date}` : ''}.`,
        de: `Synchronisierung fertig: ${published} Messwert(e) veröffentlicht${day ? `, letzter Tag ${day.date}` : ''}.`,
        es: `Sincronización terminada: ${published} lectura(s) publicada(s)${day ? `, último día ${day.date}` : ''}.`,
      }),
    );
  } catch (err) {
    return explainError(err);
  }
});

// --- Scene actions -----------------------------------------------------------
for (const [actionKey, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(actionKey, (fields) => handler(service, { fields }));
}

// --- Dashboard widget --------------------------------------------------------
for (const [widgetKey, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(widgetKey, (request) => widget.get(service, request));
  gladys.onWidgetAction(widgetKey, (actionKey, params, { settings }) =>
    widget.action(service, { actionKey, params, settings }),
  );
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
    await store.load();
    await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, service.config));
    await service.refreshContracts().catch((err) => logger.warn('Contracts', err.message));
    await service.publishHolidays().catch((err) => logger.warn('Holidays', err.message));
    await service.checkTariff();
    startTimers();
    await syncNow();
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

// Sync, report the status, then plan the next one.
async function syncNow() {
  clearTimeout(syncTimer);
  let delay = service.config.sync_interval_hours * HOUR_MS;
  if (!isConfigured(service.config)) {
    await gladys.setConnectionStatus(false, MESSAGES.notConfigured).catch(() => {});
    gladys.requestWidgetRefresh(ENERCOOP_WIDGET);
    return;
  }
  try {
    await service.sync();
    await gladys.setConnectionStatus(true).catch(() => {});
  } catch (err) {
    delay = Math.min(delay, RETRY_DELAY_MS);
    await gladys.setConnectionStatus(false, explainError(err)).catch(() => {});
  } finally {
    await publishTransports();
    syncTimer = setTimeout(syncNow, delay);
    syncTimer.unref?.();
  }
}

async function publishTransports() {
  const entries = service.transportEntries();
  if (entries.length > 0) {
    // The meter may not be created yet: the badge is cosmetic, never fatal.
    await gladys.publishTransports(entries).catch((err) => logger.debug('Transports', err.message));
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
  clearTimeout(syncTimer);
  syncTimer = null;
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
