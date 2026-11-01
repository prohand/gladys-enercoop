import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-enercoop';

test('the Unreleased section moves under the released version', () => {
  const before = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- A thing.\n\n[Unreleased]: ${REPO}/commits/main\n`;
  const after = rollChangelog(before, '1.0.0', '2026-11-01');
  assert.match(
    after,
    /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-11-01\n\n### Added\n\n- A thing\./,
  );
  assert.match(after, new RegExp(`\\[Unreleased\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.HEAD`));
  assert.match(after, new RegExp(`\\[1\\.0\\.0\\]: ${REPO}/releases/tag/v1\\.0\\.0`));
});

test('an empty Unreleased section still writes the version', () => {
  const after = rollChangelog('## [Unreleased]\n', '1.0.1', '2026-11-02');
  assert.match(
    after,
    /## \[1\.0\.1\] - 2026-11-02\n\n- Maintenance release, no functional change\./,
  );
});

test('CHANGELOG.md has an Unreleased section the Release workflow can roll', async () => {
  const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(changelog, /^## \[Unreleased\][ \t]*$/m);
  assert.match(changelog, /^\[Unreleased\]: /m);
});
