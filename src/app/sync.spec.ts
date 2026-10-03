import { describe, expect, it } from 'vitest';

import {
  RANKS_KEY,
  TRAINING_KEY,
  applyBackup,
  collectBackup,
  parseBackup,
} from './backup';
import {
  SYNC_KEY,
  clearMeta,
  conflictWinner,
  decideSync,
  emptyMeta,
  readMeta,
  tokenValid,
  writeMeta,
  type SyncMeta,
} from './sync';

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

const meta = (changes: Partial<SyncMeta> = {}): SyncMeta => ({
  ...emptyMeta('odin@example.com'),
  ...changes,
});

const remote = (version: string) => ({ id: 'f-1', version });

describe('decideSync', () => {
  it('seeds a missing remote file, synced before or not', () => {
    expect(decideSync(meta(), null)).toBe('upload');
    expect(decideSync(meta({ baseVersion: '4' }), null)).toBe('upload');
  });

  it('asks on the first connection when Drive already holds a state', () => {
    expect(decideSync(meta(), remote('4'))).toBe('ask');
    expect(decideSync(meta({ dirty: true }), remote('4'))).toBe('ask');
  });

  it('uploads local edits against an unchanged remote, else does nothing', () => {
    expect(decideSync(meta({ baseVersion: '4' }), remote('4'))).toBe('idle');
    expect(decideSync(meta({ baseVersion: '4', dirty: true }), remote('4'))).toBe(
      'upload',
    );
  });

  it('downloads a changed remote, unless both sides changed', () => {
    expect(decideSync(meta({ baseVersion: '4' }), remote('6'))).toBe('download');
    expect(decideSync(meta({ baseVersion: '4', dirty: true }), remote('6'))).toBe(
      'conflict',
    );
  });
});

describe('conflictWinner', () => {
  it('lets the newer side win and gives a tie to the remote', () => {
    const remoteAt = '2026-10-03T10:00:00.000Z';
    expect(conflictWinner('2026-10-03T10:00:01.000Z', remoteAt)).toBe('local');
    expect(conflictWinner('2026-10-03T09:59:59.000Z', remoteAt)).toBe('remote');
    expect(conflictWinner(remoteAt, remoteAt)).toBe('remote');
    expect(conflictWinner(null, remoteAt)).toBe('remote');
  });
});

describe('tokenValid', () => {
  const now = new Date('2026-10-03T10:00:00.000Z');

  it('treats a token as gone a minute before it expires', () => {
    const at = (iso: string) => meta({ token: 't', tokenExpiresAt: iso });
    expect(tokenValid(at('2026-10-03T10:30:00.000Z'), now)).toBe(true);
    expect(tokenValid(at('2026-10-03T10:00:30.000Z'), now)).toBe(false);
    expect(tokenValid(meta(), now)).toBe(false);
  });
});

describe('meta storage', () => {
  it('round-trips and fills fields an older entry lacks', () => {
    const storage = fakeStorage();
    writeMeta(storage, meta({ baseVersion: '7', dirty: true }));
    expect(readMeta(storage)).toEqual(meta({ baseVersion: '7', dirty: true }));

    storage.setItem(SYNC_KEY, JSON.stringify({ email: 'odin@example.com' }));
    expect(readMeta(storage)).toEqual(meta());

    clearMeta(storage);
    expect(readMeta(storage)).toBeNull();
  });

  it('ignores garbage', () => {
    expect(readMeta(fakeStorage({ [SYNC_KEY]: '{nope' }))).toBeNull();
    expect(readMeta(fakeStorage({ [SYNC_KEY]: '{"token":"t"}' }))).toBeNull();
  });

  it('stays out of backups and survives a restore', () => {
    const training = JSON.stringify({ state: { schemaVersion: 1 } });
    const storage = fakeStorage({ [TRAINING_KEY]: training, [RANKS_KEY]: '{}' });
    writeMeta(storage, meta({ token: 'secret', baseVersion: '3' }));

    const backup = collectBackup(storage);
    expect(Object.keys(backup.data)).not.toContain(SYNC_KEY);
    expect(JSON.stringify(backup)).not.toContain('secret');

    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error('backup did not parse');
    applyBackup(storage, parsed.backup);
    expect(readMeta(storage)?.baseVersion).toBe('3');
  });
});
