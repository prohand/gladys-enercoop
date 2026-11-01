// -----------------------------------------------------------------------------
// What the user reads when something is missing, in the four languages of the
// interface: under the Configuration button, in the widget and in the scene
// logs.
//
// A message says what to DO, not only what happened.
// -----------------------------------------------------------------------------

import { texts } from '../i18n.js';

/** An error carrying its own multi-language message. */
export class UserError extends Error {
  constructor(message, cause) {
    super(message.en, { cause });
    this.name = 'UserError';
    this.userMessage = message;
  }
}

export const MESSAGES = {
  noContract: texts(
    'No Enercoop contract in Gladys yet: in the Energy settings, add one to your electricity meter to see prices and off-peak hours.',
    'Pas encore de contrat Enercoop dans Gladys : dans les réglages Énergie, ajoutez-en un à votre compteur électrique pour voir les prix et les heures creuses.',
    'Noch kein Enercoop-Vertrag in Gladys: Ordne in den Energie-Einstellungen deinem Stromzähler einen zu, um Preise und Niedertarifzeiten zu sehen.',
    'Todavía no hay contrato de Enercoop en Gladys: en los ajustes de Energía, asigne uno a su contador eléctrico para ver los precios y las horas valle.',
  ),
};
