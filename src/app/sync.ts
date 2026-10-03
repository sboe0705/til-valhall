/**
 * Bookkeeping and decisions for the optional Google Drive sync.
 *
 * The data itself travels as the existing backup envelope (`backup.ts`); this
 * module only knows *when* to send or fetch it. Everything that decides is a
 * pure function, and the one thing that is stored – `SyncMeta` – takes its
 * `Storage` as an argument, like `backup.ts` does.
 */

/* --- keys --- */

/**
 * Deliberately *outside* the `til-valhall.` prefix. A backup collects that whole
 * prefix and `applyBackup()` wipes it, so a key inside it would put the access
 * token into every exported file and lose the sync's base version on every
 * restore – including the restore a download itself performs.
 */
export const SYNC_KEY = 'til-valhall-sync';

/** Renew a little early, so a token does not expire between list and upload. */
const TOKEN_MARGIN_MS = 60_000;

/* --- types --- */

export interface SyncMeta {
  /** The connected Google account – shown in the Impressum, used as `login_hint`. */
  email: string;
  token: string | null;
  /** ISO timestamp; the browser flow has no refresh token, so this is final. */
  tokenExpiresAt: string | null;
  /**
   * Drive's `version` of the remote file as of the last sync. `null` until the
   * first sync – which is what makes the first connection ask instead of guess.
   */
  baseVersion: string | null;
  /** Local edits since the last sync. Survives restarts, so offline edits are kept. */
  dirty: boolean;
  /** ISO timestamp of the latest local edit – the local side of a conflict. */
  lastEditAt: string | null;
  lastSyncedAt: string | null;
}

export interface RemoteFile {
  id: string;
  version: string;
}

export type SyncAction = 'idle' | 'upload' | 'download' | 'ask' | 'conflict';

/* --- storage --- */

export function emptyMeta(email: string): SyncMeta {
  return {
    email,
    token: null,
    tokenExpiresAt: null,
    baseVersion: null,
    dirty: false,
    lastEditAt: null,
    lastSyncedAt: null,
  };
}

/** The stored meta, or `null` when no account is connected or the entry is garbage. */
export function readMeta(storage: Storage): SyncMeta | null {
  const raw = storage.getItem(SYNC_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const meta = parsed as Partial<SyncMeta>;
    if (typeof meta.email !== 'string') return null;
    return { ...emptyMeta(meta.email), ...meta };
  } catch {
    return null;
  }
}

export function writeMeta(storage: Storage, meta: SyncMeta): void {
  storage.setItem(SYNC_KEY, JSON.stringify(meta));
}

export function clearMeta(storage: Storage): void {
  storage.removeItem(SYNC_KEY);
}

/* --- decisions --- */

export function tokenValid(meta: SyncMeta, now: Date = new Date()): boolean {
  if (!meta.token || !meta.tokenExpiresAt) return false;
  return Date.parse(meta.tokenExpiresAt) - TOKEN_MARGIN_MS > now.getTime();
}

/**
 * What to do, given the local bookkeeping and the remote file's current version.
 *
 * - No remote file: this device seeds it.
 * - Never synced, but a remote file exists: ask. A fresh device holds the seed
 *   plan, and silently uploading it would overwrite real history.
 * - Remote unchanged: upload if there are local edits.
 * - Remote changed: download, unless there are local edits too – then it is a
 *   conflict, settled by `conflictWinner()`.
 */
export function decideSync(meta: SyncMeta, remote: RemoteFile | null): SyncAction {
  if (remote === null) return 'upload';
  if (meta.baseVersion === null) return 'ask';
  if (remote.version === meta.baseVersion) return meta.dirty ? 'upload' : 'idle';
  return meta.dirty ? 'conflict' : 'download';
}

/**
 * Newest wins. The remote side is dated by the envelope's `exportedAt`, which
 * the other device stamped when it uploaded – no earlier than its last edit.
 * A tie goes to the remote file: it is already shared, the local edit is not.
 */
export function conflictWinner(
  lastEditAt: string | null,
  remoteExportedAt: string,
): 'local' | 'remote' {
  if (lastEditAt === null) return 'remote';
  return Date.parse(lastEditAt) > Date.parse(remoteExportedAt) ? 'local' : 'remote';
}
