// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code,
// plus the store rules that are easiest to miss. The store indexer validates
// the manifest itself (CI: "Store admission checks" on pull requests), but
// only these tests know which handlers the code registers.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/config.js';
import { SCENE_ACTIONS, SCENE_TRIGGERS } from '../src/capabilities/scenes.js';
import { WIDGETS } from '../src/capabilities/widget.js';
import { HOLIDAYS_CALENDAR } from '../src/enercoop/tariffs.js';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

const keys = (list) => (list ?? []).map((entry) => entry.key).sort();

// Every multi-language object of the manifest: an object whose `en` is a string.
function multiLanguageTexts(node, path = 'manifest', found = []) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => multiLanguageTexts(item, `${path}[${i}]`, found));
  } else if (node && typeof node === 'object') {
    if (typeof node.en === 'string') {
      found.push({ path, text: node });
    } else {
      for (const [key, value] of Object.entries(node)) {
        multiLanguageTexts(value, `${path}.${key}`, found);
      }
    }
  }
  return found;
}

test('every text of the manifest is written in English, French, German and Spanish', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), path);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('catalog card: name 3-30 characters, description 10-100 per language', () => {
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const language of LANGUAGES) {
    const { length } = manifest.description[language];
    assert.ok(length >= 10 && length <= 100, `description.${language}: ${length} characters`);
  }
});

test('version, image and Gladys range agree', () => {
  assert.equal(manifest.version, pkg.version, 'manifest and package.json versions');
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-enercoop:${pkg.version}`);
  // keywords, countries: 5.3.0; energy_contracts: 5.2.0; widgets & scenes: 5.1.0.
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('the cloud tag: the readings come from Enedis through Conso API', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['energy']);
  assert.deepEqual(manifest.countries, ['FR']);
});

test('keywords: 2-30 characters, unique', () => {
  const normalized = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length);
  for (const keyword of manifest.keywords) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
});

test('the config_schema defaults are the code defaults', () => {
  const fields = manifest.config_schema.filter((field) => field.type !== 'section');
  assert.deepEqual(keys(fields), Object.keys(DEFAULT_CONFIG).sort());
  for (const field of fields) {
    if (field.default !== undefined) {
      assert.deepEqual(field.default, DEFAULT_CONFIG[field.key], field.key);
    }
    if (field.placeholder) {
      assert.ok(['string', 'number', 'secret'].includes(field.type), field.key);
    }
  }
  for (const section of manifest.config_schema.filter((field) => field.type === 'section')) {
    for (const language of LANGUAGES) {
      assert.ok(section.description[language].length <= 1000, `${section.key}.${language}`);
    }
  }
});

test('every manifest action is registered in index.js', () => {
  for (const action of manifest.actions) {
    assert.match(indexSource, new RegExp(`onAction\\('${action.key}'`), action.key);
  }
});

test('scene actions, scene triggers and widgets match their handlers', () => {
  assert.deepEqual(keys(manifest.scene_actions), Object.keys(SCENE_ACTIONS).sort());
  assert.deepEqual(keys(manifest.scene_triggers), Object.values(SCENE_TRIGGERS).sort());
  assert.deepEqual(keys(manifest.widgets), Object.keys(WIDGETS).sort());
  for (const entry of [...manifest.scene_actions, ...manifest.scene_triggers]) {
    assert.match(entry.key, /^[a-z0-9_]{1,40}$/);
  }
  for (const widget of manifest.widgets) {
    for (const language of LANGUAGES) {
      assert.ok(widget.label[language].length >= 3 && widget.label[language].length <= 30);
      assert.ok(widget.description[language].length <= 100, `${widget.key}.${language}`);
    }
  }
});

test('energy contracts: templates the store and the Gladys rule engine accept', () => {
  const { templates, calendars } = manifest.energy_contracts;
  assert.deepEqual(keys(calendars), [HOLIDAYS_CALENDAR]);
  assert.equal(new Set(keys(templates)).size, templates.length, 'unique template keys');
  for (const template of templates) {
    const where = template.key;
    assert.match(template.key, /^[a-z0-9][a-z0-9-]{0,63}$/);
    assert.equal(template.country, 'FR');
    assert.equal(template.currency, 'EUR');
    assert.equal(template.timezone, 'Europe/Paris');
    assert.equal(template.pricing_mode, 'rules');
    assert.ok(template.version.length <= 32);
    for (const language of LANGUAGES) {
      assert.ok(template.name[language].length <= 64, `${where}.name.${language}`);
      assert.ok(template.description[language].length <= 512, `${where}.description.${language}`);
    }
    const inputKeys = template.inputs.map((input) => input.key);
    assert.equal(new Set(inputKeys).size, inputKeys.length, `${where}: unique inputs`);
    for (const input of template.inputs) {
      assert.ok((input.unit ?? '').length <= 16, `${where}.${input.key}.unit`);
      for (const language of LANGUAGES) {
        assert.ok(input.label[language].length <= 64, `${where}.${input.key}.${language}`);
      }
    }
    // Every {{input:key}} names a declared input.
    for (const [, key] of JSON.stringify(template.tariff).matchAll(/\{\{input:([a-z0-9_]+)\}\}/g)) {
      assert.ok(inputKeys.includes(key), `${where}: missing input "${key}"`);
    }
    const { tariff } = template;
    assert.equal(tariff.tariff_version, 1);
    const energy = tariff.components.filter((component) => component.kind === 'consumption');
    assert.equal(energy.length, 1, `${where}: one consumption component`);
    assert.ok(energy[0].fallback, `${where}: a consumption component needs a fallback`);
    // A calendar read by a rule is listed in the tariff and in the template.
    const read = [...JSON.stringify(tariff).matchAll(/"calendar":\{"([a-z0-9-]+)"/g)].map(
      ([, key]) => key,
    );
    for (const key of read) {
      assert.ok(tariff.calendars?.includes(key), `${where}: tariff.calendars misses ${key}`);
      assert.ok(template.calendars?.includes(key), `${where}: calendars misses ${key}`);
      assert.ok(keys(calendars).includes(key), `${where}: undeclared calendar ${key}`);
    }
    for (const rule of energy[0].rules ?? []) {
      assert.ok(rule.label.length <= 64);
    }
  }
});

test('the user documentation exists in the four languages', async () => {
  for (const language of LANGUAGES) {
    const doc = await readFile(new URL(`../docs/${language}.md`, import.meta.url), 'utf8');
    assert.ok(doc.length >= 300, `docs/${language}.md is too short`);
  }
});

test('the cover is a PNG of at most 150 KB', async () => {
  const url = new URL('../cover.png', import.meta.url);
  const cover = await readFile(url);
  assert.ok((await stat(url)).size <= 150 * 1024);
  assert.deepEqual([...cover.subarray(1, 4)], [...Buffer.from('PNG')]);
  // IHDR: width and height, big-endian, at bytes 16-23.
  assert.equal(cover.readUInt32BE(16), 800);
  assert.equal(cover.readUInt32BE(20), 534);
});
