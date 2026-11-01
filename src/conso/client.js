// -----------------------------------------------------------------------------
// Conso API client — the Linky readings, from Enedis.
//
// Enercoop is the supplier, Enedis the network operator: the meter readings
// belong to Enedis, which only serves them to the account holder, or to a
// service the holder consented to. Conso API (https://conso.boris.sh, an open
// source relay of the Enedis "Mesure synchrone V2" API) is that service for
// individuals: the user gives their consent once on the site and gets a token
// for their PRM. This is the integration's cloud channel.
//
// Since the Enedis migration of October 2026 the endpoints carry French names
// (`consommation_quotidienne`, `courbe_de_charge_consommation`) and parameters
// (`pointId`, `dateDebut` inclusive, `dateFin` exclusive).
//
// The token is a secret: it never reaches a log line.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { readFileSync } from 'node:fs';

const logger = createLogger({ name: 'conso-api' });

export const API_URL = 'https://conso.boris.sh/api';

export const DATA_TYPES = {
  DAILY: 'consommation_quotidienne',
  LOAD_CURVE: 'courbe_de_charge_consommation',
};

// Enedis serves at most 7 days of load curve per request, and a year of daily
// readings: longer windows are split.
export const MAX_DAYS_PER_REQUEST = {
  [DATA_TYPES.DAILY]: 365,
  [DATA_TYPES.LOAD_CURVE]: 7,
};

const REQUEST_TIMEOUT_MS = 30_000;

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

// Conso API asks public apps to name themselves, so they can be told apart
// (and reached) instead of blocked.
export const USER_AGENT = `gladys-enercoop/${version} (+https://github.com/prohand/gladys-enercoop)`;

/** A non-2xx answer of Conso API (or of Enedis behind it). */
export class ConsoApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ConsoApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * The PRMs a Conso API token gives access to (its JWT `sub`), read without
 * checking the signature: only to tell the user that the token and the PRM do
 * not match, before Enedis says so with a bare 401. Empty when unreadable.
 * @param {string} token
 * @returns {string[]}
 */
export function tokenPrms(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString());
    const sub = Array.isArray(payload.sub) ? payload.sub : [payload.sub];
    return sub.filter((prm) => typeof prm === 'string');
  } catch {
    return [];
  }
}

/**
 * Fetch one window of readings.
 * @param {{ prm: string, token: string }} config
 * @param {string} type one of DATA_TYPES
 * @param {string} start local date, inclusive
 * @param {string} end local date, exclusive
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<object>} the raw Enedis answer
 */
export async function fetchReadings(config, type, start, end, { fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ pointId: config.prm, dateDebut: start, dateFin: end });
  const url = `${API_URL}/${type}?${params}`;
  logger.debug(`GET ${type} ${start} -> ${end}`);
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 200) };
  }
  if (!response.ok) {
    const detail = body?.error?.error_description ?? body?.message ?? `HTTP ${response.status}`;
    throw new ConsoApiError(response.status, detail, body);
  }
  return body;
}

/**
 * Split a window of local dates into the chunks Enedis accepts.
 * @returns {Array<[string, string]>}
 */
export function splitWindow(start, end, maxDays) {
  const chunks = [];
  let from = start;
  while (from < end) {
    const limit = new Date(Date.parse(`${from}T00:00:00Z`) + maxDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const to = limit < end ? limit : end;
    chunks.push([from, to]);
    from = to;
  }
  return chunks;
}

/**
 * Fetch a whole window, chunk after chunk (Conso API is a free service: no
 * parallel burst).
 */
export async function fetchWindow(config, type, start, end, options) {
  const answers = [];
  for (const [from, to] of splitWindow(start, end, MAX_DAYS_PER_REQUEST[type])) {
    answers.push(await fetchReadings(config, type, from, to, options));
  }
  return answers;
}
