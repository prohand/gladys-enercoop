// -----------------------------------------------------------------------------
// What the integration remembers across restarts, in /data/state.json.
//
// The container rootfs is read-only: /data is the one writable volume. The
// state is small and rebuildable (Enedis keeps the readings), so a missing or
// broken file simply starts afresh — a restart then re-reads `history_days`.
//
//   - lastSync / lastError: when the meter was last read, and how it failed;
//   - lastIntervalEnd: the end of the newest reading published, per PRM and
//     granularity, so the next sync only asks for what is new;
//   - days: the daily totals of the last 31 days (widget chart, triggers);
//   - lastAnnouncedDay / lastThresholdDay: the scene events already fired,
//     so a restart never fires them twice.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'state' });

export const KEPT_DAYS = 31;

export function emptyState() {
  return {
    lastSync: null,
    lastError: null,
    lastIntervalEnd: {},
    days: {},
    lastAnnouncedDay: null,
    lastThresholdDay: null,
  };
}

export function createStore(dir = process.env.DATA_DIR ?? '/data') {
  const file = join(dir, 'state.json');
  let state = emptyState();

  return {
    get state() {
      return state;
    },

    async load() {
      try {
        state = { ...emptyState(), ...JSON.parse(await readFile(file, 'utf8')) };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn(`Unreadable ${file}, starting afresh: ${err.message}`);
        }
        state = emptyState();
      }
      return state;
    },

    async save() {
      // Keep the last KEPT_DAYS days only.
      const days = Object.keys(state.days).sort();
      for (const date of days.slice(0, Math.max(0, days.length - KEPT_DAYS))) {
        delete state.days[date];
      }
      try {
        await mkdir(dir, { recursive: true });
        // Write then rename: a crash mid-write never leaves half a file.
        await writeFile(`${file}.tmp`, JSON.stringify(state));
        await rename(`${file}.tmp`, file);
      } catch (err) {
        logger.warn(`Could not save ${file}: ${err.message}`);
      }
    },

    reset() {
      state = emptyState();
    },
  };
}
