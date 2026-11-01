// -----------------------------------------------------------------------------
// Dashboard widget `enercoop` (manifest `widgets`, Gladys 5.1+).
//
// Declarative content the core renders with its own theme: the price and the
// tariff period right now (from the user's Enercoop contract) and a status
// list (contract, next change). The consumption and its cost are not here:
// Gladys shows them with its own energy widgets, on the user's meter.
//
// The content is cached by the core until `ttl_seconds`; the service nudges it
// (`requestWidgetRefresh`) on every tariff switch and contract change.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { pick, texts } from '../i18n.js';
import { MESSAGES } from '../enercoop/messages.js';
import { PERIODS, PERIOD_SHORT } from '../enercoop/tariffs.js';
import { localParts } from '../time.js';

const logger = createLogger({ name: 'widget' });

export const ENERCOOP_WIDGET = 'enercoop';

const PERIOD_COLORS = {
  [PERIODS.BASE]: WIDGET_COLORS.PRIMARY,
  [PERIODS.PEAK]: WIDGET_COLORS.WARNING,
  [PERIODS.OFF_PEAK]: WIDGET_COLORS.SUCCESS,
};

function statusItems(service, tariff, language) {
  const items = [
    {
      label: texts('Contract', 'Contrat', 'Vertrag', 'Contrato'),
      icon: 'file-text',
      // The card is titled Enercoop already: the offer alone fits the row.
      value: pick(language, service.contractName()).replace(/^Enercoop – /, ''),
      color: WIDGET_COLORS.SUCCESS,
    },
  ];
  if (tariff.next) {
    const at = localParts(Date.parse(tariff.valid_until)).time;
    items.push({
      label: texts('Next change', 'Prochain changement', 'Nächster Wechsel', 'Próximo cambio'),
      icon: 'clock',
      value: `${pick(language, service.periodLabel(tariff.next.period))} · ${at}`,
      color: PERIOD_COLORS[tariff.next.period],
    });
  }
  return items;
}

/**
 * The widget content.
 * @param {ReturnType<import('../enercoop/service.js').createService>} service
 * @param {{ language?: string }} request
 */
export function buildContent(service, { language = 'en' } = {}) {
  const tariff = service.tariffNow();
  if (!tariff) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: MESSAGES.noContract }],
    };
  }
  return {
    // Nudged on every tariff switch: the TTL is a safety net, short enough for
    // the "next change" row to stay right.
    ttl_seconds: 600,
    components: [
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
      { type: 'status', items: statusItems(service, tariff, language) },
    ],
  };
}

export const WIDGETS = {
  [ENERCOOP_WIDGET]: {
    async get(service, request) {
      logger.debug(`onWidgetGet <- ${ENERCOOP_WIDGET}`);
      return buildContent(service, request);
    },
  },
};
