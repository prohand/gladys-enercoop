// -----------------------------------------------------------------------------
// Dashboard widget `enercoop` (manifest `widgets`, Gladys 5.1+).
//
// Declarative content the core renders with its own theme: the last day read,
// the price and the tariff period right now (from the user's Enercoop
// contract), the last 14 days as bars, a status list (contract, next change,
// last sync) and a "Sync now" button.
//
// The content is cached by the core until `ttl_seconds`; the service nudges it
// (`requestWidgetRefresh`) after every sync and every tariff switch.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { isConfigured, maskPrm } from '../config.js';
import { formatNumber, localize, pick, texts } from '../i18n.js';
import { MESSAGES } from '../enercoop/messages.js';
import { PERIODS, PERIOD_SHORT } from '../enercoop/tariffs.js';
import { addDays, localParts, localToInstant, today } from '../time.js';

const logger = createLogger({ name: 'widget' });

export const ENERCOOP_WIDGET = 'enercoop';

/** Keys of the `button` actions the content declares. */
export const WIDGET_ACTIONS = { SYNC: 'sync' };

const CHART_DAYS = 14;

const PERIOD_COLORS = {
  [PERIODS.BASE]: WIDGET_COLORS.PRIMARY,
  [PERIODS.PEAK]: WIDGET_COLORS.WARNING,
  [PERIODS.OFF_PEAK]: WIDGET_COLORS.SUCCESS,
};

function shortDateTime(iso) {
  const { date, time } = localParts(Date.parse(iso));
  return `${date.slice(8, 10)}/${date.slice(5, 7)} ${time}`;
}

function statusItems(service, tariff, language) {
  const state = service.store.state;
  const name = service.contractName();
  const items = [
    {
      label: texts('Contract', 'Contrat', 'Vertrag', 'Contrato'),
      icon: 'file-text',
      // The card is titled Enercoop already: the offer alone fits the row.
      value: name
        ? pick(language, name).replace(/^Enercoop – /, '')
        : texts('None', 'Aucun', 'Keiner', 'Ninguno'),
      color: name ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
    },
  ];
  if (tariff?.next) {
    const at = localParts(Date.parse(tariff.valid_until)).time;
    items.push({
      label: texts('Next change', 'Prochain changement', 'Nächster Wechsel', 'Próximo cambio'),
      icon: 'clock',
      value: `${pick(language, service.periodLabel(tariff.next.period))} · ${at}`,
      color: PERIOD_COLORS[tariff.next.period],
    });
  }
  items.push({
    label: texts('Meter', 'Compteur', 'Zähler', 'Contador'),
    icon: 'hash',
    value: maskPrm(service.config.prm),
    color: WIDGET_COLORS.NEUTRAL,
  });
  if (state.lastError) {
    items.push({
      label: texts(
        'Last sync',
        'Dernière synchro',
        'Letzte Synchronisierung',
        'Última sincronización',
      ),
      icon: 'alert-triangle',
      value: texts('Failed', 'En échec', 'Fehlgeschlagen', 'Fallida'),
      color: WIDGET_COLORS.DANGER,
    });
  } else {
    items.push({
      label: texts(
        'Last sync',
        'Dernière synchro',
        'Letzte Synchronisierung',
        'Última sincronización',
      ),
      icon: 'refresh-cw',
      value: state.lastSync
        ? shortDateTime(state.lastSync)
        : texts('Not yet', 'Pas encore', 'Noch nicht', 'Todavía no'),
      color: state.lastSync ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    });
  }
  return items;
}

/**
 * The widget content.
 * @param {ReturnType<import('../enercoop/service.js').createService> & { store }} service
 * @param {{ language?: string }} request
 */
export function buildContent(service, { language = 'en' } = {}) {
  const config = service.config;
  if (!isConfigured(config)) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: MESSAGES.notConfigured }],
    };
  }
  const state = service.store.state;
  const tariff = service.tariffNow();
  const end = today(service.now());
  const dates = Array.from({ length: CHART_DAYS }, (_, i) => addDays(end, i - CHART_DAYS));
  const known = dates.filter((date) => state.days[date] !== undefined);
  const lastDay = known.at(-1);

  const components = [
    {
      type: 'value',
      label: lastDay
        ? localize(
            (lang) =>
              `${pick(lang, { en: 'Day', fr: 'Jour', de: 'Tag', es: 'Día' })} ${lastDay.slice(8, 10)}/${lastDay.slice(5, 7)}`,
          )
        : texts('Last day', 'Dernier jour', 'Letzter Tag', 'Último día'),
      icon: 'zap',
      value: lastDay ? state.days[lastDay] : '—',
      unit: 'kWh',
      color: WIDGET_COLORS.PRIMARY,
    },
  ];
  if (tariff) {
    components.push(
      {
        type: 'value',
        label: texts('Price now', 'Prix actuel', 'Aktueller Preis', 'Precio actual'),
        icon: 'tag',
        value: Number(tariff.price.toFixed(4)),
        unit: '€/kWh',
        color: PERIOD_COLORS[tariff.period],
      },
      {
        type: 'value',
        label: texts('Period', 'Période', 'Zeitraum', 'Periodo'),
        icon: 'clock',
        value: PERIOD_SHORT[tariff.period],
        color: PERIOD_COLORS[tariff.period],
      },
    );
  }
  if (known.length > 0) {
    components.push({
      type: 'chart',
      chart_type: 'bar',
      title: texts('Last 14 days', '14 derniers jours', 'Letzte 14 Tage', 'Últimos 14 días'),
      unit: 'kWh',
      series: [
        {
          name: texts('Consumption', 'Consommation', 'Verbrauch', 'Consumo'),
          points: known.map((date) => ({
            t: localToInstant(date).toISOString(),
            v: state.days[date],
          })),
        },
      ],
    });
  }
  if (state.lastError) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: truncate(state.lastError.message, 80),
    });
  }
  components.push(
    { type: 'status', items: statusItems(service, tariff, language) },
    {
      type: 'button',
      label: texts('Sync now', 'Synchroniser', 'Jetzt abrufen', 'Sincronizar'),
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.SYNC },
    },
  );
  return {
    // Nudged after every sync and tariff switch: the TTL is a safety net,
    // short enough for the "next change" row to stay right.
    ttl_seconds: 600,
    components,
  };
}

function truncate(message, length) {
  return Object.fromEntries(
    Object.entries(message).map(([lang, text]) => [
      lang,
      text.length > length ? `${text.slice(0, length - 1)}…` : text,
    ]),
  );
}

export const WIDGETS = {
  [ENERCOOP_WIDGET]: {
    async get(service, request) {
      logger.debug(`onWidgetGet <- ${ENERCOOP_WIDGET}`);
      return buildContent(service, request);
    },

    async action(service, { actionKey }) {
      logger.info(`onWidgetAction <- ${ENERCOOP_WIDGET}.${actionKey}`);
      if (actionKey !== WIDGET_ACTIONS.SYNC) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      const { published, day } = await service.sync();
      return localize((language) =>
        day
          ? pick(language, {
              en: `${published} reading(s) received, ${day.date}: ${formatNumber(language, day.kwh)} kWh`,
              fr: `${published} relevé(s) reçu(s), ${day.date} : ${formatNumber(language, day.kwh)} kWh`,
              de: `${published} Messwert(e) empfangen, ${day.date}: ${formatNumber(language, day.kwh)} kWh`,
              es: `${published} lectura(s) recibida(s), ${day.date}: ${formatNumber(language, day.kwh)} kWh`,
            })
          : pick(language, {
              en: 'Up to date, nothing new from Enedis.',
              fr: 'À jour, rien de nouveau chez Enedis.',
              de: 'Aktuell, nichts Neues von Enedis.',
              es: 'Al día, nada nuevo de Enedis.',
            }),
      );
    },
  },
};
