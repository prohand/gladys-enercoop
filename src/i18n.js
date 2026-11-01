// -----------------------------------------------------------------------------
// The languages every user-facing text is written in.
//
// Gladys renders a multi-language object in the reader's own language and
// falls back to English for any other one. Every message this integration
// returns — action answers, connection status, widget texts — is such an
// object, with one key per language below. The reports are long sentences
// built from parts that each depend on the language, so they are written once
// per language through `localize`, and the parts choose their wording with
// `pick`.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, English first: it is the fallback. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * The text of one language, English when the object has none for it.
 *
 * @param {string} language a key of {@link LANGUAGES}, or anything else
 * @param {Record<string, string>} texts one text per language, `en` included
 * @returns {string}
 */
export function pick(language, texts) {
  return texts[language] ?? texts.en;
}

/**
 * One multi-language object, built by calling `build` once per language.
 *
 * @param {(language: string) => string} build the text in one language
 * @returns {Record<string, string>} `{ en, fr, de, es }`
 */
export function localize(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

/**
 * A multi-language object from its four texts, in the order of
 * {@link LANGUAGES}.
 *
 * @returns {{ en: string, fr: string, de: string, es: string }}
 */
export function texts(en, fr, de, es) {
  return { en, fr, de, es };
}

/**
 * A number written the way a reader of `language` writes it (`12,5` in
 * French, `12.5` in English).
 *
 * @param {string} language a key of {@link LANGUAGES}
 * @param {number} value
 * @param {number} [digits] maximum fraction digits
 * @returns {string}
 */
export function formatNumber(language, value, digits = 2) {
  return new Intl.NumberFormat(LANGUAGES.includes(language) ? language : 'en', {
    maximumFractionDigits: digits,
  }).format(value);
}
