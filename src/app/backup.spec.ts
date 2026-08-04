import { describe, expect, it } from 'vitest';

import {
  RANKS_KEY,
  TRAINING_KEY,
  applyBackup,
  backupFilename,
  collectBackup,
  parseBackup,
  serializeBackup,
} from './backup';

/** Minimal `Storage` – the DOM one is not needed to exercise the round trip. */
function fakeStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage;
}

const TRAINING = JSON.stringify({
  state: { schemaVersion: 1, activePlanId: 'plan-default' },
  bookedXp: { 's-1': 140 },
  advancedBy: { 's-1': 'day-1' },
});
const RANKS = JSON.stringify({ state: { week: { period: '2026-W32', xp: 140 } } });

const filled = () => fakeStorage({ [TRAINING_KEY]: TRAINING, [RANKS_KEY]: RANKS });

/** Everything in a storage, as a plain object. */
function dump(storage: Storage): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    out[key] = storage.getItem(key)!;
  }
  return out;
}

describe('export', () => {
  it('unwraps both slices into one nested document', () => {
    const backup = collectBackup(filled(), new Date(2026, 7, 4, 11, 30));

    expect(backup.app).toBe('til-valhall');
    expect(backup.format).toBe(1);
    expect(backup.exportedAt).toBe(new Date(2026, 7, 4, 11, 30).toISOString());
    expect(backup.data[TRAINING_KEY]).toEqual(JSON.parse(TRAINING));
    expect(backup.data[RANKS_KEY]).toEqual(JSON.parse(RANKS));
  });

  it('picks up any app key by prefix and ignores foreign ones', () => {
    const storage = filled();
    storage.setItem('til-valhall.future', '{"a":1}');
    storage.setItem('someone-else', '{"b":2}');

    const backup = collectBackup(storage);

    expect(Object.keys(backup.data).sort()).toEqual([
      'til-valhall.future',
      RANKS_KEY,
      TRAINING_KEY,
    ]);
  });

  it('names the file after the local calendar date', () => {
    // 00:30 CEST is still the previous day in UTC – `toISOString()` would slip.
    expect(backupFilename(new Date(2026, 7, 4, 0, 30))).toBe(
      'til-valhall-2026-08-04.json',
    );
  });
});

describe('round trip', () => {
  it('restores the exact bytes through file and back', () => {
    const source = filled();
    const parsed = parseBackup(serializeBackup(collectBackup(source)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = fakeStorage();
    applyBackup(target, parsed.backup);

    expect(dump(target)).toEqual(dump(source));
  });

  it('replaces the app keys instead of merging into them', () => {
    const target = fakeStorage({
      [TRAINING_KEY]: '{"state":{"schemaVersion":1},"bookedXp":{}}',
      // A slice the backup does not know about: leaving it would pair restored
      // training data with stale ranks.
      'til-valhall.stale': '{"x":1}',
      'someone-else': 'untouched',
    });

    applyBackup(target, collectBackup(filled()));

    expect(dump(target)).toEqual({
      [TRAINING_KEY]: TRAINING,
      [RANKS_KEY]: RANKS,
      'someone-else': 'untouched',
    });
  });
});

describe('validation', () => {
  const envelope = (data: unknown, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ app: 'til-valhall', format: 1, exportedAt: '', data, ...extra });

  it('refuses a file that is not JSON', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it.each([
    ['an empty object', '{}'],
    ['a bare array', '[]'],
    ['a foreign app', JSON.stringify({ app: 'other', format: 1, data: {} })],
    ['another envelope format', envelope({}, { format: 2 })],
    ['a missing data object', envelope(null)],
    ['a key outside the prefix', envelope({ evil: {} })],
  ])('refuses %s', (_label, text) => {
    expect(parseBackup(text)).toEqual({ ok: false, reason: 'not-a-backup' });
  });

  it.each([
    ['no training slice', envelope({ [RANKS_KEY]: { state: null } })],
    [
      'another schema version',
      envelope({ [TRAINING_KEY]: { state: { schemaVersion: 2 } } }),
    ],
  ])('refuses %s rather than letting afterHydrate wipe the data', (_label, text) => {
    expect(parseBackup(text)).toEqual({ ok: false, reason: 'wrong-schema' });
  });
});
