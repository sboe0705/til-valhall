import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { applyBackup, collectBackup, parseBackup, serializeBackup } from '@/app/backup';
import { DriveAuthError, createDriveClient, type DriveClient } from '@/app/drive';
import {
  clearMeta,
  conflictWinner,
  decideSync,
  emptyMeta,
  readMeta,
  tokenValid,
  writeMeta,
  type RemoteFile,
  type SyncMeta,
} from '@/app/sync';
import { useRankStore } from './ranks';
import { useTrainingStore } from './training';

/**
 * Optional sync of both state slices through the user's own Google Drive.
 *
 * The stores never learn about it: a download goes through `applyBackup()` and a
 * reload – the same path as the file import, with the same schema check – and
 * an upload is just `collectBackup()`. This store only watches the two slices
 * for edits and decides when to move the envelope.
 *
 * Not `persist`ed: its one stored value, `SyncMeta`, lives outside the app's
 * key prefix on purpose (see `SYNC_KEY`) and is written by hand.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SCOPES = `${DRIVE_SCOPE} openid email`;

/** Edits are bundled – ticking off a block's sets one by one is one upload. */
const UPLOAD_DELAY_MS = 3_000;

export type SyncStatus =
  'off' | 'connecting' | 'syncing' | 'ok' | 'offline' | 'expired' | 'ask' | 'error';

/* --- Google Identity Services --- */

let gis: Promise<void> | null = null;

/**
 * Inject the GIS script once. Only ever called for a user who signs in or is
 * already connected – nobody else causes a request to Google.
 */
function loadGis(): Promise<void> {
  gis ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gis = null;
      script.remove();
      reject(new Error('gis: load failed'));
    };
    document.head.append(script);
  });
  return gis;
}

/** Opens Google's popup – must run close to a tap, or the browser blocks it. */
async function requestToken(
  hint?: string,
): Promise<google.accounts.oauth2.TokenResponse> {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) reject(new Error(response.error));
        else if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
          reject(new Error('scope_denied'));
        } else resolve(response);
      },
      error_callback: (error) => reject(new Error(error.type)),
    });
    client.requestAccessToken({ prompt: '', login_hint: hint });
  });
}

const SIGN_IN_ERRORS: Record<string, string> = {
  popup_failed_to_open: 'Das Anmeldefenster wurde blockiert – bitte noch einmal tippen.',
  scope_denied:
    'Ohne Zugriff auf den App-Ordner in Google Drive ist kein Abgleich möglich.',
  // Closing the popup is a decision, not an error.
  popup_closed: '',
};

/* --- store --- */

export const useSyncStore = defineStore('sync', () => {
  const enabled = CLIENT_ID !== '';

  const meta = ref<SyncMeta | null>(enabled ? readMeta(localStorage) : null);
  const status = ref<SyncStatus>('off');
  const error = ref('');

  const email = computed(() => meta.value?.email ?? null);
  const lastSyncedAt = computed(() => meta.value?.lastSyncedAt ?? null);

  function save(next: SyncMeta | null): void {
    meta.value = next;
    if (next) writeMeta(localStorage, next);
    else clearMeta(localStorage);
  }

  function patch(changes: Partial<SyncMeta>): void {
    if (meta.value) save({ ...meta.value, ...changes });
  }

  /* --- the sync run --- */

  /** Bumped on every local edit, so an upload knows whether it caught all of them. */
  let edits = 0;
  let running: Promise<void> | null = null;
  let again = false;
  /** Set once a download has rewritten storage – nothing may touch it before the reload. */
  let reloading = false;

  /**
   * Run one reconcile, or queue another behind the one in flight. Never runs
   * two at once: both would list the same version and upload twice.
   */
  function sync(options: { keepalive?: boolean; force?: 'upload' | 'download' } = {}) {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await reconcile(options);
        options = { keepalive: options.keepalive };
      } while (again && status.value === 'ok');
    })().finally(() => {
      running = null;
    });
    return running;
  }

  async function reconcile(options: {
    keepalive?: boolean;
    force?: 'upload' | 'download';
  }): Promise<void> {
    const current = meta.value;
    if (!current || reloading) return;
    if (!tokenValid(current)) {
      status.value = 'expired';
      return;
    }

    const drive = createDriveClient(current.token!, { keepalive: options.keepalive });
    status.value = 'syncing';
    error.value = '';

    try {
      const remote = await drive.find();
      let action = options.force ?? decideSync(current, remote);
      let fetched: string | null = null;

      if (action === 'conflict' && remote) {
        fetched = await drive.download(remote.id);
        const parsed = parseBackup(fetched);
        action =
          parsed.ok &&
          conflictWinner(current.lastEditAt, parsed.backup.exportedAt) === 'remote'
            ? 'download'
            : 'upload';
      }

      if (action === 'ask') {
        status.value = 'ask';
        return;
      }
      if (action === 'upload') await upload(drive, remote);
      else if (action === 'download' && remote) await download(drive, remote, fetched);
      else patch({ lastSyncedAt: new Date().toISOString() });

      if (status.value === 'syncing' && !reloading) status.value = 'ok';
    } catch (e) {
      if (e instanceof DriveAuthError) {
        patch({ token: null, tokenExpiresAt: null });
        status.value = 'expired';
      } else {
        // Network or Drive hiccup: `dirty` stays set and the next trigger retries.
        status.value = 'offline';
      }
    }
  }

  async function upload(drive: DriveClient, remote: RemoteFile | null): Promise<void> {
    const seen = edits;
    const body = serializeBackup(collectBackup(localStorage));
    const file = remote ? await drive.update(remote.id, body) : await drive.create(body);
    // An edit that landed while the request was in flight is not in `body`.
    const caughtUp = seen === edits;
    patch({
      baseVersion: file.version,
      dirty: caughtUp ? false : true,
      lastEditAt: caughtUp ? null : (meta.value?.lastEditAt ?? null),
      lastSyncedAt: new Date().toISOString(),
    });
    if (!caughtUp) again = true;
  }

  /**
   * Replace local storage with the remote envelope and reload – the reload is
   * what brings both slices up through hydration, as with the file import.
   */
  async function download(
    drive: DriveClient,
    remote: RemoteFile,
    fetched: string | null,
  ): Promise<void> {
    const parsed = parseBackup(fetched ?? (await drive.download(remote.id)));
    if (!parsed.ok) {
      status.value = 'error';
      error.value = 'Der Stand in Google Drive ist unlesbar und wurde nicht übernommen.';
      return;
    }
    reloading = true;
    patch({
      baseVersion: remote.version,
      dirty: false,
      lastEditAt: null,
      lastSyncedAt: new Date().toISOString(),
    });
    applyBackup(localStorage, parsed.backup);
    location.reload();
  }

  /* --- edits --- */

  let timer: ReturnType<typeof setTimeout> | undefined;

  /** Record a local edit and schedule the upload. Also called by the file import. */
  function markDirty(): void {
    if (!meta.value || reloading) return;
    edits++;
    patch({ dirty: true, lastEditAt: new Date().toISOString() });
    if (status.value === 'ask' || status.value === 'expired') return;
    clearTimeout(timer);
    timer = setTimeout(() => void sync(), UPLOAD_DELAY_MS);
  }

  let watching = false;

  /**
   * Called after `training.refresh()` has run: the start-up roll-over is derived
   * from the date, not an edit, and counting it would make every stale device
   * look edited – a conflict with a newer Drive state it would then win.
   */
  function watch(): void {
    if (watching) return;
    watching = true;
    useTrainingStore().$subscribe(markDirty, { detached: true });
    useRankStore().$subscribe(markDirty, { detached: true });

    document.addEventListener('visibilitychange', () => {
      if (!meta.value) return;
      if (document.visibilityState === 'hidden') {
        if (meta.value.dirty) {
          clearTimeout(timer);
          void sync({ keepalive: true });
        }
      } else void sync();
    });
    window.addEventListener('online', () => {
      if (meta.value) void sync();
    });
  }

  /* --- actions --- */

  /** App start: a no-op unless sync is configured and an account is connected. */
  async function start(): Promise<void> {
    if (!enabled) return;
    watch();
    if (!meta.value) return;
    // Already consented – load GIS now so "Fortsetzen" opens its popup instantly.
    void loadGis().catch(() => undefined);
    await sync();
  }

  /** Sign in, or renew an expired token – both need a tap for Google's popup. */
  async function signIn(): Promise<void> {
    if (!enabled) return;
    const before = status.value;
    status.value = 'connecting';
    error.value = '';

    let response: google.accounts.oauth2.TokenResponse;
    try {
      response = await requestToken(meta.value?.email);
    } catch (e) {
      status.value = meta.value ? before : 'off';
      const reason = e instanceof Error ? e.message : '';
      error.value =
        SIGN_IN_ERRORS[reason] ?? 'Die Anmeldung bei Google ist fehlgeschlagen.';
      return;
    }

    const token = response.access_token;
    const tokenExpiresAt = new Date(
      Date.now() + response.expires_in * 1000,
    ).toISOString();
    try {
      const address = await createDriveClient(token).fetchEmail();
      // Another account means another Drive – start over and ask again.
      const base = meta.value?.email === address ? meta.value : emptyMeta(address);
      save({ ...base, token, tokenExpiresAt });
    } catch {
      status.value = meta.value ? 'offline' : 'off';
      error.value = 'Google ist gerade nicht erreichbar.';
      return;
    }

    watch();
    await sync();
  }

  /** First connection with a Drive state present: take it, replacing this device. */
  function chooseRemote(): Promise<void> {
    return sync({ force: 'download' });
  }

  /** First connection: this device's state wins and overwrites the Drive file. */
  function chooseLocal(): Promise<void> {
    return sync({ force: 'upload' });
  }

  /** Disconnect. Local data and the Drive file both stay where they are. */
  function signOut(): void {
    const token = meta.value?.token;
    if (token && typeof google !== 'undefined') google.accounts.oauth2.revoke(token);
    clearTimeout(timer);
    save(null);
    status.value = 'off';
    error.value = '';
  }

  return {
    enabled,
    status,
    error,
    email,
    lastSyncedAt,
    start,
    signIn,
    signOut,
    chooseRemote,
    chooseLocal,
    markDirty,
  };
});
