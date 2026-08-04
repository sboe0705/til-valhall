import { toIsoDate } from '@/model/schedule';

/**
 * Backup of everything the app keeps on the device.
 *
 * The two state roots live under two separate `localStorage` keys and only make
 * sense together – a training slice restored next to a foreign rank slice would
 * book XP against the wrong ladders. A backup therefore always carries *all*
 * app keys, and restoring one replaces the whole prefix rather than merging
 * into it.
 *
 * Everything here takes its `Storage` as an argument instead of reaching for
 * the global `localStorage`, so the round trip is testable without a DOM.
 */

/* --- keys --- */

/** Every key the app owns starts with this – nothing else is ever touched. */
export const STORAGE_PREFIX = 'til-valhall.';

export const TRAINING_KEY = `${STORAGE_PREFIX}training`;
export const RANKS_KEY = `${STORAGE_PREFIX}ranks`;

/** Bump when the envelope changes shape; older files are then refused. */
export const BACKUP_FORMAT = 1;

const APP_ID = 'til-valhall';

/* --- types --- */

export interface Backup {
  app: typeof APP_ID;
  format: number;
  /** Point in time, not a calendar date – full ISO timestamp on purpose. */
  exportedAt: string;
  /** Storage key → the parsed value that was stored under it. */
  data: Record<string, unknown>;
}

export type BackupError = 'invalid-json' | 'not-a-backup' | 'wrong-schema';

export type ParseResult =
  { ok: true; backup: Backup } | { ok: false; reason: BackupError };

/* --- helpers --- */

/** All app-owned keys currently in `storage`, collected before any mutation. */
function appKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A stored value as a nested object, or the raw string when it is not one. */
function unwrap(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : raw;
  } catch {
    return raw;
  }
}

/* --- export --- */

/**
 * Read every app-owned key. The prefix is scanned rather than a fixed list so a
 * third slice would be picked up without touching this function.
 *
 * Values are stored as JSON strings by the persistence plugin; objects are
 * unwrapped so the backup file reads as one nested document instead of a wall
 * of escaped quotes. Anything that is not an object stays a verbatim string,
 * which keeps the round trip lossless for values `applyBackup` must not
 * re-encode.
 */
export function collectBackup(storage: Storage, now: Date = new Date()): Backup {
  const data: Record<string, unknown> = {};

  for (const key of appKeys(storage)) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    data[key] = unwrap(raw);
  }

  return { app: APP_ID, format: BACKUP_FORMAT, exportedAt: now.toISOString(), data };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** `til-valhall-2026-08-04.json` – local calendar date, never `toISOString()`. */
export function backupFilename(now: Date = new Date()): string {
  return `${APP_ID}-${toIsoDate(now)}.json`;
}

/* --- import --- */

/**
 * Validate a file before anything is written.
 *
 * The schema check matters more than it looks: the training store's
 * `afterHydrate` silently calls `resetAll()` when it meets an unknown
 * `schemaVersion`, so an unchecked import of a foreign file would *delete* the
 * data instead of failing. Refuse it here while the old state is still intact.
 */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  if (!isRecord(parsed)) return { ok: false, reason: 'not-a-backup' };
  if (parsed.app !== APP_ID || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'not-a-backup' };
  }

  const data = parsed.data;
  if (!isRecord(data)) return { ok: false, reason: 'not-a-backup' };
  if (!Object.keys(data).every((key) => key.startsWith(STORAGE_PREFIX))) {
    return { ok: false, reason: 'not-a-backup' };
  }

  const training = data[TRAINING_KEY];
  const state = isRecord(training) ? training.state : undefined;
  if (!isRecord(state) || state.schemaVersion !== 1) {
    return { ok: false, reason: 'wrong-schema' };
  }

  return { ok: true, backup: { ...parsed, app: APP_ID, data } as Backup };
}

/**
 * Replace the app's storage with the backup's.
 *
 * Old keys are dropped first – a leftover slice the file does not know about
 * would pair a restored training state with stale ranks. Keys outside the
 * prefix are left alone.
 */
export function applyBackup(storage: Storage, backup: Backup): void {
  for (const key of appKeys(storage)) storage.removeItem(key);

  for (const [key, value] of Object.entries(backup.data)) {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}
