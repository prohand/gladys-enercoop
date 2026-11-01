// -----------------------------------------------------------------------------
// What the user reads when something goes wrong, in the four languages of the
// interface: under the Configuration buttons, in the connection status, in
// the widget and in the scene logs.
//
// An error says what to DO, not only what happened: a 401 is a token to
// renew, a 404 from Gladys a device to create, a refused load curve a setting
// to change.
// -----------------------------------------------------------------------------

import { GladysApiError } from '@gladysassistant/integration-sdk';
import { ConsoApiError } from '../conso/client.js';
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
  notConfigured: texts(
    'Enter the PRM of your meter and your Conso API token first.',
    "Renseignez d'abord le PRM de votre compteur et votre jeton Conso API.",
    'Gib zuerst die PRM deines Zählers und dein Conso-API-Token ein.',
    'Introduzca primero el PRM de su contador y su token de Conso API.',
  ),
  invalidPrm: texts(
    'The PRM must be the 14 digits printed on your Enercoop bill.',
    'Le PRM doit comporter les 14 chiffres indiqués sur votre facture Enercoop.',
    'Die PRM muss aus den 14 Ziffern deiner Enercoop-Rechnung bestehen.',
    'El PRM debe tener los 14 dígitos que figuran en su factura de Enercoop.',
  ),
  tokenOtherPrm: texts(
    'This token gives access to another PRM: check the PRM, or give your consent again on conso.boris.sh.',
    'Ce jeton donne accès à un autre PRM : vérifiez le PRM, ou redonnez votre consentement sur conso.boris.sh.',
    'Dieses Token gilt für eine andere PRM: Prüfe die PRM oder erteile die Zustimmung auf conso.boris.sh erneut.',
    'Este token da acceso a otro PRM: compruebe el PRM o vuelva a dar su consentimiento en conso.boris.sh.',
  ),
  unauthorized: texts(
    'Conso API refused the token (expired or revoked): give your consent again on conso.boris.sh and paste the new token.',
    'Conso API refuse le jeton (expiré ou révoqué) : redonnez votre consentement sur conso.boris.sh et collez le nouveau jeton.',
    'Conso API lehnt das Token ab (abgelaufen oder widerrufen): Erteile die Zustimmung auf conso.boris.sh erneut und füge das neue Token ein.',
    'Conso API rechaza el token (caducado o revocado): vuelva a dar su consentimiento en conso.boris.sh y pegue el nuevo token.',
  ),
  loadCurveRefused: texts(
    'Enedis refused the load curve: enable the half-hourly data collection in your Enedis account, or choose the daily readings.',
    'Enedis refuse la courbe de charge : activez la collecte de la consommation horaire dans votre espace Enedis, ou choisissez les relevés quotidiens.',
    'Enedis lehnt den Lastgang ab: Aktiviere die halbstündliche Datenerfassung in deinem Enedis-Konto oder wähle die Tageswerte.',
    'Enedis rechaza la curva de carga: active la recogida de datos horarios en su cuenta de Enedis o elija las lecturas diarias.',
  ),
  badRequest: (detail) =>
    texts(
      `Enedis refused the request: ${detail}`,
      `Enedis a refusé la demande : ${detail}`,
      `Enedis hat die Anfrage abgelehnt: ${detail}`,
      `Enedis ha rechazado la solicitud: ${detail}`,
    ),
  unavailable: texts(
    'Enedis or Conso API is unavailable right now. The integration will try again later.',
    "Enedis ou Conso API est indisponible pour le moment. L'intégration réessaiera plus tard.",
    'Enedis oder Conso API ist gerade nicht erreichbar. Die Integration versucht es später erneut.',
    'Enedis o Conso API no está disponible en este momento. La integración lo volverá a intentar más tarde.',
  ),
  network: texts(
    'Conso API cannot be reached: check the Internet access of Gladys.',
    "Conso API est injoignable : vérifiez l'accès Internet de Gladys.",
    'Conso API ist nicht erreichbar: Prüfe den Internetzugang von Gladys.',
    'No se puede acceder a Conso API: compruebe el acceso a Internet de Gladys.',
  ),
  deviceNotCreated: texts(
    'Readings received, but the meter is not created in Gladys yet: open the Discovery tab of the integration and create it.',
    "Relevés reçus, mais le compteur n'est pas encore créé dans Gladys : ouvrez l'onglet Découverte de l'intégration et créez-le.",
    'Messwerte empfangen, aber der Zähler ist in Gladys noch nicht angelegt: Öffne den Reiter Erkennung der Integration und lege ihn an.',
    'Lecturas recibidas, pero el contador aún no está creado en Gladys: abra la pestaña Descubrimiento de la integración y créelo.',
  ),
  noContract: texts(
    'No Enercoop contract in Gladys yet: add one to the meter (Energy settings) to see prices and off-peak hours.',
    'Pas encore de contrat Enercoop dans Gladys : ajoutez-en un au compteur (réglages Énergie) pour voir les prix et les heures creuses.',
    'Noch kein Enercoop-Vertrag in Gladys: Füge dem Zähler einen hinzu (Energie-Einstellungen), um Preise und Niedertarifzeiten zu sehen.',
    'Todavía no hay contrato de Enercoop en Gladys: añada uno al contador (ajustes de Energía) para ver los precios y las horas valle.',
  ),
  unknown: (detail) =>
    texts(
      `Unexpected error: ${detail}`,
      `Erreur inattendue : ${detail}`,
      `Unerwarteter Fehler: ${detail}`,
      `Error inesperado: ${detail}`,
    ),
};

/**
 * The multi-language message of any error the sync can meet.
 * @param {Error} err
 * @param {{ loadCurve?: boolean }} [context]
 */
export function explainError(err, { loadCurve = false } = {}) {
  if (err instanceof UserError) {
    return err.userMessage;
  }
  if (err instanceof ConsoApiError) {
    if (err.status === 401) {
      return MESSAGES.unauthorized;
    }
    if (err.status >= 500 || err.status === 429) {
      return MESSAGES.unavailable;
    }
    if (loadCurve && (err.status === 400 || err.status === 403 || err.status === 404)) {
      return MESSAGES.loadCurveRefused;
    }
    return MESSAGES.badRequest(err.message.slice(0, 150));
  }
  if (err instanceof GladysApiError && err.status === 404) {
    return MESSAGES.deviceNotCreated;
  }
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || err instanceof TypeError) {
    // fetch() rejects with a TypeError when the host cannot be reached.
    return MESSAGES.network;
  }
  return MESSAGES.unknown(String(err?.message ?? err).slice(0, 150));
}
