// Answers of Conso API, in the "Mesure synchrone V2" format Enedis serves
// since October 2026 (copied from real answers, PRM anonymized).

export const PRM = '11111111111111';

/** A JWT-shaped token whose `sub` lists the PRMs it opens (unsigned). */
export function makeToken(prms = [PRM]) {
  const part = (object) => Buffer.from(JSON.stringify(object)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part({ sub: prms })}.signature`;
}

export function dailyAnswer(points) {
  return {
    idPrm: PRM,
    etapeMetier: 'BRUT',
    typeValeur: 'GLOBALE',
    modeCalcul: 'DIFF.INDEX',
    pas: 'P1D',
    grandeur: [
      {
        grandeurMetier: 'CONS',
        grandeurPhysique: 'EA',
        unite: 'Wh',
        points: points.map(([d, v]) => ({ d, v: v === null ? null : String(v) })),
        calendrier: [],
      },
    ],
    contexte: [],
  };
}

export function loadCurveAnswer(points, period = 'PT30M') {
  return {
    idPrm: PRM,
    etapeMetier: 'BRUT',
    modeCalcul: 'MESURE',
    grandeur: [
      {
        grandeurMetier: 'CONS',
        grandeurPhysique: 'PA',
        unite: 'W',
        points: points.map(([d, v]) => ({
          d,
          v: v === null ? null : String(v),
          p: period,
          n: 'B',
          iv: '0',
          ec: '0',
        })),
        calendrier: [],
      },
    ],
    contexte: [],
  };
}

/** A whole local day of load curve at a constant power (W). */
export function dayOfLoadCurve(date, watts) {
  const points = [];
  for (let slot = 1; slot <= 48; slot += 1) {
    const minutes = slot * 30;
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    const label = minutes === 1440 ? `${nextDay(date)} 00:00:00` : `${date} ${hh}:${mm}:00`;
    points.push([label, watts]);
  }
  return points;
}

function nextDay(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * A fake fetch answering from a router `(type, params) => answer | Response`,
 * recording every request.
 */
export function createFakeFetch(router) {
  const calls = [];
  const fakeFetch = async (url, options) => {
    const parsed = new URL(url);
    const type = parsed.pathname.split('/').pop();
    const params = Object.fromEntries(parsed.searchParams);
    calls.push({ url, type, params, headers: options?.headers });
    const answer = await router(type, params);
    if (answer instanceof Response) {
      return answer;
    }
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  fakeFetch.calls = calls;
  return fakeFetch;
}

export function errorResponse(status, body) {
  return new Response(JSON.stringify(body), { status });
}
